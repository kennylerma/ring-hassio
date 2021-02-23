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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RingRestClient = exports.appApi = exports.clientApi = void 0;
const got_1 = __importDefault(require("got"));
const util_1 = require("./util");
const rxjs_1 = require("rxjs");
const defaultRequestOptions = {
    http2: true,
    responseType: 'json',
    method: 'GET',
}, ringErrorCodes = {
    7050: 'NO_ASSET',
    7019: 'ASSET_OFFLINE',
    7061: 'ASSET_CELL_BACKUP',
    7062: 'UPDATING',
    7063: 'MAINTENANCE',
}, clientApiBaseUrl = 'https://api.ring.com/clients_api/', appApiBaseUrl = 'https://app.ring.com/api/v1/', apiVersion = 11;
function clientApi(path) {
    return clientApiBaseUrl + path;
}
exports.clientApi = clientApi;
function appApi(path) {
    return appApiBaseUrl + path;
}
exports.appApi = appApi;
function requestWithRetry(requestOptions) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const options = Object.assign(Object.assign({}, defaultRequestOptions), requestOptions), { headers, body } = (yield got_1.default(options)), data = body;
            if (data !== null && typeof data === 'object' && headers.date) {
                data.responseTimestamp = new Date(headers.date).getTime();
            }
            return data;
        }
        catch (e) {
            if (!e.response) {
                util_1.logError(`Failed to reach Ring server at ${requestOptions.url}.  ${e.message}.  Trying again in 5 seconds...`);
                if (e.message.includes('NGHTTP2_ENHANCE_YOUR_CALM')) {
                    util_1.logError(`There is a known issue with your current NodeJS version (${process.version}).  Please see https://github.com/dgreif/ring/wiki/NGHTTP2_ENHANCE_YOUR_CALM-Error for details`);
                }
                util_1.logDebug(e);
                yield util_1.delay(5000);
                return requestWithRetry(requestOptions);
            }
            throw e;
        }
    });
}
class RingRestClient {
    constructor(authOptions) {
        this.authOptions = authOptions;
        // prettier-ignore
        this.refreshToken = ('refreshToken' in this.authOptions ? this.authOptions.refreshToken : undefined);
        this.hardwareIdPromise = util_1.getHardwareId(this.authOptions.systemId);
        this.authPromise = this.getAuth();
        this.sessionPromise = undefined;
        this.using2fa = false;
        this.onRefreshTokenUpdated = new rxjs_1.ReplaySubject(1);
    }
    getGrantData(twoFactorAuthCode) {
        if (this.refreshToken && !twoFactorAuthCode) {
            return {
                grant_type: 'refresh_token',
                refresh_token: this.refreshToken,
            };
        }
        const { authOptions } = this;
        if ('email' in authOptions) {
            return {
                grant_type: 'password',
                password: authOptions.password,
                username: authOptions.email,
            };
        }
        throw new Error('Refresh token is not valid.  Unable to authenticate with Ring servers.  See https://github.com/dgreif/ring/wiki/Refresh-Tokens');
    }
    getAuth(twoFactorAuthCode) {
        return __awaiter(this, void 0, void 0, function* () {
            const grantData = this.getGrantData(twoFactorAuthCode);
            try {
                const response = yield requestWithRetry({
                    url: 'https://oauth.ring.com/oauth/token',
                    json: Object.assign({ client_id: 'ring_official_android', scope: 'client' }, grantData),
                    method: 'POST',
                    headers: {
                        '2fa-support': 'true',
                        '2fa-code': twoFactorAuthCode || '',
                        hardware_id: yield this.hardwareIdPromise,
                        'User-Agent': 'android:com.ringapp'
                    },
                });
                this.onRefreshTokenUpdated.next({
                    oldRefreshToken: this.refreshToken,
                    newRefreshToken: response.refresh_token,
                });
                this.refreshToken = response.refresh_token;
                return response;
            }
            catch (requestError) {
                if (grantData.refresh_token) {
                    // failed request with refresh token
                    this.refreshToken = undefined;
                    util_1.logError(requestError);
                    return this.getAuth();
                }
                const response = requestError.response || {}, responseData = response.body || {}, responseError = typeof responseData.error === 'string' ? responseData.error : '';
                if (response.statusCode === 412 || // need 2fa code
                    (response.statusCode === 400 &&
                        responseError.startsWith('Verification Code')) // invalid 2fa code entered
                ) {
                    this.using2fa = true;
                    throw new Error('Your Ring account is configured to use 2-factor authentication (2fa).  See https://github.com/dgreif/ring/wiki/Refresh-Tokens for details.');
                }
                const authTypeMessage = 'refreshToken' in this.authOptions
                    ? 'refresh token is'
                    : 'email and password are', errorMessage = 'Failed to fetch oauth token from Ring. ' +
                    (responseData.error_description ===
                        'too many requests from dependency service'
                        ? 'You have requested too many 2fa codes.  Ring limits 2fa to 10 codes within 10 minutes.  Please try again in 10 minutes.'
                        : `Verify that your ${authTypeMessage} correct.`) +
                    ` (error: ${responseError})`;
                util_1.logError(requestError.response || requestError);
                util_1.logError(errorMessage);
                throw new Error(errorMessage);
            }
        });
    }
    fetchNewSession(authToken) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            return requestWithRetry({
                url: clientApi('session'),
                json: {
                    device: {
                        hardware_id: yield this.hardwareIdPromise,
                        metadata: {
                            api_version: apiVersion,
                            device_model: (_a = this.authOptions.controlCenterDisplayName) !== null && _a !== void 0 ? _a : 'ring-client-api',
                        },
                        os: 'android',
                    },
                },
                method: 'POST',
                headers: {
                    authorization: `Bearer ${authToken.access_token}`,
                },
            });
        });
    }
    getSession() {
        return this.authPromise.then((authToken) => __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.fetchNewSession(authToken);
            }
            catch (e) {
                const response = e.response || {};
                if (response.statusCode === 401) {
                    this.refreshAuth();
                    return this.getSession();
                }
                if (response.statusCode === 429) {
                    const retryAfter = e.response.headers['retry-after'], waitSeconds = isNaN(retryAfter)
                        ? 200
                        : Number.parseInt(retryAfter, 10);
                    util_1.logError(`Session response rate limited. Waiting to retry after ${waitSeconds} seconds`);
                    yield util_1.delay((waitSeconds + 1) * 1000);
                    util_1.logInfo('Retrying session request');
                    return this.getSession();
                }
                throw e;
            }
        }));
    }
    refreshAuth() {
        this.authPromise = this.getAuth();
    }
    refreshSession() {
        this.sessionPromise = this.getSession();
    }
    request(options) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const hardwareId = yield this.hardwareIdPromise, url = options.url, initialSessionPromise = this.sessionPromise;
            try {
                yield initialSessionPromise;
                const authTokenResponse = yield this.authPromise;
                return yield requestWithRetry(Object.assign(Object.assign({}, options), { headers: Object.assign(Object.assign({}, options.headers), { authorization: `Bearer ${authTokenResponse.access_token}`, hardware_id: hardwareId, 'User-Agent': 'android:com.ringapp' }) }));
            }
            catch (e) {
                const response = e.response || {};
                if (response.statusCode === 401) {
                    this.refreshAuth();
                    return this.request(options);
                }
                if (response.statusCode === 404 &&
                    response.body &&
                    Array.isArray(response.body.errors)) {
                    const errors = response.body.errors, errorText = errors
                        .map((code) => ringErrorCodes[code])
                        .filter((x) => x)
                        .join(', ');
                    if (errorText) {
                        util_1.logError(`http request failed.  ${url} returned errors: (${errorText}).  Trying again in 20 seconds`);
                        yield util_1.delay(20000);
                        return this.request(options);
                    }
                    util_1.logError(`http request failed.  ${url} returned unknown errors: (${util_1.stringify(errors)}).`);
                }
                if (response.statusCode === 404 && url.startsWith(clientApiBaseUrl)) {
                    util_1.logError('404 from endpoint ' + url);
                    if ((_b = (_a = response.body) === null || _a === void 0 ? void 0 : _a.error) === null || _b === void 0 ? void 0 : _b.includes(hardwareId)) {
                        util_1.logError('Session hardware_id not found.  Creating a new session and trying again.');
                        if (this.sessionPromise === initialSessionPromise) {
                            this.refreshSession();
                        }
                        return this.request(options);
                    }
                    throw new Error('Not found with response: ' + util_1.stringify(response.body));
                }
                if (response.statusCode) {
                    util_1.logError(`Request to ${url} failed with status ${response.statusCode}. Response body: ${util_1.stringify(response.body)}`);
                }
                else {
                    util_1.logError(`Request to ${url} failed:`);
                    util_1.logError(e);
                }
                throw e;
            }
        });
    }
    getCurrentAuth() {
        return this.authPromise;
    }
}
exports.RingRestClient = RingRestClient;
