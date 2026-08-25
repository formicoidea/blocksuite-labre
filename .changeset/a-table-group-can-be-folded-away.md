---
'@labre/data-view': patch
---

A grouped table can be folded down to its headings

A table grouped by status, owner or phase gives every group its full column
header, its rows, its add-row line and its statistics bar — useful while you
work inside one group, in the way while you are looking for another.

Each group heading now carries a chevron. Clicking it (or pressing Enter or
Space on it, it is a real focusable control announcing its expanded state)
folds the group down to its heading alone; clicking again brings the rows
back. The state is remembered per view and per group for the length of the
browsing session, so scrolling away and returning finds the table as you left
it, while a fresh session starts with everything open.

Both the desktop and the mobile table honour it.
