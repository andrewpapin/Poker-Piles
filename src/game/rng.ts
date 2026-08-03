/**
 * Deterministic seeding for the daily puzzle.
 *
 * Same date string in => same random sequence out, on every device, forever.
 * No external dependencies: xmur3 turns the date into a 32-bit seed, mulberry32
 * turns that seed into a uniform [0, 1) generator.
 */

/** Hashes a string into a 32-bit seed. */
export function xmur3(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

export type Rng = () => number;

/** Small, fast, well-distributed seeded PRNG. Returns values in [0, 1). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Builds the generator for a given seed string (e.g. "2026-08-03"). */
export function rngFromSeed(seed: string): Rng {
  return mulberry32(xmur3(seed));
}

/** Today's puzzle key in UTC — the puzzle rolls over at midnight UTC. */
export function todayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
