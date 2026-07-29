import { describe, expect, it } from 'vitest';
import type { CardId } from '../../engine/cards';
import {
  ENTER_MS,
  LEAVE_MS,
  fieldKey,
  initialField,
  nextFieldDeadline,
  reconcileField,
  sweepField,
  type FieldAnimation,
} from '../fieldAnimation';

const ids = (...n: string[]) => n as CardId[];
const a = 'm1-0' as CardId;
const b = 'm1-1' as CardId;
const c = 'm2-0' as CardId;
const d = 'm3-0' as CardId;

/** Shorthand: fold in a field with no leave delay. */
const step = (s: FieldAnimation, field: CardId[], now: number, delay = 0) =>
  reconcileField(s, field, 'down', delay, now);

describe('field animation', () => {
  it('holds a captured card in the layout for its animation, then drops it', () => {
    let s = initialField(ids('m1-0', 'm1-1', 'm2-0'));
    s = step(s, [a, c], 1000);

    expect(s.leaving.has(b)).toBe(true);
    expect(s.order).toContain(b);
    expect(nextFieldDeadline(s)).toBe(1000 + LEAVE_MS);

    s = sweepField(s, 1000 + LEAVE_MS);
    expect(s.leaving.has(b)).toBe(false);
    expect(s.order).toEqual([a, c]);
  });

  it('marks a newly dealt card as arriving', () => {
    let s = initialField(ids('m1-0'));
    s = step(s, [a, c], 500);

    expect([...s.arriving.keys()]).toEqual([c]);
    expect(s.arriving.get(c)).toBe(500 + ENTER_MS);

    s = sweepField(s, 500 + ENTER_MS);
    expect(s.arriving.size).toBe(0);
  });

  it('does not cancel one departure with the next', () => {
    let s = initialField(ids('m1-0', 'm1-1', 'm2-0', 'm3-0'));
    s = step(s, [c, d], 0);
    s = step(s, [d], 100);

    expect([...s.leaving.keys()].sort()).toEqual([a, b, c].sort());
    expect(s.leaving.get(a)?.expiry).toBe(LEAVE_MS);
    expect(s.leaving.get(c)?.expiry).toBe(100 + LEAVE_MS);
  });

  it('delays a departure taken by the deck flip, so the pair leave together', () => {
    let s = initialField(ids('m1-0', 'm2-0'));
    s = step(s, [c], 0, 770);

    expect(s.leaving.get(a)?.delay).toBe(770);
    expect(s.leaving.get(a)?.expiry).toBe(770 + LEAVE_MS);
    // Still present at the moment an undelayed departure would have gone.
    expect(sweepField(s, LEAVE_MS).order).toContain(a);
    expect(sweepField(s, 770 + LEAVE_MS).order).not.toContain(a);
  });

  /**
   * The bug players hit in room games.
   *
   * A guest rebuilds its state from JSON on every snapshot, so the field array
   * is a fresh object each time even when the same cards are on it. The old
   * implementation owned its cleanup with a `setTimeout` inside the effect
   * that diffed the field, and that effect was keyed on the array — so every
   * snapshot cancelled the pending sweep, and a re-run that found no change
   * returned early without scheduling another. Cards stuck mid-departure never
   * left the layout.
   */
  it('sweeps a departure even when snapshots keep arriving mid-animation', () => {
    let s = initialField(ids('m1-0', 'm1-1', 'm2-0'));
    s = step(s, [a, c], 0);
    expect(s.leaving.has(b)).toBe(true);

    // Snapshots at 100ms and 200ms carrying an identical field, as a koi-koi
    // call or any other move that does not touch the table would.
    s = step(s, [a, c], 100);
    s = step(s, [a, c], 200);
    expect(s.leaving.has(b)).toBe(true);
    expect(nextFieldDeadline(s)).toBe(LEAVE_MS);

    // The deadline still stands, so the card still leaves on time.
    s = sweepField(s, LEAVE_MS);
    expect(s.leaving.size).toBe(0);
    expect(s.order).toEqual([a, c]);
  });

  it('never accumulates ghosts across a whole round of churn', () => {
    let s = initialField(ids('m1-0', 'm1-1', 'm2-0', 'm3-0'));
    let now = 0;
    let field: CardId[] = [a, b, c, d];

    // Alternate real captures with identical-field snapshots, the way a room
    // game does, and check the layout never holds more than the field plus
    // whatever is legitimately still in flight.
    for (let turn = 0; turn < 40; turn++) {
      now += 60;
      if (turn % 4 === 0 && field.length > 1) {
        field = field.slice(1);
      } else if (turn % 7 === 0) {
        field = [...field, `m${(turn % 9) + 4}-0` as CardId];
      }
      s = step(s, field, now);
      s = sweepField(s, now);
    }

    now += LEAVE_MS + ENTER_MS;
    s = sweepField(s, now);
    expect(s.leaving.size).toBe(0);
    expect(s.arriving.size).toBe(0);
    expect([...s.order]).toEqual(field);
  });

  it('a card dealt back onto the field is arriving, not leaving', () => {
    // Captured in one round, dealt to the field in the next: the same id
    // appears on both sides of the diff and must not be left marked as gone.
    let s = initialField(ids('m1-0', 'm1-1'));
    s = step(s, [c], 0);
    expect(s.leaving.has(a)).toBe(true);

    s = step(s, [c, a], 100);
    expect(s.leaving.has(a)).toBe(false);
    expect(s.arriving.has(a)).toBe(true);
    // And it appears exactly once, or React would see a duplicate key.
    expect(s.order.filter((id) => id === a)).toHaveLength(1);
  });

  it('replaces the whole field at a new deal without stranding the old one', () => {
    let s = initialField(ids('m1-0', 'm1-1'));
    const dealt = ids('m4-0', 'm5-0', 'm6-0');
    s = step(s, dealt, 0);

    expect(s.order).toEqual([a, b, ...dealt]);
    s = sweepField(s, LEAVE_MS + ENTER_MS);
    expect(s.order).toEqual(dealt);
    expect(s.leaving.size).toBe(0);
    expect(s.arriving.size).toBe(0);
  });

  it('reports no deadline when nothing is animating', () => {
    const s = initialField(ids('m1-0'));
    expect(nextFieldDeadline(s)).toBeNull();
  });

  it('keys a field by contents, so a re-encoded snapshot is recognised', () => {
    const one = ids('m1-0', 'm2-0');
    const same = JSON.parse(JSON.stringify(one)) as CardId[];
    expect(one).not.toBe(same);
    expect(fieldKey(one)).toBe(fieldKey(same));
    expect(fieldKey(one)).not.toBe(fieldKey(ids('m2-0', 'm1-0')));
  });
});
