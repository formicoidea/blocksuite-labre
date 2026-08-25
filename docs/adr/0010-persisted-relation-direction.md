# ADR 0010 — The persisted direction of a typed edge is semantic

- Status: **proposed** (August 2026) — requires human approval. It adds no field,
  but it freezes the MEANING of two already-persisted fields
  (`ConnectorElementModel.source` / `.target`) for a subset of elements. A
  meaning, once documents rely on it, is as hard to change as a schema, so this
  belongs to the same red zone as `CLAUDE.md` § "Schema/model changes".
- Deciders: Mathieu Jolly
- Milestone: "PF+MF" refoundation — validation platform, PF5 wave 2
- Related ADRs: [0008](0008-command-registry-foundation.md) (where the reverse
  command is declared), [0009](0009-reversed-flag-contract.md) (rules ship with
  the tooling, not with the content), [0005](0005-element-docid-seam.md) /
  [0006](0006-pivot-properties-provider.md) (the pivot records that MF3 will
  read a hierarchy into).
- **Blocks**: Wardley validation rule W4 — _"a provider component may not be
  positioned higher than its consumer"_. W4 cannot be written until this ADR is
  approved, because W4 is exactly the question of whether one end of an edge
  means something different from the other.

## The question

For a connector carrying an edge role — today only `wardley:dependency`
(`packages/affine/gfx/wardley/src/roles.ts:79-83`, the only `kind: 'edge'` entry
in any framework) — does the persisted pair `source → target` carry dependency
semantics, and if so in which direction?

Three answers were on the table:

1. **Yes, as-is.** The data already exists on every edge drawn since #71; W4 can
   read it tomorrow.
2. **No, never.** Direction is a rendering detail; a dependency's orientation
   must be derived from geometry (the visibility axis), or from a new explicit
   field.
3. **Yes, but not yet.** The field is the right carrier, and the gesture that
   fills it is not yet an act of meaning.

The recon below settles it as (3), with a costed path to (1).

## Context

### 1. What a connector actually persists

`packages/affine/model/src/elements/connector/connector.ts:512-529` — two
symmetric `@field()` accessors, each a `Connection`
(`:44-54`): `{ id?: string; position?: [number, number] }`, "at least one of id
and position is not null". Nothing in the type, the defaults or the comments
distinguishes the two ends. `source` and `target` are, as data, interchangeable
labels for "the first point of the path" and "the last".

The semantic marker is elsewhere and is flat: `role`, a
`string | undefined` on the BASE element model
(`packages/framework/std/src/gfx/model/surface/element-model.ts:492-493`), whose
vocabulary declares `kind: 'node' | 'edge'`
(`packages/framework/std/src/gfx/model/surface/role.ts`). So the library already
has the exact predicate this ADR needs — "is this element a typed edge?" — and
uses it nowhere.

### 2. What the renderer does with the direction

`packages/affine/gfx/connector/src/element-renderer/utils.ts:74`:

```ts
const anchorIndex = endPoint === 'Rear' ? points.length - 1 : 0;
```

`Front` is the source end, `Rear` the target end. Product defaults
(`packages/affine/model/src/consts/connector.ts:18-20`) are
`front = PointStyle.None`, `rear = PointStyle.Arrow` — a generalist connector
therefore shows an arrowhead **on the target**, which is the reading this ADR
adopts.

But the Wardley link tool overrides it
(`packages/affine/gfx/wardley/src/actions.ts:439-445`):

```ts
: {  // kind === 'link'
    frontEndpointStyle: PointStyle.None,
    rearEndpointStyle: PointStyle.None,
  };
```

**A `wardley:dependency` edge is drawn with no arrowhead at either end.** Its
direction is persisted and strictly invisible. The same is true of the shipped
map templates (`packages/affine/gfx/wardley/src/templates/maps.ts:129-144`).

Worth spelling out, because it is the one step of this demonstration that goes
through a middleware: `activateWardleyConnector` only calls
`EditPropsStore.recordLastProps`, and `_createConnector` calls
`surface.addElement`, not `crud.addElement` — it is `EditPropsMiddlewareBuilder`
(`beforeAdd`) that applies the recorded props. The chain holds: a link drawn by
hand does come out headless, despite the model default
`rearEndpointStyle = 'Arrow'` (`connector.ts:500-501`).

