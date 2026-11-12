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

## Amendment 2026-11-12 — measured under the site's own policy; the frame's badge

- `canvas-viewer-csp.spec.ts` runs under Labre Sites' policy as the site sends
  it: `default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'`,
  no `style-src-attr`, no `'wasm-unsafe-eval'`. It ran before with
  `style-src-attr 'unsafe-inline'`, so it could not see an attribute report. It
  waits until the shape is painted rather than a fixed delay, and its page holds
  a frame with a shape, a linked-doc card, a note of formatted text and a note
  shown in the page only.
- Measured there, on the whole canvas and on the frozen frame alike: no
  `<style>` element and no `style-src-elem` report from the library (emotion's
  `<style>`, which 0050's amendment still listed, is gone: the viewer adopts
  before emotion's first flush), one `style-src-attr` report per icon drawn,
  and one `img-src` report. The spec fails on any other.
  - The icons: `@blocksuite/icons` binds `user-select:none;flex-shrink:0;` and
    its caller's declarations as a `style` string. The viewer's adopted sheet
    carries them (`vertical-align: middle` for a page reference's icon, inline
    in its text, now included); `font-size: inherit` is what an `svg` does
    anyway, and the subpage icon's `margin-bottom: 0.1em` stays dropped.
  - The image: `@atlaskit/pragmatic-drag-and-drop` preloads a 1×1 `data:` gif,
    its native drag image, when `@labre/std`'s drag and drop module is
    imported. Nothing is dragged on a read-only page. Removing it means
    deferring that preload in `@labre/std` for the editor too; not done.
- The 48 `style-src-attr` reports the site saw on a release candidate in a
  frozen frame do not reproduce here. Every style the library writes on that
  path goes through the CSSOM (`@labre/global/lit`'s `styleMap`, the viewer's
  container), which no policy checks; an attribute set as a string, or a
  cloned element carrying one, is what a policy reports.
- A frozen frame with a title shows its title badge as the editor draws it,
  above the frame's top edge: the view keeps a strip of the badge's height
  (28px) above the frame, its `aspect-ratio` adds that strip in model units for
  the current width, and is read again on each resize. The frame stays edge to
  edge across the width. The guard spec names the frame-title widget among the
  viewer's and the editing toolbars outside it.
- `CommunityCanvasTextFonts` is re-exported from `@labre/affine/canvas-viewer`,
  for a public page that serves the faces itself and needs that entry only.
  The viewer registers no font list.
