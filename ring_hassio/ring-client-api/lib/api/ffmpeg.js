"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFfmpegPath = exports.setFfmpegPath = void 0;
let ffmpegPath;
function setFfmpegPath(path) {
    ffmpegPath = path;
}
exports.setFfmpegPath = setFfmpegPath;
function getFfmpegPath() {
    return ffmpegPath;
}
exports.getFfmpegPath = getFfmpegPath;
