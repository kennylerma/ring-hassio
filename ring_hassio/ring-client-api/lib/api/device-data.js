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
exports.logDeviceData = void 0;
/* eslint-disable no-console */
const api_1 = require("./api");
const refresh_token_1 = require("./refresh-token");
const util_1 = require("./util");
const sensitiveFields = [
    'id',
    'device_id',
    'latitude',
    'longitude',
    'address',
    'email',
    'time_zone',
    'location_id',
    'serialNumber',
    'catalogId',
    'adapterZid',
    'fingerprint',
    'owner',
    'ssid',
    'ap_address',
    'codes',
    'groupId',
    'group',
    'groupMembers',
];
function stripSensitiveFields(input) {
    if (typeof input === 'object') {
        if (Array.isArray(input)) {
            input.forEach((value) => stripSensitiveFields(value));
            return;
        }
        for (const key in input) {
            if (sensitiveFields.includes(key) || key.endsWith('_id')) {
                delete input[key];
            }
            else {
                const data = input[key];
                if (key.length === 36) {
                    input[key.substr(0, 13) + '-uuid'] = data;
                    delete input[key];
                }
                if (typeof data === 'string' && data.length === 36) {
                    input[key] = data.substr(0, 13) + '-uuid';
                }
                stripSensitiveFields(data);
            }
        }
    }
}
function logDeviceData() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('This CLI will log data from you Ring Account to help debug issues and discovering new device types.');
        console.log('The logged data is anonymized and should not compromise your account in any way.');
        const refreshToken = yield refresh_token_1.acquireRefreshToken(), ringApi = new api_1.RingApi({ refreshToken });
        console.log('Successfully logged in.  Fetching devices...');
        const locations = yield ringApi.getLocations(), amazonKeyLocks = yield ringApi.fetchAmazonKeyLocks(), locationsWithDevices = yield util_1.mapAsync(locations, (location) => __awaiter(this, void 0, void 0, function* () {
            const devices = yield location.getDevices();
            return {
                name: location.name,
                cameras: location.cameras.map((camera) => camera.data),
                chimes: location.chimes.map((chime) => chime.data),
                devices: devices.map((device) => device.data),
            };
        })), results = {
            locations: locationsWithDevices,
            amazonKeyLocks,
        };
        stripSensitiveFields(results);
        console.log('\nPlease copy and paste everything AFTER THIS LINE:\n\n');
        console.log(JSON.stringify(results));
        process.exit(0);
    });
}
exports.logDeviceData = logDeviceData;
