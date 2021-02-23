/// <reference types="node" />
import { RtpSplitter, SrtpOptions } from '@homebridge/camera-utils';
export interface RtpStreamOptions extends SrtpOptions {
    port: number;
    rtcpPort: number;
}
export interface RtpOptions {
    audio: RtpStreamOptions;
    video: RtpStreamOptions;
}
export interface RtpStreamDescription extends RtpStreamOptions {
    ssrc?: number;
    iceUFrag?: string;
    icePwd?: string;
}
export interface RtpDescription {
    address: string;
    audio: RtpStreamDescription;
    video: RtpStreamDescription;
}
export declare function isStunMessage(message: Buffer): boolean;
export declare function sendStunBindingRequest({ rtpDescription, rtpSplitter, localUfrag, type, }: {
    rtpSplitter: RtpSplitter;
    rtpDescription: RtpDescription;
    localUfrag: string;
    type: 'video' | 'audio';
}): void;
export declare function createStunResponder(rtpSplitter: RtpSplitter): void;
