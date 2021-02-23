"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStunResponder = exports.sendStunBindingRequest = exports.isStunMessage = void 0;
const util_1 = require("./util");
const stun = require('stun');
const stunMagicCookie = 0x2112a442; // https://tools.ietf.org/html/rfc5389#section-6
function isStunMessage(message) {
    return message.length > 8 && message.readInt32BE(4) === stunMagicCookie;
}
exports.isStunMessage = isStunMessage;
function sendStunBindingRequest({ rtpDescription, rtpSplitter, localUfrag, type, }) {
    const message = stun.createMessage(1), remoteDescription = rtpDescription[type];
    message.addUsername(remoteDescription.iceUFrag + ':' + localUfrag);
    message.addMessageIntegrity(remoteDescription.icePwd);
    stun
        .request(`${rtpDescription.address}:${remoteDescription.port}`, {
        socket: rtpSplitter.socket,
        message,
    })
        .then(() => util_1.logDebug(`${type} stun complete`))
        .catch((e) => {
        util_1.logError(`${type} stun error`);
        util_1.logError(e);
    });
}
exports.sendStunBindingRequest = sendStunBindingRequest;
function createStunResponder(rtpSplitter) {
    return rtpSplitter.addMessageHandler(({ message, info }) => {
        if (!isStunMessage(message)) {
            return null;
        }
        try {
            const decodedMessage = stun.decode(message), response = stun.createMessage(stun.constants.STUN_BINDING_RESPONSE, decodedMessage.transactionId);
            response.addXorAddress(info.address, info.port);
            rtpSplitter.send(stun.encode(response), info).catch(util_1.logError);
        }
        catch (e) {
            util_1.logDebug('Failed to Decode STUN Message');
            util_1.logDebug(message.toString('hex'));
            util_1.logDebug(e);
        }
        return null;
    });
}
exports.createStunResponder = createStunResponder;
