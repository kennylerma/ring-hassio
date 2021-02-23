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
exports.randomString = exports.randomInteger = exports.mapAsync = exports.stringify = exports.requestInput = exports.getHardwareId = exports.generateUuid = exports.enableDebug = exports.useLogger = exports.logError = exports.logInfo = exports.logDebug = exports.delay = void 0;
const debug = require("debug");
const colors_1 = require("colors");
const readline_1 = require("readline");
const uuid_1 = require("uuid");
const systeminformation_1 = require("systeminformation");
const debugLogger = debug('ring'), uuidNamespace = 'e53ffdc0-e91d-4ce1-bec2-df939d94739c';
let logger = {
    logInfo(message) {
        debugLogger(message);
    },
    logError(message) {
        debugLogger(colors_1.red(message));
    },
}, debugEnabled = false;
function delay(milliseconds) {
    return new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
    });
}
exports.delay = delay;
function logDebug(message) {
    if (debugEnabled) {
        logger.logInfo(message);
    }
}
exports.logDebug = logDebug;
function logInfo(message) {
    logger.logInfo(message);
}
exports.logInfo = logInfo;
function logError(message) {
    logger.logError(message);
}
exports.logError = logError;
function useLogger(newLogger) {
    logger = newLogger;
}
exports.useLogger = useLogger;
function enableDebug() {
    debugEnabled = true;
}
exports.enableDebug = enableDebug;
function generateUuid(seed) {
    if (seed) {
        return uuid_1.v5(seed, uuidNamespace);
    }
    return uuid_1.v4();
}
exports.generateUuid = generateUuid;
function getHardwareId(systemId) {
    return __awaiter(this, void 0, void 0, function* () {
        if (systemId) {
            return generateUuid(systemId);
        }
        const timeoutValue = '-1', { os: id } = yield Promise.race([
            systeminformation_1.uuid(),
            delay(5000).then(() => ({ os: timeoutValue })),
        ]);
        if (id === timeoutValue) {
            logError('Request for system uuid timed out.  Falling back to random session id');
            return uuid_1.v4();
        }
        if (id === '-') {
            // default value set by systeminformation if it can't find a real value
            logError('Unable to get system uuid.  Falling back to random session id');
            return uuid_1.v4();
        }
        return generateUuid(id);
    });
}
exports.getHardwareId = getHardwareId;
function requestInput(question) {
    return __awaiter(this, void 0, void 0, function* () {
        const lineReader = readline_1.createInterface({
            input: process.stdin,
            output: process.stdout,
        }), answer = yield new Promise((resolve) => {
            lineReader.question(question, resolve);
        });
        lineReader.close();
        return answer.trim();
    });
}
exports.requestInput = requestInput;
function stringify(data) {
    if (typeof data === 'string') {
        return data;
    }
    if (typeof data === 'object' && Buffer.isBuffer(data)) {
        return data.toString();
    }
    return JSON.stringify(data) + '';
}
exports.stringify = stringify;
function mapAsync(records, asyncMapper) {
    return Promise.all(records.map((record) => asyncMapper(record)));
}
exports.mapAsync = mapAsync;
function randomInteger() {
    return Math.floor(Math.random() * 99999999) + 100000;
}
exports.randomInteger = randomInteger;
function randomString(length) {
    const uuid = generateUuid();
    return uuid.replace(/-/g, '').substring(0, length).toLowerCase();
}
exports.randomString = randomString;
