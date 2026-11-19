---
'@labre/affine-components': minor
---

Context menus (`affine-menu`) take 8px corners, the floating-menu radius of the
shell (was 4px); the shadow is unchanged, still the theme's
`--affine-overlay-panel-shadow`. A `delete-item` entry (the database's column,
view, row, card, filter, sort, group and colour-rule menus, the table block,
the selection pane) is drawn as destructive at rest: label and icon in
`--affine-error-color`, hover keeping `--affine-background-error-color` as the
row background. On a phone the label of such an entry, which stayed in the
primary text colour, now takes the error colour too (#677). The library ships
no colour value: the host theme must give `errorColor` a 4.5:1 contrast on
`layer/background/overlayPanel` and on `backgroundErrorColor`, in each theme.
