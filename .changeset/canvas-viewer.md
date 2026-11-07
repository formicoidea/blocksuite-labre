---
'@labre/affine': minor
---

New entry `@labre/affine/canvas-viewer` (ADR 0050): `mountCanvasViewer(host, state, options)` mounts a read-only canvas from a stored Y.Doc state, with no editor around it, for a host's public page. It pans (drag, wheel, two fingers), zooms (ctrl+wheel, trackpad pinch, two fingers) and follows links: a page link goes to `onOpenDoc(docId)`, an external one to `onLinkClick(url)` after `isSafeLinkUrl`; `getBlob` feeds images. It returns `{ zoomIn, zoomOut, fit, dispose }` and fits once at mount. It imports the whole view graph (3.65 MB gzipped, browser ESM): load it with a dynamic `import()`. The wheel and pinch maths of the edgeless root moved to `zoomAtPointer`, `panByWheel` and `pinchStep` (`@labre/affine-block-root`), shared by both; the editor's behaviour does not change.
