# ADR 0047 — The html block may run in a page its host serves

- Status: **proposed** (2026-11-03, amended 2026-11-04, awaiting the product
  owner's review). The block itself is retired by the amendment of 2026-11-04 of
  [ADR 0048](0048-html-attachment-and-shared-frame.md): no `srcdoc` is left, and
  what follows now applies to the html attachment, through `HtmlFileConfigExtension`.
- Deciders: Mathieu Jolly
- Related ADRs: [0028](0028-iframe-sandbox-policy.md) (every iframe is
  sandboxed; the CSP is the host's business; this ADR adds its fourth level)

## The question

`affine:embed-html` renders stored html in an `<iframe srcdoc>`, sandboxed with
`allow-scripts`. A `srcdoc` document inherits the Content-Security-Policy of the
page that holds it. So a host that limits its own scripts also stops the scripts
of every stored block, with no error the reader can see. `data:` and `blob:`
urls inherit it too (measured in Chromium, Firefox and WebKit). A document must
keep rendering, and the host must be able to limit its scripts.

## Decision

1. **The host may name a page through one seam**,
   `EmbedHtmlConfigExtension({ frameUrl })`. A frame loaded by `src` takes the
   policy of its own response. The library ships no page and no policy: a CSP is
   the host's business (ADR 0028).
2. **Without the extension nothing changes**: the block stays on `srcdoc`. A host
   that sets no script policy has nothing to do.
3. **The html travels by `postMessage`, on the frame's request.** The page posts
   `{ type: 'labre:embed-html-ready' }` to its parent; the block answers its own
   frame with `{ html }`, and with nothing to any other window. The target is
   `'*'` because the library does not know the page's origin. A script of the
   block that gets a window there only ever receives its own html.
4. **The host's page runs under `HOST_PAGE_SANDBOX`,
   `allow-same-origin allow-scripts`.** A frame's own navigations answer to the
   `frame-src` of the page that holds it, so a host that limits a block's network
   puts a page of its own between the editor and the frame. That page must keep
   its origin: with `allow-scripts` alone it turns opaque, and the frame's
   `frame-ancestors 'self'` refuses it (measured in Chromium, Firefox and WebKit:
   no handshake, no script). The value still withholds forms, popups and top
   navigation, and those flags reach everything below it.
5. **The host owns the isolation of the html.** `allow-same-origin` is safe only
   because that page is the host's code and writes no html: it hands it to a frame
   that carries `sandbox allow-scripts` in its response header, because a url can
   be opened without any attribute. A host that writes the html into the named
   page runs it on its own origin.
6. **Nothing persisted changes.** `html` is read as before; a stored block opens
   in either mode.

## Consequences

- An edit of the html reloads the frame: the page wrote its document once.
- The frame needs the network to load, where `srcdoc` did not. A reader who went
  offline after opening the editor sees an empty frame for a block not yet
  loaded; the stored html is untouched.
- ADR 0028, point 1 holds: both templates carry a sandbox, and
  `embed-provider-sandbox.unit.spec.ts` sweeps them. Point 3 gains the host's page:
  its origin is the host's, and it runs the host's code.
- Chromium and Firefox warn in the console about `allow-same-origin` with
  `allow-scripts` (measured; WebKit does not). The warning is about third-party
  content, which this page does not hold.
