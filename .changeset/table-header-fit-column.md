---
'@labre/affine': minor
---

The simple table gets a header row and a header column (ADR 0043): a "Header row" toggle in the first row's menu and a "Header column" toggle in the first column's menu, stored as two optional keys (`headerRow`, `headerColumn`; `true` or absent) that older documents never gain on open. Header cells render bold on the theme's table header tint; an explicit row or column colour still wins. The HTML export writes `<thead>`/`<th>`, the HTML import reads a `<thead>` (and a column of leading `<th>`) back, and the Markdown import now marks the first row of every GFM table as a header, so an imported or pasted Markdown table shows a bold first row. Double-clicking a column's resize handle fits that column to the room left in the table's box. New keys `com.labre.table.header-row` and `com.labre.table.header-column` (English fallbacks shipped).
