# ADR 0024 — `border-proximity`: a rule family measured against another artefact's outline

- Status: **accepted** (September 2026)
- Deciders: Mathieu Jolly
- Milestone: UML 2.5.1, tranche M (PO recette of 2026-09-16)
- Related ADRs:
  [0015](0015-rule-dependency-scope.md) (a family declares what its verdict
  depends on — this one's line, and the argument for it),
  [0021](0021-label-syntax-rule-family.md) (the previous family added to the
  engine, and the precedent for adding one rather than approximating),
  [0009](0009-reversed-flag-contract.md) (rules ship with the tooling: a flag
  off means no finding),
  [0017](0017-uml-one-framework-with-diagram-kinds.md) (the framework the first
  rule of this family belongs to).

## Context

UML 2.5.1 §11.3.4: "A Port is shown as a small square symbol. The square symbol
is placed on the boundary of the rectangle symbol for the owning
EncapsulatedClassifier." The placement IS the statement — a square on the edge
says traffic crosses there, the same square in the middle of the component says
nothing the notation has a reading for — and `gfx/uml/src/model.ts` resolves a
port's owner from exactly that geometry for the two exporters. A port dragged
inside its component therefore also exports under no component at all.

On the PO recette of 2026-09-16 (session 6, components) a port was dragged into
the middle of its component and nothing was raised, at either level of
requirement. That was correct behaviour and a recorded gap: `gfx/uml/src/rules.ts`
had filed `uml.port-on-border` among the questions the engine could not be asked,
because none of the sixteen families expressed "within N units of a node's
outline".

Three come close and each is wrong in a different direction:

- **`attachment`** measures a distance to a PATH. Its `carrierRole` must be an
  `edge` role, and `evaluateAttachment` warns once and returns nothing for a
  `node` one — a component is a box and has no path. Its other half,
  `boundaryAxis`, names a transition the FRAME declares
  (`transitionBandWidth`, Wardley's evolution frontiers); a `uml:diagram`
  declares no axis, and the border of an ordinary element is not a frontier of
  the sheet.
- **`element-in-background`** demands FULL containment, and frames against the
  sheet rather than against a neighbour. §11.3.4's own preferred drawing — the
  square straddling the edge — is by construction not contained.
- **`no-overlap`** is the only family that evaluates PAIRS, and its polarity is
  the opposite one: it forbids a collision, it cannot require a proximity, and
  it carries a `minPenetration` floor rather than a tolerance.

The choice was between approximating the requirement with one of the three and
writing the family the requirement needs. The same choice ADR 0021 faced, and
the same answer: a rule that fires on the wrong thing costs more than a
requirement nobody checks.

## Decision

**A seventeenth family, `border-proximity`: the subject's CENTRE must sit within
a declared tolerance of the OUTLINE of a carrier NODE it overlaps.**

```ts
interface BorderProximityDef {
  carrierRole: RoleId; // must be a `node` role
  tolerance: number; // model units, absolute
}
```

The carried role is the rule's own `appliesTo`, like every element-shaped
family; the carrier is named here. Same split `attachment` makes, and for the
same reason: one of the two is what the finding is about and the other is what
it is measured against.

`RULE_SCOPES['border-proximity'] = 'surface'`.

### The geometry, exactly

`outlineDistance(centre, carrier)` is the distance to the rectangle's PERIMETER,
positive on both sides of it: the distance to the nearest edge for a point
inside, the ordinary distance to the rectangle for a point outside, zero on the
line. A finding falls when that distance EXCEEDS the tolerance — `<=` passes, so
a tolerance a framework declares is a distance it accepts.

- **Centre, not extent.** The opposite of what `attachment` measures across a
  transition band, and for the opposite reason: a band is wide and the subject is
  asked to COVER it, whereas an outline is a line and the subject is asked to SIT
  on it. A glyph whose box happens to clip the edge of a component it is drawn
  well inside of passes an extent test and fails the eye.
- **Absolute units, not a ratio of the carrier.** The opposite choice from
  `relative-order-along-axis`, and the right one here: what makes "on the border"
  legible is the glyph's own footprint against the line, not the size of the box
  behind it. A tolerance proportional to the carrier would let a port sit a
  hundred units inside a large component and call it a border.
- **A tolerance of zero evaluates nothing** and warns once. A centre exactly on
  the line is a drawing no hand and no snap produces, so such a rule would indict
  every subject on the board.

### Overlap is the GATE, and silence is the default

A subject overlapping NO carrier raises nothing — not a finding, total silence.
This is the family's proportionality requirement (PRD principle 8) and the thing
that makes it shippable: a square dropped on blank canvas, or parked beside a
component while the sheet is being rearranged, is somebody drawing. The only
mistake this family reports is a glyph the author has ALREADY put on a box and
then pushed too far into it.

Shared AREA and not a shared edge (`boundsOverlap`'s epsilon), because a glyph
tangent outside its carrier is within any tolerance worth declaring anyway, and
treating a snapped edge as an overlap would make the gate depend on float noise.

### One finding, two ids

One per SUBJECT, however many carriers it touches: the mistake is one glyph in
one wrong place, and a square inside two nested components would otherwise be
reported twice for one drag. The carrier the finding is measured against and
names is the NEAREST by outline distance, ties broken by the smaller id — the
box the author was aiming at, and never the order a `Y.Map` was rebuilt in.

Both ids are indicted, sorted like every other multi-element finding, because
the finding has two honest readings — the glyph has drifted, or the box has
grown under it — and only the pair shows the user both brackets.

### `'surface'`, and the ADR 0015 argument

The carriers are collected from the WHOLE surface and bounded by no frame, so a
carrier moved, resized or deleted anywhere can flip a subject's verdict —
including from "on a border" to "on no carrier at all", which is the difference
between a finding and silence. Exactly the reasoning `attachment` already
records for its own line. Over-approximating is safe and under-approximating is
a stale verdict, so the family is declared wide.

### A carrier must be a `node`

An outline is a box's. A rule naming an `edge` or a `text` role evaluates
nothing and warns once, rather than matching nothing in silence — the same
contract `AttachmentDef.carrierRole` states in the other direction.

## The first rule

`uml.port-on-border`, and it is the only one in the library.

| field         | value                                                        |
| ------------- | ------------------------------------------------------------ |
| `appliesTo`   | `uml:port`                                                   |
| `carrierRole` | `uml:component`                                              |
| `tolerance`   | `UML_PORT_BORDER_TOLERANCE` = `UML_NODE_BOX.port.w` = **16** |
| `provenance`  | `standard`, §11.3.4                                          |
| severity      | `audit` under `uml.sketch`, `warning` under `uml.strict`     |

The tolerance is the glyph's OWN side, derived and not restated, and the three
drawings it arbitrates are:

- half in and half out (§11.3.4's own picture) — centre on the line, distance 0,
  silence;
- tangent inside, the square just clear of the edge — centre 8 units in, half a
  glyph, silence;
- pushed in by its own size — centre 24 units in, past the tolerance, and the
  finding falls.

Deliberately NOT `UML_ATTACH_TOLERANCE` (24, in `model.ts`), which measures an
edge-to-edge GAP to decide which box a glyph belongs to when the exporters need
an owner. Two numbers answering two questions is better than one number quietly
meaning both.

`uml.strict` promotes it, which makes it the only geometric rule that level
hardens: the class-side membership rules each have a second reading under which
the author is right, and a port in the middle of its component has none.

### What it does NOT close

The lollipop (`uml.interface-near-component`, §10.4.4) stays an open gap. That
glyph is drawn BESIDE a component, touching it at a gap rather than straddling
its edge, so the overlap gate never lets it in. Closing it means an outward
reading — "near the outline, inside or out" — which is a different requirement
rather than a wider tolerance: a stub floating in open canvas would then need a
rule about it, and that is a remark about a sketch.

## Consequences

- **The engine still names no notation.** It gained one geometric predicate
  (`outlineDistance`) and a walk; `validation.ts` contains no clause of any
  specification, and the family reads a carrier role and a number.
- **Seventeen families, and the second one added for a framework's sake.** Both
  additions were made rather than approximated, and both times the alternative
  was a neighbouring family answering a question nobody asked (ADR 0021 is the
  first).
- **A `'surface'`-scope family is one more thing PF5.4's closure cannot
  incrementalise.** Accepted for the same reason `attachment` and `reachability`
  are: the two populations are disjoint by role and both are small, so the walk
  is two handfuls and no sweep-and-prune is worth building for it.
- **No persisted data, no schema change.** The family lives on a rule
  declaration, which is code a framework ships — never a document. Older
  documents are byte-identical and open unchanged, and a UML diagram drawn
  before the roles existed carries no role on anything and is never evaluated.
- **The recorded gap is the mechanism that closed it.** `uml.port-on-border` was
  written down in `rules.ts` as unwritable and pinned by a test that asserted its
  absence. The PO found it from the canvas, the comment said why, and the test
  flipped in the same commit as the family. A gap somebody can read is a gap
  somebody can close.
