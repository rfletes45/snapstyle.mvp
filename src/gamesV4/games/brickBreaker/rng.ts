/**
 * Brick Breaker — Seeded RNG
 *
 * Deterministic PRNG based on Mulberry32.
 * Used for powerup drops and any game randomness.
 * NEVER use Math.random() in the simulation.
 *
 * @module gamesV4/games/brickBreaker/rng
 */

export interface SeededRng {
  /** Returns a float in [0, 1). */
  next(): number;
  /** Returns an integer in [min, max] (inclusive). */
  nextInt(min: number, max: number): number;
  /** Returns current seed state (for snapshot/restore). */
  state(): number;
}

/**
 * Create a seeded RNG (Mulberry32 algorithm).
 * Deterministic: same seed always produces the same sequence.
 */
export function createRng(seed: number): SeededRng {
  let s = seed | 0;
  if (s === 0) s = 1;

  function next(): number {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next,
    nextInt(min: number, max: number): number {
      return min + Math.floor(next() * (max - min + 1));
    },
    state(): number {
      return s;
    },
  };
}

/**
 * Pick a weighted random item from a pool.
 */
export function weightedPick<T extends string>(
  rng: SeededRng,
  items: T[],
  weights: Record<T, number>,
): T {
  const totalWeight = items.reduce(
    (sum, item) => sum + (weights[item] ?? 1),
    0,
  );
  let roll = rng.next() * totalWeight;
  for (const item of items) {
    roll -= weights[item] ?? 1;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}
