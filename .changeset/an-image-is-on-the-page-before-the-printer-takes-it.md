---
'@labre/affine-shared': patch
---

An image is on the page before the printer takes it

Printing to PDF cloned the document into a `display: none` iframe and then
waited a flat second before opening the print dialog. An iframe hidden that way
never loads its images at all, and even when they did start loading the one
second was a guess: a document with more than a handful of pictures printed
empty frames where the images should be.

The print iframe is now hidden without being taken out of rendering, lazy
loading is stripped from the cloned images, and the print dialog waits for
every image — those inside shadow roots included — to finish loading or fail,
then for the fonts to be ready, instead of for a fixed delay. A broken image
resolves rather than hanging the print. The clone also flattens shadow DOM into
light DOM, so canvases and pictures rendered inside a shadow root reach the
paper too.
