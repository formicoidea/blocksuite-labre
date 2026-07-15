---
'@labre/std': minor
'@labre/affine-block-root': minor
---

Shortcut manifest: chord sequences and per-mode scoping. A shortcut's keys are
now a sequence of keystrokes (`['Mod-z']`, or `['w', 'c']` for "press w, then
c"); the dispatcher keymap resolves multi-keystroke chords with a short arming
timeout, never while typing in an editable. The `'page'`/`'edgeless'` shortcut
scopes are now installed by the matching root view-extension branch, so scoped
shortcuts only exist in that editor mode.
