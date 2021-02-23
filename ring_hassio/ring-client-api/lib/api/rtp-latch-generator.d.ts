/// <reference types="node" />
import { SrtpOptions } from '@homebridge/camera-utils';
export declare class RtpLatchGenerator {
    readonly srtpOptions: SrtpOptions;
    readonly payloadType: number;
    readonly ssrc: number;
    private payload;
    private srtpSession;
    onLatchPacket: import("rxjs").Observable<Buffer>;
    constructor(srtpOptions: SrtpOptions, payloadType: number);
}
