---
'@labre/affine': patch
---

Raise the katex floor to ^0.18.10 (from ^0.16.11). KaTeX 0.18 prefixes its internal CSS classes, so a host must bump `katex` to 0.18 or later together with the `@formicoidea/*` ranges: the `katex/dist/katex.min.css` it imports and the runtime the library renders with must match. `@types/katex` is no longer needed, katex ships its own types.
