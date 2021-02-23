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
exports.logRefreshToken = exports.acquireRefreshToken = void 0;
/* eslint-disable no-console */
const rest_client_1 = require("./rest-client");
const util_1 = require("./util");
function acquireRefreshToken() {
    return __awaiter(this, void 0, void 0, function* () {
        const email = yield util_1.requestInput('Email: '), password = yield util_1.requestInput('Password: '), restClient = new rest_client_1.RingRestClient({ email, password }), getAuthWith2fa = () => __awaiter(this, void 0, void 0, function* () {
            const code = yield util_1.requestInput('2fa Code: ');
            try {
                return yield restClient.getAuth(code);
            }
            catch (_) {
                console.log('Incorrect 2fa code. Please try again.');
                return getAuthWith2fa();
            }
        }), auth = yield restClient.getCurrentAuth().catch((e) => {
            if (restClient.using2fa) {
                console.log('Ring 2fa or verification code is enabled.  Please enter code from the text/email.');
                return getAuthWith2fa();
            }
            console.error(e);
            process.exit(1);
        });
        return auth.refresh_token;
    });
}
exports.acquireRefreshToken = acquireRefreshToken;
function logRefreshToken() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('This CLI will provide you with a refresh token which you can use to configure ring-client-api and homebridge-ring.');
        const refreshToken = yield acquireRefreshToken();
        console.log('\nSuccessfully logged in to Ring. Please add the following to your config:\n');
        console.log(`"refreshToken": "${refreshToken}"`);
    });
}
exports.logRefreshToken = logRefreshToken;
// eslint-disable-next-line @typescript-eslint/no-empty-function
process.on('unhandledRejection', () => { });
