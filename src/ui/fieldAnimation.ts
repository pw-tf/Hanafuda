/**
 * The field's enter/leave bookkeeping, as a pure state machine.
 *
 * The engine hands over a flat list of field cards with no history, so both
 * arrivals and departures are derived by diffing against the previous list.
 * Departing cards are held in the layout for the length of their animation and
 * rendered in their old position — without that they vanish instantly and the
 * field reflows underneath, which is the jump that made captures hard to
 * follow.
 *
 * This lives apart from the component, and expiry is expressed as a timestamp
 * rather than a `setTimeout`, for one reason: a card must come out of the
 * layout after its animation whatever else happens in between. Timers owned by
 * an effect are cancelled every time that effect re-runs, and in a room game
 * the effect re-runs constantly — the guest rebuilds its whole state from JSON
 * on every snapshot, so the field array is a new object each time even when
 * the cards on it have not changed. Any departure still in flight when a
 * snapshot landed lost its timer and was never swept up, so the card stayed in
 * the layout for good: invisible, because the leave animation fills forwards
 * to `opacity: 0`, but still taking a slot. They accumulated, and once enough
 * had built up the real cards were pushed out of view. Deadlines cannot be
 * cancelled by accident; a missed sweep is corrected by the next one.
 */

import type { CardId } from '../engine/cards';

/** Must match the animation durations in the stylesheet. */
export const ENTER_MS = 440;
export const LEAVE_MS = 418;

export interface Departure {
  direction: 'up' | 'down';
  /** Held before the card starts moving, in ms. */
  delay: number;
  /** When the card may leave the layout. */
  expiry: number;
}

export interface FieldAnimation {
  /** Field cards plus any still animating out, in stable display order. */
  readonly order: readonly CardId[];
  /** Card -> when its arrival animation is done. */
  readonly arriving: ReadonlyMap<CardId, number>;
  readonly leaving: ReadonlyMap<CardId, Departure>;
  /** The field as of the last reconcile, to diff the next one against. */
  readonly field: readonly CardId[];
}

export function initialField(field: readonly CardId[]): FieldAnimation {
  return { order: [...field], arriving: new Map(), leaving: new Map(), field: [...field] };
}

/** A stable identity for a field, so re-renders that change nothing are free. */
export function fieldKey(field: readonly CardId[]): string {
  return field.join(',');
}

/**
 * Fold a new field in.
 *
 * Sweeps first, so a deadline that passed while nothing was rendering is
 * honoured here rather than being carried forward indefinitely.
 */
export function reconcileField(
  previous: FieldAnimation,
  field: readonly CardId[],
  direction: 'up' | 'down',
  leaveDelay: number,
  now: number,
): FieldAnimation {
  const state = sweepField(previous, now);

  const beforeSet = new Set(state.field);
  const nowSet = new Set(field);
  const fresh = field.filter((id) => !beforeSet.has(id));
  const gone = state.field.filter((id) => !nowSet.has(id));

  if (fresh.length === 0 && gone.length === 0) {
    // Nothing entered or left, but the order can still differ — a fresh deal
    // can hand back the same cards in a different arrangement.
    const sameOrder =
      state.order.length === field.length && state.order.every((id, i) => id === field[i]);
    const sameField =
      state.field.length === field.length && state.field.every((id, i) => id === field[i]);
    // Returned by identity when genuinely nothing moved, so a re-encoded
    // snapshot of an unchanged table costs no render.
    if (sameOrder && sameField) return state;
    return { ...state, order: sameOrder ? state.order : [...field], field: [...field] };
  }

  const goneSet = new Set(gone);
  // Departing cards keep their slot; anything genuinely new goes on the end.
  const kept = state.order.filter(
    (id) => nowSet.has(id) || goneSet.has(id) || state.leaving.has(id),
  );
  const missing = field.filter((id) => !kept.includes(id));
  const order = [...kept, ...missing];

  const arriving = new Map(state.arriving);
  for (const id of fresh) arriving.set(id, now + ENTER_MS);

  // Merged, not replaced, so a second capture while one is still animating
  // does not cancel the first.
  const leaving = new Map(state.leaving);
  for (const id of gone) {
    leaving.set(id, { direction, delay: leaveDelay, expiry: now + leaveDelay + LEAVE_MS });
  }

  // A card can come back — captured last round, dealt to the field this one —
  // in which case it is arriving, not leaving.
  for (const id of fresh) leaving.delete(id);
  for (const id of gone) arriving.delete(id);

  return { order, arriving, leaving, field: [...field] };
}

/** Drop everything whose deadline has passed. */
export function sweepField(state: FieldAnimation, now: number): FieldAnimation {
  const expired: CardId[] = [];
  for (const [id, departure] of state.leaving) {
    if (departure.expiry <= now) expired.push(id);
  }
  const staleArrivals: CardId[] = [];
  for (const [id, expiry] of state.arriving) {
    if (expiry <= now) staleArrivals.push(id);
  }
  if (expired.length === 0 && staleArrivals.length === 0) return state;

  const leaving = new Map(state.leaving);
  for (const id of expired) leaving.delete(id);
  const arriving = new Map(state.arriving);
  for (const id of staleArrivals) arriving.delete(id);

  const drop = new Set(expired);
  return {
    ...state,
    order: drop.size > 0 ? state.order.filter((id) => !drop.has(id)) : state.order,
    arriving,
    leaving,
  };
}

/** When the next sweep is due, or null if nothing is animating. */
export function nextFieldDeadline(state: FieldAnimation): number | null {
  let soonest: number | null = null;
  for (const expiry of state.arriving.values()) {
    if (soonest === null || expiry < soonest) soonest = expiry;
  }
  for (const departure of state.leaving.values()) {
    if (soonest === null || departure.expiry < soonest) soonest = departure.expiry;
  }
  return soonest;
}
