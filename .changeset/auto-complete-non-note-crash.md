---
'@labre/affine-widget-edgeless-selected-rect': patch
---

The auto-complete arrow only appears on what the click can actually complete

Clicking an auto-complete arrow on a Wardley map threw
`TypeError: Cannot read properties of undefined (reading 'background')` and left
the canvas untouched. The arrow was being offered on a **group**: a Wardley
component is a `wardleyNode` plus its text label bundled together, and selecting
it on the canvas selects that group, not the node. `createEdgelessElement` then
took "not a shape" to mean "therefore a note" and read `current.props.background`
— a surface element has no `props` bag at all.

**Two levels, so the crash cannot come back by another door.**
`createEdgelessElement` now recognises the two things it can clone — a shape
(subclasses included: Wardley, EDGY and BPMN nodes all pass) and a note block —
and returns `null` for anything else instead of reading a `props` bag on faith.
The caller already treated a falsy id as "nothing to complete".

**And the arrows now agree with the click.** The render guard hung on a stale
hover flag rather than on the predicate the click handlers use, so any selected
element grew arrows as soon as the pointer left it — a group, a free text label,
a framework background, or the first element of a multi-selection. It is now the
same single predicate throughout: exactly one element selected, it is the one the
widget holds, and it is a shape or a note. The dead hover flag and the pointer
tracking that fed it are gone.

Nothing changes for a shape (four arrows, click clones it and draws the
connector), a note (two arrows, click adds a note), a mindmap node (its sub- and
sibling-node buttons), or the drag-out gesture that opens the shape picker. A
lone Wardley node — selected by entering the group — is a shape, and completes
into a properly typed Wardley clone rather than a plain rectangle.
