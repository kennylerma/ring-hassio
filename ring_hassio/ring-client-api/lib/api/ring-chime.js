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
exports.RingChime = void 0;
const rest_client_1 = require("./rest-client");
const rxjs_1 = require("rxjs");
const settingsWhichRequireReboot = [
    'ding_audio_id',
    'ding_audio_user_id',
    'motion_audio_id',
    'motion_audio_user_id',
];
class RingChime {
    constructor(initialData, restClient) {
        this.initialData = initialData;
        this.restClient = restClient;
        this.id = this.initialData.id;
        this.deviceType = this.initialData.kind;
        this.model = this.deviceType === 'chime_pro' ? 'Chime Pro' : 'Chime';
        this.onData = new rxjs_1.BehaviorSubject(this.initialData);
        this.onRequestUpdate = new rxjs_1.Subject();
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
    get description() {
        return this.data.description;
    }
    get volume() {
        return this.data.settings.volume;
    }
    getRingtones() {
        return this.restClient.request({
            url: rest_client_1.clientApi('ringtones'),
        });
    }
    getRingtoneByDescription(description, kind) {
        return __awaiter(this, void 0, void 0, function* () {
            const ringtones = yield this.getRingtones(), requestedRingtone = ringtones.audios.find((audio) => audio.available &&
                audio.description === description &&
                audio.kind === kind);
            if (!requestedRingtone) {
                throw new Error('Requested ringtone not found');
            }
            return requestedRingtone;
        });
    }
    chimeUrl(path = '') {
        return rest_client_1.clientApi(`chimes/${this.id}/${path}`);
    }
    playSound(kind) {
        return this.restClient.request({
            url: this.chimeUrl('play_sound'),
            method: 'POST',
            json: { kind },
        });
    }
    snooze(time) {
        return __awaiter(this, void 0, void 0, function* () {
            // time is in minutes, max 24 * 60 (1440)
            yield this.restClient.request({
                url: this.chimeUrl('do_not_disturb'),
                method: 'POST',
                json: { time },
            });
            this.requestUpdate();
        });
    }
    clearSnooze() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.restClient.request({
                url: this.chimeUrl('do_not_disturb'),
                method: 'POST',
            });
            this.requestUpdate();
        });
    }
    updateChime(update) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.restClient.request({
                url: this.chimeUrl(),
                method: 'PUT',
                json: { chime: update },
            });
            this.requestUpdate();
            // inform caller if this change requires a reboot
            return Object.keys(update.settings || {}).some((key) => settingsWhichRequireReboot.includes(key));
        });
    }
    setVolume(volume) {
        if (volume < 0 || volume > 11) {
            throw new Error(`Volume for ${this.name} must be between 0 and 11, got ${volume}`);
        }
        return this.updateChime({
            settings: {
                volume,
            },
        });
    }
}
exports.RingChime = RingChime;
