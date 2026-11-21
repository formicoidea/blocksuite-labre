---
'@labre/affine-block-frame': patch
---

The "Stop presentation" button of the presentation toolbar now reads a fill and
on-fill pair of the theme, `button/error` (`--affine-v2-button-error`) for its
fill and `button/pureWhiteText` (`--affine-v2-button-pureWhiteText`) for its
icon, instead of `warningColor` (`--affine-warning-color`) under a literal
white (#683). A host theme may now tune its warning colour for text alone; it
must give the `button/error` / `button/pureWhiteText` pair a contrast of at
least 3:1 (WCAG 1.4.11). The fill moved from an inline `style` attribute to the
component's stylesheet.
