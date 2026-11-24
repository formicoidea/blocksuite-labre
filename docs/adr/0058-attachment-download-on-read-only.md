# ADR 0058 — A read-only reader can always download an attachment

- Status: **accepted** (2026-11-24)
- Deciders: the product owner, on issue #744 (2026-11-24): « upstream catch-up
  AND a Download button drawn in the card when read-only ».
- **Red zones**: none touched. No schema, no stored key, no default, no flag. A
  new visible control and one new translation key, which a host catalogue
  translates.
- Related: #744, upstream toeverything/AFFiNE#15905 (commit 268371c), ADR 0051
  (the read-only viewer is the editor), ADR 0023 (every displayed string
  through a key), `docs/integrate/04-host-seams.md` (the peek view seam).

## Context

A reader of a read-only document (a shared page, the canvas viewer of ADR
0051, a store opened `readonly`) could not get an attachment out of it:

- **The toolbar is hidden.** Download lives in the attachment's toolbar
  (`configs/toolbar.ts`, `d.download`), and `ToolbarContext.activated`
  answers `false` first thing on a read-only store
  (`shared/src/services/toolbar-service/context.ts`). The canvas viewer does
  not even mount the toolbar widget (ADR 0051,
  `READ_ONLY_EXCLUDED_VIEW_EXTENSIONS`).
- **The peek view was shut.** `@Peekable` on `AttachmentBlockComponent` had
  `enableOn: !model.store.readonly && type.endsWith('pdf')`. That line is not
  a Labre decision: it is upstream's toeverything/AFFiNE#11641 (2025-04,
  "disable opening peek view with pdf viewer in readonly and sharing modes"),
  synced here in c332148b8. Upstream reverted it in #14761 (2026-04, PDF
  preview on read-only public pages), then widened it in #15905 (commit
  268371c) to `readonly || pdf`: every attachment opens in the peek view on a
  read-only document, which offers the download for what it cannot preview.
- **A click on the card selects it** (page) or does nothing (canvas).
- **The peek view is a host seam**, read with `std.getOptional`
  (`PeekViewProvider`, `docs/integrate/04-host-seams.md`). A host without one
  peeks nothing, so the upstream fix alone leaves such a host's readers with
  no way to the file.

## Decision

A reader of a read-only document can always get the file:

1. **The peek view, when the host provides one.** `enableOn` becomes
   upstream's `model.store.readonly || model.props.type.endsWith('pdf')`. On
   an editable document only a PDF peeks, as before. Without a provider
   nothing peeks: the seam behaves as it did.
2. **An in-card Download the library draws itself, on read-only only.**
   `AttachmentBlockComponent.renderReadonlyDownload` draws a real `<button>`
   (`type="button"`, so in the tab order and pressed by Enter and Space)
   with the card's button class (`affine-attachment-content-button`, the
   Reload and Upgrade buttons' look), a 2px `:focus-visible` ring in
   `--affine-focus-ring-color` (falling back to `--affine-primary-color`),
   drawn inside so the card's `overflow: hidden` does not cut it, and an
   accessible name and tooltip that name the file
   (`com.labre.attachment.button.download`, « Download {{name}} »). Its
   visible word is the toolbar's own `com.labre.toolbar.download`.
   - It runs the toolbar's own path, `block.download()`
     (`downloadAttachmentBlob`: the in-progress guard, the toasts, an anchor
     with the blob url and the file's name). Whether an attachment offers
     Download at all is one predicate, `isDownloadableAttachment`, which the
     toolbar's `when` now reads too: a citation offers none.
   - It is drawn only once the blob url is known: a button that could only
     answer « Failed to download » is not drawn.
   - **Where.** A horizontal card puts it in its size line, where Reload and
     Upgrade sit. A vertical card (`cubeThick`) puts it beside its title: its
     banner holds the preview when there is one, and its size line is hidden
     then. It never shrinks; the name truncates, so no style overflows.
   - **Embeds.** An embed has no card chrome, so the same button sits over
     the top-left corner of the embed (`affine-attachment-embed-download`,
     above the PDF frame's event mask, clear of the html view's own controls
     top right, of a video's controls at its bottom). Beside an audio player
     instead (`inline-download`), whose controls span its whole width. An
     image embed is an image block, out of this ADR's scope.
   - **The canvas.** The button stops `pointerdown`, `mousedown`, `click`,
     `dblclick` and `keydown` at itself, the way the html view's controls do:
     the host's dispatcher never sees the press, so the read-only pan tool
     does not pan, the selection does not move, the peek view's double click
     does not open. The canvas viewer mounts the same block (ADR 0051), so it
     draws the same button.
3. **The toolbar stays hidden on read-only.** Nothing changes in the
   toolbar service.
4. **Nothing writes.** A download reads the blob url; the store sees no
   update, and stays read-only.
5. **Telemetry.** The toolbar's Download emits nothing of its own, so the
   button emits nothing either.

An editable document draws exactly what it drew before: the button is not
rendered at all.

## Alternatives rejected

- **A read-only toolbar with only read-safe actions** (Download, Copy link).
  It changes the toolbar contract for every block (`activated` is shared),
  each block's actions would have to be sorted into read-safe and not, and the
  canvas viewer does not mount the toolbar widget at all (ADR 0051): its
  readers would still have nothing.
- **A click on the card downloads.** A surprising gesture: a click selects
  everywhere else in the editor, a download is a side effect the reader did
  not ask for, and it would differ between read-only and editable documents
  for the same click.
- **The host's peek view alone** (upstream's fix only). Nothing for a host
  without a peek provider, which is a supported configuration
  (`docs/integrate/04-host-seams.md`): the library must not need a seam for a
  reader to get a file it already holds.

## Consequences

- A host's read-only pages show a « Download » control on every attachment
  card and embed. Its catalogue gains one key,
  `com.labre.attachment.button.download` (« Download {{name}} », `{{name}}`
  the file's full name, not a count).
- A host with a peek view now receives `peek` for any attachment double
  clicked on a read-only document, not only a PDF. Its peek view must offer
  the download for a file it cannot preview, as upstream's does. The
  attachment's `type` is written by the document, so an anonymous reader can
  now hand the host a file declared `text/html` or `image/svg+xml`: the host
  previews only through the block's own `blobUrl`, which the library types
  neutral (`blob-type.ts`), never through a blob or URL carrying the declared
  type, which would run in the host's origin.
- The class `affine-attachment-download` and the test id
  `attachment-download` are new; a host styling the card can target them.
- Not done: a keyboard path to the peek view on read-only (it opens on a
  double click or a shift click, as before).

## Tests

- `blocks/attachment/src/__tests__/readonly-download.unit.spec.ts`: the peek
  condition (read-only any type, editable PDF only, nothing without a
  provider); the button on read-only in both card styles, named after the
  file; none on an editable document nor for a citation; a click clicks an
  anchor with the blob url and the file's name, emits no Yjs update and
  leaves the store read-only; its events stop at the button; the embed
  placements (pdf, video over the corner, audio beside) and none on an
  editable embed.
- `integration-test/src/__tests__/page/attachment-readonly-download.spec.ts`
  (Chromium, real mouse and keyboard): page and canvas, no button while
  editable; on read-only the real mouse presses it (on the canvas under the
  pan tool, the viewport unmoved), the keyboard focuses it and Enter and
  Space press it, and no Yjs update is emitted.
