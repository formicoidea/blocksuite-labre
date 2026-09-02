---
'@labre/std': patch
'@labre/affine-block-surface': patch
---

The reading panel finds a record bound to the composite, not just to the circle.

"Read this component" reported "Not linked to a record" on a Wardley component
whose record link was plainly there in the document. A component is a COMPOSITE
— a group holding the circle that carries the role and the free text that names
it — and the two halves answer different questions: the panel resolves its
reading on the circle, because that is where the role is, while a plain click
selects the GROUP, so a host's own linking gesture stamps the group. Neither
side was wrong; they were looking at different elements.

`resolvePivotBinding(element)` in `@labre/std/gfx` is the one place that
reconciles them: the element itself when it is bound, otherwise the first bound
element in its chain of ancestor groups, with the child always winning over the
group it sits in. The whole record side of the reading now starts from that
resolved binding — the "Linked" line, the record's nature and phase, and the
drift comparison — so the panel and the drift line can never name different
records.

Reading only. Writing is unchanged: `pivot.bind` and the panel's "Link to a
record" still stamp the element that carries the role, and
`collectPivotOccurrences` and the materiality seam stay strictly
element-by-element, because that is the contract a host builds its derived state
on (ADR 0006).
