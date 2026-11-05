---
'@labre/std': patch
'@labre/affine-shared': patch
'@labre/affine-foundation': patch
---

A Markdown table pasted from VS Code, a browser or a chat app is a table again. These apps put the same text on the clipboard twice, as Markdown in `text/plain` and as one `<div>` per line in `text/html`; the paste read the HTML first and made paragraphs of pipes. The HTML copy now steps aside when it is flat (only `div`, `p`, `br`, `span`) and the plain text parses into block Markdown (a GFM table, a list, a heading, a blockquote, a fenced code block). Rich HTML (tables, lists, Google Docs), plain prose, a lone URL and the internal snapshot paste as before. `ClipboardAdapterConfig` gains an optional `defer(read)` that lets an adapter yield one paste to the next by priority; `htmlDefersToMarkdown`, `isFlatHtml` and `isBlockMarkdown` are exported from `@labre/affine-shared/adapters`.
