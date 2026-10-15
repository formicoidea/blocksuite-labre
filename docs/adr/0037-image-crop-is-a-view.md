# ADR 0037 — An image crop is a stored view, never new bytes

- Status: **accepted** (2026-10-15, approved by merging #496)
- Deciders: Mathieu Jolly
- Milestone: Labre v2, phase P4 (lot 2 bis « masques 16:9, Rogner »)
- **Red zone**: stored format (`packages/affine/model`, block `affine:image`).
  Needs a maintainer's explicit approval before merge.
- Related ADRs: [0009](0009-reversed-flag-contract.md) (a flag never gates
  content), [0012](0012-framework-interchange-and-foreign-preservation.md)
  (unknown data is preserved), [0016](0016-hollow-endpoint-styles.md) and
  [0020](0020-connector-end-labels.md) (the precedent for an optional field
  that an older client ignores), [0031](0031-canvas-layers-hide-and-grid.md)
  (optional `prop:` keys on a gfx block).

## Context

The v2 PRD lists « masques 16:9 » and « Rogner » in lot 2 bis with no further
text. The PO's standing rule (14/10) is that no data may be lost, and the asset
decision of P4 is that an image is a **reference** to a blob shared by every
page that inserts it (`sourceId` is the content hash). Cropping therefore
cannot rewrite the bytes: the same blob is shown, uncropped, on every other
page that references it, and « Remplacer » is the only gesture that creates a
new asset.

The image block stores, before this ADR: `sourceId`, `caption`, `width`,
`height`, `rotate`, `size`, the gfx keys (`xywh`, `index`, `layer`,
`hiddenForEveryone`…) and `comments`. Nothing describes a part of the picture.

## Decision

### One optional field, `crop`, on `affine:image`

```ts
type ImageCropMask = 'free' | '16:9' | '4:3' | '1:1'; // append-only
interface ImageCrop {
  x: number; // left edge, fraction of the source width, 0..1
  y: number; // top edge, fraction of the source height, 0..1
  w: number; // width, fraction of the source width, 0..1
  h: number; // height, fraction of the source height, 0..1
  mask?: ImageCropMask; // which preset drew it; absent = free
}
// ImageBlockProps.crop?: ImageCrop — default `undefined`, never written.
```

- The rectangle is **normalised to the source image**, so it survives a
  resize, a different screen and a re-encoding of the same picture, and it
  needs no pixel size to be stored.
- `mask` only says which preset the crop tool reopens on. The rectangle is the
  truth; the ratio is never recomputed from `mask`. Its values are
  append-only tokens; an unknown token reads as `free`.
- The default is `undefined`, so `sync-controller` never writes the key: an
  image that nobody crops stores exactly the keys it stored before
  (`image-crop-format.unit.spec.ts` pins the key list and proves that opening
  such a document appends no Yjs operation).
- **Uncropping deletes the key** (`delete model.props.crop`), it never writes
  a full rectangle or `null`. A full rectangle read from a peer is treated as
  "no crop".
- Every reader goes through `readImageCrop` (`@labre/affine-model`): a value
  that is not four finite numbers describing a non-empty rectangle inside the
  image reads as "no crop", so a damaged or hostile value shows the whole
  image, never an error and never an empty box.

### The bytes never change

`sourceId` is not touched by any crop gesture. The original stays one click
away (« Rogner › Image d'origine » removes the key), on every client, forever.
Copy, download, « Turn into card view », the Markdown and HTML adapters and
the draw.io writer keep handing out the **whole** picture: a crop is how this
block shows the image, not a new image.

### What a box means, per view

- **Page.** `width` / `height` keep meaning the displayed size of the
  **whole** image, as before. The block shows the window
  `crop.w × width` by `crop.h × height`; cropping keeps the picture's scale.
  A page resize with a crop writes the whole image's size back
  (`ImageResizeManager.onEnd`), so the HTML adapter's `width`/`height` stay
  those of the whole picture.
- **Canvas.** `xywh` is the visible box, as for every gfx element (selection,
  hit test, snapping, export bounds read it). A crop gesture rewrites `xywh`
  in the **same transaction** as `crop`, keeping the picture at the same scale
  and the kept part at the same place, rotation included (`cropBoundFor`).
- Paths that rebuild an image from its props carry `crop`: the canvas
  clipboard (`EdgelessClipboardImageConfig`) and a page image dropped on the
  canvas (its box is the cropped window of `width` × `height`).

### Rendering and export

- Page and canvas draw the source through an `overflow: hidden` window; the
  `<img>` is scaled by `1 / crop.w`, `1 / crop.h` and offset by the crop's
  origin. No canvas, no re-encoding.
- The PNG and PDF canvas export draw the blob with the source rectangle of
  `imageCropSourceRect` (`ExportManager.edgelessToCanvas`); the page PNG is a
  rasterised DOM and shows what the page shows.
- The board SVG export (ADR 0025) draws no image block today, cropped or not;
  a future image painter must apply `imageCropSourceRect` too.

### The tool

« Rogner » is one entry of the image toolbar (page and canvas), an
`editor-menu-button` of `editor-menu-action`s: Libre, 16:9, 4:3, 1:1, and
« Image d'origine » when a crop exists. A preset writes the largest centred
rectangle of that ratio and opens the crop frame; « Libre » opens the frame on
the current crop. In the frame, dragging the window moves it, dragging a corner
resizes it (ratio held unless free). Each drag is one gesture: one
`captureSync`, one write at release, nothing written when nothing changed,
nothing at all when `store.readonly`. Escape, Enter or a press outside closes
the frame. A preset needs only the source's proportions: the loaded picture's
pixel size, else (an SVG with no intrinsic size) the stored box, which is the
crop's share of the whole picture on the canvas and the whole picture on a
page.

## Consequences

- **A 0.49 client** (and any client before this ADR) ignores the key and
  keeps it through a round trip (unknown `prop:` keys are preserved,
  `unknown-block-props.spec.ts`). It shows the **whole image**:
  - on a page, at its whole size, undistorted (page `width`/`height` still
    describe the whole picture);
  - on the canvas, inside the cropped box: the whole picture **stretched** to
    the crop's proportions, because `xywh` is the visible box. Nothing is
    lost; the next client paints it cropped again.
  - Its canvas clipboard lists the props it copies, so a 0.49 duplicate of a
    cropped canvas image loses the crop on the copy (never on the original).
    A 0.49 **cut and paste** goes through the same path: the image it
    recreates is the original whole picture in the cropped box, without its
    crop. The bytes are intact and « Rogner » can redo it, but the crop
    itself is gone from that image.
  - A 0.49 **page → canvas drag** keeps the key but sizes the box from the
    whole picture's `width`/`height`, so a recent client then shows the
    cropped window stretched to the whole picture's proportions until the
    crop is redone or removed. Nothing is lost.
  - These three exist only while an older client edits a document a recent
    one cropped. Labre has one host, which ships the published library to
    every user at once: they disappear with that release.
- **Collaboration.** `crop` and `xywh` are two keys, each resolved by Yjs
  on its own (last writer wins per key). A crop on one peer concurrent with a
  resize or another crop on a second peer can end with a box from one and a
  crop from the other: the picture is drawn distorted, but both values are
  stored and nothing is lost; the next crop or « Image d'origine » restores
  the proportions.
- No migration: absent means uncropped, which is every existing image.
- One more key every future reader of `affine:image` honours. Writers that
  rebuild an image from a hand-picked prop list must add `crop` (the two such
  sites are listed above).
- Not gated: an image crop is content a stored document needs to render as
  its author saw it (ADR 0009).
- Not done: cropping a canvas frame or an embed, a mask shape other than a
  rectangle, and a crop in the SVG/draw.io writers (draw.io receives the
  cropped box with the whole picture's reference).
