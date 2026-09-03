---
'@labre/affine-shared': minor
'@labre/std': minor
'@labre/affine-all': patch
'@labre/affine-gfx-wardley': patch
'@labre/affine-gfx-bpmn': patch
'@labre/affine-gfx-c4': patch
'@labre/affine-gfx-edgy': patch
'@labre/affine-gfx-cynefin-estuarine': patch
'@labre/affine-gfx-ddd-event-storming': patch
'@labre/affine-gfx-ddd-core-domain': patch
'@labre/affine-gfx-ddd-context-map': patch
---

feat(telemetry): the block lifecycle reports canvas flavours only, and a framework's board command says so

Two decisions the product owner took on 2026-09-03, ahead of launch, on what
the telemetry bus should carry.

**Canvas only.** `BlockEdited` / `BlockDeleted` / `BlockAbandoned` /
`BlockUsageDuration` used to fire for every flavour. Per-paragraph editing
sessions were the volume driver of the whole bus — at near-zero usage they
already outnumbered every framework event combined — and they answer no
question the document cannot answer later: which documents carry prose next to
a map is a corpus query. What evaporates if not captured is behaviour on the
canvas — hesitation, abandonment, time spent on a map — so the watcher now
reports the surface, the cards placed on it and the media dropped there
(`CANVAS_FLAVOURS`), and nothing else. The trade-off is explicit: the "compare
every block with one query" promise of the lifecycle contract is given up for
prose. Reversible in one line.

**`role: 'board'`.** "How many boards are created per framework used" is the
ratio that says whether the board gesture is understood at all — and it could
not be read: Wardley names its board `background:classic`, BPMN `pool`, C4 and
EDGY `board`, Cynefin `cynefin` / `estuarine`, core-domain `background`. A
prefix convention would drift silently with the next framework. The board
command now declares `telemetry.board: true`, the central reporter forwards
it as a new `role` dimension on `FrameworkElementAdded` (absent on every other
event — no existing value changes), and a unit test pins the board elements of
all eight frameworks: a framework shipped without a board command fails the
build.
