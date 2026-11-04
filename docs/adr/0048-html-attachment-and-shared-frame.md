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
4. **The handshake is ADR 0047's, unchanged.** A `Blob` is read as text and posted.
   It never becomes a url: a `blob:` url has the origin of the app, the origin of
   the reader's tokens. A `frameUrl` that is not http(s) is ignored.
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
8. **A thumbnail is a real preview, scaled down.** It is laid out at 1280 px, scaled
   in CSS to its box, `inert` and without scrolling, and its frame is created only
   once it has been in view. No capture is stored and no server renders it.
9. **Interacting is a state of the view, never stored.** A preview lets the pointer
   through (`inert`), so a page scrolls over it and a canvas drags it. "Interact"
   lets the pointer in, and a press outside ends it, since a press inside never
   reaches the parent. Full screen takes the view with its exit button and is
   interactive. The buttons sit on the preview, not in the toolbar, because a
   read-only reader needs them and an unselected block has no toolbar.

## Consequences

- Nothing persisted changes. The embed view writes `style: 'html'`, already a key of
  `EMBED_CARD_WIDTH`, as the video view writes `style: 'video'`; both are outside
  `AttachmentBlockStyles`, which only types the prop.
- `EmbedHtmlBlockComponent.iframe` is gone: the frame is in the component's shadow
  root and the library read it nowhere else.
- The text is decoded as UTF-8. `ponytail:` a file in another encoding shows wrong
  accents, whatever its `<meta charset>` says; reading the meta before decoding is
  the upgrade, when a real file needs it.
- A thumbnail runs the file's scripts, as the preview does. Many thumbnails on one
  screen are many documents; the ceiling is what is in view, since an unseen one has
  no frame and a seen one stays mounted until the block goes.
- The ticket's second enlargement, the full page of the editor without the browser
  full screen, is the host's: the library does not know the size of its shell.

## What this deliberately does not do

No capture in the document or in the blob store, no server rendering, no new block,
no flag (an html file is content, and ADR 0009 forbids gating content), no reading
of the workspace's data from the frame.