Worse, on a Wardley map an arrowhead is already taken: the evolution annotation
is the red dashed connector with `rearEndpointStyle: PointStyle.Triangle` and
**no role** (`actions.ts:430-438`, `maps.ts:135,140`). In this framework's visual
language a head on a link means _movement_, not _dependency_.

### 3. What the gesture guarantees — the load-bearing finding

Every interactive creation path is mechanically deterministic and semantically
mute:

| path                                                                  | source                             | target                      | can it carry a role?                          |
| --------------------------------------------------------------------- | ---------------------------------- | --------------------------- | --------------------------------------------- |
| `ConnectorTool` drag (`connector-tool.ts:178-181`, `:162-176`)        | element under the pointer at press | element under it at release | **yes** — `role` tool option (:40-49, :81-88) |
| quick-connect (`connector-tool.ts:209-273`, esp. `:256-263`)          | the already-selected element       | the one picked afterwards   | no — `misc.ts:200` passes `mode` only         |
| auto-complete arrow (`edgeless-auto-complete.ts:195-203`, `:380-389`) | the origin element, always         | the new/hit element         | no — `_addConnector` passes no role           |

Two consequences:

- **Only the framework toolbox can mint a typed edge.** Quick-connect and
  auto-complete produce neutral connectors, so the population this ADR governs
  is exactly "edges drawn with the Wardley link tool" plus authored templates.
  That is a small, controlled surface.
- **Inside that path, `source` means "where my finger went down".** There is no
  normalisation at `dragEnd` (`connector-tool.ts:140-150` only does
  `captureSync` + select), no hint in the tool, no arrowhead in the result, and
  no way to inspect or change the orientation afterwards. The user is never
  told that the gesture has a direction, never shown that it produced one, and
  cannot correct it. Direction is a by-product, not a statement.

Note the one place where the grabbed side is deliberately drained of meaning:
auto-complete's `Direction.Top/Right/Bottom/Left` feeds only anchor placement
(`packages/affine/widgets/edgeless-selected-rect/src/utils.ts:245-268`), so
dragging the LEFT arrow of a node still yields `source = that node`. Even a user
who reasoned about direction from the gesture would reason wrong.

### 4. The convention is already written — in a comment, and in twelve edges out of thirteen

**The best witness is the vocabulary itself.** `roles.ts:78`, one line above the
role declaration:

```ts
// The value-chain link: "A depends on B".
```

The convention was stated the day the role was born. What it never got was a
direction fixed in the data model, a rendering, or a check.

**Wardley map templates — twelve typed edges, twelve compliant.** With
`vy = PL.y + (1 - v) * PL.h` (a larger `v` is higher on the map), every typed
edge of `templates/maps.ts` has `source.v > target.v` strictly: Tea Shop's eight
(0.93 → 0.74, 0.74 → 0.70 / 0.60 / 0.47, 0.47 → 0.34 / 0.38, 0.38 → 0.10) and
Kodak's four (0.92 → 0.80 → 0.62 → 0.40, and 0.80 → 0.40).

**The thirteenth is a counter-example, and it is the useful one.**
`templates/index.ts:250` ships a "Link" sample as
`connect({ position: [0,0] }, { position: [160,0] })`, and `connect` (`:113-131`)
stamps `role: WARDLEY_ROLE.dependency`. That is a shipped `wardley:dependency`
that is **horizontal and bound to nothing** — neither `source.id` nor
`target.id`. It is a decorative stroke in a palette, typed by accident of the
helper's default. It is dealt with in "Compatibility" below, and it forces a case
into the rule family that the "two maps" case did not: an edge with an unbound
endpoint.

It also exposes a divergence between the two template kits: `maps.ts:135` tests
`o.arrow ? undefined : dependency` while `templates/index.ts:122` tests
`opts.red ? undefined : dependency`. Two different predicates for "is this a
dependency?" in one framework, in neighbouring files — so `maps.ts`'s
`link('capture','storage',{ red: true })` (Kodak, red and solid) IS typed, and
`index.ts`'s red `connect` is not. Today that is a style inconsistency. The
moment W4 reads these edges it becomes a **semantic** inconsistency: what a rule
governs would depend on which authoring helper the template borrowed.

