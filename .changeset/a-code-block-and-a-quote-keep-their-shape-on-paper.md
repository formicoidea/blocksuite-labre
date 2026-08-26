---
'@labre/affine-shared': patch
---

A code block and a quote keep their shape on paper

Forcing every background to white for printing also flattened the three
surfaces that give code blocks, quotations and bordered elements their shape:
the code block lost its tinted panel, the quote lost its left rule and every
border disappeared into the page.

The print stylesheet now gives `--affine-background-code-block`,
`--affine-quote-color` and `--affine-border-color` their own light greys
instead of white, so those blocks are still recognisable in the printed
document while the rest of the page stays black on white.
