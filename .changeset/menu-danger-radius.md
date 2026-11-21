---
'@labre/affine-components': minor
---

Every context-menu (`affine-menu`) entry flagged `delete-item` (database, table
block and selection pane menus, such as a database column's or row's "Delete")
is drawn as destructive at rest: label and icon in `--affine-error-color`, with
`--affine-background-error-color` as the row background on hover and while the
entry holds a popup open. On a phone the label of such an entry, which stayed
in the primary text colour, now takes the error colour too (#677). The menu
panel keeps its 4px corners and its `--affine-overlay-panel-shadow`. The
library ships no colour value: the host theme must give `errorColor` a 4.5:1
contrast on `layer/background/overlayPanel` and on `backgroundErrorColor`, in
each theme.
