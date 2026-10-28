# ADR 0046 — Wardley component + method: a component in the role tree, its method a tag with a prefabricated ring

- Status: **accepted** (2026-10-28, PO decision on importing
  wardley-map-renderer maps, revised the same day after the PO's review of
  PR #556: prefabricated styles, Make, grouped dropdown, legend rows; and
  again: the palette's own swatches by key, light swatches for the
  "transparent" fills, an untagged node painted as Make; awaiting the
  maintainer's review of the PR)
- Deciders: Mathieu Jolly
- Related ADRs: [0007](0007-universe-tag-defs-format.md) (tag defs are data
  the host seeds; ids are forever; values are never persisted as defs),
  [0009](0009-reversed-flag-contract.md) (painting a stored document never
  depends on a flag), [0026](0026-legend-is-a-catalogue-subscription.md)
  (amended: a legend row lit by a tag value), [0012](0012-framework-interchange-and-foreign-preservation.md)
  (an importer keeps what it cannot map), [0039](0039-dark-notation-palette.md)
  (hues stay, paper inverts).
- **Not a red zone**: no schema, no stored field, no enum value, no element
  type. A role gains a `parent` (role ids are data in `gfx/wardley/src/roles.ts`,
  and `role` is an existing string field); a tag pack gains a tag (append-only
  ids, written in the existing `tags` field through the existing `tag.set`
  command). Two optional, additive type fields: `TagValueDef.group`
  (runtime tag configuration, never persisted; ADR 0007 amendment) and
  `CommandLegendEntry.tag` (ADR 0026 amendment). No document is rewritten on
  load.

## Context

The Wardley "component + method" node (`kind: 'method'`) is a white component
inscribed in a coloured ring. Until 0.61:

1. its role `wardley:method` had **no parent**, so the nature tag
   (`wardley:nature`, applied to `wardley:component`) never reached it: a
   component drawn with a method could not say whether it was an activity,
   data, a practice or knowledge, the reading panel skipped it
   (`reading-coverage.unit.spec.ts` listed it as "not a link in the value
   chain") and W3 never measured it;
2. its **method** was only the ring's fill colour, picked from the Wardley
   palette ("colour = phase": Wonder, Peace, War, …). No reader, rule or
   importer could name it.

The PO decided on 2026-10-28 that the Labre editor will import maps written in
the wardley-map-renderer JSON, where a component may carry a `nature` and a
`method: { category, recommendation }` — `category` free text with three known
defaults (`buying-policy` blue `#2563eb`, `project-management` green
`#16a34a`, `attitudes` amber `#f59e0b`), `recommendation` one of
Uncharted (ring outline), Transitional (40 % fill), Industrialized (solid) —
and that the board replays the renderer's look. The import must be able to
write both as real, user-editable parameters.

Reviewing the first version of this PR, the PO decided that **in Labre the
colour defines the type**: each of the nine methods has its own prefabricated
style, chosen per family and phase from the Wardley palette, rather than the
renderer's three hues; the buying-policy trio is **Make, Buy, Outsource**; the
picker groups the nine under their family titles; and the legend lists every
method the map uses. There are no custom categories: the one freedom left to
the author is the legend's wording, which tells the story of the final
picture.

## Decision

### 1. `wardley:method` specialises `wardley:component`

The white circle inside the ring IS a link in the value chain; the ring is a
decision about that link. So the role gets `parent: 'wardley:component'`, the
same specialisation `market` and `ecosystem` already have. Through `roleIsA`
every consumer of the role tree now treats a method node as a component:

| Consumer                                                    | Before                        | After                                                                                                  |
| ----------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| Tag picker (`tags-toolbar.ts`)                              | no entry                      | the **Nature** section, the same tag, labels and keys as a plain component, then **Method**            |
| Reading panel (`WARDLEY_READING.appliesTo`)                 | not read                      | read as a component: nature naming convention, phase, consumers above and suppliers below              |
| W3 overlap pairs (`component/component`, `label/component`) | not measured                  | measured like a component                                                                              |
| Legend (`legendRole`, not `exact`)                          | "Component + method" row only | that row, the "Component" row as a market or an ecosystem lights it, and one row per method used (§ 4) |
| Morph families (`morph.ts`)                                 | excluded                      | unchanged: the families are data, not derived from `roleIsA`                                           |
| Nudges, audit criteria                                      | —                             | unchanged: neither reads roles                                                                         |
| W1, W2, W4                                                  | —                             | unchanged: they are written on the arrow, the inertia bar and the dependency edge                      |

The alternative — `appliesTo: [component, method]` on the nature tag and no
role change — was smaller and wrong: it would have given the method node a
nature that no reading, no rule and no legend could use, the exact
"qualification nobody reads" the tag mechanism exists to avoid.

### 2. The method is one tag with nine values, `wardley:method`

Appended to the library's own pack (`WARDLEY_TAG_DEFS`, `natures.ts`),
`cardinality: 'single'`, `appliesTo: ['wardley:method']` (so a plain
component, the parent, is never offered it):

| Value id                       | Label         | Renderer pair                         |
| ------------------------------ | ------------- | ------------------------------------- |
| `wardley:method/make`          | Make          | `buying-policy` / Uncharted           |
| `wardley:method/buy`           | Buy           | `buying-policy` / Transitional        |
| `wardley:method/outsource`     | Outsource     | `buying-policy` / Industrialized      |
| `wardley:method/agile`         | Agile         | `project-management` / Uncharted      |
| `wardley:method/lean`          | Lean          | `project-management` / Transitional   |
| `wardley:method/six-sigma`     | Six Sigma     | `project-management` / Industrialized |
| `wardley:method/pioneers`      | Pioneers      | `attitudes` / Uncharted               |
| `wardley:method/settlers`      | Settlers      | `attitudes` / Transitional            |
| `wardley:method/town-planners` | Town planners | `attitudes` / Industrialized          |

One tag and not two (a category tag plus a recommendation tag): the renderer's
pair and these nine values are the same nine facts, and one value per fact
admits nothing else. Two tags would let a board say "Transitional" with no
family — a fact no reader can name and no style can paint. The labels are
Wardley's own words (Make for the renderer's "build", in the PO's wording).
The pair stays one pure lookup away, both directions:
`wardleyMethodOf(category, recommendation)` and `wardleyMethodParts(valueId)`
(`gfx/wardley/src/method.ts`, exported from `@labre/affine-gfx-wardley`).

A renderer `category` outside the three defaults (its `methods` list is open,
and `renderConfig.style.decorators.method` can restyle them) maps to no value:
there is no custom category in Labre, and an importer keeps it under
`interchange` (ADR 0012) rather than filing it under the nearest family. The
renderer's colours are not imported either: the ring is Labre's.

**The picker groups the values by family.** Each value carries
`group: { label, labelKey }` (the new optional `TagValueDef.group`, ADR 0007
amendment), and the qualification dropdown (`tags-toolbar.ts`, generic) opens
a sub-title each time the group changes. On a method node it reads:

```
Nature        Activity · Data · Practice · Knowledge
Method
  Buying policy        Make · Buy · Outsource
  Project management   Agile · Lean · Six Sigma
  Attitudes            Pioneers · Settlers · Town planners
```

A value with no group (an id a document carries that no def explains) is
listed after the last family, under no sub-title.

### 3. Each method has a prefabricated ring, painted from the tag, never written

`METHOD_STYLE` (`node/consts.ts`) gives each of the nine a fill, a line and a
line width, built from named tokens only. "Wardley blue" and "Wardley violet"
are the colour picker's own swatches **Peace** and **War**, read by their keys
from the picker's swatch table, `WARDLEY_PALETTES`, under no new name (PO
decision): the table and its nine wordings moved word for word from
`toolbar/node-config.ts` to `node/consts.ts`, with `export` as the only change,
because the toolbar module already imports `node/consts.ts` (an import loop
otherwise) and the node painter must not load toolbar code. `swatch(key)`
accepts only the keys in `METHOD_SWATCH_KEYS`, and a guard test checks each
is in the table. A "transparent" fill is the border swatch's own light variant
(PO decision): Peace light under Peace, War light under War, and the same rule
for any Wonder use. Dark values come from the notation tint (ADR 0039): the
ink and the greys invert, the palette's swatches stay.

| Value         | Fill (light → dark)                           | Line (light → dark)             | Width |
| ------------- | --------------------------------------------- | ------------------------------- | ----- |
| Make          | `METHOD_FILL` `#d9d9d9` → `#313131`           | ink `#1f2328` → `#eaeaea`       | 2     |
| Buy           | `METHOD_BUY_FILL` `#8c8c8c` → `#6b6b6b`       | ink                             | 2     |
| Outsource     | `METHOD_OUTSOURCE_FILL` `#404040` → `#b5b5b5` | ink                             | 2     |
| Agile         | ink at 15 % `#1f232826` → `#eaeaea26`         | the same                        | 1.5   |
| Lean          | ink at 35 % `#1f232859` → `#eaeaea59`         | the same                        | 1.5   |
| Six Sigma     | ink at 55 % `#1f23288c` → `#eaeaea8c`         | the same                        | 1.5   |
| Pioneers      | swatch 'Peace light' `#c6dbfc` (kept)         | swatch 'Peace' `#5b9cf6` (kept) | 2     |
| Settlers      | swatch 'Peace' `#5b9cf6` (kept)               | swatch 'Peace'                  | 2     |
| Town planners | swatch 'War light' `#d9c9fa` (kept)           | swatch 'War' `#9d6df0` (kept)   | 2     |

- **Buying policy** is Wardley's own style, the one OWM draws: a thick ink
  border around a grey that darkens with the phase. The darkest step is
  `#404040` rather than OWM's `#444444` because that literal is C4's stencil
  grey and the dark tables are one table across frameworks
  (`notation-dark-palettes`): Wardley's ramp keeps its own dark values, and
  its order (outsource the furthest from the paper, on either card).
- **Project management** is an intensity of grey: the ink itself at three
  alphas, line and fill alike, so it has no border of another colour. The
  tint keeps a stored alpha, so the dark card paints the same three
  intensities in its light ink.
- **Attitudes** are the Wardley palette: pioneers Peace light in a Peace
  border, settlers solid Peace, town planners War light in a War border.

Families differ by their border (thick ink, none, hue), values within a
family by their fill; the nine pictures are distinct on both cards and none is
a plain component's white disc (`method.unit.spec.ts`).

**The default style is Make** (PO decision, 2026-10-28): the method node's
default family is the buying policy, so a node with no method tag, or with a
value no pack of this version names, paints exactly what a Make node paints
(`node-renderer.unit.spec.ts` compares the two draws).

#### Painting

`wardleyNode` (`node/node-renderer.ts`) reads the node's `wardley:method`
value with `elementTagValues` — no registry, no defs, so painting does not
depend on the flag-gated pack registration (ADR 0009) — and, when it names one
of the nine, paints over the native ellipse on its exact path: the paper,
fill and line (so no dark edge of the native rim survives under a wash), then
the style's fill and line, every colour through `notationColor`. The line is
never thinner than the node's own rim. The inner white component is drawn on
top as before, in the node's stored stroke colour and width.

- **Existing method nodes change look.** Every method node paints a method
  style now, Make when untagged, so the fill an author picked with the
  "colour = phase" palette no longer shows on any of them. Nothing is
  rewritten: the stored `fillColor` and `strokeColor` stay in the document, and a
  client older than 0.62 still paints them.
- **What the colour picker still does on a method node.** Its fill swatches
  have no visible effect on the ring any more. Its stroke colour, width and
  style still reach the inner white component's outline, and the width also
  thickens the ring (never thinner than the rim). Proposed, not done here:
  take the fill half of the picker off the method node's toolbar (keep the
  stroke controls), since a fill that paints nothing is a control that lies.
  That is a toolbar change for a follow-up PR, once the PO confirms.
