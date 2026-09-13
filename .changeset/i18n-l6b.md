---
'@labre/affine-block-attachment': minor
'@labre/affine-block-bookmark': minor
'@labre/affine-block-embed': minor
'@labre/affine-block-embed-doc': minor
'@labre/affine-block-image': minor
'@labre/affine-block-surface-ref': minor
'@labre/affine-block-frame': minor
'@labre/affine-fragment-frame-panel': minor
'@labre/affine-shared': minor
---

feat(blocks): the AFFiNE chrome of media, documents, embeds and frames now resolves through the translation seam instead of raw English literals. Attachment's and image's slash-menu items, toolbars (Replace, Turn into card view, Download/Upload toasts with the file name or a formatted size) and error messages; bookmark's, embed-doc's and embed's slash-menu items, card-style switchers, "Open doc"/"Open this doc" toolbars, iframe error/idle/invalid-URL/link-popup cards and the HTML embed's empty state; surface-ref's slash-menu items (mind map, frame, group, including the live "Frame: {{title}}"/"Group: {{title}}" list entries, previously built by string concatenation) and its per-kind placeholder cards (deleted / cannot-display, one full sentence per reference kind); frame's dense-menu, surface toolbar, presentation mode (previous/next, fullscreen, frame order, reached-first/last) and the frame panel's header and settings menu — all now carry keys, resolved via `translateKey`/`labelWording`/`tooltipWording`/`nameWording`/`descriptionWording`/`captionWording`. Words shared across two or more of these packages (Caption, Download, Reload, Rename, Frame, Settings, Loading…, Untitled, the four card-style labels…) moved to `@labre/affine-shared/services`'s `chrome.ts` as single shared keys rather than being restated per package. Every non-framework package touched gained its own `./translations` export subpath, imported by `packages/affine/all/src/translations.ts`. With no catalogue registered every surface reads exactly as it did before — no visible change for a host that has not wired a `TranslationService`.

Left untouched, and why: the surface-ref preview-tooltip illustrations (`configs/tooltips.ts`) keep their English figures per an earlier PO decision; displayed domains/URLs are unchanged per PO decision; the three linked-doc export adapters' (`embed-doc/src/embed-linked-doc-block/adapters/{html,markdown,plain-text}.ts`) own "untitled" fallback stays a plain literal — per the L2b lot's precedent, the paste/import pipeline's `Transformer` carries an optional `provider` never wired to the editor's `TranslationProvider` by any existing caller, so resolving a key there would be dead code rather than a real translation path; the `embed-youtube-block`, `embed-loom-block`, `embed-figma-block` and `embed-github-block` directories are out of scope (postponed embeds).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
