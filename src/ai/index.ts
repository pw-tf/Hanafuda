import { legalMoves, type GameState, type Move } from '../engine/game';
import type { Rng } from '../engine/rng';
import { chooseHeuristicMove } from './heuristic';
import { chooseMonteCarloMove, DEFAULT_SEARCH, type SearchOptions } from './mcts';

export type Difficulty = 'easy' | 'normal' | 'hard';

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
};

export const DIFFICULTY_BLURB: Record<Difficulty, string> = {
  easy: 'Plays at random. Good for learning the flow.',
  normal: 'Weighs card value, yaku progress and what it hands you.',
  hard: 'Simulates the rest of the round before committing.',
};

const SEARCH_BY_DIFFICULTY: Record<'hard', SearchOptions> = {
  hard: DEFAULT_SEARCH,
};

/** Pick the AI's move. Always one of `legalMoves(state)`. */
export function chooseAiMove(state: GameState, difficulty: Difficulty, rng: Rng): Move {
  const moves = legalMoves(state);
  if (moves.length === 0) throw new Error('No legal moves available');
  if (moves.length === 1) return moves[0] as Move;

  switch (difficulty) {
    case 'easy':
      return moves[rng.nextInt(moves.length)] as Move;
    case 'normal':
      return chooseHeuristicMove(state, rng);
    case 'hard':
      return chooseMonteCarloMove(state, rng, SEARCH_BY_DIFFICULTY.hard);
  }
}

export { chooseHeuristicMove, chooseMonteCarloMove };
