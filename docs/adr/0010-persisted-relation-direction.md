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

### 4. Authored data already obeys one convention, unanimously

Nothing enforces it, yet every hand-written fixture in the repo orients the same
way — the depender first:

- Wardley templates (`templates/maps.ts:270-278`): `link('business','cupOfTea')`,
  `link('cupOfTea','cup')`, `link('hotWater','water')`, `link('kettle','power')`.
  With `comp(evolution, visibility)` the source's visibility is strictly greater
  than the target's in every single link — `cupOfTea` 0.74 → `cup` 0.70,
  `hotWater` 0.47 → `water` 0.34, `kettle` 0.38 → `power` 0.10.
- Mindmap (`packages/affine/model/src/elements/mindmap/mindmap.ts:551-574`):
  `source = parent`, `target = child` (in-memory `LocalConnectorElementModel`
  only, never persisted).
- EDGY (`packages/affine/gfx/edgy/src/templates/index.ts:277-306`): oriented
  triplets `[subject, object, verb]` — `['process','asset','requires']`,
  `['product','capability','requires']`. `source` is the party that needs.

The convention exists. It has simply never been written down, shown, or checked.

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
  dot onto the current target is refused. The two ends can never be crossed by
  dragging.
- **Resize / mirror** (`connector.ts:353-386`) always writes `path[0]` to
  `source` and `path[last]` to `target`; there is no element-level flip command
  at all (`flipX`/`flipY` in `edgeless-selected-rect.ts:660-666` only choose a
  cursor).
- **Paste** (`edgeless/clipboard/canvas.ts:70-88`) and **duplicate**
  (`utils/clone-utils.ts:69-86`, `:137-148`) remap `source→source`,
  `target→target`. `role` rides along for free, being a declared base `@field()`.
- **Undo/redo** is plain Yjs; nothing rewrites endpoints.

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

### 2. The convention, stated once and for all

> **`source` is the consumer. `target` is what it needs.**
> An edge with role `wardley:dependency` reads **"`source` depends on `target`"**.

Corollaries, in the words each layer uses:

- Wardley: the source is the higher, more visible component; the target is the
  lower, more evolved-or-not component it rests on. **Needs descend from source
  to target; value flows back up from target to source.**
- Generic: for any future `kind: 'edge'` role, `source` is the dependent /
  subject / initiator and `target` is the dependency / object / recipient. This
  matches EDGY's triplets, mindmap's parent→child, and the shipped Wardley
  templates without changing a single byte of any of them.
- Rendering: when direction is shown, the mark sits on the **Rear/target** end —
  the same end the product default already arrows
  (`consts/connector.ts:18-20`). The arrow points at the thing depended upon.

This direction, and not its opposite, because it is the one every authored
fixture in the repo already uses (§ 4) and the one the three creation paths
already produce for the natural gesture ("start on the thing that has the need").
Choosing the reverse would invert every template on the same day.

### 3. Yet the direction of an edge drawn TODAY does not qualify

The gesture is consistent but not intentional (§ 3). Data that the user cannot
see, was never told about, and cannot correct is not a statement they made. W4
must not be built on it.

Three mechanisms turn the by-product into a statement. **W4 does not ship before
they do; they ship in one slice.**

| #   | mechanism                                                                                                                                                                                                                                                                                                                                                                                                                    | size    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| M1  | **Say it.** The Wardley link tool announces its gesture — tooltip and toolbar hint, "drag from the component that has the need to what it needs". One i18n key, one tooltip, `actions.ts` + the wardley menu.                                                                                                                                                                                                                | 0.5 d   |
| M2  | **Show it.** A typed edge reveals its orientation on hover and on selection: a chevron at the Rear end plus the role's own label (`com.labre.wardley.role.dependency`, already declared). At rest the map keeps the canonical arrowless look, so the head never collides with the evolution arrow's meaning (§ 2). Branch in the connector element renderer on "the role is an edge role", using `roleIsA` / `RoleDef.kind`. | 1.5 d   |
| M3  | **Let them fix it.** A **Reverse dependency** command on a selected typed edge: swaps `source` ↔ `target`, swaps `frontEndpointStyle` ↔ `rearEndpointStyle`, mirrors `curveControlPoint` (`connector.ts:432`), in ONE undo step. Declared in the command registry (ADR 0008) so it also reaches the palette and a shortcut. And `b.flip-direction` is hidden for role-carrying edges — on a typed edge it is a lie (§ 6).  | 1.0 d   |
|     | telemetry for the new command + tests                                                                                                                                                                                                                                                                                                                                                                                        | 0.25 d  |
|     | **total before W4 can be written**                                                                                                                                                                                                                                                                                                                                                                                           | ~3.25 d |
|     | W4 itself: new rule family, rule entry, unit + integration                                                                                                                                                                                                                                                                                                                                                                   | ~2 d    |

