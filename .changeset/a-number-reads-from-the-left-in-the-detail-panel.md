---
'@labre/data-view': patch
---

A number reads from the left in the record detail panel

Number cells are right-aligned in a table, where the column edge gives the digits
something to line up against. The detail panel has no such edge, so it carries a
rule that flips a number back to the left — except the rule named a class the
cell never renders, so it matched nothing and every number in the panel stayed
pushed against the far right of a full-width row, adrift from its own label.

The rule now names the element the cell actually renders, so numbers in the
detail panel start where every other field starts.
