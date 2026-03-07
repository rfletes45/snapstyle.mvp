/**
 * Mini Golf — Server-side Quantization (duplicated for parity)
 *
 * MUST remain in sync with src/gamesV4/games/miniGolf/utils/quantize.ts
 */
export declare function quantizeAngle(radians: number): number;
export declare function dequantizeAngle(angleQ: number): number;
export declare function quantizePower(power: number): number;
export declare function dequantizePower(powerQ: number): number;
export declare function quantizePos(x: number, y: number): {
    x: number;
    y: number;
};
export declare function isValidAngleQ(angleQ: number): boolean;
export declare function isValidPowerQ(powerQ: number): boolean;
