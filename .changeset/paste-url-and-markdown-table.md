---
'@labre/affine-inline-link': minor
'@labre/affine-block-root': minor
'@labre/affine-block-table': patch
'@labre/affine-block-database': patch
---

Pasting a lone http(s) URL in a page still writes a plain link, then opens the link's own toolbar on it, so its view switcher offers "Card view" and "Embed view" beside "Inline view"; the next key or a press outside the toolbar closes it and the link stays. `@labre/affine-inline-link` exports `lonePastedUrl(text)` and `proposeLinkViews(std, url)`, and `AffineLink` gains `proposeViews()`. A GFM table pasted or imported as Markdown always becomes an inline table, never a database (the database's Markdown matcher no longer claims `table` nodes), and an image inside a cell is kept as a link named by its alt text instead of vanishing. No new key, no stored format change.
