"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RtpLatchGenerator = void 0;
const operators_1 = require("rxjs/operators");
const util_1 = require("./util");
const rxjs_1 = require("rxjs");
const werift_rtp_1 = require("werift-rtp");
class RtpLatchGenerator {
    constructor(srtpOptions, payloadType) {
        this.srtpOptions = srtpOptions;
        this.payloadType = payloadType;
        this.ssrc = util_1.randomInteger();
        this.payload = Buffer.alloc(1, 0);
        this.srtpSession = new werift_rtp_1.SrtpSession({
            keys: {
                localMasterKey: this.srtpOptions.srtpKey,
                localMasterSalt: this.srtpOptions.srtpSalt,
                remoteMasterKey: this.srtpOptions.srtpKey,
                remoteMasterSalt: this.srtpOptions.srtpSalt,
            },
            profile: 1,
        });
        this.onLatchPacket = rxjs_1.timer(0, 60).pipe(operators_1.map((sequenceNumber) => {
            return this.srtpSession.encrypt(this.payload, new werift_rtp_1.RtpHeader({
                padding: false,
                extension: false,
                marker: false,
                payloadType: this.payloadType,
                sequenceNumber: sequenceNumber % Math.pow(2, 32),
                timestamp: Date.now() % Math.pow(2, 32),
                ssrc: this.ssrc,
            }));
        }));
    }
}
exports.RtpLatchGenerator = RtpLatchGenerator;
