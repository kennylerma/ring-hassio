import { Options as RequestOptions } from 'got';
import { AuthTokenResponse, SessionResponse } from './ring-types';
import { ReplaySubject } from 'rxjs';
export declare function clientApi(path: string): string;
export declare function appApi(path: string): string;
export interface ExtendedResponse {
    responseTimestamp: number;
}
export interface EmailAuth {
    email: string;
    password: string;
    systemId?: string;
}
export interface RefreshTokenAuth {
    refreshToken: string;
    systemId?: string;
}
export interface SessionOptions {
    controlCenterDisplayName?: string;
}
export declare class RingRestClient {
    private authOptions;
    refreshToken: string | undefined;
    private hardwareIdPromise;
    private authPromise;
    private sessionPromise?;
    using2fa: boolean;
    onRefreshTokenUpdated: ReplaySubject<{
        oldRefreshToken?: string | undefined;
        newRefreshToken: string;
    }>;
    constructor(authOptions: (EmailAuth | RefreshTokenAuth) & SessionOptions);
    private getGrantData;
    getAuth(twoFactorAuthCode?: string): Promise<AuthTokenResponse>;
    private fetchNewSession;
    getSession(): Promise<SessionResponse>;
    private refreshAuth;
    private refreshSession;
    request<T = void>(options: RequestOptions & {
        url: string;
    }): Promise<T & ExtendedResponse>;
    getCurrentAuth(): Promise<AuthTokenResponse>;
}
