/**
 * End-of-round breakdown. Shows every scoring yaku and each multiplier as a
 * separate line so a player can check the arithmetic themselves — the round
 * total should never look like it came out of nowhere.
 *
 * Both sheets here are `dismissible={false}`: they report or ask for a
 * decision that has to be acknowledged, so a stray tap on the backdrop must
 * not close them.
 */

import type { PlayerIndex, RoundResult } from '../../engine/game';
import { YAKU_INFO, type RuleConfig } from '../../engine/rules';
import type { RoundSettlement } from '../../engine/scoring';
import { CardFace } from '../../art/CardFace';
import { plural } from '../text';
import { Sheet } from './Sheet';

const REASON_TEXT: Record<RoundResult['reason'], string> = {
  shobu: 'Round called',
  teyaku: 'Hand yaku dealt',
  exhausted: 'Hands exhausted',
};

/**
 * One round's scoring, laid out line by line so the total can be checked by
 * hand. Shared: it is the whole of the round-result sheet, and it also tails
 * the match result, where the last round now settles without a sheet of its
 * own.
 */
export function RoundBreakdown({
  result,
  rules,
  names,
}: {
  result: RoundResult;
  rules: RuleConfig;
  names: readonly [string, string];
}) {
  const { settlement, yaku } = result;

  if (result.reason === 'teyaku') {
    // Both players dealt a hand yaku is a draw, so the points beside each hand
    // would be points nobody actually took. Say so rather than showing them.
    const drawn = result.winner === null;
    return (
      <div className="sheet__body">
        {([0, 1] as const).map((seat) =>
          result.teyaku[seat].length === 0 ? null : (
            <div key={seat} className="sheet__teyaku">
              <h3>{names[seat]}</h3>
              {result.teyaku[seat].map((y, i) => (
                <div key={`${y.id}-${i}`} className="sheet__line">
                  <span>
                    {YAKU_INFO[y.id].name} <em>{YAKU_INFO[y.id].nameJa}</em>
                  </span>
                  <b>{drawn ? '—' : y.points}</b>
                </div>
              ))}
            </div>
          ),
        )}
        {drawn && (
          <p className="sheet__none">
            Both players were dealt a hand yaku, so the round is a draw and the deal does not
            move.
          </p>
        )}
      </div>
    );
  }

  if (yaku.length === 0) {
    // `exhausted` with the dealer's privilege on still pays the dealer, so the
    // flat "nobody scores" line is only true when it did not apply.
    const oyaKen = rules.drawRule === 'dealer-1' && result.winner !== null;
    return (
      <p className="sheet__none">
        {oyaKen
          ? `Neither player called the round. ${names[result.winner as PlayerIndex]} dealt, so they take ${plural(
              result.awarded[result.winner as PlayerIndex],
              'point',
            )}.`
          : 'Neither player called the round, so nobody scores.'}
      </p>
    );
  }

  return (
    <div className="sheet__body">
      {yaku.map((y) => (
        <div key={y.id} className="sheet__yaku">
          <div className="sheet__line">
            <span>
              {YAKU_INFO[y.id].name} <em>{YAKU_INFO[y.id].nameJa}</em>
            </span>
            <b>{y.points}</b>
          </div>
          <div className="sheet__cards">
            {y.cards.map((id) => (
              <CardFace key={id} id={id} width={30} />
            ))}
          </div>
        </div>
      ))}

      {settlement && (
        <div className="sheet__maths">
          <div className="sheet__line sheet__line--sub">
            <span>Yaku total</span>
            <b>{settlement.base}</b>
          </div>
          {settlement.sevenPointMultiplier > 1 && (
            <div className="sheet__line sheet__line--sub">
              <span>{rules.sevenPointThreshold}+ points</span>
              <b>×{settlement.sevenPointMultiplier}</b>
            </div>
          )}
          {settlement.koiMultiplier > 1 && (
            <div className="sheet__line sheet__line--sub">
              <span>Koi-Koi</span>
              <b>×{settlement.koiMultiplier}</b>
            </div>
          )}
          <div className="sheet__line sheet__line--total">
            <span>Round total</span>
            <b>{settlement.total}</b>
          </div>
        </div>
      )}
    </div>
  );
}

