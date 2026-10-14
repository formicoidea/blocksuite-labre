---
'@labre/data-view': patch
'@labre/affine-components': patch
---

A select option's colour and a conditional colour rule's are now picked from the canvas colour grid (`<edgeless-color-panel>`) instead of a list of ten menu rows: the same ten chip colours, each named in the host's language as its accessible label, the current one ringed. The value written is unchanged, the same `selectOptionColors` string as before (ADR 0036 amendment of 2026-10-14).

- `selectOptionColorGrid` (the grid as one menu entry) and `selectOptionColorPalettes` replace `selectOptionColorActions`, introduced in the same release.
- A colour panel swatch also paints through an inline `fill` style, so a CSS variable colour string paints in every engine; a plain colour paints as before.
