---
'@labre/affine': patch
---

Importing Markdown or HTML no longer leaves an empty paragraph above a picture
that stands on its own, nor loses it. A linked image (`[![a](src)](href)`),
images split by a hard line break and an HTML `<p><img></p>` now import as
image blocks alone (the link target is still dropped: the image block has no
link). An image alone in a list item becomes a child of the list block instead
of disappearing, and an image inside a quote lands right after the quote,
whose text is kept. Nothing persisted changes.
