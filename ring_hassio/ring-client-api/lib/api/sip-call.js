"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SipCall = exports.expiredDingError = void 0;
const rxjs_1 = require("rxjs");
const util_1 = require("./util");
const camera_utils_1 = require("@homebridge/camera-utils");
const sip = require('sip'), sdp = require('sdp');
exports.expiredDingError = new Error('Ding expired, received 480');
function getRandomId() {
    return Math.floor(Math.random() * 1e6).toString();
}
function getRtpDescription(sections, mediaType) {
    var _a, _b, _c, _d;
    try {
        const section = sections.find((s) => s.startsWith('m=' + mediaType)), { port } = sdp.parseMLine(section), lines = sdp.splitLines(section), rtcpLine = lines.find((l) => l.startsWith('a=rtcp:')), cryptoLine = lines.find((l) => l.startsWith('a=crypto')), ssrcLine = lines.find((l) => l.startsWith('a=ssrc')), iceUFragLine = lines.find((l) => l.startsWith('a=ice-ufrag')), icePwdLine = lines.find((l) => l.startsWith('a=ice-pwd')), encodedCrypto = cryptoLine.match(/inline:(\S*)/)[1];
        return Object.assign({ port, rtcpPort: (rtcpLine && Number((_a = rtcpLine.match(/rtcp:(\S*)/)) === null || _a === void 0 ? void 0 : _a[1])) || port, ssrc: (ssrcLine && Number((_b = ssrcLine.match(/ssrc:(\S*)/)) === null || _b === void 0 ? void 0 : _b[1])) || undefined, iceUFrag: (iceUFragLine && ((_c = iceUFragLine.match(/ice-ufrag:(\S*)/)) === null || _c === void 0 ? void 0 : _c[1])) ||
                undefined, icePwd: (icePwdLine && ((_d = icePwdLine.match(/ice-pwd:(\S*)/)) === null || _d === void 0 ? void 0 : _d[1])) || undefined }, camera_utils_1.decodeSrtpOptions(encodedCrypto));
    }
    catch (e) {
        util_1.logError('Failed to parse SDP from Ring');
        util_1.logError(sections.join('\r\n'));
        throw e;
    }
}
function parseRtpDescription(inviteResponse) {
    const sections = sdp.splitSections(inviteResponse.content), lines = sdp.splitLines(sections[0]), cLine = lines.find((line) => line.startsWith('c='));
    return {
        address: cLine.match(/c=IN IP4 (\S*)/)[1],
        audio: getRtpDescription(sections, 'audio'),
        video: getRtpDescription(sections, 'video'),
    };
}
class SipCall {
    constructor(sipOptions, rtpOptions, tlsPort) {
        this.sipOptions = sipOptions;
        this.seq = 20;
        this.fromParams = { tag: getRandomId() };
        this.toParams = {};
        this.callId = getRandomId();
        this.onEndedByRemote = new rxjs_1.Subject();
        this.destroyed = false;
        this.cameraConnectedPromise = new Promise((resolve) => {
            this.cameraConnected = resolve;
        });
        this.audioUfrag = util_1.randomString(16);
        this.videoUfrag = util_1.randomString(16);
        this.speakerActivated = false;
        const { audio, video } = rtpOptions, { from } = this.sipOptions, host = this.sipOptions.localIp;
        this.sipClient = sip.create({
            host,
            hostname: host,
            tls_port: tlsPort,
            tls: {
                rejectUnauthorized: false,
            },
            tcp: false,
            udp: false,
        }, (request) => {
            var _a;
            if (request.method === 'BYE') {
                util_1.logDebug('received BYE from ring server');
                this.sipClient.send(this.sipClient.makeResponse(request, 200, 'Ok'));
                if (this.destroyed) {
                    this.onEndedByRemote.next();
                }
            }
            else if (request.method === 'MESSAGE' &&
                request.content === 'event=camera_connected') {
                util_1.logDebug('camera connected to ring server');
                (_a = this.cameraConnected) === null || _a === void 0 ? void 0 : _a.call(this);
            }
        });
        this.sdp = [
            'v=0',
            `o=${from.split(':')[1].split('@')[0]} 3747 461 IN IP4 ${host}`,
            's=Talk',
            `c=IN IP4 ${host}`,
            'b=AS:380',
            't=0 0',
            `m=audio ${audio.port} RTP/SAVPF 0`,
            'a=rtpmap:0 PCMU/8000',
            camera_utils_1.createCryptoLine(audio),
            'a=rtcp-mux',
            'a=rtcp-fb:* trr-int 5',
            'a=rtcp-fb:* ccm tmmbr',
            `a=ice-ufrag:${this.audioUfrag}`,
            `a=ice-pwd:${util_1.randomString(22)}`,
            `a=candidate:${util_1.randomInteger()} 1 udp ${util_1.randomInteger()} ${host} ${audio.port} typ host generation 0 network-id 1 network-cost 50`,
            `m=video ${video.port} RTP/SAVPF 99`,
            'a=rtpmap:99 H264/90000',
            'a=fmtp:99 profile-level-id=42801F',
            camera_utils_1.createCryptoLine(video),
            'a=rtcp-mux',
            'a=rtcp-fb:* trr-int 5',
            'a=rtcp-fb:* ccm tmmbr',
            'a=rtcp-fb:99 nack pli',
            'a=rtcp-fb:99 ccm tstr',
            'a=rtcp-fb:99 ccm fir',
            `a=ice-ufrag:${this.videoUfrag}`,
            `a=ice-pwd:${util_1.randomString(22)}`,
            `a=candidate:${util_1.randomInteger()} 1 udp ${util_1.randomInteger()} ${host} ${video.port} typ host generation 0 network-id 1 network-cost 50`,
        ]
            .filter((l) => l)
            .join('\r\n');
    }
    request({ method, headers, content, seq, }) {
        if (this.destroyed) {
            return Promise.reject(new Error('SIP request made after call was destroyed'));
        }
        return new Promise((resolve, reject) => {
            seq = seq || this.seq++;
            this.sipClient.send({
                method,
                uri: this.sipOptions.to,
                headers: Object.assign({ to: {
                        name: '"FS Doorbot"',
                        uri: this.sipOptions.to,
                        params: this.toParams,
                    }, from: {
                        uri: this.sipOptions.from,
                        params: this.fromParams,
                    }, 'max-forwards': 70, 'call-id': this.callId, 'X-Ding': this.sipOptions.dingId, 'X-Authorization': '', 'User-Agent': 'Android/3.23.0 (belle-sip/1.6.3)', cseq: { seq, method } }, headers),
                content: content || '',
            }, (response) => {
                if (response.headers.to.params && response.headers.to.params.tag) {
                    this.toParams.tag = response.headers.to.params.tag;
                }
                if (response.status >= 300) {
                    if (response.status === 480 && method === 'INVITE') {
                        const { dingId } = this.sipOptions;
                        util_1.logInfo(`Ding ${dingId} is expired (${response.status}).  Fetching a new ding and trying video stream again`);
                        reject(exports.expiredDingError);
                        return;
                    }
                    if (response.status !== 408 || method !== 'BYE') {
                        util_1.logError(`sip ${method} request failed with status ` + response.status);
                    }
                    reject(new Error(`sip ${method} request failed with status ` + response.status));
                }
                else if (response.status < 200) {
                    // call made progress, do nothing and wait for another response
                    // console.log('call progress status ' + response.status)
                }
                else {
                    if (method === 'INVITE') {
                        // The ACK must be sent with every OK to keep the connection alive.
                        this.ackWithInfo(seq).catch((e) => {
                            util_1.logError('Failed to send SDP ACK and INFO');
                            util_1.logError(e);
                        });
                    }
                    resolve(response);
                }
            });
        });
    }
    ackWithInfo(seq) {
        return __awaiter(this, void 0, void 0, function* () {
            // Don't wait for ack, it won't ever come back.
            void this.request({
                method: 'ACK',
                seq,
            }).catch(rxjs_1.noop);
            // SIP session will be terminated after 60 seconds if these aren't sent
            yield this.sendDtmf('2');
            yield this.sendKeyFrameRequest();
        });
    }
    sendDtmf(key) {
        return this.request({
            method: 'INFO',
            headers: {
                'Content-Type': 'application/dtmf-relay',
            },
            content: `Signal=${key}\r\nDuration=250`,
        });
    }
    sendKeyFrameRequest() {
        return this.request({
            method: 'INFO',
            headers: {
                'Content-Type': 'application/media_control+xml',
            },
            content: '<?xml version="1.0" encoding="utf-8" ?><media_control>  <vc_primitive>    <to_encoder>      <picture_fast_update></picture_fast_update>    </to_encoder>  </vc_primitive></media_control>',
        });
    }
    invite() {
        return __awaiter(this, void 0, void 0, function* () {
            const { from } = this.sipOptions, inviteResponse = yield this.request({
                method: 'INVITE',
                headers: {
                    supported: 'replaces, outbound',
                    allow: 'INVITE, ACK, CANCEL, OPTIONS, BYE, REFER, NOTIFY, MESSAGE, SUBSCRIBE, INFO, UPDATE',
                    'content-type': 'application/sdp',
                    contact: [{ uri: from }],
                },
                content: this.sdp,
            });
            return parseRtpDescription(inviteResponse);
        });
    }
    requestKeyFrame() {
        return __awaiter(this, void 0, void 0, function* () {
            // camera connected event doesn't always happen if cam is already streaming.  2 second fallback
            yield Promise.race([this.cameraConnectedPromise, util_1.delay(2000)]);
            util_1.logDebug('requesting key frame');
            yield this.sendKeyFrameRequest();
        });
    }
    activateCameraSpeaker() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.speakerActivated) {
                return;
            }
            this.speakerActivated = true;
            util_1.logDebug('Activating camera speaker');
            yield this.sendDtmf('1').catch((e) => {
                util_1.logError('Failed to activate camera speaker');
                util_1.logError(e);
            });
        });
    }
    sendBye() {
        return this.request({ method: 'BYE' }).catch(() => {
            // Don't care if we get an exception here.
        });
    }
    destroy() {
        this.destroyed = true;
        this.sipClient.destroy();
    }
}
exports.SipCall = SipCall;