**Two neighbouring corpora orient the same way**, neither of them governed by
this ADR:

- Mindmap (`packages/affine/model/src/elements/mindmap/mindmap.ts:551-574`):
  `source = parent`, `target = child` — in-memory `LocalConnectorElementModel`,
  never persisted, no role.
- EDGY (`packages/affine/gfx/edgy/src/templates/index.ts:277-306`): 24 oriented
  triplets `[subject, object, verb]`, rendered as neutral connectors (no
  `roles.ts` in `gfx/edgy` at all). Only two carry `requires`
  (`['process','asset','requires']`, `['product','capability','requires']`);
  six others put the **provider or the owner** in the subject slot —
  `['product','task','serves']`, `['brand','task','supports']`,
  `['organisation','product','makes']`, `['process','product','creates']`,
  `['organisation','capability','has']`, `['task','journey','is part of']`.
  What this corpus demonstrates unanimously is therefore **`source` = subject of
  the verb**, not `source` = consumer. That distinction is what Decision § 2
  splits into two tiers.

### 5. What Wardley prescribes

The user and their need sit at the top; the value chain forms below them; each
component depends on the components under it; value flows back up. The
**visibility axis IS the statement of dependency order**, and canonical maps draw
the links as plain lines — the geometry carries the orientation, so the line does
not need to.

