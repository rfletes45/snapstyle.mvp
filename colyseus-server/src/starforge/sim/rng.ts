/**
 * Deterministic PRNG — mulberry32.
 * Pure math, no DOM / Three.js imports.
 */

export interface RNG {
  /** Next float in [0, 1). */
  nextFloat(): number;
  /** Next integer in [min, max] inclusive. */
  nextInt(min: number, max: number): number;
  /** Current internal seed (for serialisation). */
  readonly seed: number;
}

/**
 * Create a mulberry32 PRNG from an integer seed.
 */
export function createRNG(seed: number): RNG {
  let s = seed | 0;

  function next(): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    nextFloat: next,
    nextInt(min: number, max: number): number {
      return min + Math.floor(next() * (max - min + 1));
    },
    get seed() {
      return s;
    },
  };
}
