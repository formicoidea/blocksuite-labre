---
'@labre/affine-widget-linked-doc': patch
---

Markdown frontmatter becomes the doc's metadata instead of its first paragraph

Almost every tool that exports markdown puts a YAML frontmatter block at the
top of the file. Importing one dumped that block into the document as content —
a horizontal rule followed by a paragraph reading `title: … tags: …` — while
the doc itself was named after the file. The block is now read before the
content is parsed: the title, creation and modification dates, tags and
favourite flag land on the doc's metadata, under the spellings the common
exporters use, and the content starts at the first real line. A file with no
frontmatter, or one that merely opens with a horizontal rule, is untouched.

The frontmatter is read by a small parser for the flat YAML a metadata block
actually uses, so no YAML dependency joins the tree.
