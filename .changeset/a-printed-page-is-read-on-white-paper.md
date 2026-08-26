---
'@labre/affine-shared': patch
---

A printed page is read on white paper, whatever theme it was written in

Printing to PDF cloned the document into an iframe that inherited whatever
theme the editor was wearing. In the dark theme that meant light text on a
background the printer simply leaves white: headings, body text and note
shadows came out invisible, and a reader got a page of blank paper.

The print iframe is now pinned to the light theme — the document element, the
body and the cloned root are all marked `data-theme="light"`, and the injected
print stylesheet forces a light colour scheme along with black text, white
backgrounds and light values for the `--affine-text-*` and
`--affine-background-*` variables. What is on screen is what comes out of the
printer.
