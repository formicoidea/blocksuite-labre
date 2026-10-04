---
'@labre/affine-block-latex': patch
---

Pasting or importing Markdown keeps inline math that starts with a digit
(`$4\vee 6=12$`) as math instead of escaping its opening dollar as currency,
and no longer escapes a dollar the author already escaped (`\$4` stays `\$4`).
Genuine currency (`$4`) is still escaped. `preprocessLatex` is now exported.
