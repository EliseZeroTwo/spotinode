export enum AudioType {
    Track,
    Podcast,
    NonPlayable
};

const base16Digits = '0123456789abcdef';
const base62Digits = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

export default class SpotifyId {
    id: bigint;
    audioType: AudioType;

    constructor(id: bigint, audioType: AudioType) {
        this.id = id;
        this.audioType = audioType;
    }

    toBase16() {
        return this.id.toString(16);
    }

    toBase62() {
        let workingId = this.id;
        let outData = Buffer.alloc(22);
        for (let x = 0; x < 22; x++) {
            outData.write(base62Digits[Number(workingId % 62n)], 21 - x);
            workingId /= 62n;
        }

        return outData.toString();
    }

    toUri() {
        let prefix = '';
        switch (this.audioType) {
            case AudioType.Track: {
                prefix = 'spotify:track:';
                break;
            }
            case AudioType.Podcast: {
                prefix = 'spotify:episode:';
                break;
            }
            default: {
                prefix = 'spotify:unknown:';
                break;
            }
        }
        return `${prefix}${this.toBase62()}`;
    }
}

export function asTrack(id: bigint) {
    return new SpotifyId(id, AudioType.Track);
}

export function fromBase16(id: string, type: AudioType=AudioType.Track): SpotifyId {
    let rawId = 0n;

    for (let x = 0; x < id.length; x++) {
        let idx = base16Digits.indexOf(id[x]);
        if (idx == -1)
            throw new Error(`Invalid Base16 Character ${id[x]} in Id ${id}`);
        
        rawId *= 16n;
        rawId += BigInt(idx);
    }
    return new SpotifyId(rawId, type);
}

export function fromBase62(id: string, type: AudioType=AudioType.Track): SpotifyId {
    let rawId = 0n;

    for (let x = 0; x < id.length; x++) {
        let idx = base62Digits.indexOf(id[x]);
        if (idx == -1)
            throw new Error(`Invalid Base62 Character ${id[x]} in Id ${id}`);
        
        rawId *= 62n;
        rawId += BigInt(idx);
    }
    return new SpotifyId(rawId, type);
}

export function fromUri(uri: string): SpotifyId {
    let split = uri.split(':');
    if (split.length != 3)
        throw new Error(`Invalid URI ${uri}`);
    
    const b62SpotifyId = split[2];
    let audioType = AudioType.NonPlayable;
    switch (split[1]) {
        case 'track': {
            audioType = AudioType.Track;
            break;
        }
        case 'episode': {
            audioType = AudioType.Podcast;
            break;
        }
    }

     return fromBase62(b62SpotifyId, audioType);
}