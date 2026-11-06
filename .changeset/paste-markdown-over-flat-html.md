---
'@labre/std': minor
'@labre/affine-shared': minor
'@labre/affine-foundation': minor
---

A Markdown table pasted from VS Code, Slack, Teams or another chat app is a table again. These apps put the same text on the clipboard twice, as Markdown in `text/plain` and as one `<div>` per line in `text/html`; the paste read the HTML first and made paragraphs of pipes. The HTML copy now steps aside when the plain text parses into a GFM table and the HTML is flat (only `div`, `p`, `br`, `span`). Nothing else changes path: rich HTML (tables, lists, `<pre>`, Google Docs), source code and prose copied from VS Code, a lone URL and the internal snapshot paste as before. A paste with no GFM delimiter row, or over 200 000 characters, is never parsed. New API: `ClipboardAdapterConfig` gains an optional `defer(read)` that lets an adapter yield one paste to the next by priority, typed by the new `ClipboardItemReader` (`@labre/std`); `htmlDefersToMarkdown`, `isFlatHtml` and `isMarkdownTable` are exported from `@labre/affine-shared/adapters`.
