/**
 * How the game looks, remembered between visits.
 *
 * Kept apart from `persistence.ts`, which stores a game in progress: a saved
 * match is discarded when it fails validation or the schema moves on, and a
 * display preference should outlive all of that. Losing your background because
 * a half-finished round could not be parsed would be absurd.
 *
 * Every `localStorage` access is guarded, for the same reason as everywhere
 * else in this app: private-mode Safari throws on access rather than returning
 * null, and a preference failing to save must never take the game down.
 */

const KEY = 'hanafuda-koikoi:prefs';

export interface Preferences {
  /** Show the painted background behind the interface. */
  background: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  background: true,
};

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadPreferences(): Preferences {
  const store = storage();
  if (!store) return DEFAULT_PREFERENCES;

  try {
    const raw = store.getItem(KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    // Read field by field rather than spreading: a stored blob from a future
    // build should not be able to introduce keys this one does not know.
    return {
      background:
        typeof parsed.background === 'boolean'
          ? parsed.background
          : DEFAULT_PREFERENCES.background,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(preferences: Preferences): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(KEY, JSON.stringify(preferences));
  } catch {
    // Out of quota, or storage denied. Not worth interrupting anyone over.
  }
}
