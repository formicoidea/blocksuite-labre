---
'@labre/data-view': patch
---

A stored filter resolves to the function it means

A condition is persisted as a function name and nothing else — the column type
it was built for is not written down. Resolution took the first function
answering to that name, whatever type it belonged to, so a name declared by two
types resolved to the wrong implementation. Its argument then failed
validation, and a condition that cannot be evaluated reports a match: the
filter silently let every row through and looked as if it had been ignored.

Every function answering to the name is now tried, and the first one that can
actually decide answers. A condition no candidate can apply still lets the row
through rather than hiding everything, as before.
