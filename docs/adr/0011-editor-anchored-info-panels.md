# ADR 0011 — Canvas metadata is shown in an editor-anchored panel

- Status: **accepted** (August 2026) — PO decision of the recette of 02/08/2026,
  second pass, points 2 and 3.
- Deciders: Mathieu Jolly
- Milestone: "PF+MF" refoundation — validation platform / reversed reading
- Related ADRs: [0008](0008-command-registry-foundation.md) (the commands these
  panels are one surface of), [0009](0009-reversed-flag-contract.md) (a panel is
  tooling, so it disappears with a flag and takes no content with it).

## The decision, in the PO's words

> The metadata of the canvas is shown in a panel anchored to the editor, above
> the senior button bar, at its width.

## Context

Both info surfaces the validation platform grew — the reversed reading of a
component (#98, #100) and the Map quality checklist (PF7.11) — shipped as
floating popovers hung off the element they talk about. Both lost the same two
wars.

**The z-order war.** A widget host inside `.widgets-container` that picks a
polite `z-index: 2` sits below `editor-toolbar`, which takes
`--affine-z-index-popover` — 1000 in the theme. The reading panel was found
rendering _behind_ the contextual toolbar; the Map quality dropdown had the same
ceiling waiting for it. Winning that contest is not a per-panel decision to be
rediscovered: the panels are siblings of the toolbars, and the layer has to be
declared once, at the sibling level, or the next surface repeats the bug.

**The legibility war.** A paragraph of prose about a component is not something
to read out of the corner of a shape. The floating anchor also had to flip sides
and ends to stay on screen, so the panel moved under the reader as the board
moved — and a checklist somebody is halfway through ticking must not move at
all. The fixed widths that replaced the bubbles (480px for the reading, 320px
for Map quality) were an improvement and still arbitrary: they lined up with
nothing on screen.

## Decision

Canvas metadata is presented in a panel **anchored to the editor**, not to an
element:

1. **Placed against the senior button bar.** The panel's left and right edges
   are the bar's own, measured from `.edgeless-toolbar-container`'s rect rather
   than computed from the toolbar's layout constants — the bar's width is
   `fit-content` over a tool count that changes with the editor's width, so any
   arithmetic here would be a copy that drifts. Its bottom edge sits a fixed gap
   above the bar's top edge. It re-measures on a viewport change (resize, zoom)
   and on a `ResizeObserver` over the bar itself, which is what catches the
   toolbar's own debounced re-layout.
2. **In one layer, above every toolbar**, declared on the widget HOST —
   `calc(var(--affine-z-index-popover, 1000) + 10)` — because that sibling level
   inside `.widgets-container` is the only level where the contest with
   `editor-toolbar` can be won. Host stays zero-sized; the panel carries the box.
3. **Through one shared class.** `EditorAnchoredPanel`
   (`packages/affine/blocks/surface/src/extensions/editor-anchored-panel.ts`)
   owns the geometry, the layer, the dialog semantics, the pointer-swallowing,
   click-away and Escape, and the re-measure wiring. A panel subclasses it,
   says when it is open and how it closes, and renders its own body. No copy.
4. **Presentation only.** Adopting the pattern never changes what opens a panel,
   what it says, or what it writes. Map quality keeps the entry in the
   background's contextual menu as its trigger, and its command
   (`validation.mapQuality`) as its other surface.

A panel that cannot measure the bar — a read-only board renders no toolbar —
falls back to a centred panel of comfortable measure clear of the bottom strip.
The fallback is the only place a width floor applies: where the bar _is_
measured, "the same width as the bar" is exact, because a panel that quietly
stopped matching under some condition is the bug this decision exists to remove.

## Consequences

- **Today**: the reversed reading panel (`reading-widget.ts`) and the Map quality
  panel (`map-quality-widget.ts`). Map quality leaves the popover presentation
  entirely; its dropdown-anchored geometry, its flipping and its 320px are gone.
- **Tomorrow**: any surface that tells the reader something about the canvas
  rather than about a selection — a framework's own legend, a document-level
  audit report, a host's inspector — extends the same class and inherits the
  place, the layer and the dismissal contract for free. Adding a second
  arbitrary width is now a code review question with an ADR behind it.
- **Not covered**: transient reads of ONE finding, which stay where the finding
  is. The violation bubble (`violation-detail-widget.ts`) is deliberately not
  migrated: it is about a marker at a point on the board, and moving it to the
  bottom of the editor would sever it from the thing it explains.
- **Cost**: the panel is only as wide as the toolbar, so a very narrow editor
  gives a narrow panel. Accepted: it is the same measure every other piece of
  the tool's furniture already lives at, and the alternative is a panel wider
  than the UI it belongs to.
- **Testable**: the width equality is asserted against the measured bar at two
  editor widths, and the layer against both toolbars' computed `z-index`.
