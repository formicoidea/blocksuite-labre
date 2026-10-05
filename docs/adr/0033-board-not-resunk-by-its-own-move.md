# ADR 0033 — A board is not re-sunk by its own move

- Status: accepted (2026-10-05, product owner's decision)
- Deciders: Mathieu Jolly
- Relates to rule R10 (`docs/add-a-framework/02-framework-rules.md`) and
  [ADR 0031](./0031-canvas-layers-hide-and-grid.md) (the selection pane, where
  a user reorders a board by hand)

## Context

`BackgroundStackingExtension`
(`packages/affine/blocks/surface/src/framework-background/stacking.ts`) keeps
rule R10, "a board is a floor, never a lid", on a live surface. It answered two
local gestures, an element CREATED and an element MOVED, with the same rule:

- an element that a board overlapping it sits above is raised just above that
  board (a shape dropped onto a map, a board dropped on a peer board);
- a board that covers an artefact below it is lowered to the floor it lies on,
  or to the back of the surface.

The second half also ran on a board's own move. With the selection pane, a
user can now put a board above an artefact on purpose (a drag in the pane,
"bring forward"); the next drag of that board lowered it again, silently
undoing the order the user had just chosen.

Nothing else enforces a board's depth: no comparator special-cases a
background (`packages/framework/std/src/utils/layer.ts`), the renderers paint
the stored `index`, and the extension writes only on local gestures. The rule
changes how documents react to edits, never how an existing document paints
when it is opened.

## Decision

A board is lowered under what it covers only when it is **placed** — created,
pasted, duplicated, inserted from a template, imported — never by its own
**move**. `stackingIndexFor` takes the gesture (`'placed'` | `'moved'`); a
move never answers "lid".

Kept as they are:

- whatever is placed or moved ONTO a board is raised above it, a board moved
  under a peer board included;
- the insertion-time default for a new board, board-on-board placement
  (superposed peers, an enclosing sheet) included;
- the frame-versus-board rule (`frameIndexAt`, `_watchFrameMoved` in
  `packages/affine/blocks/frame/src/frame-manager.ts`);
- the cascade invariants: local gestures only, nothing on a remote change,
  nothing nested, idempotent so undo stays one step.

## Consequences

- Moving a board over existing free elements now covers them. Accepted by the
  product owner: those elements are not lost — they are listed in the pane, and
  moving one of them onto the board raises it again.
- A board the user raised by hand stays where they put it through its own
  moves and through a peer's edits (`background-stacking.spec.ts`, the guard
  "a board dragged above an artefact from the pane stays above…").
- Nothing stored changes, no document paints differently on open.
