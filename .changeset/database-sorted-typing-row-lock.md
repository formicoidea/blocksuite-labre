---
'@labre/affine-database-engine': patch
---

In a table view sorted by a column, typing into a selected cell no longer
makes its row jump away (#739, upstream toeverything/AFFiNE#15915): the
first key enters the edit mode and freezes the row order before it is
written, so the row stays where it was and the cell keeps editing. Before,
the first letter was written while the rows were still sorted live, the row
moved to its new place and the editor was left on the row that took its
place. Tag cells (select, multi-select), which open their picker instead of
writing the key, are unchanged.
