---
'@labre/data-view': patch
'@labre/affine-components': patch
---

A select option's colour and a conditional colour rule's are now picked from the canvas colour grid (`<edgeless-color-panel>`) instead of a list of ten menu rows, in the option menu, the rule menu and the kanban group header: the same ten chip colours, each named in the host's language, the current one ringed. The value written is unchanged, the same `selectOptionColors` string as before (ADR 0036 amendment of 2026-10-14).

- `selectOptionColorGrid` (the grid as one menu entry) and `selectOptionColorPalettes` replace `selectOptionColorActions`, introduced in the same release.
- Every colour panel, the canvas's included, is keyboard-operable: one Tab stop, the arrow keys move between swatches, Enter or Space picks, a focused swatch shows a focus ring. A swatch shows its colour name as a tooltip. Pointer picking is unchanged.
- A colour panel swatch also paints through an inline `fill` style, so a CSS variable colour string paints in every engine; a plain colour paints as before.
