"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RingDevice = void 0;
const rxjs_1 = require("rxjs");
const ring_types_1 = require("./ring-types");
const operators_1 = require("rxjs/operators");
const subscribed_1 = require("./subscribed");
class RingDevice extends subscribed_1.Subscribed {
    constructor(initialData, location, assetId) {
        super();
        this.initialData = initialData;
        this.location = location;
        this.assetId = assetId;
        this.onData = new rxjs_1.BehaviorSubject(this.initialData);
        this.zid = this.initialData.zid;
        this.id = this.zid;
        this.deviceType = this.initialData.deviceType;
        this.categoryId = this.initialData.categoryId;
        this.onComponentDevices = this.location.onDevices.pipe(operators_1.map((devices) => devices.filter(({ data }) => data.parentZid === this.id)));
        this.addSubscriptions(location.onDeviceDataUpdate
            .pipe(operators_1.filter((update) => update.zid === this.zid))
            .subscribe((update) => this.updateData(update)));
    }
    updateData(update) {
        this.onData.next(Object.assign({}, this.data, update));
    }
    get data() {
        return this.onData.getValue();
    }
    get name() {
        return this.data.name;
    }
    get supportsVolume() {
        return (ring_types_1.deviceTypesWithVolume.includes(this.data.deviceType) &&
            this.data.volume !== undefined);
    }
    setVolume(volume) {
        if (isNaN(volume) || volume < 0 || volume > 1) {
            throw new Error('Volume must be between 0 and 1');
        }
        if (!this.supportsVolume) {
            throw new Error(`Volume can only be set on ${ring_types_1.deviceTypesWithVolume.join(', ')}`);
        }
        return this.setInfo({ device: { v1: { volume } } });
    }
    setInfo(body) {
        return this.location.sendMessage({
            msg: 'DeviceInfoSet',
            datatype: 'DeviceInfoSetType',
            dst: this.assetId,
            body: [
                Object.assign({ zid: this.zid }, body),
            ],
        });
    }
    sendCommand(commandType, data = {}) {
        this.setInfo({
            command: {
                v1: [
                    {
                        commandType,
                        data,
                    },
                ],
            },
        });
    }
    toString() {
        return this.toJSON();
    }
    toJSON() {
        return JSON.stringify({
            data: this.data,
        }, null, 2);
    }
    disconnect() {
        this.unsubscribe();
    }
}
exports.RingDevice = RingDevice;
