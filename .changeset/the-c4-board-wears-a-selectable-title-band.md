---
'@labre/affine-model': minor
'@labre/affine-gfx-c4': minor
'@labre/affine-block-surface': minor
---

feat(edgeless): the c4 board wears a selectable title band

The C4 board now has a **painted title band** across the top of the sheet: a
click anywhere in it selects the board, and a double-click anywhere in it opens
the title editor.

Since framework backgrounds stopped being picked by their area and started being
picked by their borders alone (#194 / #197), the board's title had quietly
become unreachable. A single click on it selected nothing, and the only thing
still answering a double-click was the tight box of the drawn glyphs — a target
a few characters wide, on a sheet 1400 units across.

The BPMN pool had already solved this and its solution is transposed whole:

- **The band is the top margin.** `C4_BOARD_TITLE_BAND_HEIGHT` (56 model units)
  is declared in `@labre/affine-model`, beside the board model that hit-tests
  against it, and re-exported by `@labre/affine-gfx-c4` — exactly as
  `POOL_BAND_WIDTH` is. It is the same number the title has always been written
  in; it now has a name, so what is painted, what is picked and what is renamed
  are one number rather than three.
- **It is painted**, from the declaration and not from ad-hoc drawing code: a
  quiet tint (`#f7f8fa`) under a divider in the card's own line. A strip a user
  cannot see is a strip they cannot aim at. `BackgroundSideBandDef.side` gains
  `'top'` beside `'left'` for it — the union grows when a framework asks, and one
  has.
- **It is selectable**: `C4BoardElementModel.includesPoint` carves the band out
  of the border-only test, in element-local coordinates, de-rotated about the
  centre, clamped on a board shorter than its own header.
- **It is renameable end to end**: `C4BoardView` widens its rename zone from the
  drawn words to the whole band. The C4 boundary is deliberately untouched — its
  name sits inside the plot, over the diagram, where a wide zone would swallow
  clicks meant for the elements around it.

The board's title moved from a full-plot zone's label to the band's label. That
zone existed only to carry a name because a board had no band to write one in;
it has one now, so the zone went with the label and the board declares none. The
title lands on the same pixels — the anchor is in plot ratios either way.

**No document changes.** No new field, no schema bump, no migration: the band is
rendering and hit testing. A board saved before this release opens with a header
band and a title you can rename, and nothing else about it moves.
