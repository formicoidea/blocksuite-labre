/** Modifier tokens as a Mac spells them. */
const MAC_SYMBOLS: Record<string, string> = {
  mod: '⌘',
  meta: '⌘',
  cmd: '⌘',
  ctrl: '⌃',
  control: '⌃',
  alt: '⌥',
  shift: '⇧',
};

/** …and as everything else spells them. */
const OTHER_NAMES: Record<string, string> = {
  mod: 'Ctrl',
  meta: 'Win',
  cmd: 'Win',
  ctrl: 'Ctrl',
  control: 'Ctrl',
  alt: 'Alt',
  shift: 'Shift',
};

/**
 * A keystroke sequence (`ShortcutDescriptor.defaultKeys`) spelled the way the
 * platform spells it: `⌘⇧Z` on a Mac, `Ctrl+Shift+Z` elsewhere, and a chord as
 * its keystrokes separated by a space (`['w', 'c']` → `W C`).
 *
 * Symbols and `+` rather than words, because this line is NOT translated — the
 * catalogue's rows carry it beside a label the host did translate, and a
 * hard-coded "then" would be the one English word left in a French panel.
 *
 * `isMac` is a parameter rather than a read of `IS_MAC` so the spelling is
 * testable on either platform from either platform.
 */
export function formatChord(keys: readonly string[], isMac: boolean): string {
  const table = isMac ? MAC_SYMBOLS : OTHER_NAMES;

  const part = (token: string) => {
    const symbol = table[token.toLowerCase()];
    if (symbol) return symbol;
    // A bare key: `'w'` reads as `W`; `'ArrowUp'` and `'Space'` as they are.
    return token.length === 1 ? token.toUpperCase() : token;
  };

  return keys
    .map(keystroke =>
      // `-(?!$)` so a literal `-` key survives being the separator too.
      keystroke.split(/-(?!$)/).map(part).join(isMac ? '' : '+')
    )
    .join(' ');
}
