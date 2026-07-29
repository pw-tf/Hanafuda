/**
 * End-of-round breakdown. Shows every scoring yaku and each multiplier as a
 * separate line so a player can check the arithmetic themselves — the round
 * total should never look like it came out of nowhere.
 *
 * Both sheets here are `dismissible={false}`: they report or ask for a
 * decision that has to be acknowledged, so a stray tap on the backdrop must
 * not close them.
 */

import type { RoundResult } from '../../engine/game';
import { YAKU_INFO, type RuleConfig } from '../../engine/rules';
import { CardFace } from '../../art/CardFace';
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
                  <b>{y.points}</b>
                </div>
              ))}
            </div>
          ),
        )}
      </div>
    );
  }

  if (yaku.length === 0) {
    return (
      <p className="sheet__none">
        Neither player called the round, so nobody scores.
        {rules.drawRule === 'dealer-6' && ' (Dealer bonus is enabled but did not apply.)'}
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
}: {
  result: RoundResult;
  rules: RuleConfig;
  names: readonly [string, string];
  onNext(): void;
  scores: readonly [number, number];
}) {
  const { winner, awarded } = result;

  return (
    <Sheet label="Round result" dismissible={false}>
      <header className="sheet__head">
        <p className="sheet__kicker">
          Round {result.round} · {REASON_TEXT[result.reason]}
        </p>
        <h2>
          {winner === null
            ? 'No score'
            : `${names[winner]} ${awarded[winner] === 1 ? 'scores 1 point' : `scores ${awarded[winner]} points`}`}
        </h2>
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

/** The koi-koi / shobu decision. */
export function KoiKoiPrompt({
  base,
  onKoiKoi,
  onShobu,
}: {
  base: number;
  onKoiKoi(): void;
  onShobu(): void;
}) {
  return (
    <Sheet label="Koi-Koi or stop" dismissible={false} className="sheet__inner--tight">
      <h2>You have {base} points</h2>
      <p className="sheet__explain">
        Stop now and bank them, or call Koi-Koi to keep playing for more — the multiplier
        rises, but your opponent can still take the round.
      </p>
      <div className="sheet__choices">
        <button type="button" className="btn btn--ghost btn--wide" onClick={onShobu}>
          Stop · take {base}
        </button>
        <button type="button" className="btn btn--primary btn--wide" onClick={onKoiKoi}>
          Koi-Koi!
        </button>
      </div>
    </Sheet>
  );
}
