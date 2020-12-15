const crypto = require('crypto');
const fs = require('fs');
const protobuf = require('protocol-buffers');
const {PromiseSocket, TimeoutError} = require("promise-socket");
const Shannon = require('shannon');
const struct = require('python-struct');
const keyExchangeMessages = protobuf(fs.readFileSync('keyexchange.proto'));

class ApConnection {
    constructor(socket, keys) {
        this.socket = socket;
        
        this.keys = keys;
        this.encodeCipher = new Shannon(keys.sendKey);
        this.decodeCipher = new Shannon(keys.recieveKey);
        this.encodeNonce = 0;
        this.decodeNonce = 0;
    }

    async send(cmd, payload) {
        var buffer = Buffer.alloc(3);
        buffer.writeUInt8(cmd);
        buffer.writeUInt16BE(payload.length, 1);
        buffer = Buffer.concat([buffer, payload]);

        this.encodeCipher.nonce(struct.pack('>I', this.encodeNonce++));
        buffer = this.encodeCipher.encrypt(buffer);
        await this.socket.writeAll(Buffer.concat([buffer, this.encodeCipher.finish(Buffer.alloc(4))]));
    }

    async recieve() {
        var packet = {
            cmd: undefined,
            payloadLength: undefined,
            payload: undefined,
            mac: undefined
        }

        var header = await this.socket.read(3);
        this.decodeCipher.nonce(struct.pack('>I', this.decodeNonce++));
        header = this.decodeCipher.decrypt(header);
        packet.cmd = header[0];
        packet.payloadLength = struct.unpack('>H', header.slice(1))[0];

        var payload = await this.socket.read(packet.payloadLength + 4);
        payload = this.decodeCipher.decrypt(payload);
        packet.payload = payload.slice(0, packet.payloadLength);
        packet.mac = payload.slice(packet.payloadLength);

        return packet;
    }
}

const prime = Buffer.from([
    0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc9, 0x0f, 0xda, 0xa2, 0x21, 0x68, 0xc2,
    0x34, 0xc4, 0xc6, 0x62, 0x8b, 0x80, 0xdc, 0x1c, 0xd1, 0x29, 0x02, 0x4e, 0x08, 0x8a, 0x67,
    0xcc, 0x74, 0x02, 0x0b, 0xbe, 0xa6, 0x3b, 0x13, 0x9b, 0x22, 0x51, 0x4a, 0x08, 0x79, 0x8e,
    0x34, 0x04, 0xdd, 0xef, 0x95, 0x19, 0xb3, 0xcd, 0x3a, 0x43, 0x1b, 0x30, 0x2b, 0x0a, 0x6d,
    0xf2, 0x5f, 0x14, 0x37, 0x4f, 0xe1, 0x35, 0x6d, 0x6d, 0x51, 0xc2, 0x45, 0xe4, 0x85, 0xb5,
    0x76, 0x62, 0x5e, 0x7e, 0xc6, 0xf4, 0x4c, 0x42, 0xe9, 0xa6, 0x3a, 0x36, 0x20, 0xff, 0xff,
    0xff, 0xff, 0xff, 0xff, 0xff, 0xff ]);

async function readPacket(connection) {
    var packetSizeRaw = await connection.read(4);
    var packetSize = struct.unpack('>I', packetSizeRaw)[0];
    var data = await connection.read(packetSize - 4);
    return {
        data: data,
        raw: Buffer.concat([packetSizeRaw, data])
    };
}

async function clientHello(socket, gc) {
    var clientHelloMessage = keyExchangeMessages.ClientHello.encode({
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
    var buffer = Buffer.concat([Buffer.from([0, 4]), struct.pack('>I', packetLength), clientHelloMessage]);
    await socket.writeAll(buffer);
    return buffer;
}

async function clientResponse(socket, challenge) {
    var clientResponsePlaintext = keyExchangeMessages.ClientResponsePlaintext.encode({
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

function computeKeys(sharedSecret, clientHello, clientHelloResponse) {
    var data = Buffer.alloc(0);
    var hashBuffer = Buffer.concat([clientHello, clientHelloResponse]);
    for (var x = 0; x <= 4; x++) {
        var hmac = crypto.createHmac('sha1', sharedSecret);
        hmac.update(hashBuffer);
        hmac.update(struct.pack('>B', x + 1));
        data = Buffer.concat([data, hmac.digest()]);
    }

    var hmac = crypto.createHmac('sha1', data.slice(0, 20));
    hmac.update(hashBuffer);

    return {
        challenge: hmac.digest(),
        sendKey: data.slice(0x14, 0x34),
        recieveKey: data.slice(0x34, 0x54)
    };
}

async function connectToAccessPoint(apAddress, apPort) {
    const promiseSocket = new PromiseSocket();
    await promiseSocket.connect(apPort, apAddress);
    
    var diffieHellman = crypto.createDiffieHellman(prime, struct.pack('>I', 2));
    var diffieHellmanLocalKeys = diffieHellman.generateKeys();
    
    const clientHelloBuffer = await clientHello(promiseSocket, diffieHellman.getPublicKey());
    const clientHelloResponse = await readPacket(promiseSocket);
    const remoteKey = keyExchangeMessages.APResponseMessage.decode(clientHelloResponse.data).challenge.login_crypto_challenge.diffie_hellman.gs;
    
    const sharedSecret = diffieHellman.computeSecret(remoteKey);
    
    var keys = computeKeys(sharedSecret, clientHelloBuffer, clientHelloResponse.raw);

    console.log(`Challenge: ${keys.challenge.toString('hex')}\nSend Key: ${keys.sendKey.toString('hex')}\nRecieve Key: ${keys.recieveKey.toString('hex')}`);
    await clientResponse(promiseSocket, keys.challenge);
    
    return new ApConnection(promiseSocket, keys);
}

module.exports = { connectToAccessPoint };