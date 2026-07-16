---
'@labre/std': patch
---

A chord prefix now fully scopes the next keystroke to its namespace: an
unknown continuation (e.g. `w` then `e` when no wardley shortcut binds `e`)
is swallowed instead of falling through to the generic single-key tool
bindings. The prefix timeout and typing-in-editable behaviors are unchanged.
