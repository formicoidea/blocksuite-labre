# ADR 0050 — A read-only canvas viewer a host mounts from a Y.Doc state

- Status: accepted (2026-11-08, built as amended below); superseded in part
  by [0051](0051-read-only-viewer-is-the-editor.md) (2026-11-10): the viewer
  mounts the edgeless editor on a read-only store, not the preview scope
- Date: 2026-11-05
- Deciders: Mathieu Jolly
- Host side, never restated here: Labre Sites (labre ADR-0069), public pages
  rendered on a server, the canvas as a client-side island. The server half is
  `HtmlAdapter` (`docs/integrate/09-static-html.md`), which prints
  `data-labre-surface-ref` for this viewer to mount on.

## Context

A public page needs to show a canvas: pan, zoom, click a link, no toolbar, no
editing. The obvious answer is the `preview-edgeless` scope, which already draws
a read-only canvas for the surface reference and the frame panel. What the code
says:

- **The scope is a picture, on purpose.** `affine-edgeless-root-preview` sets
  `pointer-events: none` on its host, `EdgelessLocker` locks the viewport, and the
  surface reference lays an event mask on top. Nothing in it pans, zooms or
  receives a click.
- **Zoom and pan live in the editor's root.** The wheel handling, the pinch
  capture (`pinch-zoom.unit.spec.ts`) and the pan tool are in
  `edgeless-root-block.ts`, tied to `affine-edgeless-root`, which the scope does
  not mount.
- **The full `edgeless` scope is the wrong start.** On a read-only store it still
  registers the clipboard, the toolbars and the widgets, each of which would have
  to be proven inert on a public page.
- **The cost is the whole view graph.** `getInternalViewExtensions()` bundled for
  the browser, minified, with `get('preview-edgeless')` as the only use: 5 112
  modules, 16.1 MB, 3.62 MB gzipped. Stylesheets from `.css.ts` files are not in
  that figure. The scope filters what registers, not what is imported.
- **happy-dom cannot paint it.** The surface renders on a 2D canvas context,
  which is why `blocks/surface` runs its specs in browser mode. A happy-dom spec
  can prove the wiring and the teardown, not that anything is drawn.

## Decision

Proposed, not built: one exported function, no new scope, no new bundle.

```ts
// @labre/affine/canvas-viewer
export function mountCanvasViewer(
  element: HTMLElement,
  state: Uint8Array,
  options?: { docId?: string; onLinkClick?: (url: string) => void }
): { dispose(): void };
```

1. Opens the state like the headless path, on a store with `readonly: true`.
2. Mounts `new BlockStdScope({ store, extensions }).render()` with the
   `preview-edgeless` list plus one runtime extension, the way
   `surface-ref-block.ts` adds its `_runtimePreviewExt`.
3. That extension unlocks the viewport after `EdgelessLocker`, restores pointer
   events on this host only, and handles wheel, pinch and drag on the viewport.
4. The wheel and pinch maths moves out of `edgeless-root-block.ts` into one
   function both call, held by the existing pinch and shift-wheel specs. Copying
   it is how the two would drift.
5. A click hit-tests the blocks under the pointer and follows an `a[href]` through
   `isSafeLinkUrl`. Without `onLinkClick` it navigates.

`ViewScope` does not grow: a new scope is a branch in every `view.ts`, for every
framework. The two existing consumers of `preview-edgeless` do not change.

## Consequences

- The host must load this with a dynamic `import()`, on pages that hold a canvas
  only. Static pages stay free of it. A lighter graph means splitting
  `getInternalViewExtensions`, which is a separate decision.
- Every framework paints through it, so a new framework needs nothing here. A flag
  stays out of it: a stored document renders whatever the flags say (ADR 0009).
- Testing is in two parts: a happy-dom spec for mount, dispose and the readonly
  store; a spec in `packages/integration-test` for painting, pan, zoom and a link
  click.
- Until it ships, a host leaves the `data-labre-surface-ref` mount point with its
  caption.

## Amendment 2026-11-08 — what shipped

