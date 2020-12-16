import Shannon = require('shannon');
import struct = require('python-struct');
import PromiseSocket from 'promise-socket';
import { Socket } from 'net';
import { ApKeys } from './handshake';

export interface ApPacket {
    cmd: number;
    payloadLength: number;
    payload: Buffer;
    mac: Buffer;
}

export default class ApConnection {
    socket: PromiseSocket<Socket>;
    keys: ApKeys;

    encodeCipher: any;
    encodeNonce: number;
    decodeCipher: any;
    decodeNonce: number;

    constructor(socket: PromiseSocket<Socket>, keys: ApKeys) {
        this.socket = socket;
        
        this.keys = keys;
        this.encodeCipher = new Shannon(keys.sendKey);
        this.decodeCipher = new Shannon(keys.recieveKey);
        this.encodeNonce = 0;
        this.decodeNonce = 0;
    }

    async send(cmd: number, payload: Buffer): Promise<void> {
        let buffer = Buffer.alloc(3);
        buffer.writeUInt8(cmd);
        buffer.writeUInt16BE(payload.length, 1);
        buffer = Buffer.concat([buffer, payload]);

        this.encodeCipher.nonce(struct.pack('>I', this.encodeNonce++));
        buffer = this.encodeCipher.encrypt(buffer);
        await this.socket.writeAll(Buffer.concat([buffer, this.encodeCipher.finish(Buffer.alloc(4))]));
    }

    async recieve(): Promise<ApPacket> {
        let packet: ApPacket = { cmd: undefined, payloadLength: undefined, payload: undefined, mac: undefined };

        let header = await this.socket.read(3);
        if (header == undefined)
            throw new Error('Socket Error');

        this.decodeCipher.nonce(struct.pack('>I', this.decodeNonce++));
        header = this.decodeCipher.decrypt(header);
        if (!(header instanceof Buffer))
            header = Buffer.from(header);
        
        packet.cmd = header[0];
        packet.payloadLength = header.readInt16BE(1);

        let payload = await this.socket.read(packet.payloadLength + 4);
        if (payload == undefined)
            throw new Error('Socket Error');
            
        payload = this.decodeCipher.decrypt(payload);
        if (!(payload instanceof Buffer))
            payload = Buffer.from(payload);
        packet.payload = payload.slice(0, packet.payloadLength);
        packet.mac = payload.slice(packet.payloadLength);

        return packet;
    }
}