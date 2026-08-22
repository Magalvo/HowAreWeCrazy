const STORAGE_PREFIX = "how-are-we-crazy";
const LEGACY_STORAGE_PREFIX = "open-thread";
const STORAGE_NAMES = ["session", "room", "saved", "language"] as const;

export const SESSION_KEY = `${STORAGE_PREFIX}.session`;
export const ROOM_KEY = `${STORAGE_PREFIX}.room`;
export const SAVED_KEY = `${STORAGE_PREFIX}.saved`;
export const LANGUAGE_KEY = `${STORAGE_PREFIX}.language`;

export function loadJson<T>(key: string): T | null {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : null;
  } catch {
    return null;
  }
}

export function saveJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be full or unavailable; play continues without persistence.
  }
}

export function clearKey(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to release when storage is unavailable.
  }
}

// Players keep saved cards and an unfinished session in local storage. Those keys moved
// with the product name, so carry anything still filed under the previous prefix.
export function adoptLegacyStorage() {
  try {
    STORAGE_NAMES.forEach((name) => {
      const legacyKey = `${LEGACY_STORAGE_PREFIX}.${name}`;
      const stored = localStorage.getItem(legacyKey);
      if (stored !== null && localStorage.getItem(`${STORAGE_PREFIX}.${name}`) === null) {
        localStorage.setItem(`${STORAGE_PREFIX}.${name}`, stored);
      }
      localStorage.removeItem(legacyKey);
    });
  } catch {
    // Storage can be unavailable; play continues without a resumed session.
  }
}
