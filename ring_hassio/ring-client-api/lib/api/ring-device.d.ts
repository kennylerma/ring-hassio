import { BehaviorSubject } from 'rxjs';
import { RingDeviceData } from './ring-types';
import { Location } from './location';
import { Subscribed } from './subscribed';
export declare class RingDevice extends Subscribed {
    private initialData;
    location: Location;
    assetId: string;
    onData: BehaviorSubject<RingDeviceData>;
    zid: string;
    id: string;
    deviceType: import("./ring-types").RingDeviceType;
    categoryId: number;
    onComponentDevices: import("rxjs").Observable<RingDevice[]>;
    constructor(initialData: RingDeviceData, location: Location, assetId: string);
    updateData(update: Partial<RingDeviceData>): void;
    get data(): RingDeviceData;
    get name(): string;
    get supportsVolume(): boolean;
    setVolume(volume: number): Promise<void>;
    setInfo(body: any): Promise<void>;
    sendCommand(commandType: string, data?: {}): void;
    toString(): string;
    toJSON(): string;
    disconnect(): void;
}
