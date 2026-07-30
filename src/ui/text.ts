/**
 * Sentence fragments the interface builds at runtime.
 *
 * Counted nouns and the player's own name both go wrong in the same way: a
 * string assembled for the common case reads as broken English in the other
 * one — "1 points", "You scores 5 points". Small enough to inline each time,
 * and it was inlined each time, which is how the wrong ones got there.
 */

/** `plural(1, 'point')` → "1 point"; `plural(5, 'point')` → "5 points". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
