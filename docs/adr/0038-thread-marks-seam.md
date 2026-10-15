# ADR 0038 — A "has a thread" seam: marks and "Discuss", ids and counts only

- Status: accepted (2026-10-15)
- Deciders: Mathieu Jolly
- Not a red zone: no stored field, no schema, no write to the document, no
  CI or publishing change. A new workspace package lands in core.
- Relates to [ADR 0003](./0003-telemetry-bus-and-taxonomy.md) (the library
  emits, the host transports), [ADR 0023](./0023-every-displayed-string-through-a-key.md)
  (every string a key), [ADR 0031](./0031-canvas-layers-hide-and-grid.md)
  (what a viewer does not see) and [ADR 0034](./0034-panel-seams-and-host-panels-facade.md)
  (one seam per thing the library asks of the host, one façade for the
  host's calls).
- Host side, in the Labre app, never restated here: labre ADR-0048 « Fils et
  ancres » §10 (the requirements this seam answers) and its module
  `apps/web/src/modules/thread/`.

## Context

Labre v2 makes the discussion one object, the thread, which the host keeps
in SQL with its anchors (labre ADR-0048). A thread may anchor to a block, in
either view, or to a canvas element. The editor has to show what has a
discussion and let a reader start one from any block or element, and only
the editor knows where a block is drawn and what it says.

What the library already had did not fit:

- **AFFiNE's `CommentProvider`** writes the comment id into the block
  (`block.props.comments`, through `BlockCommentManager`), so a discussion
  would live in the document and in the host's database at once; it changes
  the content on load and ignores canvas elements entirely. Its toolbar
  button, `blockCommentToolbarButton`, sits on a dozen block toolbars and on
  no surface element or framework board.
- **No widget marks a block from the outside** except `remote-selection`,
  which draws collaborators' selections over blocks in the page view and over
  elements on the canvas. It is the model for where a mark is drawn, not a
  place to put one.

## Decision

1. **One seam, `ThreadMarksProvider`**, in `@labre/affine-shared/services`,
   registered with `ThreadMarksExtension({ marks$, openThread } | null)`
   (`di.override`, like the panel seams), read with `std.getOptional`:

   - `marks$: ReadonlySignal<readonly ThreadMark[]>`, with
     `ThreadMark = { targetType: 'block' | 'element', targetId, count, unread }`,
     for the mounted document;
   - `openThread({ docId, targetType, targetId, excerpt })`.

   The library never learns what a thread is: ids and counters in, ids and an
   excerpt out. Absent or `null`, no mark and no action.

2. **The excerpt is the library's** (`threadExcerpt(std, target)`), because
   it knows the content: a block's text, then its descendants' (a canvas note
   reads as its paragraphs); a canvas block with no text and a canvas element
   read as the selection pane names them (`selectionPaneRowLabel`: a frame or
   group title, an element's text or label sibling, its role, its kind); any
   other textless block reads as its kind. Whitespace collapsed, at most
   `THREAD_EXCERPT_MAX` = 280 code points, an ellipsis included.
3. **One widget, both views** (`affine-thread-marks-widget`, package
   `@labre/affine-widget-thread-marks`), mounted on the root like
   `remote-selection`: in the page view a mark sits in the right gutter at the
   top of the block; on the canvas it is centred on the top-right corner of
   the model's bound (or of a block inside a note). It is the existing
   `icon-button` with `CommentIcon` and the count, `active` (accent) when
   unread; nothing is drawn anew. An id the editor cannot find, a mark at
   `count <= 0`, and a target this viewer does not see (the renderers'
   `isPainted` for an element, the local hide for a canvas block) are skipped.
   Two marks on one target are one mark. A click is `openThread`.
4. **One toolbar module, "Discuss"** (`com.labre.thread.discuss`, `CommentIcon`),
   registered under `toolbarModuleKey('affine:*', 'thread')` and
   `toolbarModuleKey('affine:surface:*', 'thread')` (the bare
   `affine:surface:*` is the root's canvas module). The toolbar merges entries
   by id, so a canvas row shows it once. It shows when the seam is there and
   the row speaks for ONE target: one canvas model (a primitive is an
   `element`, a canvas block a `block`), a text selection within one block, one
   selected block. Never the page or the surface itself. A new block or
   framework inherits it by doing nothing.
5. **Nothing is written.** No prop, no id in the content, no write on load or
   on reading an excerpt. Not `CommentProvider`, not
   `blockCommentToolbarButton`; both stay as they are for hosts that use them.
6. **No flag.** The seam decides; a discussion is never gated (labre P5), and
   a mark is chrome over content, never content.
7. **No telemetry of its own.** The host's `openThread` is the event; the
   library would only restate it.

## Consequences

- The seams table gains a row; `@labre/affine/host-panels` exports
  `ThreadMarksExtension`, the types and `threadExcerpt`, held by
  `host-panels-signature.unit.spec.ts`.
- Guards: `shared/src/__tests__/services/thread-marks-null.unit.spec.ts`
  (absent and `null` answer nothing), `widgets/thread-marks/src/__tests__/thread-marks.unit.spec.ts`
  (no mark and no button without a provider, absent ids ignored, the action's
  request, the 280 cut) and `all/src/__tests__/thread-marks.unit.spec.ts`
  (registered in both scopes without a DI collision, excerpts read off a real
  document, nothing written); `integration-test/src/__tests__/page/thread-marks.spec.ts`
  (a mark beside a paragraph and on a shape's corner, none for an absent id
  or without the seam, "Discuss" from a selected block and a selected
  element).
- A block whose toolbar never shows (one with no toolbar module of its own and
  not a paragraph, list, code or image, e.g. a divider in the page view)
  offers no "Discuss" from its own selection; a text selection or its mark
  still reaches it. `ponytail:` a block-level "Discuss" in the drag handle's
  menu is the upgrade path if a reader asks for it.
- The mark's geometry is client rects recomputed once a frame at most on
  marks, document, view, canvas, scroll and resize changes. `ponytail:` a
  page of several hundred marked blocks measures each on every refresh; a
  visibility filter on the page view's viewport is the upgrade path if a
  budget test shows it.
- A host without the seam pays nothing: the widget renders nothing and
  subscribes to nothing when `ThreadMarksProvider` is absent at mount.
