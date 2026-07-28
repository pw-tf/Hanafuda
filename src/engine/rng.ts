/**
 * Deterministic PRNG. Needed in three places:
 *  - P2P, where the host's deal must be reproducible and auditable
 *  - tests, where a failing seed must replay exactly
 *  - the Monte Carlo AI, which needs cheap, fast, independent streams
 *
 * mulberry32: 32-bit state, good enough distribution for shuffling, and
 * trivially portable so a seed means the same thing in every environment.
 */

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform integer in [0, max). */
  nextInt(max: number): number;
  /** Current internal state, so a game can be saved and resumed mid-round. */
  state(): number;
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    nextInt: (max) => Math.floor(next() * max),
    state: () => s,
  };
}

/** Fisher-Yates. Returns a new array; the input is not mutated. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    const a = out[i] as T;
    const b = out[j] as T;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

export function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}
