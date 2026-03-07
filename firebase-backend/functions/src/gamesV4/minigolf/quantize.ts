/**
 * Mini Golf — Server-side Quantization (duplicated for parity)
 *
 * MUST remain in sync with src/gamesV4/games/miniGolf/utils/quantize.ts
 */

export function quantizeAngle(radians: number): number {
  let degrees = ((radians * 180) / Math.PI) % 360;
  if (degrees < 0) degrees += 360;
  return Math.round(degrees * 10) % 3600;
}

export function dequantizeAngle(angleQ: number): number {
  const degrees = (angleQ % 3600) / 10;
  return (degrees * Math.PI) / 180;
}

export function quantizePower(power: number): number {
  return Math.round(Math.max(0, Math.min(1, power)) * 1000);
}

export function dequantizePower(powerQ: number): number {
  return Math.max(0, Math.min(1000, powerQ)) / 1000;
}

export function quantizePos(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.round(x * 1000) / 1000,
    y: Math.round(y * 1000) / 1000,
  };
}

export function isValidAngleQ(angleQ: number): boolean {
  return Number.isInteger(angleQ) && angleQ >= 0 && angleQ <= 3599;
}

export function isValidPowerQ(powerQ: number): boolean {
  return Number.isInteger(powerQ) && powerQ >= 0 && powerQ <= 1000;
}
