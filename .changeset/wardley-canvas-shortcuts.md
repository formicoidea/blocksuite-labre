---
'@labre/affine-gfx-wardley': minor
'@labre/affine': minor
---

Wardley canvas keyboard chords: press `w`, then `c` (component), `l` (link
tool), `a` (evolution arrow), `i` (inertia), `p` (pipeline), `m` (method) or
`b` (classic background). Edgeless-only, disabled with the `wardley` block
flag, host-rebindable via the shortcut manifest (`getShortcutManifest` now
lists the `wardley` group). The wardley menu actions were extracted into
standalone functions shared by the toolbar and the shortcuts.
