import { ChimeData, ChimeUpdate, ChimeSoundKind, RingtoneOptions } from './ring-types';
import { RingRestClient } from './rest-client';
import { BehaviorSubject, Subject } from 'rxjs';
export declare class RingChime {
    private initialData;
    private restClient;
    id: number;
    deviceType: "chime" | "chime_pro";
    model: string;
    onData: BehaviorSubject<ChimeData>;
    onRequestUpdate: Subject<unknown>;
    constructor(initialData: ChimeData, restClient: RingRestClient);
    updateData(update: ChimeData): void;
    requestUpdate(): void;
    get data(): ChimeData;
    get name(): string;
    get description(): string;
    get volume(): number;
    getRingtones(): Promise<RingtoneOptions & import("./rest-client").ExtendedResponse>;
    getRingtoneByDescription(description: string, kind: ChimeSoundKind): Promise<{
        user_id: string;
        id: string;
        description: string;
        kind: string;
        url: string;
        checksum: string;
        available: string;
    }>;
    chimeUrl(path?: string): string;
    playSound(kind: ChimeSoundKind): Promise<void & import("./rest-client").ExtendedResponse>;
    snooze(time: number): Promise<void>;
    clearSnooze(): Promise<void>;
    updateChime(update: ChimeUpdate): Promise<boolean>;
    setVolume(volume: number): Promise<boolean>;
}
