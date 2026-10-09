# ADR 0034 — One seam per panel the library opens; one façade for the host's own panels

- Status: proposed (2026-10-09)
- Deciders: Mathieu Jolly
- Relates to [ADR 0008](./0008-command-registry-foundation.md) (one
  command registry, `runCommand` as the single bottleneck),
  [ADR 0011](./0011-editor-anchored-info-panels.md) (the library's own panels
  anchor to the editor), [ADR 0013](./0013-cynefin-framworks-carries-no-validation-rules.md)
  (the "closed against this ADR" device) and
  [ADR 0031 §12](./0031-canvas-layers-hide-and-grid.md) (the selection pane's
  seam, the model this one generalises)

## Context

The product owner asked whether the frame panel — the side panel that lists
and reorders the frames a presentation walks through — could be redrawn by a
host the way the artefact catalogue and the selection pane already can. The
audit that answered found four things.

**Three seams say "host, show a panel", and nothing else.** The library asks
the host to show a panel through `ArtefactCatalogueExtension`
(`open(owner)`, `close`), `SelectionPaneExtension` (`open()`, `close`) and
the `SidebarExtension` inherited from AFFiNE (`open(tabId?: string)`, `close`,
`getTabIds`). The first two accept `null`, and every consumer reads that
absence the honest way: no button is drawn for a panel that would not open.
The third has one caller in the whole library, the "View in TOC" action of
the note toolbar's toast (`packages/affine/blocks/note/src/configs/toolbar.ts`),
which opens the tab named `'outline'`; a string nobody types elsewhere, on a
seam shaped for a sidebar the library never had. `SidebarExtension` is not the
seam that opens a document beside the canvas: that is
`RefNodeSlotsProvider.docLinkClicked` with its `openMode`, or
`PeekViewProvider`.

**The frame panel has no seam because nothing in the library opens it.** No
toolbar button, no command, no shortcut: `affine-frame-panel` is a component
a host mounts (the playground's debug menu does). A seam with `open` and
`close` would have no caller on the library side, and a row in the seams table
promising a degraded behaviour that never happens.

**What a host panel needs is scattered, and one write path is missing.** A
host that draws its own catalogue imports `armArtefact` from the edgeless
toolbar widget; its own selection pane imports `selectionPaneTree` from the
surface block and the `canvas.*` commands from the registry; its own frame
panel would read `EdgelessFrameManager.frames` from the frame block — four
packages, three levels of abstraction, no page naming them together. And the
frame order has no command at all: the library's panel writes
`presentationIndex` by hand (`frame-panel-body.ts`, `_reorderFrames`) with no
read-only check and `captureSync` after the write, and the presentation
toolbar's order menu (`present/frame-order-menu.ts`) writes it a second time,
differently. A host could only have copied one of the two.

**Two drag-to-reorder gestures drifted.** The frame panel's
(`fragments/frame-panel/src/utils/drag.ts`) runs on mouse events, never checks
`readonly`, ignores Escape and draws its drop line at the top of the list for
a drop after the last card; the selection pane's (`selection-pane-widget.ts`,
"Drag to reorder") runs on pointer events, refuses on read-only, shows a
`not-allowed` cursor and swallows Escape. The pane's docblock says it copied
"the frame panel's model"; a comment held the two together, and a comment
holds nothing. Only the 5px threshold, `panelDragStarted`, was shared.

A universal panel connector — one seam, `open(request)` routed by panel kind —
was studied against the two shipped seams and rejected: it would fold three
contracts into one object without removing what actually varies (a default
per panel, a typed argument for one of them, a `null` per panel), it would
turn the host's single implementation into a router, it would break or
double-path two published host contracts, and its fourth consumer does not
exist. The `open/close` direction is not where the duplication is. The
host→editor direction is.

## Decision

1. **Editor→host: one dedicated DI seam per panel the library itself opens,
   and no universal router.** `ArtefactCatalogueExtension` and
   `SelectionPaneExtension` stay as they are. The note toast's "View in TOC"
   gets its own seam, `OutlinePanelExtension({ open, close } | null)` /
   `OutlinePanelProvider`, shaped exactly like the selection pane's; absent or
   `null`, the toast offers no link.
2. **`SidebarExtension`, `SidebarService` and `SidebarExtensionIdentifier`
   are removed**, not deprecated: a public export is not a persisted
   identifier, the seam had one caller, and a host that implemented it sees
   a compile error at upgrade whose fix is one rename.
3. **The frame panel gets no seam.** Nothing in the library opens it; a host
   that wants its own mounts its own component beside the editor, and the
   "start the presentation" button is the host's (`PresentTool` is exported).
   An audit reporting a missing `FramePanelExtension`, or a missing universal
   panel seam, is closed against this ADR.
4. **Host→editor: one façade module, `@labre/affine/host-panels`.** Named
   functions only — re-exports of what already exists (`runCommand`,
   `getCommandsForSurface`, `getCommandIcon`, `armArtefact`,
   `selectionPaneTree`, …) plus one-line helpers (`frameList`, `selectModels`,
   `fitToModel`) — no class, no object with state, no Lit type named in its
   signatures. The library's own panels and a host's panels call the same
   functions, which is what makes their behaviour the same.
5. **Every write a host panel performs is a core command run through
   `runCommand`.** `canvas.frame.reorder` (`{ ids, before }`, `before: null`
   = the end) is added so the frame order has one; the library's frame panel
   and the presentation order menu write through it too. The read-only
   refusal, the no-op detection and the single undo step live in the action,
   once.
6. **One drag-to-reorder controller for both panels**,
   `createPanelReorderDrag` in `@labre/affine-shared/utils`: pointer events,
   the shared threshold, read-only refused at the press, the gap computed from
   live row rects, a mask whose cursor says `grabbing` or `not-allowed`,
   `pointercancel` and **Escape cancel the gesture** (nothing written), the
   click after a release swallowed once. Ghost rendering and the drop
   predicate stay the panel's. **Both panels move the whole selection**, so
   `canvas.element.reorder` widens to accept `ids`.

## Consequences

- The seams table gains the outline row and loses the sidebar row; a host
  reading it sees three panel seams, each with a `null` story, and a pointer
  to `docs/integrate/08-host-panels.md` for the other direction.
- `@labre/affine/host-panels` only widens from here (a type-level guard holds
  its 0.46 call shapes, `docs/lessons.md` 33). A verb a host panel needs and
  cannot find there is a gap in the façade, not a reason to import a widget
  package.
- The frame panel's drag refuses on a read-only document, draws its line
  under the last card, writes through the command and undoes in one step. The
  selection pane's Escape now cancels instead of waiting for the release; its
  drag moves every selected row of one stack, and refuses a selection that
  spans several.
- The presentation order menu keeps its own gesture (a popover, not a panel);
  only its write goes through the command. A `ponytail:` line names the
  ceiling and the upgrade path.
- Nothing stored changes: `presentationIndex` keeps its meaning and its
  fractional-key format; a document reordered by a 0.45 client reads the same.
- Revisit this decision at a **fourth panel the library itself opens**, or
  when a host registers panels dynamically. Then a router is reconsidered
  with the three seams as its first adapters — not before.

## Amendments

None yet.
