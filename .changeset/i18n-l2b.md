---
'@labre/affine': minor
'@labre/affine-block-frame': minor
'@labre/affine-block-surface-ref': minor
'@labre/affine-gfx-cynefin-estuarine': minor
'@labre/affine-gfx-ddd-aggregate': minor
'@labre/affine-gfx-ddd-context-map': minor
'@labre/affine-gfx-ddd-core-domain': minor
'@labre/affine-gfx-ddd-event-storming': minor
'@labre/affine-gfx-ddd-shared': minor
'@labre/affine-gfx-group': minor
'@labre/affine-gfx-mindmap': minor
'@labre/affine-gfx-template': minor
---

feat(blocks): every seed the DDD frameworks, the generic diagrams and the gfx-primitive packages write into a document at creation now resolves through the translation seam (`translateKey`, ADR 0016), so a document created in a translated host starts in that language instead of English — a document created before these keys existed keeps its plain text.

Event Storming's eight sticky captions and its hotspot; Core Domain's five sub-domain dots and three Team Topologies markers (both palettes derived from tables shared in `ddd-shared`, exported once as `dddSharedTranslationEntries` and spread into each consuming framework rather than restated); Context Map's bounded-context bubble and its cloud's "System" name; Cynefin/Estuarine's two hand-composed compositions ("Decision sorting"'s four domain stickies, "Constraint map"'s three hexagon captions); the standalone "Aggregate Design Canvas" template's header and nine section titles; the five generic ("Other") templates — SWOT's four quadrant labels, Kanban's card/column words, the Business Model Canvas's title and nine section names, Fishbone's category/effect/item words, Gantt's phase names and its `{{n}}`-parameterised week header; a frame's and a group's default title (`Frame {{n}}` / `Group {{n}}`); the "/ Mind Map" slash command's and the drag-from-basket mindmap tool's root and child captions; the four starter mindmap templates' root and three topic captions; and an imported `.mm`/`.opml` file's untitled-node fallback.

Every hand-composed template touched (the mindmap starters, the two Cynefin/Estuarine compositions, the Aggregate Design Canvas, the five generic diagrams) gained a `localize` rebuild mirroring the derived-template mechanism already in place: without a host catalogue every one of them still inserts byte-identical English content. Non-framework packages that write seeds now have their own small `translations.ts`, listed under a new `PACKAGE_SEED_WORDINGS` table in the manifest (source `seed`, alongside the existing chrome-sourced `PACKAGE_WORDINGS`) — the same minimal extension the seed-source manifest already needed for a framework's own seeds.

Left untouched, and why: the DDD Context Map's nine relationship patterns write no seed at all since WS2 (the palette arms the connector tool rather than dropping a labelled group — nothing to translate); the mindmap model's own "New node" default (a red zone — `packages/affine/model`) and the two callers that rely on it sit in packages outside this lot's scope; the code and shared-adapter "Plain Text"/"Untitled" fallbacks run in the paste/import pipeline's `Transformer`, whose optional `provider` is never wired to the editor's `TranslationProvider` by any existing caller.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
