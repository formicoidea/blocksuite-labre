---
'@labre/data-view': patch
---

A date column can group a database, at the grain you choose

Grouping a table or a kanban board offered tags, text, numbers and booleans —
never dates, the one axis a roadmap is actually organised along. A date
property is now groupable, and it is groupable at six grains: relative to
today (Yesterday, Today, Next 7 days, Last 30 days, then by month further
out), by day, by week starting Monday, by week starting Sunday, by month, or
by year.

The grain and the reading direction live in the group settings menu, beside
"Group by", and both are stored with the view, so reopening the document
finds the same reading rather than snapping back to the default. Date groups
order themselves chronologically — oldest first or newest first — instead of
offering a manual drag order that a recomputed set of groups could not honour
anyway; the manual order stays exactly as it was for every other kind of
grouping.