This is the trap W4 must avoid. If the direction of a `wardley:dependency` edge
is _derived_ from the y coordinates of its endpoints, then W4 ("a provider may
not be higher than its consumer") compares the geometry against itself and can
never fire. **W4 is only a rule if the orientation has an origin independent of
the layout.** The persisted `source → target` is the only candidate in the
model today.

### 6. The good news: nothing in the product loses or inverts the direction

A full sweep of the mutation sites found no inversion anywhere:

- **Endpoint re-drag** (`components/connector-handle.ts:69-84`, `:152-174`)
  writes back into the same slot it grabbed (`connector[connection] = …`), and
  passes the OTHER endpoint's id as `excludedIds` to
  `renderConnector` (`connector-manager.ts:1226-1229`), so dropping the source
  dot onto the current target is refused. **No single gesture can cross the two
  ends** — which is not the same as saying they cannot be crossed: dropping
  `source` in the void, moving `target` onto the old source, then `source` onto
  the old target inverts the edge in three gestures, silently and at unchanged
  geometry. Under W4 that produces a violation appearing with nothing having
  moved on screen. M2 is exactly what makes that sequence legible.
- **Resize / mirror** (`connector.ts:353-386`) always writes `path[0]` to
  `source` and `path[last]` to `target`; there is no element-level flip command
  at all (`flipX`/`flipY` in `edgeless-selected-rect.ts:660-666` only choose a
  cursor).
- **Paste** (`edgeless/clipboard/canvas.ts:70-88`) and **duplicate**
  (`utils/clone-utils.ts:137-148`, `mapConnectorIds`) remap `source→source`,
  `target→target`. `role` rides along for free, being a declared base `@field()`.
- **Block conversions**, the two sites a sweep most easily misses:
  `reassociateConnectorsCommand`
  (`blocks/surface/src/commands/reassociate-connectors.ts`, reached from five
  conversions) and `moveConnectors`
  (`root/src/edgeless/utils/connector.ts:22-31`). Neither inverts — both
  re-point ids in place — but they are the two functions someone will edit one
  day without knowing a direction now depends on them.
- **Undo/redo** is plain Yjs; nothing rewrites endpoints.

Two adjacent defects were found and are tracked outside this ADR (a side task is
open): `reassociate-connectors.ts:33` only re-points `source` on a self-loop, and
`clone-utils.ts:137-148` lacks the `?? id` fallback the clipboard has, so an
endpoint that was not cloned yields `source.id === undefined`. The reachable path
to the second is "turn into linked doc", not `serializeConnector`
(`clone-utils.ts:69-86`). Neither changes a direction; both can drop a binding.

Exactly one affordance is direction-flavoured and it is a liar:
`packages/affine/gfx/connector/src/toolbar/config.ts:266-290`, `b.flip-direction`,
swaps `frontEndpointStyle` ↔ `rearEndpointStyle` and **does not touch
`source`/`target`**. On a generalist connector that is honest enough (it is an
arrowhead-style menu). On a typed edge it would move the only visible sign of the
relation while leaving the relation intact — the picture and the data would then
disagree. It also routes through `updateElement`, whose `recordLastProps`
(`blocks/surface/src/extensions/crud-extension.ts:120-130`) makes the swap the
default for every connector drawn afterwards.

### 7. Nothing reads direction today

`packages/affine/gfx/wardley/src/rules.ts` ships one rule, `element-in-background`,
node-only; the engine (`packages/affine/blocks/surface/src/extensions/validation.ts`)
reads `el.role` and never `connector.source` / `.target`. There is no consumer to
break and no behaviour to preserve. This ADR is therefore a decision about the
future, taken before the first consumer exists — which is the only comfortable
moment to take it.

## Decision

### 1. Direction is semantic, for typed edges only

For an element whose `role` resolves to a `RoleDef` with `kind: 'edge'`, the
persisted pair `source → target` **is** the relation's orientation and is part of
the document's meaning. It must be preserved by every transform, and it may be
read by rules, by exporters and by the host.

For a connector with no role — the generalist connector, the Wardley evolution
arrow, the market-glyph wiring (`actions.ts:400-413`), the EDGY decorations —
`source`/`target` remain what they are today: the two ends of a path, carrying no
claim. No existing behaviour changes for them.

### 2. The convention, in two tiers

**Tier 1 — the generic invariant, binding on every framework.**

> An edge role names a **relation with a verb**. **`source` is the subject of
> that verb; `target` is its object.** Reading an edge is reading one sentence:
> `source` _verb_ `target`.

That is the only claim the library makes. It is what the whole authored corpus
supports without exception — EDGY's 24 triplets `[subject, object, verb]`,
mindmap's parent→child, every Wardley link (§ 4) — and it is decidable by looking
at the role's own declaration rather than at a framework's habits.

**Tier 2 — what the verb of `wardley:dependency` happens to be.**

> Its verb is **"depends on"** — `roles.ts:78` says so already. Therefore, for
> this role and this role only: **`source` is the consumer, `target` is what it
> needs.**

Corollaries:

- Wardley: the source is the higher, more visible component; the target is the
  lower one it rests on. **Needs descend from source to target; value flows back
  up from target to source.** This is the reading W4 evaluates, and it is
  unchanged from the previous draft of this ADR.
- Any future `kind: 'edge'` role inherits tier 1 and supplies its own verb. A
  BPMN sequence flow ("is followed by"), an EDGY `serves` or `has`, a Cynefin
  transition — each is oriented, none of them is a dependency, and none of them
  is required to put the needing party in the source slot. Tier 1 tells an
  implementer where to write the two ends; the role's verb tells a rule what the
  sentence means.
- Rendering: when direction is shown, the mark sits on the **Rear/target** end —
  the same end the product default already arrows
  (`consts/connector.ts:18-20`). The mark points at the object of the verb.

This direction and not its opposite, because it is the one the code comment
already states, the one every authored fixture uses, and the one the three
creation paths already produce for the natural gesture ("start on the subject").
Choosing the reverse would invert every template on the same day.

Why two tiers rather than one: an earlier draft stated the dependency reading as
the general law. The EDGY corpus contradicts it — six of its triplets put the
provider or the owner in the subject slot (§ 4). Promoting one framework's verb
into the library's invariant would have forced more than half of a future EDGY
vocabulary to declare itself an exception, or produced a generic rule reading
"product depends on task".

### 3. Yet the direction of an edge drawn TODAY does not qualify

The gesture is consistent but not intentional (§ 3). Data that the user cannot
see, was never told about, and cannot correct is not a statement they made. W4
must not be built on it.

Three mechanisms turn the by-product into a statement. **W4 does not ship before
they do; they ship in one slice.**

| #   | mechanism                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | size  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| M1  | **Say it.** The Wardley link tool announces its gesture — tooltip and toolbar hint, "drag from the component that has the need to what it needs". One i18n key, one tooltip, `actions.ts` + the wardley menu.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 0.5 d |
| M2  | **Show it.** _(Amended 02/08/2026 — see the UX contract: the chevron and the label are ONE mark now, the role's verb laid along the link, and the overlay named below is deleted.)_ A typed edge reveals its orientation on hover and on selection: a chevron at the Rear end plus the role's own label (`com.labre.wardley.role.dependency`, already declared). At rest the map keeps the canonical arrowless look, so the head never collides with the evolution arrow's meaning (§ 2). **Seam: an `Overlay` plus a widget, NOT the element renderer** — an `ElementRenderer` is `(model, ctx, matrix, renderer, rc)` (`element-renderer/index.ts:38-39`) and knows neither hover nor selection. The precedent is one directory away and one week old: `ValidationOverlay` (`validation.ts:1363`) and `violation-detail-widget.ts`, the only file of `blocks/surface` that handles a hover. | 1.5 d |
| M3  | **Let them fix it.** A **Reverse dependency** command on a selected typed edge: swaps `source` ↔ `target` and swaps `frontEndpointStyle` ↔ `rearEndpointStyle`, in ONE undo step. `curveControlPoint` is deliberately left alone — it is an ABSOLUTE pass-through point at t = 0.5 and the tangent formulas are symmetric under a `P0` ↔ `P3` exchange (`connector-manager.ts:1653-1690`), so swapping the ends leaves the same curve; "mirroring" it would visibly move the curve, i.e. it would be a bug. Declared in the command registry (ADR 0008) so it also reaches the palette and a shortcut. And `b.flip-direction` is hidden for role-carrying edges — on a typed edge it is a lie (§ 6).                                                                                                                                                                                       | 1.0 d |
|     | telemetry, unit tests, **an integration spec** (M2 paints on the canvas, so the `CLAUDE.md` template requires one) and a changeset                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 1.0 d |
|     | **total before W4 can be written**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | ~4 d  |
|     | W4 itself: new rule family, rule entry, unit + integration                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | ~2 d  |

Two dependencies the figures do not cover, both to be settled before the slice
starts:

- **M1 is half outside this repo.** The library holds an i18n _key_ and never
  prose; the sentence a user reads is resolved by the host (`labreapp`). The
  0.5 d buys the key, the tooltip and the wiring — not the copy.
- **M3 leans on ADR 0008**, whose command registry is itself `proposed` and
  unapproved. If 0008 is not accepted first, Reverse dependency ships as a plain
  contextual-toolbar entry and loses the palette and the shortcut: same cost,
  smaller reach.

### 4. The direction never comes from the geometry

Two distinct shortcuts hide under one phrase, and they fail for two different
reasons. They are separated here so that neither argument is later quoted for
the other.

**(a) Deriving the orientation at evaluation time** — no orientation is stored;
W4 asks the y coordinates who depends on whom. This one is _vacuous_: the rule
compares the layout against itself and can never fire (§ 5 of the Context).
Rejected on that ground alone.

**(b) Normalising once at `dragEnd` and persisting it** — the higher endpoint
becomes the source, and the stored direction is then a plain persisted state.
This variant is NOT vacuous: evaluation is a pure function of the document, and
the rule acquires a real meaning, "you have since moved a node against the order
you drew". It is rejected on the other ground: **it invents intent from an
accident.** The layout at one instant becomes the permanent meaning of the
relation. An architect who wires the chain before arranging it gets a dependency
graph decided by a transient position, and the subsequent, correct rearrangement
is precisely what the rule then complains about.

Assumed, in fairness: the retained option also lets an accident fix the direction
— which end the finger landed on first. The difference is not that one is
accidental and the other deliberate; it is that the retained accident is
_announced, visible and reversible_ once M1–M3 land, while a normalisation is
none of the three and is done to the user rather than by them.

The honest behaviour is therefore to leave the gesture's direction alone and let
W4 fire immediately when it contradicts the layout. **The violation _is_ the
affordance** — it appears the moment an edge is drawn upside-down, and its
suggestion offers M3's reverse command. The user resolves it by moving the node
or by reversing the edge, and either way the resolution is theirs.

### 5. No new persisted field

Not `directionConfirmed`, not `orientation`, not a `wardley:dependency-reversed`
role. See "Rejected alternatives".

## UX contract

- **Fixing the direction.** Drawing with the Wardley link tool: press on the
  component that has the need, release on what it needs. Stated by M1, and it is
  what the gesture already does mechanically — no code changes which end becomes
  the source.
- **Seeing it.** At rest, a dependency link is a plain grey line (canonical
  Wardley, unchanged). On hover or selection, the link says what it means. A
  permanently-arrowed link is deliberately NOT adopted: on a Wardley map a head
  means evolution movement.

  > **Amended 02/08/2026 — PO acceptance, point 5.** This bullet first read "a
  > chevron appears at the target end with the role label". Shipped, the two
  > marks covered each other: the label was placed on the middle VERTEX of the
  > path, which on a two-point link is its target endpoint, so the tooltip
  > landed on top of the chevron — and a horizontal box across a diagonal link
  > reads as a sticker on the map rather than a statement about that link.
  >
  > It is **one** mark now: the role's **verb**, centred on the middle of the
  > drawn path by arc length, rotated onto the median segment (turned 180° when
  > that would stand the text on its head, the words themselves never
  > reversing), in a box that ends in a POINT on the side facing the target —
  > `depends on >`. The chevron is folded into that point and
  > `EdgeDirectionOverlay` is deleted; M2 draws no canvas layer at all.
  > Everything else about M2 holds: hover ∪ selection, model units, silence on
  > an unbound edge, the verb from the role vocabulary.
  >
  > **Amended again — same recette, second pass, points 4 and 5.** The first cut
  > of this amendment put the whole sentence in the box,
  > `{consumer} {verb} {provider}`. A sentence is longer than most links, so the
  > box overhung both ends and covered the very components it was naming — and
  > the map already draws those names at both ends of the line. The label is the
  > **verb alone**; the names are the canvas's job, and the reading panel's
  > (`readRelations`) when a user asks for them in prose.
  >
  > The widget also paints **under every toolbar** (`z-index: 0` on its host,
  > below `edgeless-toolbar-widget`'s 1 and `editor-toolbar`'s
  > `--affine-z-index-popover`). What it draws belongs to the canvas, and the
  > toolbars overhang the canvas; the reading panel is the opposite case and
  > keeps its layer above them.

- **Inverting it.** M3's **Reverse dependency**, on the contextual toolbar of the
  selected edge, one undo step. It is the only supported inversion.
  `b.flip-direction` disappears for typed edges.
- **Re-dragging an endpoint.** Unchanged and safe _gesture by gesture_: a source
  handle can only rewrite `source`, a target handle only `target`, and the
  overlay refuses to bind an end to the element already held by the other end
  (`connector-handle.ts:152-174`). Re-targeting the provider changes _what_ the
  consumer depends on; it never changes _who_ depends on whom, so no single
  re-target is an implicit inversion and none needs a confirmation. A
  three-gesture detour (detach the source, move the target onto the old source,
  reattach) does invert the edge, at unchanged geometry and with no trace — the
  reason M2 exists, and the reason M3 is the _supported_ way to do it.
- **Moving a node.** Never touches the direction. It may, from now on, produce or
  clear a W4 violation — which is the intended feedback loop.
- **Copy, paste, duplicate, undo.** Direction rides along verbatim (§ 6). A
  duplicated map is oriented exactly like its original.

## Compatibility

**The exposed corpus is one day old and unpublished.** The `role` field and the
Wardley link tool landed in `7a3458ad3` (#71, 2026-08-01); the packages are not
published (`CLAUDE.md`: "publication pending"), no host consumes them, and
nothing in the library has ever read a connector's direction (§ 7). The
`wardley:dependency` edges that exist are (a) the twelve map-template edges,
oriented correctly by construction, (b) the "Link" sample template, which is not
(§ 4), and (c) whatever was drawn in the playground since yesterday.

**The "Link" sample template is corrected in the M1–M3 slice, not grandfathered.**
It ships a `wardley:dependency` that is horizontal and bound to nothing
(`templates/index.ts:250`): a decorative stroke in a palette, typed only because
`connect` defaults to the role. A sample of a _stroke style_ makes no claim about
anything, so **the role is dropped there** — exactly as the market-glyph wiring
already does (`actions.ts:400-413`). One line, in the slice that makes the role
mean something.

The same slice **aligns the two kits' neutrality predicate**. `maps.ts:135` tests
`o.arrow`, `templates/index.ts:122` tests `opts.red` (§ 4): today a style
inconsistency, tomorrow a semantic one, since what W4 governs would depend on
which authoring helper a template borrowed. Both become one explicit flag
(`evolution: true` — the dashed red arrow is the annotation), rather than
inferring a relation's type from its colour. Kodak's red _solid_ links stay typed
dependencies, which is what they are and what their coordinates already respect.

Neither correction is load-bearing for the decision: the rule family must skip an
edge with an unbound endpoint regardless (see Consequences), because a user can
produce one at any time by releasing the link tool over empty canvas.

**Therefore: no migration, no confirmation bit, no legacy mode.** The convention
of § 2 applies to every typed edge, past and future. This is the big-bang option
and it is the honest one here — not because old data is trustworthy in principle,
but because there is no old data worth protecting and the mechanisms of § 3 land
before the first consumer.

**The window that would have needed a bit is closed by sequencing, not by a
field.** Between #71 and the M1–M3 slice, a user could draw an edge whose
direction they never chose. That window is only dangerous if something reads the
direction during it — and nothing does, because W4 ships _with_ M1–M3, never
before. On the day direction starts being read, it is also being announced,
shown and reversible.

**If the corpus turns out to matter** (a tenant that already drew maps in a
pre-release build, say), the fallback is a user-driven, per-map orientation
review built on M2 + M3 — hover the chain, reverse what is wrong — never a
silent backfill and never a persisted tri-state. Cost of that fallback: zero new
code, since M2 and M3 are the review.

## Consequences

- **W4 becomes a new rule family.** `RuleFamily` is today a single value,
  `'element-in-background'` (`validation.ts:64`). W4 needs a second one — call it
  **`relative-order-along-axis`**: given a typed edge, compare the two elements
  it links along one axis of the framework's background, in the order the edge
  states. Its declaration needs an edge role, an axis and an expected order; its
  `Violation.elementIds` indicts **more than one element** for the first time
  (the two nodes, and arguably the edge), which the shape already allows —
  `elementIds: string[]`, commented "One for wave 1's family"
  (`validation.ts:311-314`). The comment is what needs updating, not the type.
  The family also picks the `backgroundId` itself (`validation.ts:319-336`), and
  must skip two cases rather than one: a pair whose endpoints sit on two
  different maps, **and an edge at least one of whose ends is not bound to an
  element at all** (`Connection.position` without `id`). The second is not
  marginal — it is the "Link" sample template (§ 4) and it is what releasing the
  link tool over empty canvas produces (`connector-tool.ts:81-88` starts on
  `target: { position }` and `dragEnd` requires no attachment). M2 inherits the
  same guard: no label at all on a stroke that links nothing.
- **The rule engine stops being node-only.** Until now roles were read on nodes
  and the `kind: 'edge'` half of the vocabulary was declarative decoration. W4
  is the first consumer of an edge role, and the first rule whose subject is a
  _pair_. Everything else about the engine is unchanged: still declarative data,
  still versioned, still severity-overridable by a profile, still shipped with
  the flag-gated tooling (ADR 0009).
- **`b.flip-direction` becomes conditional.** A generalist connector keeps it; a
  typed edge gets Reverse dependency instead. This is a visible behaviour change
  for anyone who used the arrowhead swap on a Wardley link — acceptable, since
  that link has no arrowheads to swap and the command is already a silent no-op
  when both styles are equal (`toolbar/config.ts:281`).
- **It opens MF3's reversed reading.** Once `source → target` is a statement,
  the parent-child structure the host needs for pivot records (ADRs 0005/0006) is
  _derivable from the board_: an oriented `wardley:dependency` between two
  elements bound to pivot records is "record A depends on record B", with no
  second source of truth to keep in sync and no new field on either side. The
  drawing becomes the input to the model rather than a picture of it. That is a
  much larger claim than W4 and it is the real reason this ADR is worth a human
  signature.
- **A new framework declares a verb, not an allegiance.** Any future
  `kind: 'edge'` role (BPMN sequence flow, EDGY relations, Cynefin transitions)
  inherits tier 1 only — `source` is the subject of the role's verb — and states
  its own verb. Nothing obliges it to be a dependency, and a rule may only read
  "consumer / provider" out of an edge whose verb says so.
- **EDGY, concretely.** If `gfx/edgy` ever grows a `roles.ts`, its 24 relations
  become typed edges under tier 1 with no data change whatsoever: `source` is
  already the subject in all 24 (`['product','task','serves']` as much as
  `['process','asset','requires']`). Under the single-tier wording of the earlier
  draft, six of them would have had to declare themselves exceptions, and a
  generic rule could have read "product depends on task". The two-tier statement
  is what makes EDGY a free ride instead of a migration. Note it would also need
  the verb to move from the template fixture into the role vocabulary — today the
  verb only exists as connector label text.
- **Cost of being wrong.** If the convention is later reversed, every persisted
  typed edge must be swapped — a one-line transform over the surface map, cheap
  now, expensive after the first tenant corpus. This is precisely why the
  decision is taken before W4 and not after.

## Rejected alternatives

- **Read the direction, as-is, today (option 1).** Cheapest, and it would put a
  rule on top of data the user never authored. The first W4 warning on a
  correctly-drawn map — because the architect happened to drag upward — would
  teach them that the validator is noise. The whole validation platform's
  credibility is spent on its first false positive.
- **A `directionConfirmed?: boolean` field.** A permanent tri-state on a red-zone
  model (`GfxPrimitiveElementModel`, ADR 0005's territory) to paper over a
  one-day window, which every consumer would then have to branch on forever, and
  which would need its own UI to ever become `true`. That UI is M2 + M3 — so the
  field buys nothing the mechanisms do not already provide.
- **Derive the direction from the geometry at evaluation time.** Vacuous — the
  rule would compare the layout against itself (§ 4a). It would also make a
  dependency flip meaning when a node is dragged past another: the map would
  silently rewrite what the architect said.
- **Two roles, `wardley:depends-on` and `wardley:depended-on-by`.** Doubles the
  vocabulary, still leaves the question of which end is which, and makes
  "reverse" a role change rather than an endpoint swap.
- **A permanent arrowhead on every dependency link.** One line
  (`actions.ts:445`), and it breaks the canonical Wardley look while colliding
  with the evolution arrow's established meaning (§ 2). Rejected in favour of the
  hover/selection reveal.
- **Normalising once at `dragEnd` and persisting it.** Covered in § 4b — not
  vacuous, and rejected all the same: it replaces the user's statement with a
  snapshot of their layout, without asking.

## Test coverage this implies

- Unit: the convention as an assertion over the shipped templates — walk BOTH
  kits, and for every `wardley:dependency` whose two ends are bound, assert the
  source's visibility is strictly greater than the target's. It pins § 2 against
  the only corpus that exists and fails loudly the day someone authors a template
  backwards. The same walk asserts that no shipped typed edge has an unbound end
  — which is what keeps the "Link" sample de-typed once it has been corrected.
- Unit: Reverse dependency is an involution (apply twice = identity, endpoint
  styles included) and produces exactly one undo step. Separately: reversing a
  curved connector leaves its rendered path unchanged — the assertion that stops
  someone from "fixing" `curveControlPoint` later.
- Unit: the `relative-order-along-axis` family — a compliant pair, an inverted
  pair, a pair straddling two maps (no violation, no background), an edge with an
  unbound end (never evaluated), a pair whose edge carries no role (never
  evaluated).
- Integration: draw a link upward with the Wardley tool, assert the violation
  appears; reverse it, assert it clears. That round trip is the whole ADR in one
  spec.
