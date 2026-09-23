---
'@labre/affine': patch
---

refactor(blocks): no visible change; the chrome accent now follows the host theme token everywhere. The 61 hard-coded spellings of the AFFiNE blue (`#1e96eb`, `rgb(a)(30, 150, 235, …)`) that short-circuited the theme are gone: CSS and inline SVG reach it through `var(--affine-primary-color)`, canvas painters resolve it through the new `getChromeAccentColor(std)`, and the only literal left is the fallback of the standalone HTML export's stylesheet, which is opened without a theme sheet. Two of those literals were bugs that always won over their variable — `var(--affine—primary—color, …)` (em dashes instead of hyphens) on the edgeless text block and `var(--light-brand-color, …)` (a variable defined nowhere) on the frame panel's selected card — so both now take the accent they were meant to. A host that redefines `--affine-primary-color` repaints the whole editor, canvas included.
