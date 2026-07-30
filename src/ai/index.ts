/**
 * The AI opponents.
 *
 * `createAiAgent` is the real entry point — it remembers what it has seen, which
 * is what lets the top tiers infer anything. `chooseAiMove` is the stateless
 * convenience wrapper for tests, benchmarks and anywhere a lifecycle would be
 * more trouble than it is worth.
 */

export { chooseAiMove, createAiAgent, type AiAgent } from './agent';
export {
  DIFFICULTIES,
  DIFFICULTY_BLURB,
  DIFFICULTY_LABEL,
  PLAYOUT_WEIGHTS,
  PROFILES,
  type AiProfile,
  type Difficulty,
} from './profiles';
export { choosePolicyMove, koiKoiScore, scoreMove, type PolicyWeights } from './policy';
export { evaluateOutcome, searchMove, searchMoveSync, type SearchOptions } from './search';
export {
  foldObservation,
  neutralBelief,
  sampleConsistentWorld,
  sampleWorld,
  statelessBelief,
  type Belief,
} from './belief';
export { gainFor, matchUtility, pileValue, staticCardValue } from './evaluate';
