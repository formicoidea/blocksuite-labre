---
'@labre/std': patch
---

fix(std): a fractional display scale is not an outer transform

On displays with a fractional `devicePixelRatio` (Windows 175% → dpr 1.75),
the editor shell's CSS width is fractional (e.g. 1009.1428833). The viewport's
`viewScale` heuristic — meant to detect a CSS scale applied by an outer
container in nested-editor scenarios — compared that fractional
`getBoundingClientRect().width` against the integer-rounded `offsetWidth` and
concluded the editor was scaled by 1.0001416. Every client→model coordinate
conversion was then divided by that phantom factor: a 100px drag landed at
99.98584112288302 model units, off by 0.014px per 100px everywhere pointer
input is converted.

`viewScale` now treats a sub-pixel difference (≤ 0.5px, the exact bound of
`offsetWidth`'s integer rounding when no transform is applied) as scale 1.
Genuine container transforms still register: they shift the rect width by far
more than the rounding noise.

Surfaced by the `element drag moving` / `block drag moving` integration tests
failing reproducibly on a 175% Windows display — the assertions are unchanged
and now pass exactly, because the geometry is exact again.
