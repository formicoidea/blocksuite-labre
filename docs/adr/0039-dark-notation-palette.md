# ADR 0039 — The notations' dark variant is resolved at render time

- Status: **accepted** (2026-10-16)
- Deciders: Mathieu Jolly (default applied in P7, « decisions-a-valider » n°2)
- Milestone: Labre v2, phase P7 (dark mode, ticket « Lib B16 »)
- **Not a red zone**: no stored value, schema or model changes. Every
  document reads and writes exactly what it did before.
- Related ADRs: [0009](0009-reversed-flag-contract.md) (a flag never gates
  content), [0027](0027-framework-palettes-carousel.md) (framework palettes),
  [0031](0031-canvas-layers-hide-and-grid.md) (nothing is written on load).

## Context

Before this ADR, a dark editor drew every framework board as a white card on
the dark canvas (DESIGN.md, Deferred), and every notation ink, a near-black
by construction, vanished wherever it was drawn straight on the canvas. The
host (Labre, ADR-0049 § 7) now ships a dark shell, so the canvas has to follow.

Three constraints fix the shape of the answer:

- the colours of a notation element are **stored values** (`'#438dd5'`,
  `'#1f2328'`), not keys: the persisted format is forever, and rewriting a
  stored colour on opening a page would write into every document and every
  undo stack (The Untouched Data Rule);
- the hues of a standard (EDGY's facets, the C4 ladder, BPMN's events) are the
  standard's and never follow a theme (The Standard-Fidelity Rule);
- a colour chosen by hand stays the colour chosen.

## Decision

**The paper inverts, the hues stay.** On a dark canvas the renderer resolves
the colour of a NOTATION element through a dark table at paint time; the
stored value is never touched.

1. The shared neutrals map key for key onto `NOTATION_NEUTRALS_DARK`
   (`packages/affine/shared/src/consts/notation.ts`). Each dark neutral reads
   on the dark card at least as well as its light twin on white (capped at
   7:1); the words of the scale are AA.
2. A framework adds the few values of its own that would vanish (a stencil
   ink, a near-black label, a pale wash) with
   `NotationDarkPaletteExtension({ framework, colors, kept? })`, registered
   from its ALWAYS-ON render view extension: painting a stored page is content
   (ADR 0009). It is a library registry, not a host seam. `kept` lists, in
   writing, the framework swatches that read below 3:1 on the dark card and
   stay anyway because they are the standard's (the C4 person blues, EDGY's
   Architecture blue).
3. Everything else is painted as stored: every hue, every `{ light, dark }`
   pair of the base palette (it already knows its dark side), every fallback
   and every colour a user typed that is not in a table.
4. White has two jobs. As a SURFACE (a board card, a node body: `use: 'fill'`)
   it is the paper and inverts; as an INK (white words on a C4 person, EDGY's
   pictograms) it stays.
5. **Ink follows its paper.** Words drawn on a fill that is painted as stored
   (and opaque enough to be what they sit on) keep their stored colour: black
   on a C4 component stays black, while the same black on the bare card turns
   light (`CanvasRenderer.getInkColorValue`, `NotationTint.keepsInkOn`).
6. An element is a notation when it has a `role`, is a framework board, is a
   connector with a role at either end, or sits inside a framework board. A
   neutral element anywhere else is painted as stored, dark canvas or not.
7. **The SVG export is always light** (`CanvasRenderer.withColorScheme`): a
   file is printed on white, read back by its colours by the SVG importer
   (rule R33), and a `{ light, dark }` pair painted on its dark side would turn
   a black stroke white on a white page. This matches the draw.io export,
   which already takes the light side. The PNG export is a picture of the
   screen and keeps the scheme in force.
8. EDGY keeps its standard colours, including the facets' white centre,
   separators and pictograms; only its near-black stencil ink (`#262626`),
   a neutral, turns light.

The Standard-Fidelity Rule is amended accordingly: a standard's HUES never
follow the theme; its neutrals (the paper and the inks drawn on it) do,
through this table.

## Consequences

- Nothing is stored, migrated or written on load. A 0.53 client opening a page
  saved by a dark 0.54 client sees exactly the same colours.
- `notation-dark-palettes.unit.spec.ts` (`packages/affine/all`) mounts the real
  view extensions with every flag off and checks: one palette per framework,
  no light value mapped twice, every dark framework swatch mapped or kept,
  EDGY's hues untouched, the contrast of each dark value, the host's dark
  accent (`#2a5bc8`) at 3:1 on the card and on every darker wash, and every
  board painted dark keeping the contrast it had on white.
  `canvas-renderer-dark-notation.unit.spec.ts` (`blocks/surface`) checks that
  only notation elements are tinted, never a pair, and that the SVG override
  is light.
- The chrome follows the theme through tokens; `chrome-colours.unit.spec.ts`
  ratchets the raw colour literals left outside the notations.
- Limits, written down: the experimental DOM renderer (`enable_dom_renderer`)
  does not go through the table and still paints the light values; an
  element inserted by a template that stamps no role and lands outside a board
  (the generic "Other" templates, the DDD aggregate canvas) is a neutral
  element and is painted as stored. The trigger to revisit either is a user
  report on a dark canvas.
- The C4 blues sit close to the host's selection accent: `#2a5bc8` against the
  C4 system blue `#1168bd` is 1.09:1 (about 10° of hue apart), the same
  closeness as the light accent `#2563eb`. The library does not own the
  accent; a host that wants a sharper selection on C4 boards lightens its dark
  accent.
