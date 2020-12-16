enum Bitrate {
    Bitrate96,
    Bitrate160,
    Bitrate360
};

function bitrateFromStr(bitrate: string): Bitrate {
    switch (bitrate) {
        case '96':
            return Bitrate.Bitrate96;
        case '160':
            return Bitrate.Bitrate160;
        case '360':
        default:
            return Bitrate.Bitrate360;
    }
}

export default class PlayerConfig {
    bitrate: Bitrate;
    normalization: boolean;
    normalizationPregain: number;
    gapless: boolean;

    constructor(bitrate: Bitrate=Bitrate.Bitrate360, normalization: boolean=false, normalizationPregain: number=0, gapless: boolean=true) {
        this.bitrate = bitrate;
        this.normalization = normalization;
        this.normalizationPregain = normalizationPregain;
        this.gapless = gapless;
    }
}