/**
 * Mini Golf — Quantization Utilities
 *
 * All inputs and outputs are quantized to ensure deterministic
 * simulation results across client and server.
 *
 * @module gamesV4/games/miniGolf/utils/quantize
 */

/**
 * Quantize angle to integer [0..3599] representing 0.0-359.9 degrees.
 * Input: angle in radians.
 */
export function quantizeAngle(radians: number): number {
  let degrees = ((radians * 180) / Math.PI) % 360;
  if (degrees < 0) degrees += 360;
  return Math.round(degrees * 10) % 3600;
}

/**
 * Dequantize angle from int [0..3599] back to radians.
 */
export function dequantizeAngle(angleQ: number): number {
  const degrees = (angleQ % 3600) / 10;
  return (degrees * Math.PI) / 180;
}

/**
 * Quantize power to integer [0..1000] representing 0.0-1.0.
 */
export function quantizePower(power: number): number {
  return Math.round(Math.max(0, Math.min(1, power)) * 1000);
}

/**
 * Dequantize power from int [0..1000] back to float [0..1].
 */
export function dequantizePower(powerQ: number): number {
  return Math.max(0, Math.min(1000, powerQ)) / 1000;
}

/**
 * Quantize a position to a fixed grid (1e-3 precision).
 * This ensures deterministic state regardless of float drift.
 */
export function quantizePos(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.round(x * 1000) / 1000,
    y: Math.round(y * 1000) / 1000,
  };
}

/**
 * Quantize a single number to 1e-3 precision.
 */
export function quantizeNum(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Validate that angleQ is in valid range.
 */
export function isValidAngleQ(angleQ: number): boolean {
  return Number.isInteger(angleQ) && angleQ >= 0 && angleQ <= 3599;
}

/**
 * Validate that powerQ is in valid range.
 */
export function isValidPowerQ(powerQ: number): boolean {
  return Number.isInteger(powerQ) && powerQ >= 0 && powerQ <= 1000;
}
