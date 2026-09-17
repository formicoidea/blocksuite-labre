# ADR 0027 — A colour picker is a carousel of the active palettes

- Status: **accepted** (2026-09-17)
- Deciders: Mathieu Jolly (arbitration 2026-09-16)
- Milestone: chantier « palettes des frameworks dans les sélecteurs de couleur »
- Related ADRs: [0009](0009-reversed-flag-contract.md) (flags gate tooling,
  never content — the rule this one applies to hues),
  [0023](0023-every-displayed-string-through-a-key.md) (the page names cross
  the translation seam), [0026](0026-legend-is-a-catalogue-subscription.md)
  (the same shape: a framework declares, the platform derives).

## Context

Each framework ships its own hues (`consts.ts`, DESIGN.md "Notation
palettes"), and until now only the framework's OWN node toolbar offered them:
`paletteColorAction` seeded `edgeless-shape-color-picker` with
`WARDLEY_PALETTE_LIST` or `EDGY_PALETTE_LIST`, and every other picker on the
canvas showed the editor's palette and nothing else.

So an author drawing a Wardley map could tint a component with a Wardley blue
but not the connector between two components, not the free-text label beside
them, not the frame drawn round the whole map, not a native shape used as an
annotation. The notation was available to the artefacts of the framework and to
nothing else on the same sheet — which is precisely where the eye compares
them. The workaround was the custom-colour tab and a hex typed from memory,
which is how a map ends up with four blues that are nearly the Wardley blue.

Four options were put to the PO:

- **S1 — extend the framework palette to its relations only.** The connector
  between two Wardley components would get the Wardley list; everything else
  keeps the editor palette. Cheapest, and it fixes the most frequent
  complaint.
- **S2 — propagate the board's palette.** Any element inside a framework board
  gets that framework's palette INSTEAD of the editor's, for every picker.
  One palette at a time, chosen by where you are.
- **S3 — a carousel.** Every picker offers every active palette, paged with
  `‹ Label ›`, the editor's always among them.
- **Hybrid 2 + 3.** The carousel of S3, opened by default on the palette S2
  would have chosen.

The PO chose the **hybrid (2 + 3)** on 2026-09-16: the origin rule decides
where the picker OPENS, the carousel decides what it OFFERS.

## Decision

1. **Every contextual colour picker offers a carousel.** One page per palette,
   the page's name above the swatch grid, wrapping in both directions.
   `frameworkPaletteGroups(std, models, basePalettes)` builds it and
   `renderPaletteCarousel` draws it
   (`packages/affine/components/src/color-picker/`).

   **Amended 2026-09-17** (PO feedback after recette): the name is a
   drop-down, not a label between two arrows. The first cut drew
   `‹ Label ›` and paged one step per click; with nine pages, reaching one
   cost up to four clicks. The header is now a native `<select>` styled as
   the label — every page in one list, one gesture to any of them — and the
   arrows are gone. A wheel over the header still pages one step at a time,
   wrapping, so the carousel gesture survives for the common "what's next"
   move. Native because the header lives inside an open popper menu: a
   `<select>` renders its list at the OS level, so there is no second
   popover to position, dismiss or trap focus in, and the keyboard and the
   accessibility tree come for free. The ceiling, marked `ponytail:` in the
   source, is that the option rows are the OS's own — no swatch preview
   beside a page name; the upgrade path is the repo's own menu component.

2. **The base palette is page one and is never hidden**, whatever the origin
   and whatever the flags — DESIGN.md, "The Coexisting Palettes Rule". A
   framework page is never trimmed either: a page IS the framework's own
   `*_PALETTE_LIST`, neutral tail included, the very list its node toolbar is
   already seeded with. Nothing is restated.
3. **A framework registers its palette from its FLAG-GATED view extension**,
   with `FrameworkPaletteExtension`, beside its senior tool and its templates
   category. Offering hues is TOOLING (ADR 0009): a framework switched off
   contributes no page, and every colour it ever wrote stays exactly where it
   is, painted by the always-on render extension. See
   [R36](../add-a-framework/02-framework-rules.md).
4. **The origin of an element is read off the document, in three tiers**
   (`frameworkOfElement`):

   1. **its own role's namespace** — a role id is `<framework>:<role>`, so a
      Wardley component answers `wardley`, and so does a Wardley map, boards
      carrying roles like everything else;
   2. **for a connector, its two ends** — a link is drawn between artefacts
      and belongs to what it links; a plain connector stamps no role of its
      own. Both ends must agree, else the link crosses two notations and tier
      three decides;
   3. **the smallest framework board whose bound contains it** — a native
      shape dropped on a Wardley map is being used as part of that map.
      Smallest, so a boundary nested inside a board wins over the sheet under
      it: the nearer frame is the one the author is working in.

   A selection answers the framework they all share, and `undefined` as soon
   as two of them disagree. `undefined` opens on the base palette, which is
   true of every element in the selection.

5. **Paging is view state and nothing else.** It stops the click, the change
   and the keydown, so the menu stays open, the canvas selection is untouched
   and an arrow key inside the drop-down moves the page rather than the
   element; a wheel over the header is swallowed too, so neither the canvas
   zooms nor the page scrolls — except `ctrl`+wheel, which stays the board's
   pinch-zoom gesture. A trackpad's inertia burst moves one page, not nine.
   The page is forgotten as soon as the
   picker is asked to open on a different framework, so a new selection always
   re-opens on ITS origin. "Custom colour" is measured against the UNION of
   the pages, so paging to `Default` never makes a Wardley blue look
   hand-typed.
6. **A single page is no carousel.** With no framework active the header is
   not drawn and the caller's own `palettes` prop drives the panel — the
   panel exactly as it was before this existed. That is also how a Wardley
   node keeps its notation swatches when the Wardley flag is off: its node
   toolbar is always-on, its palette is not.
7. **Nothing new is written to a document.** A picked swatch is still a plain
   stored colour value; `packages/affine/model` is untouched and no migration
   is owed.

## Test coverage

- `framework-palette.unit.spec.ts` (`affine/components`) — the three tiers,
  nested boards, an overlapping board that does not claim, a connector whose
  ends disagree, mixed and empty selections; then the builder: base first,
  `FRAMEWORK_IDS` order whatever the registration order, the opening page, and
  a framework with no registration contributing nothing.
- `palette-carousel.unit.spec.ts` (`affine/components`) — on the real
  component: opens on the asked-for page, an unknown key falls back to page
  one, the drop-down lists every page and jumps straight to one, a wheel pages
  with wrap-around both ways, a trackpad burst moves one page, a `ctrl`+wheel
  is left alone, a single page draws no header and lets the caller's list win,
  a new selection forgets the page paged to, and "custom" against the union.
- `framework-palettes-gating.unit.spec.ts` (`affine/all`) — the flag contract,
  per editor: every framework with a palette registers one with the flags on,
  none with them off, and a second editor mounted with other flags answers
  about itself (#244).
- `manifest.unit.spec.ts` (`affine/all`) — the two new chrome keys are in
  the manifest and the page labels reuse the frameworks' existing
  `com.labre.framework.*` keys, so nothing was minted for a page name.

## Consequences

- **Wired into every contextual picker that serves a selection**: shape
  (fill / stroke), shape text, connector stroke, connector label, canvas text,
  edgeless text, brush, highlighter, frame background, and the Wardley and
  EDGY node pickers. The quick-tool creation menus (pen, shape, connector,
  text) are out: there is no selection, so there is no origin to read, and
  guessing from the viewport would be a different rule.
- **The note background panel is out**, deliberately. `edgeless-color-panel`
  there is a single fixed row sized to the note palette
  (`.columns=${NoteBackgroundColorPalettes.length + 1}`), and a note's
  background is a surface tint rather than a notation hue. Revisit only if the
  panel stops being one row.
- **`frameworkOfRole` moved into `@labre/std`** beside `FRAMEWORK_IDS`: the
  materiality publisher, the pivot commands and the tag commands had each
  copied it, and the carousel would have been the fourth.
- **The origin rule costs one pass over the surface elements** per picker
  render, filtered to `FrameworkBackgroundElementModel`. Boards are a handful
  per document; if a document ever holds hundreds, this is the line to index.
- **A framework without hues of its own registers nothing** and simply has no
  page. UML is drawn in `NOTATION_NEUTRALS` alone, and the base palette — page
  one, never hidden — already says everything a UML diagram is drawn in.

## What was rejected, and why

- **S1 (relations only)** would have answered the loudest complaint and left
  the label, the frame and the annotation shape exactly as they were — the
  same bug, one artefact narrower. A rule that has to be extended artefact by
  artefact is not a rule.
- **S2 alone (replace the palette by the board's)** breaks the Coexisting
  Palettes Rule: an author who wants the editor's medium blue on a Wardley map
  would have no way back to it, and the base palette is the one palette every
  element on the canvas has a right to. Its good half — "where you are decides
  what you see first" — survives as the origin rule.
- **S3 alone (carousel always opening on page one)** makes the common case
  cost two clicks forever: on a Wardley map, the Wardley page is what the
  author wants nine times out of ten.
- **Registering palettes from the always-on render extension** would have kept
  the pages when the flag is off, which reads as a framework that is switched
  off still offering to draw in its colours — the exact confusion ADR 0009
  exists to prevent.
- **A `<palette-carousel>` custom element** would have bought a tag name and
  an entry in `effects()`; the two pickers that draw the header already own
  their `render()`, so it is a render helper and a stylesheet.
- **Persisting the page the user last paged to** (per document, per
  framework): more state to store and to migrate, for a preference the origin
  rule already guesses correctly.
