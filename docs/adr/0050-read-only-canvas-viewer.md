# ADR 0050 — A read-only canvas viewer a host mounts from a Y.Doc state

- Status: proposed
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

## Open questions

- Does the island pan and zoom on touch from day one? The root handles pinch for
  a trackpad; a phone's two-finger gesture on a public page is untested.
- Should a page's surface references each mount a viewer, or share one? One scope
  per reference is what the surface reference does in the editor; a page with many
  may need a cap.
