# ADR 0046 — Wardley component + method: a component in the role tree, its method a tag, its ring derived

- Status: **accepted** (2026-10-28, PO decision on importing
  wardley-map-renderer maps; awaiting the maintainer's review of the PR)
- Deciders: Mathieu Jolly
- Related ADRs: [0007](0007-universe-tag-defs-format.md) (tag defs are data
  the host seeds; ids are forever; values are never persisted as defs),
  [0009](0009-reversed-flag-contract.md) (painting a stored document never
  depends on a flag), [0012](0012-framework-interchange-and-foreign-preservation.md)
  (an importer keeps what it cannot map), [0039](0039-dark-notation-palette.md)
  (hues stay, paper inverts).
- **Not a red zone**: no schema, no stored field, no enum value, no element
  type. A role gains a `parent` (role ids are data in `gfx/wardley/src/roles.ts`,
  and `role` is an existing string field); a tag pack gains a tag (append-only
  ids, written in the existing `tags` field through the existing `tag.set`
  command). No document is rewritten on load.

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

## Decision

### 1. `wardley:method` specialises `wardley:component`

The white circle inside the ring IS a link in the value chain; the ring is a
decision about that link. So the role gets `parent: 'wardley:component'`, the
same specialisation `market` and `ecosystem` already have. Through `roleIsA`
every consumer of the role tree now treats a method node as a component:

| Consumer                                                    | Before                        | After                                                                                       |
| ----------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------- |
| Tag picker (`tags-toolbar.ts`)                              | no entry                      | the **Nature** section, the same tag, labels and keys as a plain component, then **Method** |
| Reading panel (`WARDLEY_READING.appliesTo`)                 | not read                      | read as a component: nature naming convention, phase, consumers above and suppliers below   |
| W3 overlap pairs (`component/component`, `label/component`) | not measured                  | measured like a component                                                                   |
| Legend (`legendRole`, not `exact`)                          | "Component + method" row only | that row, and the "Component" row is lit too, as a market or an ecosystem already lights it |
| Morph families (`morph.ts`)                                 | excluded                      | unchanged: the families are data, not derived from `roleIsA`                                |
| Nudges, audit criteria                                      | —                             | unchanged: neither reads roles                                                              |
| W1, W2, W4                                                  | —                             | unchanged: they are written on the arrow, the inertia bar and the dependency edge           |

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
| `wardley:method/build`         | Build         | `buying-policy` / Uncharted           |
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
family — a ring nothing can colour and a fact no reader can name. The labels
are Wardley's own words, which is also what the renderer's default legend
prints for each pair. The pair stays one pure lookup away, both directions:
`wardleyMethodOf(category, recommendation)` and `wardleyMethodParts(valueId)`
(`gfx/wardley/src/method.ts`, exported from `@labre/affine-gfx-wardley`).

A renderer `category` outside the three defaults (its `methods` list is open,
and `renderConfig.style.decorators.method` can restyle them) maps to no value:
an importer keeps it under `interchange` (ADR 0012) rather than painting it as
the nearest family.

### 3. The ring is derived at paint time from the tag, never written

`wardleyNode` (`node/node-renderer.ts`) reads the node's `wardley:method`
value with `elementTagValues` — no registry, no defs, so painting does not
depend on the flag-gated pack registration (ADR 0009) — and, when it names one
of the nine, paints over the native ellipse on its exact path: the paper
(`notationColor(…, 'fill')`, so it inverts on a dark card), then the family hue
at 0 % / 40 % / 100 % by phase, then the ring's line in the hue (2 for an
outline, 1.5 otherwise, never thinner than the node's rim). The inner white
component is drawn on top as before.

- **No tag, or a value no pack of this version names**: nothing changes. The
  native ellipse paints the stored `fillColor` and `strokeColor`, so every
  method node drawn before this ADR keeps its colours.
- **The fill-colour palette stays, as the fallback, not as an override.** On a
  node with a method tag the stored fill no longer shows; clearing the tag
  gives it back untouched, because nothing overwrote it. The colour picker
  stays on the toolbar: it still sets the stroke colour, width and style of
  the inner component, and the fill of an untagged node. Making a picked fill
  win over the tag would need to tell a deliberate fill from the creation
  default (`METHOD_FILL`, always written), which the document cannot do; and
  writing colours from the tag (a watcher, as the Porter letter does) would
  store the same fact twice and let the two disagree after a repaint.

## Consequences

- A host seeding its own catalogue gets 21 new keys (the tag, its
  description, nine values and their descriptions); the French belongs to the
  Labre app. Without them the English fallbacks show.
- A board with only method nodes now shows the "Component" legend row and
  reading entries, and an existing map may raise W3 warnings on method nodes
  that overlap a component or a label: those overlaps were always there, the
  rule simply did not see them.
- The legend row's description ("Component + method (color = phase)") is left
  as it is: changing a fallback the host has already translated is a catalogue
  decision for the PO, not a side effect of this change.
- The OWM export still writes a method node as a plain component with a
  warning; mapping `build` / `buy` / `outsource` to OWM's decorators is a
  separate change, like the renderer import itself (#555).
- A client older than 0.62 opening a board with a method tag paints the stored
  fill (it does not read the tag) and offers no Method section; the tag is
  preserved.
