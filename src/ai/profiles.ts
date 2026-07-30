/**
 * The four opponents.
 *
 * They differ in *what they attend to*, not in how many samples they take. That
 * is the whole design: a weaker opponent should be recognisably playing a worse
 * game, not the same game with noise added. The version this replaces made Easy
 * a uniform random choice over legal moves, which is not a beginner — it is a
 * broken player, and it read that way across the table.
 *
 *   Easy    grabs whatever shines, never blocks you, calls koi-koi on a whim
 *   Normal  collects toward a yaku and takes cards you need
 *   Hard    simulates the rest of the round, and plays the scoreboard
 *   Expert  all of that, longer, plus it reads the months you decline
 *
 * Measured, `npm run bench:ai`: Normal beats Easy and Hard beats Normal at
 * about 64%, which is the intended "strong but beatable". Expert's edge over
 * Hard is NOT established — 50% over 32 matches, and its belief model likewise
 * measured 50% against uniform sampling. It is never worse, and it plays a
 * visibly different game, but do not claim it is stronger without a much longer
 * bench run behind it. The honest reading is that flat determinized search
 * saturates: past a few dozen worlds the limit is strategy fusion, not samples,
 * and no amount of extra budget fixes that.
 */

import type { PolicyWeights } from './policy';

export type Difficulty = 'easy' | 'normal' | 'hard' | 'expert';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard', 'expert'];

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
  expert: 'Expert',
};

/** Describes the opponent, not the algorithm. */
export const DIFFICULTY_BLURB: Record<Difficulty, string> = {
  easy: 'Grabs whatever shines, and will not stop you.',
  normal: 'Collects toward a yaku, and takes the cards you need.',
  hard: 'Thinks ahead, and plays the scoreboard rather than the round.',
  expert: 'Thinks longer, reads what you decline, and never plays a loose card.',
};

/** How a tier answers koi-koi or shobu. */
export type KoiKoiMode =
  /** A whim, weighted toward continuing. Beginners over-call, and it is fun. */
  | 'impulsive'
  /** The cheap rule in `policy.ts`. */
  | 'rule'
  /** Simulate both branches. */
  | 'search';

export interface SearchTuning {
  budgetMs: number;
  maxWorlds: number;
  matchAware: boolean;
  useBelief: boolean;
  rootTemp: number;
  /** Standard errors of advantage required before overruling the policy. */
  confidence: number;
}

export interface AiProfile {
  weights: PolicyWeights;
  koikoi: KoiKoiMode;
  search: SearchTuning | null;
  /** How far a match's style may drift from these weights. 0 disables it. */
  styleDrift: number;
}

/**
 * A beginner.
 *
 * The capture term dominates, so it reliably spots and takes an available pair —
 * the one thing that makes an opponent read as playing rather than flailing.
 * `brightBias` sends it chasing the shiny cards, which is both a real beginner
 * habit and legible from the other side of the table. `denial: 0` is the
 * characterful weakness: it will cheerfully hand you the card you need, every
 * time, and never once takes something just to keep it from you.
 */
const EASY_WEIGHTS: PolicyWeights = {
  capture: 1,
  build: 0.35,
  denial: 0,
  brightBias: 1.6,
  discardCost: 0.4,
  sweepBonus: 2,
  softmaxTemp: 2.5,
  blunderRate: 0.12,
};

/** A competent club player: has a plan, and gets in the way of yours. */
export const NORMAL_WEIGHTS: PolicyWeights = {
  capture: 1,
  build: 1.6,
  denial: 0.9,
  brightBias: 1,
  discardCost: 1.2,
  sweepBonus: 6,
  softmaxTemp: 0.35,
  blunderRate: 0,
};

/**
 * What the playouts inside a search are run with, for both sides.
 *
 * Flatter than Normal on purpose: a playout is a cheap estimate of how a round
 * tends to go, and a policy that agonises over every ply costs samples without
 * making the estimate better. Softmax stays low but non-zero so simulated
 * rounds are not all identical.
 */
const PLAYOUT_WEIGHTS: PolicyWeights = {
  capture: 1,
  build: 1.4,
  denial: 0.6,
  brightBias: 1,
  discardCost: 1,
  sweepBonus: 6,
  softmaxTemp: 0.5,
  blunderRate: 0,
};

export const PROFILES: Record<Difficulty, AiProfile> = {
  easy: {
    weights: EASY_WEIGHTS,
    koikoi: 'impulsive',
    search: null,
    styleDrift: 0,
  },
  normal: {
    weights: NORMAL_WEIGHTS,
    koikoi: 'rule',
    search: null,
    styleDrift: 0.06,
  },
  hard: {
    weights: NORMAL_WEIGHTS,
    koikoi: 'search',
    search: {
      budgetMs: 260,
      maxWorlds: 160,
      matchAware: true,
      useBelief: false,
      rootTemp: 1,
      confidence: 1,
    },
    styleDrift: 0.08,
  },
  expert: {
    weights: NORMAL_WEIGHTS,
    koikoi: 'search',
    search: {
      budgetMs: 800,
      maxWorlds: 400,
      matchAware: true,
      useBelief: true,
      // Always its best move: Hard varies, Expert does not.
      rootTemp: 0,
      confidence: 1,
    },
    styleDrift: 0.05,
  },
};

export { PLAYOUT_WEIGHTS };
