# ADR 0047 — The html block may run in a page its host serves

- Status: **proposed** (2026-11-03, awaiting the product owner's review)
- Deciders: Mathieu Jolly
- Related ADRs: [0028](0028-iframe-sandbox-policy.md) (every iframe is
  sandboxed; the CSP is the host's business)

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
   `'*'` because an opaque origin cannot be named. A script of the block that
   navigates its frame away only ever receives its own html.
4. **`sandbox="allow-scripts"` stays on the frame.** The attribute is not the only
   lock: the host's page must also carry `sandbox allow-scripts` in its response
   header, because that url can be opened without the attribute.
5. **Nothing persisted changes.** `html` is read as before; a stored block opens
   in either mode.

## Consequences

- An edit of the html reloads the frame: the page wrote its document once.
- The frame needs the network to load, where `srcdoc` did not. A reader who went
  offline after opening the editor sees an empty frame for a block not yet
  loaded; the stored html is untouched.
- ADR 0028, point 1 holds: both templates carry the sandbox, and
  `embed-provider-sandbox.unit.spec.ts` sweeps them.
