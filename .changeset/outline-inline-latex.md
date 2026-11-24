---
'@labre/affine-fragment-outline': patch
---

The outline panel now shows a heading's inline equation instead of dropping
it. The formula is drawn by KaTeX as MathML, so a screen reader can read it,
and it stays inside the entry's single truncated line. The outline package now
declares `katex` (^0.18.10, the same range as the LaTeX inline). Fixes #735
(upstream toeverything/AFFiNE#15813).
