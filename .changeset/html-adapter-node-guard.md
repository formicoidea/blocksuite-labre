---
'@labre/affine': patch
---

`HtmlAdapter` output no parser has to repair: a todo list item prints its checkbox and label as siblings instead of a stray `</input>`, and a document title is escaped before it reaches the page. A guard spec renders a stored page in plain Node.
