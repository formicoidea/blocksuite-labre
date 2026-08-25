---
'@labre/affine-block-surface': patch
'@labre/affine-gfx-wardley': patch
'@labre/affine-shared': patch
---

fix(edgeless): an inertia bar is judged on the divider it straddles, and Map quality is the checklist

Second pass of the PO recette of 02/08/2026, on two points of substance.

## W2 changes meaning — read this before updating a catalogue

The rule was built on a misreading, and the PO settled it with two captures and
one sentence:

> "The horizontal position of an inertia bar is only valid if it is astride two
> evolution phases, that is, superimposed on a dashed vertical axis."

- **Old rule** — the bar had to sit ON A DEPENDENCY _and_ at a phase transition,
  and the finding named the carrier half first ("This inertia bar is not drawn on
  a dependency."). A bar alone on a divider was flagged.
- **New rule** — the bar has to STRADDLE a phase transition, and nothing else. A
  bar alone on a divider is valid (the PO's second capture); a bar between two
  dividers is not (the third), with or without a dependency under it.

What that means in practice:

- The carrier condition is gone, with the second message that existed only to
  tell the two halves apart. Both
  `com.labre.wardley.validation.inertia-off-carrier` and
  `com.labre.wardley.validation.inertia-off-equilibrium-zone` (and their
  suggestion keys) are retired; the rule now speaks one sentence, under
  `com.labre.wardley.validation.inertia-off-transition` — "This inertia bar sits
  inside a phase, not astride a phase transition." A host shipping a catalogue
  replaces the two keys with this one. `Violation.boundaryId` still names the
  frontier the bar missed.
- **"Astride", as geometry:** the bar's own EXTENT along the evolution axis must
  intersect the transition BAND — the divider widened by the frame's declared
  `transitionBandWidth`. One interval overlap, saying both halves of
  "superimposed on the axis": a bar wide enough to cover the divider is accepted
  whatever the band says, and a bar too thin to cover anything (the toolbox draws
  it eight units wide) is accepted inside the band the map itself declares. It is
  measured on the ink, never on the centre, and the band stays a ratio of the
  plot so a resized map gets the same verdict.
- `AttachmentDef.carrierRole` and `tolerance` are now OPTIONAL: the family still
  supports "posed on a carrier" for a rule that wants it, W2 simply no longer
  declares one. `AttachmentDef.offBoundary` is only read by a rule that declares
  both.
- The Kodak template is unaffected: its bar is computed at the crossing of the
  `capture → storage` dependency with the Commodity divider, so it is centred on
  that divider and stays green.

## Map quality is the checklist, and only the checklist

The panel carried three different kinds of statement — the nudges, a "Run
check-up" button with its remarks and the families it walked, and a count of the
real-time warnings on the map. All three were true, and reading them together
was work. The PO's decision is to keep the one the panel is for:

- the **check-up section** and the **real-time warning count** are gone from the
  panel and from the contextual toolbar's entry;
- Wardley no longer declares **Q5** (`wardley.tone-off-convention`) or **Q6**
  (`wardley.phase-nomenclature`); `WARDLEY_CHECKUP_RULES` is gone and
  `gfx/wardley`'s `quality.ts` is now `nudges.ts`, exporting `WARDLEY_NUDGES`;
- `ValidationManager.hasMapQuality()` now answers on the checklist alone, so a
  framework declaring only on-demand rules is not offered an empty panel;
- the `MapQualityCheckupRun` telemetry event is removed, having lost its only
  emitter.

**Nothing was removed from the engine.** The on-demand moment (PF5.14) —
`moment: 'on-demand'`, `runCheckup`, `checkupRulesFor`, `evaluateCheckup` — and
the `tone-convention` and `majority-fact` families are still there and still
tested, including the zero-cost guarantee at the bench. The next framework that
wants a check-up declares one; Wardley stopped exposing one.
