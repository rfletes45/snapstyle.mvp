import { clamp, clamp01 } from "../../utils/math";

export interface MinigameProgressParams {
  progress: number;
  catchTimeSeconds: number;
  overlap: boolean;
  dtSeconds: number;
}

export function intervalsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export function computeBarOverlap(
  userBarX: number,
  userBarWidth: number,
  targetX: number,
  targetWidth: number
): boolean {
  return intervalsOverlap(userBarX, userBarX + userBarWidth, targetX, targetX + targetWidth);
}

export function updateCatchProgress(params: MinigameProgressParams): number {
  const growthRate = 1 / params.catchTimeSeconds;
  const decayRate = 1.5 * growthRate;
  const delta = params.overlap ? growthRate * params.dtSeconds : -decayRate * params.dtSeconds;
  return clamp01(params.progress + delta);
}

export function applySturdinessToMovement(baseValue: number, sturdiness: number): number {
  const factor = clamp(sturdiness / 100, 0, 0.35);
  return baseValue * (1 - factor);
}
