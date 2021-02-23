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
exports.RingApi = void 0;
const rest_client_1 = require("./rest-client");
const location_1 = require("./location");
const ring_camera_1 = require("./ring-camera");
const ring_chime_1 = require("./ring-chime");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const util_1 = require("./util");
const ffmpeg_1 = require("./ffmpeg");
const subscribed_1 = require("./subscribed");
class RingApi extends subscribed_1.Subscribed {
    constructor(options) {
        super();
        this.options = options;
        this.restClient = new rest_client_1.RingRestClient(this.options);
        this.onRefreshTokenUpdated = this.restClient.onRefreshTokenUpdated.asObservable();
        this.locations = this.fetchAndBuildLocations();
        if (options.debug) {
            util_1.enableDebug();
        }
        const { locationIds, ffmpegPath } = options;
        if (locationIds && !locationIds.length) {
            util_1.logError('Your Ring config has `"locationIds": []`, which means no locations will be used and no devices will be found.');
        }
        if (ffmpegPath) {
            ffmpeg_1.setFfmpegPath(ffmpegPath);
        }
    }
    fetchRingDevices() {
        return __awaiter(this, void 0, void 0, function* () {
            const { doorbots, chimes, authorized_doorbots: authorizedDoorbots, stickup_cams: stickupCams, base_stations: baseStations, beams_bridges: beamBridges, } = yield this.restClient.request({ url: rest_client_1.clientApi('ring_devices') });
            return {
                doorbots,
                chimes,
                authorizedDoorbots,
                stickupCams,
                allCameras: doorbots.concat(stickupCams, authorizedDoorbots),
                baseStations,
                beamBridges,
            };
        });
    }
    fetchActiveDings() {
        return this.restClient.request({
            url: rest_client_1.clientApi('dings/active'),
        });
    }
    listenForDeviceUpdates(cameras, chimes) {
        const { cameraStatusPollingSeconds, cameraDingsPollingSeconds, } = this.options, onCamerasRequestUpdate = rxjs_1.merge(...cameras.map((camera) => camera.onRequestUpdate)), onChimesRequestUpdate = rxjs_1.merge(...chimes.map((chime) => chime.onRequestUpdate)), onCamerasRequestActiveDings = rxjs_1.merge(...cameras.map((camera) => camera.onRequestActiveDings)), onUpdateReceived = new rxjs_1.Subject(), onActiveDingsReceived = new rxjs_1.Subject(), onPollForStatusUpdate = cameraStatusPollingSeconds
            ? onUpdateReceived.pipe(operators_1.debounceTime(cameraStatusPollingSeconds * 1000))
            : rxjs_1.EMPTY, onPollForActiveDings = cameraDingsPollingSeconds
            ? onActiveDingsReceived.pipe(operators_1.debounceTime(cameraDingsPollingSeconds * 1000))
            : rxjs_1.EMPTY, camerasById = cameras.reduce((byId, camera) => {
            byId[camera.id] = camera;
            return byId;
        }, {}), chimesById = chimes.reduce((byId, chime) => {
            byId[chime.id] = chime;
            return byId;
        }, {});
        if (!cameras.length && !chimes.length) {
            return;
        }
        this.addSubscriptions(rxjs_1.merge(onCamerasRequestUpdate, onChimesRequestUpdate, onPollForStatusUpdate)
            .pipe(operators_1.throttleTime(500), operators_1.switchMap(() => __awaiter(this, void 0, void 0, function* () {
            const response = yield this.fetchRingDevices().catch(() => null);
            return response;
        })))
            .subscribe((response) => {
            onUpdateReceived.next();
            if (!response) {
                return;
            }
            response.allCameras.forEach((data) => {
                const camera = camerasById[data.id];
                if (camera) {
                    camera.updateData(data);
                }
            });
            response.chimes.forEach((data) => {
                const chime = chimesById[data.id];
                if (chime) {
                    chime.updateData(data);
                }
            });
        }));
        if (cameraStatusPollingSeconds) {
            onUpdateReceived.next(); // kick off polling
        }
        this.addSubscriptions(rxjs_1.merge(onCamerasRequestActiveDings, onPollForActiveDings).subscribe(() => __awaiter(this, void 0, void 0, function* () {
            const activeDings = yield this.fetchActiveDings().catch(() => null);
            onActiveDingsReceived.next();
            if (!activeDings || !activeDings.length) {
                return;
            }
            activeDings.forEach((activeDing) => {
                const camera = camerasById[activeDing.doorbot_id];
                if (camera) {
                    camera.processActiveDing(activeDing);
                }
            });
        })));
        if (cameras.length && cameraDingsPollingSeconds) {
            onActiveDingsReceived.next(); // kick off polling
        }
    }
    fetchRawLocations() {
        return __awaiter(this, void 0, void 0, function* () {
            const { user_locations: rawLocations } = yield this.restClient.request({ url: 'https://app.ring.com/rhq/v1/devices/v1/locations' });
            if (!rawLocations) {
                throw new Error('The Ring account which you used to generate a refresh token does not have any associated locations.  Please use an account that has access to at least one location.');
            }
            return rawLocations;
        });
    }
    fetchAmazonKeyLocks() {
        return this.restClient.request({
            url: 'https://api.ring.com/integrations/amazonkey/v2/devices/lock_associations',
        });
    }
    fetchAndBuildLocations() {
        return __awaiter(this, void 0, void 0, function* () {
            const rawLocations = yield this.fetchRawLocations(), { authorizedDoorbots, chimes, doorbots, allCameras, baseStations, beamBridges, } = yield this.fetchRingDevices(), locationIdsWithHubs = [...baseStations, ...beamBridges].map((x) => x.location_id), cameras = allCameras.map((data) => new ring_camera_1.RingCamera(data, doorbots.includes(data) ||
                authorizedDoorbots.includes(data) ||
                data.kind.startsWith('doorbell'), this.restClient, this.options.avoidSnapshotBatteryDrain || false)), ringChimes = chimes.map((data) => new ring_chime_1.RingChime(data, this.restClient)), locations = rawLocations
                .filter((location) => {
                return (!Array.isArray(this.options.locationIds) ||
                    this.options.locationIds.includes(location.location_id));
            })
                .map((location) => new location_1.Location(location, cameras.filter((x) => x.data.location_id === location.location_id), ringChimes.filter((x) => x.data.location_id === location.location_id), {
                hasHubs: locationIdsWithHubs.includes(location.location_id),
                hasAlarmBaseStation: baseStations.some((station) => station.location_id === location.location_id),
                locationModePollingSeconds: this.options
                    .locationModePollingSeconds,
            }, this.restClient));
            this.listenForDeviceUpdates(cameras, ringChimes);
            return locations;
        });
    }
    getLocations() {
        return this.locations;
    }
    getCameras() {
        return __awaiter(this, void 0, void 0, function* () {
            const locations = yield this.locations;
            return locations.reduce((cameras, location) => [...cameras, ...location.cameras], []);
        });
    }
    getProfile() {
        return this.restClient.request({
            url: rest_client_1.clientApi('profile'),
        });
    }
    disconnect() {
        this.unsubscribe();
        this.locations.then((locations) => locations.forEach((location) => location.disconnect()));
    }
}
exports.RingApi = RingApi;
