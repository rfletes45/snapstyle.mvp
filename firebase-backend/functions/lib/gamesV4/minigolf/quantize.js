"use strict";
/**
 * Mini Golf — Server-side Quantization (duplicated for parity)
 *
 * MUST remain in sync with src/gamesV4/games/miniGolf/utils/quantize.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.quantizeAngle = quantizeAngle;
exports.dequantizeAngle = dequantizeAngle;
exports.quantizePower = quantizePower;
exports.dequantizePower = dequantizePower;
exports.quantizePos = quantizePos;
exports.isValidAngleQ = isValidAngleQ;
exports.isValidPowerQ = isValidPowerQ;
function quantizeAngle(radians) {
    let degrees = ((radians * 180) / Math.PI) % 360;
    if (degrees < 0)
        degrees += 360;
    return Math.round(degrees * 10) % 3600;
}
function dequantizeAngle(angleQ) {
    const degrees = (angleQ % 3600) / 10;
    return (degrees * Math.PI) / 180;
}
function quantizePower(power) {
    return Math.round(Math.max(0, Math.min(1, power)) * 1000);
}
function dequantizePower(powerQ) {
    return Math.max(0, Math.min(1000, powerQ)) / 1000;
}
function quantizePos(x, y) {
    return {
        x: Math.round(x * 1000) / 1000,
        y: Math.round(y * 1000) / 1000,
    };
}
function isValidAngleQ(angleQ) {
    return Number.isInteger(angleQ) && angleQ >= 0 && angleQ <= 3599;
}
function isValidPowerQ(powerQ) {
    return Number.isInteger(powerQ) && powerQ >= 0 && powerQ <= 1000;
}
//# sourceMappingURL=quantize.js.map