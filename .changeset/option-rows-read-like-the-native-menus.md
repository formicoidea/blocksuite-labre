---
'@labre/affine-components': patch
'@labre/affine-block-surface': patch
'@labre/affine-gfx-c4': patch
'@labre/affine-gfx-wardley': patch
'@labre/affine-shared': patch
'@labre/std': patch
---

fix(edgeless): option rows read like the native menus

Every one-of-N dropdown on the edgeless toolbars now draws its rows the way the
editor's own menus do — the Regular/Semibold panel, the size dropdowns: **label
on the left, tick on the right and only on the option in force, the active row
in the primary colour.**

Three home-made dropdowns had restated the opposite shape, each keeping a 20 px
gutter on the left of every row for a tick that was only ever drawn on one of
them: the tag qualification menu (`element-tag-option`), the validation profile
menu (`validation-profile-option`, and the "Map quality…" row that held a
spacer to line up with it) and the C4 level menu (`c4-level-option`). The empty
gutter did not read as an empty tick slot — it read as a MISSING ICON.

The shape is not reimplemented three times: `editor-menu-action` gains an
opt-in `data-option` affordance carrying the geometry and the primary colour,
next to the `data-selected` it already had. Nothing else changes appearance —
the more-menu, the conversion menu and the other rows that use `data-selected`
are untouched, as are every click handler, `data-testid` and ARIA attribute of
the three menus.

**The tag-value icon mechanism, added the same day, is removed.** It existed to
fill that gutter, and the gutter is gone: `TagValueDef.iconKey`,
`IconTableExtension` and `resolveIconKey` are withdrawn, `getCommandIcon` is
back to the single function it was, and the four Wardley nature glyphs are gone
with the icon key table that named them. All of it shipped hours earlier, was
never consumed by a host, and is removed before any host could bind it — so the
API surface a host sees is the one it had before that release.