### 4. No normalisation of the direction from the geometry — ever

Rejected, and worth spelling out because it is the tempting shortcut: at
`dragEnd`, orient the edge so that the higher endpoint becomes the source.

It is wrong twice.

- **It makes W4 vacuous at birth.** Every fresh edge is compliant by
  construction; the rule can only ever fire after a later move. A rule whose
  truth is a function of when it was evaluated is not a rule.
- **It invents intent from an accident.** The layout at the instant of the drag
  becomes the permanent meaning of the relation. A user who wires the chain
  before arranging it gets a dependency graph decided by a transient position,
  and the subsequent, correct rearrangement is what the rule then complains
  about.

The honest behaviour is the opposite: leave the gesture's direction alone and let
W4 fire immediately when it contradicts the layout. **The violation _is_ the
affordance** — it appears the moment the edge is drawn upside-down, and its
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
  Wardley, unchanged). On hover or selection, a chevron appears at the target end
  with the role label; the reading is "this end depends on that end". A
  permanently-arrowed link is deliberately NOT adopted: on a Wardley map a head
  means evolution movement.
- **Inverting it.** M3's **Reverse dependency**, on the contextual toolbar of the
  selected edge, one undo step. It is the only supported inversion.
  `b.flip-direction` disappears for typed edges.
- **Re-dragging an endpoint.** Unchanged and safe: a source handle can only
  rewrite `source`, a target handle only `target`, and the overlay refuses to
  bind an end to the element already held by the other end
  (`connector-handle.ts:152-174`). Re-targeting the provider changes _what_ the
  consumer depends on; it never changes _who_ depends on whom. Re-targeting is
  therefore never an implicit inversion, and needs no confirmation.
- **Moving a node.** Never touches the direction. It may, from now on, produce or
  clear a W4 violation — which is the intended feedback loop.
- **Copy, paste, duplicate, undo.** Direction rides along verbatim (§ 6). A
  duplicated map is oriented exactly like its original.

## Compatibility

**The exposed corpus is one day old and unpublished.** The `role` field and the
Wardley link tool landed in `7a3458ad3` (#71, 2026-08-01); the packages are not
published (`CLAUDE.md`: "publication pending"), no host consumes them, and
nothing in the library has ever read a connector's direction (§ 7). The
`wardley:dependency` edges that exist are (a) the shipped templates, which are
oriented correctly by construction (§ 4), and (b) whatever was drawn in the
playground since yesterday.

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
  must skip a pair whose endpoints sit on two different maps.
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
- **A new framework must now choose.** Any future `kind: 'edge'` role (BPMN
  sequence flow, EDGY relations, Cynefin transitions) inherits the § 2
  convention: source = subject/initiator. A framework whose natural reading is
  the opposite must say so explicitly in its role declaration rather than quietly
  invert — and that would be a new ADR, not a local decision.
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
- **Derive the direction from the geometry.** Kills W4 (§ 4), and makes a
  dependency flip meaning when a node is dragged past another — the map would
  silently rewrite what the architect said.
- **Two roles, `wardley:depends-on` and `wardley:depended-on-by`.** Doubles the
  vocabulary, still leaves the question of which end is which, and makes
  "reverse" a role change rather than an endpoint swap.
- **A permanent arrowhead on every dependency link.** One line
  (`actions.ts:445`), and it breaks the canonical Wardley look while colliding
  with the evolution arrow's established meaning (§ 2). Rejected in favour of the
  hover/selection reveal.
- **Normalising at role stamping.** Covered in § 4 — the tempting one, and the
  one that quietly replaces the user's statement with a snapshot of their layout.

## Test coverage this implies

- Unit: the convention as an assertion over the shipped templates — for every
  `wardley:dependency` link in `templates/maps.ts`, the source's visibility is
  strictly greater than the target's. It pins § 2 against the only corpus that
  exists, and it fails loudly the day someone authors a template backwards.
- Unit: Reverse dependency is an involution (apply twice = identity, including
  endpoint styles and the curve control point) and produces exactly one undo
  step.
- Unit: the `relative-order-along-axis` family — a compliant pair, an inverted
  pair, a pair straddling two maps (no violation, no background), a pair whose
  edge carries no role (never evaluated).
- Integration: draw a link upward with the Wardley tool, assert the violation
  appears; reverse it, assert it clears. That round trip is the whole ADR in one
  spec.
