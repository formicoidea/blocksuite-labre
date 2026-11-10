# ADR 0051 — The read-only viewer is the editor, mounted read-only, derived from the registry

- Status: **accepted** (2026-11-10)
- Deciders: Mathieu Jolly (PO principle, Labre Sites acceptance of 2026-11-10)
- Supersedes in part: [0050](0050-read-only-canvas-viewer.md), its decision to
  mount the `preview-edgeless` scope and to add pan, zoom and links by a runtime
  extension. 0050's entry point, sub-path and host contract stand.
- Related ADRs: [0009](0009-reversed-flag-contract.md) (a flag never gates
  content), [0035](0035-core-database-bundle-and-panel-seams.md) (the database chrome
  ships apart).

## Context

The PO's principle, verbatim: « Cet éditeur doit être un miroir de l'éditeur
interactif, c'est presque un fork quelque part. D'ailleurs ce serait bien qu'il
soit autogénéré par la lib elle-même pour qu'on n'ait pas à penser sa
maintenance alors que l'éditeur interactif est modifié. »

ADR 0050 mounted the `preview-edgeless` scope, a picture, and gave it back
pan, zoom and link clicks with its own handlers. That is a second interaction
layer that drifts from the editor's (the editor's wheel and pinch maths had to
be extracted to be shared), and the preview scope only shows what each
provider chose to register for previews. 0050 rejected the full `edgeless`
scope because "the clipboard, the toolbars and the widgets would each have to
be proven inert on a public page".

What the code says since:

- On a read-only store the edgeless root takes the pan tool
  (`edgeless-root-block.ts`, `this.store.readonly`): a drag, the wheel, two
  fingers and the pinch move the canvas with the editor's own handlers.
- Every write goes through the store, which refuses it when read-only.
- What a public page must not show is a short, nameable set of providers:
  editing widgets, panels, collaboration, telemetry.

## Decision

`mountCanvasViewer` mounts the `edgeless` scope of:

```
getInternalViewExtensions()          // the registry, every flag on
  + host providers                   // what the host adds for its editor
  − READ_ONLY_EXCLUDED_VIEW_EXTENSIONS
```

then drops the single extensions in `READ_ONLY_EXCLUDED_EXTENSIONS`, on a
store opened `readonly`. Both lists live in `extensions/view.ts`, beside the
registry, and nowhere else:

- telemetry and the AI audit: `CommandTelemetry`, `CommandUsage`, `Audit`;
- editing widgets: drag handle, auto-connect, dragging areas, selected rect,
  edgeless toolbar, zoom toolbar, keyboard toolbar, linked-doc menu, note
  slicer, scroll anchoring, slash menu, toolbar;
- collaboration: remote selection, thread marks;
- panels: adapter panel, doc title, frame panel, outline;
- one extension inside a kept provider: the file drop, whose indicator lives
  in `<body>`.

A provider added to the registry reaches the viewer without touching it. The
viewer keeps only the host's integration: links (a note's mask covers its
content, so a click is resolved from the elements under the pointer), the
frozen view of an inserted frame, framing, the light theme, and holding under
a strict Content-Security-Policy (`adoptShadowlessStyles`,
`adoptEmotionStyles`, shiki's JavaScript engine).

**The host's providers.** The published core leaves each framework to its own
bundle (`scripts/build-bundles.mjs` strips them from core's `view.ts`), so the
viewer takes `viewExtensions`: the same providers the host gives its editor
(each `descriptor.extensions[].viewExtension`, the database chrome). Without
them a framework's notation is not painted.

**The guard.** `read-only-view.unit.spec.ts` reads, in a real DI container,
what the editor and the viewer register, by identifier. It fails when an
excluded provider or extension registers content (a block view, a canvas
element's view or renderer), when the editor registers something the viewer
lacks without it being excluded, and when an exclusion is stale.

## Consequences

- The wheel and pinch extraction 0050 §4 asked for is dropped: the viewer has
  no handler of its own to share them with. The editor's root is unchanged.
- The viewer is as heavy as the editor (3.65 MB gzipped, browser ESM); a host
  loads it with a dynamic `import()`. 0050's measure stands.
- A frozen view locks the viewport and makes the editor host `inert`; the
  wheel and touch then scroll the page.
- The library keeps no per-line deviation log ([0001](0001-assumed-divergence-from-upstream.md)
  records the divergence as a whole): this ADR is the record.

## Open questions

- A widget that registers with a kept block provider (the code block's
  toolbar, a framework's validation widgets) is part of the viewer. It is read
  only on a read-only store; if one shows editing chrome on a public page, it
  joins `READ_ONLY_EXCLUDED_EXTENSIONS` and the guard proves it paints no
  content.
