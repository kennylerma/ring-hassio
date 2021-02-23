import { Subject } from 'rxjs';
import { RtpDescription, RtpOptions } from './rtp-utils';
export declare const expiredDingError: Error;
interface UriOptions {
    name?: string;
    uri: string;
    params?: {
        tag?: string;
    };
}
interface SipHeaders {
    [name: string]: string | any;
    cseq: {
        seq: number;
        method: string;
    };
    to: UriOptions;
    from: UriOptions;
    contact?: UriOptions[];
    via?: UriOptions[];
}
export interface SipRequest {
    uri: UriOptions | string;
    method: string;
    headers: SipHeaders;
    content: string;
}
export interface SipResponse {
    status: number;
    reason: string;
    headers: SipHeaders;
    content: string;
}
export interface SipClient {
    send: (request: SipRequest | SipResponse, handler?: (response: SipResponse) => void) => void;
    destroy: () => void;
    makeResponse: (response: SipRequest, status: number, method: string) => SipResponse;
}
export interface SipOptions {
    to: string;
    from: string;
    dingId: string;
    localIp: string;
}
export declare class SipCall {
    private sipOptions;
    private seq;
    private fromParams;
    private toParams;
    private callId;
    private sipClient;
    readonly onEndedByRemote: Subject<unknown>;
    private destroyed;
    private cameraConnected?;
    private cameraConnectedPromise;
    readonly sdp: string;
    readonly audioUfrag: string;
    readonly videoUfrag: string;
    constructor(sipOptions: SipOptions, rtpOptions: RtpOptions, tlsPort: number);
    request({ method, headers, content, seq, }: {
        method: string;
        headers?: Partial<SipHeaders>;
        content?: string;
        seq?: number;
    }): Promise<SipResponse>;
    private ackWithInfo;
    sendDtmf(key: string): Promise<SipResponse>;
    private sendKeyFrameRequest;
    invite(): Promise<RtpDescription>;
    requestKeyFrame(): Promise<void>;
    private speakerActivated;
    activateCameraSpeaker(): Promise<void>;
    sendBye(): Promise<void | SipResponse>;
    destroy(): void;
}
export {};
