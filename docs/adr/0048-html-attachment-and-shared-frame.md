# ADR 0048 — An html file is an attachment, previewed by one shared frame

- Status: **proposed** (2026-11-04, awaiting the product owner's review)
- Deciders: Mathieu Jolly
- Related ADRs: [0028](0028-iframe-sandbox-policy.md) (every iframe is sandboxed;
  the attachment's pdf frame and its `blob:` url, amendment of 2026-11-04),
  [0047](0047-html-block-frame-served-by-the-host.md) (the page a host names, the
  handshake)

## The question

A reader wants to import an html file, preview it and see a thumbnail of it, as
for an image, in a page and on the canvas. html is the one kind of file a browser
runs: a preview is code from whoever wrote the file, on the screen of whoever
opens the page.

## Decision

1. **An html file is an `affine:attachment`.** The bytes go to the blob store, the
   document keeps `sourceId`. No new block and no schema change. `affine:embed-html`
   stays what it is, html stored in the document, and is not removed: stored
   documents render forever.
2. **One component runs html: `labre-html-frame`**
   (`@labre/affine/components/html-frame`). The html block, the attachment and a
   host's own views mount it. It takes the html (a string or a `Blob`), `frameUrl`,
   `thumbnail` and `interactive`. It knows no object, right or quota. It lives in
   `affine-components` because the two blocks are siblings, so the two sandbox
   levels it applies moved there, and `embed/common/iframe-sandbox.ts` re-exports
   them: that file remains the place to read the policy.
3. **One seam.** `EmbedHtmlConfigExtension({ frameUrl })` (ADR 0047) now also opens
   the attachment's preview. It moved to `@labre/affine-shared/services` so that
   both blocks reach it, and stays importable from the embed package.
4. **The handshake is ADR 0047's, with two more fields.** The answer is
   `{ html, scripts, scroll }`; a thumbnail and the html block never scroll. A `Blob` is read as text and posted. It never becomes a url:
   a `blob:` url has the origin of the app, the origin of the reader's tokens. A
   `frameUrl` that is not http(s) is ignored.
5. **Without a page from the host, an html attachment stays a card.** No `srcdoc`
   for this new case, no embed view offered and no thumbnail: the toolbar's "Embed
   view" stays disabled. Only the html block keeps its `srcdoc`, because a stored
   document must keep rendering. A document with `embed: true` opened by such a
   host, or by an older library, shows the card.
6. **The type is a declaration.** An attachment is treated as html when its type
   says so, or when no type is declared and its name ends in `.html`, `.htm` or
   `.xhtml`. Whichever way it is decided, the bytes only reach the frame. A
   collaborator who declares anything else gets the card or the viewer of that
   type, under ADR 0028's amendment.
7. **The extension point is `AttachmentEmbedConfig`**, which gains an `html` entry
   next to image, pdf, video and audio. The type widens: `check` and `render`
   receive an optional `std`, and `renderThumbnail` is optional; a host's config of
   the previous shape still compiles (`html-attachment.unit.spec.ts`). The card /
   embed switch and the download are the existing ones.
8. **A thumbnail is a real preview, scaled down, and it never runs a script.** It is
   laid out at 1280 px, scaled in CSS to its box, `inert` and without scrolling, and
   its frame is created only once it has been in view. No capture is stored and no
   server renders it.
9. **Interacting is one state per document, never stored** (`html-interaction.ts`).
   A preview lets the pointer through (`inert`), so a page scrolls over it and a canvas
   drags it. "Interact" on one embed view lets the pointer into all those of the
   document and starts their scripts; a press outside all of them ends it, since a press
   inside never reaches the parent. A view that arrives later stays closed until the next
   gesture. Full screen takes one view with its exit button and is interactive. The
   buttons sit on the preview, not in the toolbar, because a read-only reader needs them
   and an unselected block has no toolbar. In a note on a canvas the note's mask covers
   the content until the note is entered: the buttons, the height handle and the frame
   while interacting stack above it (`z-index: 2`, no stacking context between them and
   the mask), so "Interact" needs no double-click, and the preview stays under it, so a
   press there still selects and drags the note.
10. **An html file opens on its embed view**, in a page and on the canvas, once the host
    has named its page. Only at creation: a stored block keeps its view, and
    `shouldBeConverted` plays no part, it replaces a block by an image.
11. **Its size is the block's.** On the canvas the box is the block's bound, not a scale
    of it, so width and height change on their own and the page is laid out in its box;
    the ratio lock of an attachment is lifted for this view only. A view opens around its
    centre: anchored by its corner, a wide one leaves its buttons off the screen. In a page
    the height is in `xywh` too, no schema change, set by a handle that shows outside the
    interaction, from 120 to 2400 px, 44 px of target on touch. A note on a canvas is
    the same flow drawn at its scale times the zoom: the handle divides the pointer's
    move by what it measures on screen.
12. **No script of the html runs without a reader's gesture** (product owner,
    2026-11-04). The html of a file can be written without going through any screen, and
    a page in a loop freezes every reader of a browser that keeps the frame in the
    page's process. So `HtmlFrame.scripts` is off by default, a thumbnail never has it,
    and on an attachment only "Interact" or full screen turns it on (decision 9).
    - **Closed is the default, at every level.** The answer says `scripts: false` until
      the gesture. A host's frame must run scripts only on an explicit `scripts: true`,
      so that a page or a message that says nothing runs nothing. A `srcdoc` is
      `sandbox=""` until the gesture.
    - **The html block gets no button.** Its future is being decided: it mounts the same
      frame and asks for nothing, so its scripts do not run.
    - **The gesture takes a new frame.** What a document may run is fixed when it loads.
    - **A page already started keeps running when the interaction ends**, inert.
      Reloading it would throw away what the reader did in it. A reload of the document
      stops it, since the gesture is not stored, and that is also what gets a reader out
      of a page that froze once started.
    - **A closed document is answered once.** It cannot ask, but a `<meta refresh>` to
      the host's page could, and answering would reload it forever: it stays empty.

## Consequences

- Nothing persisted changes. The embed view writes `style: 'html'`, already a key of
  `EMBED_CARD_WIDTH`, as the video view writes `style: 'video'`; both are outside
  `AttachmentBlockStyles`, which only types the prop.
- `EmbedHtmlBlockComponent.iframe` is gone: the frame is in the component's shadow
  root and the library read it nowhere else.
- The text is decoded as UTF-8. `ponytail:` a file in another encoding shows wrong
  accents, whatever its `<meta charset>` says; reading the meta before decoding is
  the upgrade, when a real file needs it.
- Interacting with one view starts the scripts of every embed view of the document: a
  file that loops takes the others down with it, on a browser that keeps the frame in the
  page's process. It is the reader's gesture, and a reload closes them all.
- A page drawn by a script shows blank, in its thumbnail and in its preview, until the
  reader interacts. That is the price of decision 10.
- A stored html block that draws itself with a script stays empty: it has no gesture.
- Many thumbnails on one screen are many documents; the ceiling is what is in view,
  since an unseen one has no frame and a seen one stays mounted until the block goes.
- The ticket's second enlargement, the full page of the editor without the browser
  full screen, is the host's: the library does not know the size of its shell.

## What this deliberately does not do

No capture in the document or in the blob store, no server rendering, no new block,
no flag (an html file is content, and ADR 0009 forbids gating content), no reading
of the workspace's data from the frame.

## Amendment of 2026-11-04: the html block is retired, and a link card imports its page

Decisions of the product owner, not reopened here. What they replace above: decision 1's
last sentence, decision 2's mention of the block, decision 3's name for the seam,
decision 5's `srcdoc` exception and decision 12's paragraph on the block.

### The block

1. **`affine:embed-html` renders a card, in a page and on the canvas, and runs nothing.**
   No frame, no `srcdoc`, no read of `html`, which stays in the document untouched. The
   product owner accepts the break: the stored html of such a block is no longer shown,
   and nobody has counted them.
2. **The type stays declared.** Measured (`retired-embed-html.unit.spec.ts`): on a flavour
   it does not know, `new Block` throws `schema for flavour ... not found`, the store's
   `_onBlockAdded` catches it and logs, and the block is gone from the page with no word
   to the reader, the rest of the document staying. A card is honest; a silence is not.
3. **Nothing creates one any more on the canvas.** The clipboard config is gone: a paste
   or a duplicate reads `EdgelessClipboardConfigIdentifier` and skips a flavour without
   one. The toolbar of a page keeps Delete alone. `ponytail:` copying one of these cards
   in a page still writes another card, through the snapshot path, which has no list of
   flavours to refuse; it is inert, and refusing it means a new hook in the transformer.
4. **What is dead went with it:** `srcdocFallback`, `noScroll`, `CLOSED_SANDBOX`, the
   `srcdoc` branch of `labre-html-frame`, the fullscreen toolbar, the tooltips, the
   clipboard config. Without `frameUrl` the frame renders nothing.
5. **Deviation from AFFiNE:** upstream's `affine:embed-html` renders its html and takes
   part in the clipboard. Here it is a read-only card whose schema survives so documents
   open. A document from upstream with such a block stays readable, and its html does not
   run.

### The seam

6. **`EmbedHtmlConfigExtension` is now `HtmlFileConfigExtension`**, key `affine:html-file`:
   the name of a retired block said nothing of what it configures, and it has not been
   published, so the rename costs nothing. The wire name `labre:embed-html-ready` stays:
   changing it would change a script a host has pinned by hash, for no reader's benefit.
7. **The import goes through the same seam**, `HtmlFileConfig.importPage`, rather than a new
   row of the seams table. It takes `{ url, docId }` and answers `imported`, `cancelled`
   or `refused`.
8. **The host answers with a reference, `AssetRef`, not with a `File`.** Two reasons, read
   in the host's upload path. `BlobSource.set` is local-first, so a library that stored
   the bytes itself would write a block a refused upload then leaves broken, where the
   decision is that a refusal keeps the card. And what the host knows about the file
   (where it came from) goes on a row that only exists once the upload has landed. The
   asset picker already speaks `AssetRef`, so nothing new is asked of a block.
9. **The library knows nothing else.** No fetch, no right, no quota, no relation between a
   page and a file, nothing of the page's title or url in the document: the url is the
   card's own prop, and it goes when the card goes.

### The button

10. **It sits in the card's toolbar, for any url**, in a page and on the canvas, when the host
    provides `importPage`, the document is writable and the card is not a citation, which
    its footnote holds. It writes nothing until pressed, and a pasted url stays what it was.
11. **The gesture is one undo step.** The attachment takes the card's place (in a page its
    index, on a canvas its centre, its layer and its connectors) and its caption, in its
    embed view when `frameUrl` is set. Every attachment of the document holding `replaces`
    takes the new file in the same step. An undo gives the card and the old file back: the
    bytes are the host's to keep until then.
12. **The wait is the card's, not the button's.** The state hangs on the model, because the
    toolbar is drawn again on every selection and a second press must not start a second
    import. A card deleted, or a document turned read-only, while the host reads the page
    writes nothing.
13. **An imported page runs no script without the reader's gesture**: it opens closed, like any
    html file (decision 12).

14. **The first press on a block of an unfocused editor keeps the selection** (`std`,
    `range-binding.ts`). The focus a block selection takes puts a caret in the document's first
    text, whose `selectionchange` replaced the selection and closed the toolbar it had just opened,
    so the button took two presses. The native range is cleared right after that focus.

### Consequences

- A host that set `EmbedHtmlConfigExtension` renames one import. A host without `frameUrl`
  that relied on the block's `srcdoc` sees cards: there is no way back but the product
  owner's.
- `@labre/affine-block-bookmark` now depends on `@labre/affine-block-attachment`, for the
  default view of an html file. Nothing goes the other way.
