# ADR 0028 — Every embedded iframe is sandboxed, at one of three levels

- Status: **accepted** (2026-09-23)
- Deciders: Mathieu Jolly
- Milestone: issue #389 (branch `fix/389-embed-provider-sandbox`), after
  issue #376 which hardened the generic block alone
- Related ADRs: none. This is the first ADR on the iframe surface; until now
  the policy existed only in a consumed changeset and in two `CHANGELOG.md`
  entries.

## The question

The editor renders third-party pages inside `<iframe>`: a YouTube video, a
Figma board, a Loom recording, a Spotify player, an arbitrary url pasted by
the reader, a snippet of html stored in the document. Each of those frames
runs code we did not write, inside a document that holds the reader's work.

The library ships **no Content-Security-Policy** — a CSP is the host's
business, not the library's — so the `sandbox` attribute is the only control
there is. There is no defence in depth behind it.

Issue #376 (2026-09) sandboxed the generic `affine:embed-iframe` block and
stopped there, on the assumption that it was the whole surface. It was not:
`affine:embed-youtube`, `affine:embed-figma` and `affine:embed-loom` predate
it, build their `src` themselves, and hard-code their attributes in their own
Lit template. They shipped with no `sandbox` at all for a year. That is issue
#389.

The reason the omission was possible is structural: `TRUSTED_SANDBOX` and
`UNTRUSTED_SANDBOX` lived in `embed-iframe-block/consts.ts` and were not
re-exported, so the policy was not reachable from the sibling blocks of the
very same package.

## Decision

1. **Every `<iframe>` rendered by `@labre/affine-block-embed` carries a
   non-empty `sandbox`.** No exception, no "this one is a known good
   provider". A new embed block is not done until its frame has one.

2. **The policy lives in one module of the package**,
   `packages/affine/blocks/embed/src/common/iframe-sandbox.ts`, re-exported
   from the package `index.ts`. It is not owned by any one block. There are
   exactly three levels, and adding a fourth is an amendment to this ADR:

   | constant                  | value                                                            | granted to                                                                               |
   | ------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
   | `TRUSTED_SANDBOX`         | `allow-same-origin allow-scripts allow-forms allow-presentation` | an embed matched to a named `EmbedIframeConfig` provider (spotify, miro, google-docs, …) |
   | `UNTRUSTED_SANDBOX`       | `allow-scripts`                                                  | an arbitrary url: the `generic` provider, or no provider at all                          |
   | `PROVIDER_PLAYER_SANDBOX` | `allow-same-origin allow-scripts allow-presentation`             | the dedicated youtube / figma / loom players, whose origin is hard-coded                 |

3. **`allow-same-origin` is granted only where the origin is fixed.** For the
   three dedicated players the `src` is built on a literal
   (`https://www.youtube.com/embed/…`, `https://www.figma.com/embed?…`,
   `https://www.loom.com/embed/…`), so the frame is always cross-origin to the
   host: it keeps its own origin and cannot reach the host document. For an
   arbitrary url we cannot say that, so `UNTRUSTED_SANDBOX` withholds it and
   the frame runs on an opaque origin.

   It is also not optional for a player: measured in Chromium with network,
   a YouTube frame without `allow-same-origin` fails with
   `Cache storage is disabled because the context is sandboxed` and paints a
   black rectangle. A sandbox that breaks the feature is a sandbox that gets
   removed, so the level that works is the level we ship.

4. **`PROVIDER_PLAYER_SANDBOX` is `TRUSTED_SANDBOX` minus `allow-forms`.**
   None of the three players has a form to submit, so the capability is not
   granted. It is the value the upstream AFFiNE editor ships for these same
   three blocks.

5. **A provider may widen its own sandbox, through one seam only**:
   `sandbox?: string` on `EmbedIframeConfig`
   (`packages/affine/shared/src/services/embed-iframe/embed-iframe-config.ts`).
   It applies to the generic block. The three dedicated players have no such
   seam and are not given one: they are not configuration, they are three
   named platforms.

6. **Labre's two divergences from upstream on this surface are kept**, and
   must not be "realigned" by a later cherry-pick:

   - an embed whose matched config name is unknown falls back to
     `UNTRUSTED_SANDBOX`, where upstream falls back to the trusted one;
   - `isSafeEmbedUrl` refuses a non-`http(s)` url before it ever reaches
     `src`; upstream has no such guard.

7. **Out of scope, deliberately**: the attachment block's PDF preview
   (`packages/affine/blocks/attachment/src/embed.ts`) renders a local blob
   url, and the adapter panel (`fragments/adapter-panel`) is a developer tool
   whose frame already runs without `allow-scripts`. Neither shows
   third-party content.

## Consequences

- The three players are now sandboxed. The value was verified in a browser
  with network for YouTube; Figma and Loom inherit the value upstream has
  shipped for them for years, and the release recipe opens all three.
- Nothing persisted changes. `videoId` and `url` are untouched; a document
  written before this ADR opens and paints identically.
- The guard that enforces point 1 is a test, not a review habit:
  `src/__tests__/embed-provider-sandbox.unit.spec.ts` sweeps every Lit
  template of the package and fails, naming `file:line`, on any `<iframe>`
  without a sandbox. It is red on the code that shipped #389.
- Remaining gap, acknowledged: the `allow` attribute lists of the three
  players still grant `accelerometer` and `gyroscope`, which upstream has
  dropped, and Figma uses the legacy `allowfullscreen` attribute rather than
  `allow="fullscreen"`. Tightening them is a behaviour change on the frame's
  feature policy, not a sandbox one, and is a separate arbitration.
- Remaining gap, host-side: there is still no CSP anywhere. The `sandbox` is
  the single control. A `frame-src` allow-list belongs to labreapp.
