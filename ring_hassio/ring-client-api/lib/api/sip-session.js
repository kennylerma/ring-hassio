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
exports.SipSession = void 0;
const rxjs_1 = require("rxjs");
const rtp_utils_1 = require("./rtp-utils");
const camera_utils_1 = require("@homebridge/camera-utils");
const sip_call_1 = require("./sip-call");
const rtp_latch_generator_1 = require("./rtp-latch-generator");
const subscribed_1 = require("./subscribed");
const util_1 = require("./util");
const ffmpeg_1 = require("./ffmpeg");
const operators_1 = require("rxjs/operators");
const stun = require('stun');
class SipSession extends subscribed_1.Subscribed {
    constructor(sipOptions, rtpOptions, audioSplitter, audioRtcpSplitter, videoSplitter, videoRtcpSplitter, tlsPort, camera) {
        super();
        this.sipOptions = sipOptions;
        this.rtpOptions = rtpOptions;
        this.audioSplitter = audioSplitter;
        this.audioRtcpSplitter = audioRtcpSplitter;
        this.videoSplitter = videoSplitter;
        this.videoRtcpSplitter = videoRtcpSplitter;
        this.tlsPort = tlsPort;
        this.camera = camera;
        this.hasStarted = false;
        this.hasCallEnded = false;
        this.onCallEndedSubject = new rxjs_1.ReplaySubject(1);
        this.sipCall = this.createSipCall(this.sipOptions);
        this.reservedPorts = [
            this.tlsPort,
            this.rtpOptions.video.port,
            this.rtpOptions.audio.port,
        ];
        this.onCallEnded = this.onCallEndedSubject.asObservable();
    }
    createSipCall(sipOptions) {
        if (this.sipCall) {
            this.sipCall.destroy();
        }
        const call = (this.sipCall = new sip_call_1.SipCall(sipOptions, this.rtpOptions, this.tlsPort));
        this.addSubscriptions(call.onEndedByRemote.subscribe(() => this.callEnded(false)));
        return this.sipCall;
    }
    start(ffmpegOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.hasStarted) {
                throw new Error('SIP Session has already been started');
            }
            this.hasStarted = true;
            if (this.hasCallEnded) {
                throw new Error('SIP Session has already ended');
            }
            try {
                const videoPort = yield this.reservePort(1), audioPort = yield this.reservePort(1), rtpDescription = yield this.sipCall.invite();
                if (ffmpegOptions) {
                    this.startTranscoder(ffmpegOptions, rtpDescription, audioPort, videoPort);
                }
                // if rtcp-mux is supported, rtp splitter will be used for both rtp and rtcp
                if (rtpDescription.audio.port === rtpDescription.audio.rtcpPort) {
                    this.audioRtcpSplitter.close();
                    this.audioRtcpSplitter = this.audioSplitter;
                }
                if (rtpDescription.video.port === rtpDescription.video.rtcpPort) {
                    this.videoRtcpSplitter.close();
                    this.videoRtcpSplitter = this.videoSplitter;
                }
                if (rtpDescription.video.iceUFrag) {
                    // ICE is supported
                    rtp_utils_1.createStunResponder(this.audioSplitter);
                    rtp_utils_1.createStunResponder(this.videoSplitter);
                    rtp_utils_1.sendStunBindingRequest({
                        rtpSplitter: this.audioSplitter,
                        rtpDescription,
                        localUfrag: this.sipCall.audioUfrag,
                        type: 'audio',
                    });
                    rtp_utils_1.sendStunBindingRequest({
                        rtpSplitter: this.videoSplitter,
                        rtpDescription,
                        localUfrag: this.sipCall.videoUfrag,
                        type: 'video',
                    });
                }
                else {
                    // ICE is not supported, use RTP latching
                    const { address } = rtpDescription, remoteAudioLocation = {
                        port: rtpDescription.audio.port,
                        address,
                    }, remoteAudioRtcpLocation = {
                        port: rtpDescription.audio.rtcpPort,
                        address,
                    }, remoteVideoLocation = {
                        port: rtpDescription.video.port,
                        address,
                    }, remoteVideoRtcpLocation = {
                        port: rtpDescription.video.rtcpPort,
                        address,
                    }, sendKeepAlive = () => {
                        const audioStun = stun.encode(stun.createMessage(1)), videoStun = stun.encode(stun.createMessage(1));
                        this.audioSplitter.send(audioStun, remoteAudioLocation);
                        this.audioRtcpSplitter.send(audioStun, remoteAudioRtcpLocation);
                        this.videoSplitter.send(videoStun, remoteVideoLocation);
                        this.videoRtcpSplitter.send(videoStun, remoteVideoRtcpLocation);
                    }, audioLatchGenerator = new rtp_latch_generator_1.RtpLatchGenerator(this.rtpOptions.audio, 0), videoLatchGenerator = new rtp_latch_generator_1.RtpLatchGenerator(this.rtpOptions.video, 99);
                    this.addSubscriptions(
                    // hole punch every .5 seconds to keep stream alive and port open (matches behavior from Ring app)
                    rxjs_1.timer(0, 500).subscribe(sendKeepAlive), 
                    // Send a valid RTP/RTCP packet to audio/video ports repeatedly until data is received.
                    // This is how Ring gets through NATs.  See https://tools.ietf.org/html/rfc7362 for details
                    audioLatchGenerator.onLatchPacket
                        .pipe(operators_1.takeUntil(this.audioSplitter.onMessage))
                        .subscribe((latchPacket) => {
                        // console.log('AUDIO LATCH', latchPacket.toString('hex'))
                        this.audioSplitter.send(latchPacket, remoteAudioLocation);
                        this.audioRtcpSplitter.send(latchPacket, remoteAudioLocation);
                    }), videoLatchGenerator.onLatchPacket
                        .pipe(operators_1.takeUntil(this.videoSplitter.onMessage))
                        .subscribe((latchPacket) => {
                        // console.log('VIDEO LATCH', latchPacket.toString('hex'))
                        this.videoSplitter.send(latchPacket, remoteVideoLocation);
                        this.videoRtcpSplitter.send(latchPacket, remoteVideoLocation);
                    }));
                }
                return rtpDescription;
            }
            catch (e) {
                if (e === sip_call_1.expiredDingError) {
                    const sipOptions = yield this.camera.getUpdatedSipOptions(this.sipOptions.dingId);
                    this.createSipCall(sipOptions);
                    this.hasStarted = false;
                    return this.start(ffmpegOptions);
                }
                this.callEnded(true);
                throw e;
            }
        });
    }
    startTranscoder(ffmpegOptions, remoteRtpOptions, audioPort, videoPort) {
        const transcodeVideoStream = ffmpegOptions.video !== false, ffmpegArgs = [
            '-hide_banner',
            '-protocol_whitelist',
            'pipe,udp,rtp,file,crypto',
            '-f',
            'sdp',
            ...(ffmpegOptions.input || []),
            '-i',
            'pipe:',
            ...(ffmpegOptions.audio || ['-acodec', 'aac']),
            ...(transcodeVideoStream
                ? ffmpegOptions.video || ['-vcodec', 'copy']
                : []),
            ...(ffmpegOptions.output || []),
        ], ff = new camera_utils_1.FfmpegProcess({
            ffmpegArgs,
            ffmpegPath: ffmpeg_1.getFfmpegPath(),
            exitCallback: () => this.callEnded(true),
            logLabel: `From Ring (${this.camera.name})`,
            logger: {
                error: util_1.logError,
                info: util_1.logDebug,
            },
        }), inputSdpLines = [
            'v=0',
            'o=105202070 3747 461 IN IP4 127.0.0.1',
            's=Talk',
            'c=IN IP4 127.0.0.1',
            'b=AS:380',
            't=0 0',
            'a=rtcp-xr:rcvr-rtt=all:10000 stat-summary=loss,dup,jitt,TTL voip-metrics',
            `m=audio ${audioPort} RTP/SAVP 0 101`,
            'a=rtpmap:0 PCMU/8000',
            camera_utils_1.createCryptoLine(remoteRtpOptions.audio),
            'a=rtcp-mux',
        ];
        if (transcodeVideoStream) {
            inputSdpLines.push(`m=video ${videoPort} RTP/SAVP 99`, 'a=rtpmap:99 H264/90000', camera_utils_1.createCryptoLine(remoteRtpOptions.video), 'a=rtcp-mux');
            let haveReceivedStreamPacket = false;
            this.videoSplitter.addMessageHandler(({ isRtpMessage, message }) => {
                if (rtp_utils_1.isStunMessage(message)) {
                    return null;
                }
                if (!haveReceivedStreamPacket) {
                    void this.sipCall.requestKeyFrame();
                    haveReceivedStreamPacket = true;
                }
                return {
                    port: isRtpMessage ? videoPort : videoPort + 1,
                };
            });
        }
        this.onCallEnded.subscribe(() => ff.stop());
        ff.writeStdin(inputSdpLines.filter((x) => Boolean(x)).join('\n'));
        this.audioSplitter.addMessageHandler(({ isRtpMessage, message }) => {
            if (rtp_utils_1.isStunMessage(message)) {
                return null;
            }
            return {
                port: isRtpMessage ? audioPort : audioPort + 1,
            };
        });
    }
    reservePort(bufferPorts = 0) {
        return __awaiter(this, void 0, void 0, function* () {
            const ports = yield camera_utils_1.reservePorts({ count: bufferPorts + 1 });
            this.reservedPorts.push(...ports);
            return ports[0];
        });
    }
    requestKeyFrame() {
        return this.sipCall.requestKeyFrame();
    }
    activateCameraSpeaker() {
        return this.sipCall.activateCameraSpeaker();
    }
    callEnded(sendBye) {
        if (this.hasCallEnded) {
            return;
        }
        this.hasCallEnded = true;
        if (sendBye) {
            this.sipCall.sendBye();
        }
        // clean up
        this.onCallEndedSubject.next();
        this.sipCall.destroy();
        this.videoSplitter.close();
        this.audioSplitter.close();
        this.unsubscribe();
        camera_utils_1.releasePorts(this.reservedPorts);
    }
    stop() {
        this.callEnded(true);
    }
}
exports.SipSession = SipSession;
