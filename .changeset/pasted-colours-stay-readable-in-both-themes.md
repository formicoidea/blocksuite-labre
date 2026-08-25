---
'@labre/affine-shared': patch
---

Pasted colours stay readable in both themes

The colour of pasted HTML was matched against the supported highlights by plain
RGB distance, which is not how the eye measures sameness: every colour found a
"nearest" highlight, so ordinary body text at `#333` or `rgb(26, 26, 26)` came
in painted grey, a translucent `rgba(...)` picked for someone else's background
came in opaque, and a hue could land on the grey highlight or the other way
round. Matching now happens in Oklab, where distance is perceptual, and is
fenced by chroma and hue: a grey only ever becomes the grey highlight, a hue
only ever a hue, near-black and near-white are left as they are, and anything
translucent is left alone. Text that matches nothing keeps no colour at all and
so follows the theme, light or dark. The parser also grew to cover the syntax
that actually turns up in pasted markup — `hsl()`, percentage channels, the
`rgb(0 0 0 / 50%)` form, the basic colour keywords — and a `style` value
containing further colons is no longer truncated.
