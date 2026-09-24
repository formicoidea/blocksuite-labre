# ADR 0029 — A label is inscribed only if it fits its symbol; otherwise it gravitates

- Status: **accepted** (2026-09-24)
- Deciders: Mathieu Jolly (PO rule, 2026-09-24)
- Milestone: branch `feat/bpmn-labels-gravitating`
- Related ADRs: [0009](0009-reversed-flag-contract.md) (nothing here is
  gated: a label is content), [0012](0012-framework-interchange-and-foreign-preservation.md)
  (the BPMN round trip must keep the name), [0023](0023-every-displayed-string-through-a-key.md)
  (the new seeds cross the translation seam).
- Red zone: none. No schema, no stored field, no enum changes. A document
  drawn before this ADR opens and paints identically.

## Context

User feedback on the BPMN pack: an event's name, typed inside its 56-unit
ring, either overflowed the circle or was shrunk to an unreadable size; the
same for a 72-unit gateway diamond and the two data shapes. The task, at
120×72, held its name only on two cramped lines. BPMN itself draws an event's
and a gateway's name beside the symbol, never in it.

Wardley had already settled the question for its own circles: a component is
a native group of an 18-unit dot and a free `wardley:label` text, which is what
rule R16 generalised as "labels are free text grouped with the shape, never
text on the shape". But R16 was written as a blanket rule with ad-hoc
exceptions, and most frameworks did not follow it: a BPMN task, an EDGY
activity, a C4 container or a UML class carry their name inside, and they are
right to — the name fits and the shape is the name's box. What was missing was
the criterion that says which symbol is which.

An audit of the palettes (2026-09-24, read-only) counted 100 kinds across the
nine frameworks: 72 already consistent with the criterion below, 12 not — the
10 BPMN kinds this ADR fixes, plus Wardley `porter` and DDD Event Storming
`hotspot`.

## Decision

1. **The rule (R38, `docs/add-a-framework/02-framework-rules.md`).** A
   catalogue component is labelled one of two ways: INSCRIBED in the shape, or
   GRAVITATING around it. The only criterion is the symbol's size: if a
   normal-size text (18) of two five-letter words does not fit legibly inside
   the shape at its canonical creation size, without enlarging it, the label
   gravitates. A gravitating label is a native group of the symbol and a free
   text element (R16, amended to point here).

2. **The criterion is arithmetic, in one helper.** `fitsInscribedLabel` in
   `packages/affine/shared/src/utils/label-mode.ts` (`@labre/affine-shared/utils`)
   takes `{ w, h, shapeType }`, with `fontSize` 18 and `padding` `[10, 20]` by
   default.
   Inner box = shape minus the native text insets; ×0.7 per side for an
   ellipse, ×0.5 for a diamond, ×1 otherwise; the probe "Hello World" fits on
   one line (11 × 0.5 em by 1.2 em) or two (5 × 0.5 em by 2.4 em). The 0.5 em
   advance is Inter's average over the probe itself (≈ 5.4 em for the
   11 characters); a generic prose average of 0.55 em would reject the
   140×48 annotation that visibly holds it. It is a deliberate approximation
   (`ponytail:` in the file): no real font metrics; measuring with the
   renderer's `wrapText` in a browser-mode spec is the upgrade. The 18 is the
   reference size of the test, not a size frameworks must adopt.

3. **BPMN adopts it.** `NODE_SIZE`, `NODE_PRESETS[kind].shapeType` and
   `bpmnLabelMode(kind)` / `BPMN_EXTERNAL_LABEL_KINDS` (`gfx/bpmn/src/consts.ts`)
   are held together by `gfx/bpmn/src/__tests__/label-mode.unit.spec.ts`:

   - the six events, the two gateways, `dataObject` and `dataStore` become
     EXTERNAL: the node is born with no `text`, and a `bpmn:label` text is
     centred under it, both in a native group;
   - the five activities grow 1.5× to 180×108 and stay INSCRIBED at 18 units,
     with `textAnnotation` and `group`. The import fit keeps the old 120×72 as
     its reference (`ACTIVITY_FIT_REF`), so a `.bpmn` task is not shrunk
     harder for it.

4. **Every external label is seeded with the name of its type** ("Start
   event", "Exclusive gateway", "Data store"…), resolved through the host's
   catalogue under `com.labre.bpmn.seed.<kind>` at placement. An empty label
   is a text element nobody can find to click; Wardley seeds "Component" for
   the same reason.

5. **Gestures mirror Wardley.** A click selects the group; double-clicking the
   label edits it (`TextElementView`); double-clicking an external symbol opens
   nothing (`bpmnNodeEditsInnerText`), unless it is a legacy node that still
   carries inner text. Morph is registered on the group as for Wardley's
   composites and rewrites the label only while it still reads the source
   kind's seed.

6. **Import and export bind by group membership, never geometry.** The
   importer writes node, label and group for a named external kind; the
   exporter reads a node's name from the `bpmn:label` sharing its group, and
   falls back to the node's own `text`, so a legacy document exports the same
   name it did before.

## Consequences

- Nothing is migrated. An event drawn before this ADR keeps its inner text,
  keeps painting it, keeps it editable and exports it.
- Two known deviations are recorded, not fixed (PO decision), each with a
  Backlog ticket: Wardley `porter` (a 60×60 ellipse whose inscribed 28-unit
  letter "R" IS the notation) and DDD Event Storming `hotspot` (a 120×120
  diamond whose inscribed Kalam 20 relies on the `Contained` fit shrinking the
  font). R38 names both.
- C4, UML and the Context Map cloud use a separate text element but PLACE it
  inside the silhouette. They comply: the rule forbids inscribing a text that
  does not fit, not placing a text inside a shape that holds it.
- Other frameworks' label sizes (EDGY 20, C4 title 20, UML 16, DDD 14) are
  untouched; 18 is only the probe size of the fit test.
- Hosts: the FR catalogue gains ten seed keys, `com.labre.bpmn.seed.<kind>` for
  the ten external kinds.
- Validation: `bpmn.unlabeled-step` is narrowed to the activities; an event or
  a gateway has no inner text to check any more.
- A framework that adopts R38 adds the same per-kind spec against the helper.
