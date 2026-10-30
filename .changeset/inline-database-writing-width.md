---
'@labre/affine': patch
---

An inline table or board scrolls within the text column. The block no longer bleeds its scroller into the page's gutters (its distance to the editor's edge, minus 72px), so a wide inline view shows a horizontal scrollbar as wide as the column the person writes in, not across the whole editor. A database's full page is unchanged (its bleed was already 0).
