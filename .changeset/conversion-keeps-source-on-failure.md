---
'@labre/affine-shared': patch
---

A block conversion the schema rejects no longer deletes the source block:
`transformModel` returns `null` and leaves the block in place when the new
block was not created, and `mergeToCodeModel` adds the code block before it
deletes the paragraphs, keeping them all when the parent refuses a code block.
"Turn into → Code block" on a paragraph inside a callout used to wipe the text
and create nothing; it now does nothing.
