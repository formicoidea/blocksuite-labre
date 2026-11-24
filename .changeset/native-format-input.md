---
'@labre/std': minor
---

Native bold, italic and underline controls now format rich text (#743, after
upstream toeverything/AFFiNE aaf0c9f). The iOS selection menu (B / I / U) and
similar native controls send a `beforeinput` of type `formatBold`,
`formatItalic` or `formatUnderline` with no key event, so nothing happened.
Every keymap bound with `bindHotkey` now runs the binding it registered as
`Mod-b`, `Mod-i` or `Mod-u` for these inputs, on all platforms, through the
same binding and keyboard state as the real shortcut; the input is prevented
only when the binding handled it. Nothing runs during
a composition, an armed chord is left armed, and the Android Backspace
routing is unchanged.
