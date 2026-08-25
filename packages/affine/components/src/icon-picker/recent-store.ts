export const RECENT_EMOJIS_KEY = 'affine:icon-picker:recent-emojis';
export const RECENT_ICONS_KEY = 'affine:icon-picker:recent-icons';

const MAX_RECENT = 10;

/**
 * `localStorage` throws outright in a few environments (private mode quotas,
 * sandboxed frames, some test runners), and a picker is never important enough
 * to take the host down with it — every access is therefore best-effort.
 */
const storage = (): Storage | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

export const readRecent = (key: string): string[] => {
  try {
    const raw = storage()?.getItem(key);
    if (!raw) return [];
    return raw.split(',').filter(Boolean);
  } catch {
    return [];
  }
};

/**
 * Pushes `value` to the front of the recents, de-duplicating and capping the
 * list, and returns the new list even when it could not be persisted.
 */
export const pushRecent = (key: string, value: string): string[] => {
  const next = [value, ...readRecent(key).filter(item => item !== value)].slice(
    0,
    MAX_RECENT
  );

  try {
    storage()?.setItem(key, next.join(','));
  } catch {
    // best-effort: the caller still gets the updated list for this session
  }

  return next;
};
