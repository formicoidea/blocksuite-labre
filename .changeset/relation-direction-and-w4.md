---
'@labre/affine-block-surface': patch
'@labre/affine-gfx-connector': patch
'@labre/affine-gfx-wardley': patch
'@labre/affine-shared': patch
'@labre/affine-widget-edgeless-toolbar': patch
'@labre/affine': patch
'@labre/std': patch
---

feat(edgeless): the direction of a typed edge is a statement, and W4 reads it

`docs/adr/0010` in one slice. For a connector carrying an edge role, the
persisted `source → target` pair IS the relation's orientation and part of the
document's meaning. That was already true of the data since #71 — and it was
invisible: the Wardley link tool draws no arrowhead, nothing said which way to
drag, nothing showed which way it came out, and nothing could change it. A rule
on top of that would have been a rule on top of an accident, so the three
mechanisms that turn the by-product into a statement ship WITH the rule, never
before it.

- **M1 — say it.** An edge role now declares its own `direction`: the verb the
  relation is read with (`depends on`), and the sentence that tells the user
  which way to draw it. The Wardley link tool shows it under its label in the
  senior sub-menu ("Drag from the component that has the need to what it
  needs"), and the evolution arrow shows its own. Keys and framework fallbacks,
  resolved through the host's catalogue: the library still puts no words in a
  framework's mouth. `CommandDescriptor.descriptionFallback` is new, beside the
  `descriptionKey` that already crossed the manifest seam and was never
  rendered.
- **M2 — show it.** Hovering or selecting a typed edge reveals a chevron at its
  TARGET end plus the role's verb — an `Overlay` and a widget
  (`affine-edge-direction-widget`), never the element renderer, which knows
  neither hover nor selection. At rest the map keeps its canonical arrowless
  look: on a Wardley map a permanent head already means evolution movement, and
  two meanings on one glyph make both unreadable. Nothing is revealed for an
  edge bound to nothing — a stroke that relates nothing says nothing.
- **M3 — let them fix it.** `edge.invert-direction` swaps `source` ↔ `target`
  AND the two endpoint styles, in one undo step, from the contextual toolbar,
  the palette, Settings › Shortcuts or the agent. `curveControlPoint` is
  deliberately untouched (an absolute pass-through point at t = 0.5, symmetric
  under a `P0` ↔ `P3` exchange, so the drawn curve does not move — an
  integration spec pins it). It writes through the surface and not through
  `EdgelessCRUDIdentifier`, so an inversion never becomes the default style of
  the next connector drawn.
- **`b.flip-direction` is hidden for a typed edge.** It swaps the arrowhead
  STYLES without touching the ends: honest on a generalist connector, a lie on
  an edge whose direction is the relation. Reverse direction takes its place.
  Gated on the ROLE vocabulary, not on a framework flag — a stored typed edge
  stays protected on a board whose framework tooling is switched off.
- **W4, a new rule family — `relative-order-along-axis`.** Given a typed edge,
  the two elements it links are compared along one declared axis of the frame,
  in the order the edge states. Wardley ships
  `wardley.provider-above-consumer`: "a provider may not sit above its
  consumer", `warning` under strict, `audit` under sketch, with 2% of the map's
  height of slack (a ratio, never model units — two components drawn level are
  not a mistake). Its finding names THREE elements for the first time: the two
  nodes and the edge, because reversing the edge is one of the two honest ways
  out and that gesture lives on the edge. It stays silent on an edge with a
  free end, a dangling end, a pair straddling two maps, a self-loop, and any
  edge whose role is not the one it names. Cost is linear in the RELATIONS
  somebody drew — a 200-node chain is 199 findings, not 19 900 comparisons —
  and measures ~0.3 ms on the 500-element reference map.
- **The role VOCABULARY is now registered** (`RoleVocabularyExtension`, from a
  framework's always-on render extension) and readable
  (`findRoleDef`, `isTypedEdgeRole`). The library had the "is this a typed
  edge?" predicate since PF1 and used it nowhere.
- **Templates.** The palette's "Link" and "Evolution arrow" swatches are
  de-typed: a horizontal stroke bound to nothing is a sample of a style, and it
  must claim nothing. Both template kits now decide what a stroke MEANS with
  one flag (`evolution`) instead of two different colour tests — a style
  inconsistency until W4 read these edges, a semantic one afterwards. Kodak's
  red *solid* links stay typed dependencies, which is what they are.
- **Telemetry.** `EdgeDirectionInverted` (ids only, never board content): how
  often a direction has to be corrected is the measurement of whether the
  drawing gesture announces itself well enough.
- `VERDICT_PROPS` gains `source` and `target`, so re-pointing or reversing an
  edge re-judges the board instead of waiting for an unrelated drag.
