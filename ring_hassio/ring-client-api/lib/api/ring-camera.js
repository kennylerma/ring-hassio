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
exports.RingCamera = exports.getSearchQueryString = exports.getBatteryLevel = void 0;
const ring_types_1 = require("./ring-types");
const rest_client_1 = require("./rest-client");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const camera_utils_1 = require("@homebridge/camera-utils");
const util_1 = require("./util");
const sip_session_1 = require("./sip-session");
const subscribed_1 = require("./subscribed");
const snapshotRefreshDelay = 500, maxSnapshotRefreshSeconds = 35, // needs to be 30+ because battery cam can't take snapshot while recording
maxSnapshotRefreshAttempts = (maxSnapshotRefreshSeconds * 1000) / snapshotRefreshDelay, fullDayMs = 24 * 60 * 60 * 1000;
function parseBatteryLife(batteryLife) {
    if (batteryLife === null || batteryLife === undefined) {
        return null;
    }
    const batteryLevel = typeof batteryLife === 'number'
        ? batteryLife
        : Number.parseFloat(batteryLife);
    if (isNaN(batteryLevel)) {
        return null;
    }
    return batteryLevel;
}
function getStartOfToday() {
    return new Date(new Date().toLocaleDateString()).getTime();
}
function getEndOfToday() {
    return getStartOfToday() + fullDayMs - 1;
}
function getBatteryLevel(data) {
    const levels = [
        parseBatteryLife(data.battery_life),
        parseBatteryLife(data.battery_life_2),
    ].filter((level) => level !== null);
    if (!levels.length) {
        return null;
    }
    return Math.min(...levels);
}
exports.getBatteryLevel = getBatteryLevel;
function getSearchQueryString(options) {
    const queryString = Object.entries(options)
        .map(([key, value]) => {
        if (value === undefined) {
            return '';
        }
        if (key === 'olderThanId') {
            key = 'pagination_key';
        }
        return `${key}=${value}`;
    })
        .filter((x) => x)
        .join('&');
    return queryString.length ? `?${queryString}` : '';
}
exports.getSearchQueryString = getSearchQueryString;
class RingCamera extends subscribed_1.Subscribed {
    constructor(initialData, isDoorbot, restClient, avoidSnapshotBatteryDrain) {
        super();
        this.initialData = initialData;
        this.isDoorbot = isDoorbot;
        this.restClient = restClient;
        this.avoidSnapshotBatteryDrain = avoidSnapshotBatteryDrain;
        this.id = this.initialData.id;
        this.deviceType = this.initialData.kind;
        this.model = ring_types_1.RingCameraModel[this.initialData.kind] || 'Unknown Model';
        this.onData = new rxjs_1.BehaviorSubject(this.initialData);
        this.hasLight = this.initialData.led_status !== undefined;
        this.hasSiren = this.initialData.siren_status !== undefined;
        this.hasBattery = ring_types_1.isBatteryCameraKind(this.deviceType) ||
            (typeof this.initialData.battery_life === 'string' &&
                this.batteryLevel !== null &&
                this.batteryLevel < 100 &&
                this.batteryLevel >= 0);
        this.onRequestUpdate = new rxjs_1.Subject();
        this.onRequestActiveDings = new rxjs_1.Subject();
        this.onNewDing = new rxjs_1.Subject();
        this.onActiveDings = new rxjs_1.BehaviorSubject([]);
        this.onDoorbellPressed = this.onNewDing.pipe(operators_1.filter((ding) => ding.kind === 'ding'), operators_1.share());
        this.onMotionDetected = this.onActiveDings.pipe(operators_1.map((dings) => dings.some((ding) => ding.motion || ding.kind === 'motion')), operators_1.distinctUntilChanged(), operators_1.publishReplay(1), operators_1.refCount());
        this.onMotionStarted = this.onMotionDetected.pipe(operators_1.filter((currentlyDetected) => currentlyDetected), operators_1.mapTo(null), // no value needed, event is what matters
        operators_1.share());
        this.onBatteryLevel = this.onData.pipe(operators_1.map(getBatteryLevel), operators_1.distinctUntilChanged());
        this.onInHomeDoorbellStatus = this.onData.pipe(operators_1.map(({ settings: { chime_settings } }) => {
            return Boolean(chime_settings === null || chime_settings === void 0 ? void 0 : chime_settings.enable);
        }), operators_1.distinctUntilChanged());
        this.expiredDingIds = [];
        this.lastSnapshotTimestampLocal = 0;
        if (!initialData.subscribed) {
            this.subscribeToDingEvents().catch((e) => {
                util_1.logError('Failed to subscribe ' + initialData.description + ' to ding events');
                util_1.logError(e);
            });
        }
        if (!initialData.subscribed_motions) {
            this.subscribeToMotionEvents().catch((e) => {
                util_1.logError('Failed to subscribe ' + initialData.description + ' to motion events');
                util_1.logError(e);
            });
        }
    }
    updateData(update) {
        this.onData.next(update);
    }
    requestUpdate() {
        this.onRequestUpdate.next();
    }
    get data() {
        return this.onData.getValue();
    }
    get name() {
        return this.data.description;
    }
    get activeDings() {
        return this.onActiveDings.getValue();
    }
    get batteryLevel() {
        return getBatteryLevel(this.data);
    }
    get hasLowBattery() {
        return this.data.alerts.battery === 'low';
    }
    get isCharging() {
        return this.initialData.external_connection;
    }
    get operatingOnBattery() {
        return this.hasBattery && this.data.settings.power_mode !== 'wired';
    }
    get isOffline() {
        return this.data.alerts.connection === 'offline';
    }
    get hasInHomeDoorbell() {
        const { chime_settings } = this.data.settings;
        return (this.isDoorbot &&
            Boolean(chime_settings &&
                [ring_types_1.DoorbellType.Mechanical, ring_types_1.DoorbellType.Digital].includes(chime_settings.type)));
    }
    doorbotUrl(path = '') {
        return rest_client_1.clientApi(`doorbots/${this.id}/${path}`);
    }
    setLight(on) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.hasLight) {
                return false;
            }
            const state = on ? 'on' : 'off';
            yield this.restClient.request({
                method: 'PUT',
                url: this.doorbotUrl('floodlight_light_' + state),
            });
            this.updateData(Object.assign(Object.assign({}, this.data), { led_status: state }));
            return true;
        });
    }
    setSiren(on) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.hasSiren) {
                return false;
            }
            yield this.restClient.request({
                method: 'PUT',
                url: this.doorbotUrl('siren_' + (on ? 'on' : 'off')),
            });
            this.updateData(Object.assign(Object.assign({}, this.data), { siren_status: { seconds_remaining: 1 } }));
            return true;
        });
    }
    setSettings(settings) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.restClient.request({
                method: 'PUT',
                url: this.doorbotUrl(),
                json: { doorbot: { settings } },
            });
            this.requestUpdate();
        });
    }
    // Enable or disable the in-home doorbell (if digital or mechanical)
    setInHomeDoorbell(enable) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.hasInHomeDoorbell) {
                return false;
            }
            yield this.setSettings({ chime_settings: { enable } });
            return true;
        });
    }
    getHealth() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.restClient.request({
                url: this.doorbotUrl('health'),
            });
            return response.device_health;
        });
    }
    startVideoOnDemand() {
        return this.restClient
            .request({
            method: 'POST',
            url: this.doorbotUrl('live_view'),
        })
            .catch((e) => {
            var _a;
            if (((_a = e.response) === null || _a === void 0 ? void 0 : _a.statusCode) === 403) {
                const errorMessage = `Camera ${this.name} returned 403 when starting a live stream.  This usually indicates that live streaming is blocked by Modes settings.  Check your Ring app and verify that you are able to stream from this camera with the current Modes settings.`;
                util_1.logError(errorMessage);
                throw new Error(errorMessage);
            }
            throw e;
        });
    }
    pollForActiveDing() {
        // try every second until a new ding is received
        this.addSubscriptions(rxjs_1.interval(1000)
            .pipe(operators_1.takeUntil(this.onNewDing))
            .subscribe(() => {
            this.onRequestActiveDings.next();
        }));
    }
    getSipConnectionDetails() {
        return __awaiter(this, void 0, void 0, function* () {
            const vodPromise = this.onNewDing.pipe(operators_1.take(1)).toPromise(), videoOnDemandDing = yield this.startVideoOnDemand();
            if (videoOnDemandDing && 'sip_from' in videoOnDemandDing) {
                // wired cams return a ding from live_view so we don't need to wait
                return videoOnDemandDing;
            }
            // battery cams return '' from live_view so we need to request active dings and wait
            this.pollForActiveDing();
            return vodPromise;
        });
    }
    removeDingById(idToRemove) {
        const allActiveDings = this.activeDings, otherDings = allActiveDings.filter((ding) => ding.id_str !== idToRemove);
        this.onActiveDings.next(otherDings);
    }
    processActiveDing(ding) {
        const activeDings = this.activeDings, dingId = ding.id_str;
        this.onActiveDings.next(activeDings.filter((d) => d.id_str !== dingId).concat([ding]));
        this.onNewDing.next(ding);
        setTimeout(() => {
            this.removeDingById(ding.id_str);
            this.expiredDingIds = this.expiredDingIds.filter((id) => id !== dingId);
        }, 65 * 1000); // dings last ~1 minute
    }
    getEvents(options = {}) {
        return this.restClient.request({
            url: rest_client_1.clientApi(`locations/${this.data.location_id}/devices/${this.id}/events${getSearchQueryString(options)}`),
        });
    }
    videoSearch({ dateFrom, dateTo, order = 'asc' } = {
        dateFrom: getStartOfToday(),
        dateTo: getEndOfToday(),
    }) {
        return this.restClient.request({
            url: rest_client_1.clientApi(`video_search/history?doorbot_id=${this.id}&date_from=${dateFrom}&date_to=${dateTo}&order=${order}&api_version=11&includes%5B%5D=pva`),
        });
    }
    getPeriodicalFootage({ startAtMs, endAtMs } = {
        startAtMs: getStartOfToday(),
        endAtMs: getEndOfToday(),
    }) {
        // These will be mp4 clips that are created using periodic snapshots
        return this.restClient.request({
            url: `https://api.ring.com/recordings/public/footages/${this.id}?start_at_ms=${startAtMs}&end_at_ms=${endAtMs}&kinds=online_periodical&kinds=offline_periodical`,
        });
    }
    getRecordingUrl(dingIdStr, { transcoded = false } = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const path = transcoded ? 'recording' : 'share/play', response = yield this.restClient.request({
                url: rest_client_1.clientApi(`dings/${dingIdStr}/${path}?disable_redirect=true`),
            });
            return response.url;
        });
    }
    isTimestampInLifeTime(timestampAge) {
        return timestampAge < this.snapshotLifeTime;
    }
    get snapshotsAreBlocked() {
        return this.data.settings.motion_detection_enabled === false;
    }
    getSnapshotTimestamp() {
        return __awaiter(this, void 0, void 0, function* () {
            const { timestamps, responseTimestamp } = yield this.restClient.request({
                url: rest_client_1.clientApi('snapshots/timestamps'),
                method: 'POST',
                json: {
                    doorbot_ids: [this.id],
                },
            }), deviceTimestamp = timestamps[0], timestamp = deviceTimestamp ? deviceTimestamp.timestamp : 0, timestampAge = Math.abs(responseTimestamp - timestamp);
            this.lastSnapshotTimestampLocal = timestamp ? Date.now() - timestampAge : 0;
            return {
                timestamp,
                inLifeTime: this.isTimestampInLifeTime(timestampAge),
            };
        });
    }
    get snapshotLifeTime() {
        return this.avoidSnapshotBatteryDrain && this.operatingOnBattery
            ? 600 * 1000 // battery cams only refresh timestamp every 10 minutes
            : 10 * 1000; // snapshot updates will be forced.  Limit to 10 lifetime
    }
    get currentTimestampAge() {
        return Date.now() - this.lastSnapshotTimestampLocal;
    }
    get currentTimestampExpiresIn() {
        // Gets 0 if stale snapshot is used because snapshot timestamp refused to update (recording in progress on battery cam)
        return Math.max(this.lastSnapshotTimestampLocal - Date.now() + this.snapshotLifeTime, 0);
    }
    get hasSnapshotWithinLifetime() {
        return this.isTimestampInLifeTime(this.currentTimestampAge);
    }
    checkIfSnapshotsAreBlocked() {
        if (this.snapshotsAreBlocked) {
            throw new Error(`Motion detection is disabled for ${this.name}, which prevents snapshots from this camera.  This can be caused by Modes settings or by turning off the Record Motion setting.`);
        }
    }
    requestSnapshotUpdate() {
        return this.restClient.request({
            method: 'PUT',
            url: rest_client_1.clientApi('snapshots/update_all'),
            json: {
                doorbot_ids: [this.id],
                refresh: true,
            },
        });
    }
    refreshSnapshot() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.hasSnapshotWithinLifetime) {
                util_1.logInfo(`Snapshot for ${this.name} is still within its life time (${this.currentTimestampAge / 1000}s old)`);
                return true;
            }
            this.checkIfSnapshotsAreBlocked();
            if (!this.avoidSnapshotBatteryDrain || !this.operatingOnBattery) {
                // tell the camera to update snapshot immediately.
                // avoidSnapshotBatteryDrain is best if you have a battery cam that you request snapshots for frequently.  This can lead to battery drain if snapshot updates are forced.
                yield this.requestSnapshotUpdate();
            }
            for (let i = 0; i < maxSnapshotRefreshAttempts; i++) {
                this.checkIfSnapshotsAreBlocked();
                const { timestamp, inLifeTime } = yield this.getSnapshotTimestamp();
                if (!timestamp && this.isOffline) {
                    throw new Error(`No snapshot available and device ${this.name} is offline`);
                }
                if (inLifeTime) {
                    return false;
                }
                yield util_1.delay(snapshotRefreshDelay);
            }
            const extraMessageForBatteryCam = this.operatingOnBattery
                ? '.  This is normal behavior since this camera is unable to capture snapshots while streaming'
                : '';
            throw new Error(`Snapshot for ${this.name} failed to refresh after ${maxSnapshotRefreshAttempts} attempts${extraMessageForBatteryCam}`);
        });
    }
    getSnapshot() {
        return __awaiter(this, void 0, void 0, function* () {
            this.refreshSnapshotInProgress =
                this.refreshSnapshotInProgress ||
                    this.refreshSnapshot().catch((e) => {
                        util_1.logError(e.message);
                        throw e;
                    });
            try {
                const useLastSnapshot = yield this.refreshSnapshotInProgress;
                this.refreshSnapshotInProgress = undefined;
                if (useLastSnapshot && this.lastSnapshotPromise) {
                    return this.lastSnapshotPromise;
                }
            }
            catch (e) {
                this.refreshSnapshotInProgress = undefined;
                throw e;
            }
            this.lastSnapshotPromise = this.restClient.request({
                url: rest_client_1.clientApi(`snapshots/image/${this.id}`),
                responseType: 'buffer',
            });
            this.lastSnapshotPromise.catch(() => {
                // snapshot request failed, don't use it again
                this.lastSnapshotPromise = undefined;
            });
            return this.lastSnapshotPromise;
        });
    }
    getSipOptions() {
        return __awaiter(this, void 0, void 0, function* () {
            const activeDings = this.onActiveDings.getValue(), existingDing = activeDings
                .filter((ding) => !this.expiredDingIds.includes(ding.id_str))
                .slice()
                .reverse()[0], ding = existingDing || (yield this.getSipConnectionDetails());
            return {
                to: ding.sip_to,
                from: ding.sip_from,
                dingId: ding.id_str,
                localIp: yield camera_utils_1.getDefaultIpAddress(),
            };
        });
    }
    getUpdatedSipOptions(expiredDingId) {
        // Got a 480 from sip session, which means it's no longer active
        this.expiredDingIds.push(expiredDingId);
        return this.getSipOptions();
    }
    createSipSession(options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const audioSplitter = new camera_utils_1.RtpSplitter(), audioRtcpSplitter = new camera_utils_1.RtpSplitter(), videoSplitter = new camera_utils_1.RtpSplitter(), videoRtcpSplitter = new camera_utils_1.RtpSplitter(), [sipOptions, ffmpegIsInstalled, audioPort, audioRtcpPort, videoPort, videoRtcpPort, [tlsPort],] = yield Promise.all([
                this.getSipOptions(),
                options.skipFfmpegCheck ? Promise.resolve(true) : camera_utils_1.isFfmpegInstalled(),
                audioSplitter.portPromise,
                audioRtcpSplitter.portPromise,
                videoSplitter.portPromise,
                videoRtcpSplitter.portPromise,
                camera_utils_1.reservePorts(),
            ]), rtpOptions = {
                audio: Object.assign({ port: audioPort, rtcpPort: audioRtcpPort }, (options.audio || camera_utils_1.generateSrtpOptions())),
                video: Object.assign({ port: videoPort, rtcpPort: videoRtcpPort }, (options.video || camera_utils_1.generateSrtpOptions())),
            };
            if (!ffmpegIsInstalled) {
                throw new Error('Ffmpeg is not installed.  See https://github.com/dgreif/ring/wiki/FFmpeg for directions.');
            }
            return new sip_session_1.SipSession(sipOptions, rtpOptions, audioSplitter, audioRtcpSplitter, videoSplitter, videoRtcpSplitter, tlsPort, this);
        });
    }
    recordToFile(outputPath, duration = 30) {
        return __awaiter(this, void 0, void 0, function* () {
            const sipSession = yield this.streamVideo({
                output: ['-t', duration.toString(), outputPath],
            });
            yield sipSession.onCallEnded.pipe(operators_1.take(1)).toPromise();
        });
    }
    streamVideo(ffmpegOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            const sipSession = yield this.createSipSession();
            yield sipSession.start(ffmpegOptions);
            return sipSession;
        });
    }
    subscribeToDingEvents() {
        return this.restClient.request({
            method: 'POST',
            url: this.doorbotUrl('subscribe'),
        });
    }
    unsubscribeFromDingEvents() {
        return this.restClient.request({
            method: 'POST',
            url: this.doorbotUrl('unsubscribe'),
        });
    }
    subscribeToMotionEvents() {
        return this.restClient.request({
            method: 'POST',
            url: this.doorbotUrl('motions_subscribe'),
        });
    }
    unsubscribeFromMotionEvents() {
        return this.restClient.request({
            method: 'POST',
            url: this.doorbotUrl('motions_unsubscribe'),
        });
    }
    disconnect() {
        this.unsubscribe();
    }
}
exports.RingCamera = RingCamera;
// SOMEDAY: extract image from video file?
// ffmpeg -i input.mp4 -r 1 -f image2 image-%2d.png
