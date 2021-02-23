import { RtpDescription, RtpOptions } from './rtp-utils';
import { RtpSplitter } from '@homebridge/camera-utils';
import { SipCall, SipOptions } from './sip-call';
import { RingCamera } from './ring-camera';
import { Subscribed } from './subscribed';
declare type SpawnInput = string | number;
export interface FfmpegOptions {
    input?: SpawnInput[];
    video?: SpawnInput[] | false;
    audio?: SpawnInput[];
    output: SpawnInput[];
}
export declare class SipSession extends Subscribed {
    readonly sipOptions: SipOptions;
    readonly rtpOptions: RtpOptions;
    readonly audioSplitter: RtpSplitter;
    audioRtcpSplitter: RtpSplitter;
    readonly videoSplitter: RtpSplitter;
    videoRtcpSplitter: RtpSplitter;
    private readonly tlsPort;
    readonly camera: RingCamera;
    private hasStarted;
    private hasCallEnded;
    private onCallEndedSubject;
    private sipCall;
    readonly reservedPorts: number[];
    onCallEnded: import("rxjs").Observable<unknown>;
    constructor(sipOptions: SipOptions, rtpOptions: RtpOptions, audioSplitter: RtpSplitter, audioRtcpSplitter: RtpSplitter, videoSplitter: RtpSplitter, videoRtcpSplitter: RtpSplitter, tlsPort: number, camera: RingCamera);
    createSipCall(sipOptions: SipOptions): SipCall;
    start(ffmpegOptions?: FfmpegOptions): Promise<RtpDescription>;
    private startTranscoder;
    reservePort(bufferPorts?: number): Promise<number>;
    requestKeyFrame(): Promise<void>;
    activateCameraSpeaker(): Promise<void>;
    private callEnded;
    stop(): void;
}
export {};
