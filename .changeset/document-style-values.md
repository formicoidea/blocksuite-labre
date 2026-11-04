---
'@labre/global': patch
'@labre/affine-inline-preset': patch
---

`styleMap` now comes from `@labre/global/lit`: every value goes to the CSSOM on the
first render too, as Lit does on later ones, so one value sets one property and a
value the browser refuses leaves the property unset. No package imports Lit's
directive any more (`style-map-boundary.unit.spec.ts`). The HTML adapter writes a
highlight colour only from a `--` token. Nothing persisted changes, and tokens,
`var()`, `rgb()` and `oklch()` render as before.