export function RoundEnd({
  result,
  rules,
  names,
  onNext,
  scores,
  youSeat,
}: {
  result: RoundResult;
  rules: RuleConfig;
  names: readonly [string, string];
  onNext(): void;
  scores: readonly [number, number];
  /** The seat the player reading this holds, or null in pass-and-play. */
  youSeat: PlayerIndex | null;
}) {
  const { winner, awarded } = result;

  // Second person for your own round, third for theirs — "You scores 5
  // points" is what one line for both gets you.
  const headline =
    winner === null
      ? result.reason === 'teyaku'
        ? 'A draw'
        : 'No score'
      : winner === youSeat
        ? `You score ${plural(awarded[winner], 'point')}`
        : `${names[winner]} scores ${plural(awarded[winner], 'point')}`;

  return (
    <Sheet label="Round result" dismissible={false}>
      <header className="sheet__head">
        <p className="sheet__kicker">
          Round {result.round} · {REASON_TEXT[result.reason]}
        </p>
        <h2>{headline}</h2>
      </header>

      <RoundBreakdown result={result} rules={rules} names={names} />

      <div className="sheet__scores">
        <div>
          <span>{names[0]}</span>
          <b>{scores[0]}</b>
        </div>
        <div>
          <span>{names[1]}</span>
          <b>{scores[1]}</b>
        </div>
      </div>

      <button type="button" className="btn btn--primary btn--wide" onClick={onNext}>
        Next round
      </button>
    </Sheet>
  );
}

/**
 * The koi-koi / shobu decision.
 *
 * The number on the Stop button is the settled total, not the raw yaku base.
 * They are not the same once the seven-point doubling or a koi-koi multiplier
 * is in play — a base of 8 after one koi-koi banks 32 — and this is the one
 * decision in the game that turns entirely on how big that number is. The
 * arithmetic is shown underneath so the total is checkable rather than magic.
 *
 * The total is not the whole picture, though: whether to play on depends on
 * what is still on the table and what is left in your hand, and this sheet
 * covers both. So `onPeek` slides it out of the way rather than making the
 * player decide from memory. The decision itself is not skippable — the sheet
 * is not dismissible, and peeking leaves a button that only brings it back.
 */
export function KoiKoiPrompt({
  settlement,
  rules,
  onKoiKoi,
  onShobu,
  onPeek,
}: {
  settlement: RoundSettlement;
  rules: RuleConfig;
  onKoiKoi(): void;
  onShobu(): void;
  onPeek(): void;
}) {
  const { base, sevenPointMultiplier, koiMultiplier, total } = settlement;
  const multiplied = total !== base;

  return (
    <Sheet label="Koi-Koi or stop" dismissible={false} className="sheet__inner--tight">
      <h2>Stopping banks {plural(total, 'point')}</h2>
      {multiplied && (
        <p className="sheet__explain sheet__explain--maths">
          {plural(base, 'point')} of yaku
          {sevenPointMultiplier > 1 && ` × ${sevenPointMultiplier} (${rules.sevenPointThreshold}+)`}
          {koiMultiplier > 1 && ` × ${koiMultiplier} (koi-koi)`}
        </p>
      )}
      <p className="sheet__explain">
        Stop now and bank that, or call Koi-Koi to keep playing for more — the multiplier rises,
        but your opponent can still take the round and leave you with nothing.
      </p>
      <div className="sheet__choices">
        <button type="button" className="btn btn--ghost btn--wide" onClick={onShobu}>
          Stop · take {total}
        </button>
        <button type="button" className="btn btn--primary btn--wide" onClick={onKoiKoi}>
          Koi-Koi!
        </button>
      </div>
      <button type="button" className="btn btn--quiet btn--wide" onClick={onPeek}>
        Look at the table first
      </button>
    </Sheet>
  );
}
