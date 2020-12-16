import crypto = require('crypto');
import fs = require('fs');
import protobuf = require('protocol-buffers');
import { PromiseSocket, TimeoutError } from 'promise-socket';
import struct = require('python-struct');
import { Socket } from 'net';
import ApConnection from './apconnection';

const keyExchangeMessages = protobuf(fs.readFileSync(`${process.cwd()}/protocol/keyexchange.proto`));

const prime = Buffer.from([
    0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc9, 0x0f, 0xda, 0xa2, 0x21, 0x68, 0xc2,
    0x34, 0xc4, 0xc6, 0x62, 0x8b, 0x80, 0xdc, 0x1c, 0xd1, 0x29, 0x02, 0x4e, 0x08, 0x8a, 0x67,
    0xcc, 0x74, 0x02, 0x0b, 0xbe, 0xa6, 0x3b, 0x13, 0x9b, 0x22, 0x51, 0x4a, 0x08, 0x79, 0x8e,
    0x34, 0x04, 0xdd, 0xef, 0x95, 0x19, 0xb3, 0xcd, 0x3a, 0x43, 0x1b, 0x30, 0x2b, 0x0a, 0x6d,
    0xf2, 0x5f, 0x14, 0x37, 0x4f, 0xe1, 0x35, 0x6d, 0x6d, 0x51, 0xc2, 0x45, 0xe4, 0x85, 0xb5,
    0x76, 0x62, 0x5e, 0x7e, 0xc6, 0xf4, 0x4c, 0x42, 0xe9, 0xa6, 0x3a, 0x36, 0x20, 0xff, 0xff,
    0xff, 0xff, 0xff, 0xff, 0xff, 0xff ]);

interface UnencryptedPacket {
    payload: Buffer;
    raw: Buffer;
}

async function readPacket(connection: PromiseSocket<Socket>): Promise<UnencryptedPacket> {
    let packetSizeRaw: string | Buffer = await connection.read(4);
    if (typeof(packetSizeRaw) === 'string')
        packetSizeRaw = Buffer.from(packetSizeRaw);

    let packetSize = packetSizeRaw.readInt32BE();
    let data = await connection.read(packetSize - 4);
    if (typeof(data) == 'string')
        data = Buffer.from(data);
    
    return {
        payload: data,
        raw: Buffer.concat([packetSizeRaw, data])
    };
}

async function clientHello(socket: PromiseSocket<Socket>, gc: Buffer): Promise<Buffer> {
    let clientHelloMessage = keyExchangeMessages.ClientHello.encode({
        build_info: {
            product: keyExchangeMessages.Product.PRODUCT_PARTNER,
            platform: keyExchangeMessages.Platform.PLATFORM_LINUX_ARM,
            version: 109800078
        },
        cryptosuites_supported: [keyExchangeMessages.Cryptosuite.CRYPTO_SUITE_SHANNON],
        login_crypto_hello: {
            diffie_hellman: {
                gc: gc,
                server_keys_known: 1
            }
        },
        client_nonce: crypto.randomBytes(0x10),
        padding: Buffer.alloc(0x1e)
    });

    const packetLength = 2 + 4 + clientHelloMessage.length;
    let buffer = Buffer.concat([Buffer.from([0, 4]), struct.pack('>I', packetLength), clientHelloMessage]);
    await socket.writeAll(buffer);
    return buffer;
}

async function clientResponse(socket: PromiseSocket<Socket>, challenge: Buffer): Promise<void> {
    let clientResponsePlaintext = keyExchangeMessages.ClientResponsePlaintext.encode({
        login_crypto_response: {
            diffie_hellman: {
                hmac: challenge
            }
        },
        pow_response: {},
        crypto_response: {}
    });

    await socket.writeAll(Buffer.concat([struct.pack('>I', clientResponsePlaintext.length + 4), clientResponsePlaintext]));
}

export interface ApKeys {
    challenge: Buffer;
    sendKey: Buffer;
    recieveKey: Buffer;
}

function computeKeys(sharedSecret: Buffer, clientHello: Buffer, clientHelloResponse: Buffer): ApKeys {
    let data = Buffer.alloc(0);
    let hashBuffer = Buffer.concat([clientHello, clientHelloResponse]);
    for (let x = 0; x <= 4; x++) {
        let hmac = crypto.createHmac('sha1', sharedSecret);
        hmac.update(hashBuffer);
        hmac.update(struct.pack('>B', x + 1));
        data = Buffer.concat([data, hmac.digest()]);
    }

    let hmac = crypto.createHmac('sha1', data.slice(0, 20));
    hmac.update(hashBuffer);

    return {
        challenge: hmac.digest(),
        sendKey: data.slice(0x14, 0x34),
        recieveKey: data.slice(0x34, 0x54)
    };
}

export default async function connectToAccessPoint(apAddress: string, apPort: number): Promise<ApConnection> {
    const promiseSocket = new PromiseSocket();
    await promiseSocket.connect(apPort, apAddress);
    
    let diffieHellman = crypto.createDiffieHellman(prime);
    diffieHellman.generateKeys();
    
    const clientHelloBuffer = await clientHello(promiseSocket, diffieHellman.getPublicKey());
    const clientHelloResponse = await readPacket(promiseSocket);
    const remoteKey = keyExchangeMessages.APResponseMessage.decode(clientHelloResponse.payload).challenge.login_crypto_challenge.diffie_hellman.gs;
    
    const sharedSecret = diffieHellman.computeSecret(remoteKey);
    
    let keys = computeKeys(sharedSecret, clientHelloBuffer, clientHelloResponse.raw);
    await clientResponse(promiseSocket, keys.challenge);
    
    return new ApConnection(promiseSocket, keys);
}