- Writing colours from the tag (a watcher, as the Porter letter does) was
  rejected: it would store the same fact twice and let the two disagree.

### 4. The legend lists every method the map uses

The method command's legend subscription is the "Component + method" row plus
nine rows, one per value, each declared with `tag: ['wardley:method', id]`
(the new optional `CommandLegendEntry.tag`, ADR 0026 amendment): a value row
is lit only when a method node on the board carries that value, once however
many do. Each row is filed under its family's title (the same key as the
picker's sub-title) and labelled with the value's own label key, so the
legend and the dropdown say the same words. Its swatch is a method node at
the row's size carrying the tag, so it goes through the very ring painter the
map uses; the swatch has no role, so no rule reads its tag and the next
legend does not list it.

The "Component + method" row is reworded for the new meaning: "Component +
method (the ring names the method)" (same key,
`com.labre.wardley.legend.desc.method`, new English).

Every row is a plain text element of the legend box, as every legend row
already is: the author rewrites a method's line in place (the story of the
picture), and a regenerate redraws it from the keys, as for any row
(ADR 0026, 2026-09-23 amendment).

## Consequences

- A host seeding its own catalogue gets 24 new keys (the tag, its
  description, nine values and their descriptions, three family titles) and
  one changed English fallback (`com.labre.wardley.legend.desc.method`); the
  French belongs to the Labre app. Without them the English fallbacks show.
- A board with only method nodes now shows the "Component" legend row and
  reading entries, and an existing map may raise W3 warnings on method nodes
  that overlap a component or a label: those overlaps were always there, the
  rule simply did not see them.
- The OWM export still writes a method node as a plain component with a
  warning; mapping `make` / `buy` / `outsource` to OWM's decorators is a
  separate change, like the renderer import itself (#555).
- Every existing method node changes look on upgrade: it paints Make (or its
  tagged method) instead of its stored fill. A client older than 0.62 opening
  the same board paints the stored fill (it reads no tag) and offers no
  Method section; the tag is preserved.
