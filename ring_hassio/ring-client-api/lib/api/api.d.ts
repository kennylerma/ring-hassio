import { RefreshTokenAuth, RingRestClient, SessionOptions } from './rest-client';
import { Location } from './location';
import { ActiveDing, BaseStation, BeamBridge, CameraData, ChimeData, ProfileResponse, UserLocation } from './ring-types';
import { RingCamera } from './ring-camera';
import { Subscribed } from './subscribed';
export interface RingApiOptions extends SessionOptions {
    locationIds?: string[];
    cameraStatusPollingSeconds?: number;
    cameraDingsPollingSeconds?: number;
    locationModePollingSeconds?: number;
    avoidSnapshotBatteryDrain?: boolean;
    debug?: boolean;
    ffmpegPath?: string;
    externalPorts?: {
        start: number;
        end: number;
    };
}
export declare class RingApi extends Subscribed {
    readonly options: RingApiOptions & RefreshTokenAuth;
    readonly restClient: RingRestClient;
    readonly onRefreshTokenUpdated: import("rxjs").Observable<{
        oldRefreshToken?: string | undefined;
        newRefreshToken: string;
    }>;
    private locations;
    constructor(options: RingApiOptions & RefreshTokenAuth);
    fetchRingDevices(): Promise<{
        doorbots: CameraData[];
        chimes: ChimeData[];
        authorizedDoorbots: CameraData[];
        stickupCams: CameraData[];
        allCameras: CameraData[];
        baseStations: BaseStation[];
        beamBridges: BeamBridge[];
    }>;
    fetchActiveDings(): Promise<ActiveDing[] & import("./rest-client").ExtendedResponse>;
    private listenForDeviceUpdates;
    fetchRawLocations(): Promise<UserLocation[]>;
    fetchAmazonKeyLocks(): Promise<any[] & import("./rest-client").ExtendedResponse>;
    fetchAndBuildLocations(): Promise<Location[]>;
    getLocations(): Promise<Location[]>;
    getCameras(): Promise<RingCamera[]>;
    getProfile(): Promise<ProfileResponse & import("./rest-client").ExtendedResponse>;
    disconnect(): void;
}