Built as decided, under the same sub-path and name, with the contract the two
hosts asked for (Labre Sites' island and its publishing service) folded in:

```ts
// @labre/affine/canvas-viewer → @formicoidea/labre-core/canvas-viewer
export function mountCanvasViewer(
  host: HTMLElement,
  state: Uint8Array,
  options?: {
    onOpenDoc?: (docId: string) => void;
    onLinkClick?: (url: string) => void;
    getBlob?: (blobId: string) => Promise<Blob | null>;
    focus?: { kind: 'frame' | 'group'; id: string };
    interactive?: boolean; // defaults to !focus
    onExpand?: () => void;
    docTitles?: Readonly<Record<string, string>>;
  }
): { zoomIn(): void; zoomOut(): void; fit(): void; dispose(): void };
```

- `docId` is gone: the viewer opens the state under its own id. A page link
  goes to `onOpenDoc` (an inline page reference, a linked or synced doc card);
  an external one to `onLinkClick`, after `isSafeLinkUrl`, or navigates.
- The controller gains `zoomIn`, `zoomOut` and `fit`, for a host's own zoom
  buttons; the viewer fits once at mount.
- `getBlob` feeds images through a read-only blob source; without it nothing
  is fetched.
- No `locale`: the viewer displays no library string. No `fitToContent`
  switch: it always fits at mount.
- `focus` shows one frame or group the way the surface reference block shows
  it in a page (PO acceptance, 2026-11-10: an inserted frame must open a view
  on the canvas): the container takes the element's `aspect-ratio`, the view
  frames its bounds with `setViewportByBound` (a frame edge to edge with its
  border hidden, a group with 20px), and `fit()` returns to them. It throws
  when the state holds no element of that kind under that id.
- `interactive` defaults to `false` with `focus`: a frozen view, like the
  surface reference under its event mask. The wheel and touch scroll the page,
  no link is followed, and a click or Enter calls `onExpand`; the host opens
  the larger view by mounting the same `focus` with `interactive: true`, as the
  editor opens the referenced canvas. The "Expand" button is the host's: the
  viewer still displays no library string.
- `docTitles` names the other pages for page references and linked doc
  cards; a page left out shows as deleted, as in the editor.
- It holds under a public page's strict Content-Security-Policy (`style-src`
  without `'unsafe-inline'`, `script-src` without `'wasm-unsafe-eval'`), checked
  in a browser on 2026-11-10 against a release candidate that drew nothing:
  `adoptShadowlessStyles()` (`@labre/std`) moves every light-DOM style from
  `<style>` elements to adopted sheets, which the editor keeps off; the
  viewer's own rules and emotion's (tables, databases) go to adopted sheets
  too; code blocks highlight with shiki's JavaScript engine
  (`CodeBlockConfig.engine`), not WebAssembly; the paragraph's in-template
  `<style>` moved to its static styles; the file drop is not mounted. Two
  reports remain and change nothing on screen: emotion's own `<style>`, created
  at import before any viewer exists, and the `style` attribute
  `@blocksuite/icons` binds on its icons, whose two declarations the viewer's
  sheet carries. A click resolves its link from the elements under the
  pointer, since a note's mask covers its content.
- The light theme is set as custom properties on the viewer's container only.
- §4 shipped as `utils/wheel-gesture.ts`, then was dropped by ADR 0051: the
  viewer now runs the editor's own handlers and has none to share.
- Events: one-finger or mouse drag pans, two fingers pinch, ctrl+wheel and a
  trackpad pinch zoom, a plain wheel pans; every pointer, wheel and click
  event stops on the viewer's container in capture, so no block reacts.
- Measured cost of the entry, browser ESM minified: 5 184 modules, 16.2 MB,
  3.65 MB gzipped, `.css.ts` not extracted. The lighter graph is still the
  separate decision of splitting `getInternalViewExtensions`.
- Tests: `canvas-viewer.unit.spec.ts` (happy-dom, a recording 2d context)
  holds mount, read-only store, zoom, drag, link, dispose, and a focused frame
  that shows nothing beyond it, frozen or interactive. The painting
  spec in `packages/integration-test` is not written yet.

## Open questions

- Does the island pan and zoom on touch from day one? Answered in code: yes,
  one finger pans and two pinch, on pointer events. Still untested on a phone.
- Should a page's surface references each mount a viewer, or share one? One scope
  per reference is what the surface reference does in the editor; a page with many
  may need a cap.
