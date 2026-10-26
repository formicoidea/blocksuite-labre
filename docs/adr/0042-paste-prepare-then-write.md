# ADR 0042 — A canvas paste prepares every block, then writes in one go

- Status: **accepted** (2026-10-26)
- Deciders: Mathieu Jolly
- **Red zone**: `packages/framework/store` (the transformer). Approved by the
  maintainer for this change. Nothing persisted changes: no schema, no prop,
  no Yjs layout; the transformer only gains a second way to write the same
  blocks.
- Related ADRs: [0031](0031-canvas-layers-hide-and-grid.md) (every pasted
  block still gets its layer, §6).

## Context

A canvas paste or duplicate (`createElementsFromClipboardDataCommand`,
`blocks/root/src/edgeless/clipboard/command.ts`) wrote its canvas elements in
one transaction, but each block through its `EdgelessClipboardConfig.createBlock`,
after an `await`: the note and the edgeless text go through
`Transformer.snapshotToBlock` (block transformers await `assets.writeToBlob`),
the image and the attachment await `blobSync.get`. A Yjs transaction cannot
span an await, so each block was its own transaction, and the
`Y.UndoManager` merges transactions only within its 500 ms capture window: a
blob fetch slower than that split one gesture across several Ctrl+Z.

One outer `store.transact` around the loop does not work: the store creates
block models only when a transaction ends, so inside it `getBlock(id)` is
undefined (`_insertBlockTree` throws), the `afterImport` middlewares have no
model, and the CRUD `addBlock` would hand one `generateIndex()` to several
blocks. Making the store create models synchronously is a far larger change
to a red zone.

## Decision

Prepare everything, then write in two synchronous transactions back to back
(one undo step, two Yjs updates for a peer).

1. **Store.** `Transformer.snapshotToBlock` is split into
   `prepareSnapshotToBlock` (async: fires `beforeImport`, flattens, converts;
   writes nothing) and `insertPrepared` (sync: adds the nodes with no yield,
   returns `flushAfterImport()` to fire `afterImport` once the models exist).
   Both halves run on the same transformer, whose middlewares keep their state
   (`replaceIdMiddleware`'s id map). `snapshotToBlock` is unchanged for
   imports, which keep the yield every 100 blocks. `std.clipboard` exposes the
   pair as `prepareBlockSnapshot`.
2. **Surface.** `EdgelessClipboardConfig` gains `prepare(snapshot, context)`
   returning `{ write(), afterWrite?() }`. The default defers to
   `createBlock`, so a host's own config compiles and pastes as before
   (types only widen; `clipboard-config-prepare.unit.spec.ts` holds the
   previous shape). Note, edgeless text, image and attachment override it:
   the slow part in `prepare`, a synchronous add in `write`.
3. **Paste.** Phase A awaits every `prepare` and writes nothing; `readonly`
   is checked again; then `captureSync()`, transaction 1 writes the canvas
   elements and calls every `write` in the pasted order (a frame's
   `childElementIds` and a group's `children` name copies written before
   them), transaction 2 runs `afterWrite`, the planned indexes, the layer and
   hide of each block (ADR 0031 §6) and the frame release.

## Consequences

- A paste of notes, texts, images and attachments is one undo step whatever
  the blob fetch time (`paste-one-transaction.spec.ts`).
- Ceiling (`ponytail:` in `command.ts`): a host config still on an async
  `createBlock` writes after both transactions, may cost its own undo step,
  and a container pasted with it misses that child; a dev warning says so.
  The writes run on the main thread in one go: a pasted note of thousands of
  blocks blocks it while written.
- New public API, additions only: `Transformer.prepareSnapshotToBlock`,
  `Transformer.insertPrepared`, `PreparedBlockSnapshot`,
  `InsertedBlockSnapshot`, `Clipboard.prepareBlockSnapshot`,
  `PreparedBlockSnapshotPaste`, `EdgelessClipboardConfig.prepare`,
  `prepareBlockSnapshotPaste`, `createPreparedBlock`,
  `PreparedClipboardBlock`.
