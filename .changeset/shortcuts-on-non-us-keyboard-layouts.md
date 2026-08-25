---
'@labre/std': patch
---

Shortcuts read the physical key only when a modifier is held

When a keystroke did not match any binding, the keymap fell back to the
physical key position (`keyCode`) — the way a French or Russian layout still
reaches `Ctrl-Z` on a key that does not print `z`. That fallback was reached
under the wrong conditions.

It fired on any non-ASCII character even with no modifier at all, so typing
Cyrillic `х` in a paragraph triggered whatever was bound to `[`, the physical
key underneath. And it never fired for a plain `Ctrl` combination, so on a
Russian layout `Ctrl` shortcuts on letter keys simply did nothing.

The fallback now requires a modifier and ignores characters that the modifier
itself produced (Alt on a Polish or Mac layout prints `ś`, `œ`, … — those are
input, not shortcuts). Alt+digit keeps its fallback, so the edgeless zoom
shortcuts `Alt-0`/`Alt-1`/`Alt-2` are unaffected. Chord shortcuts (`w` then a
letter) never used this path and are unchanged.
