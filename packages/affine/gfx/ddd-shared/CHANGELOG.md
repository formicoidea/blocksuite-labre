# @labre/affine-gfx-ddd-shared

## 0.34.0

### Patch Changes

- Updated dependencies [881d3f5]
- Updated dependencies [6c1bdfb]
- Updated dependencies [8b00f7d]
- Updated dependencies [5f76ab3]
- Updated dependencies [f09d68c]
  - @labre/std@0.34.0
  - @labre/affine-shared@0.34.0
  - @labre/affine-block-surface@0.34.0
  - @labre/affine-widget-edgeless-toolbar@0.34.0
  - @labre/affine-gfx-group@0.34.0
  - @labre/affine-gfx-pointer@0.34.0
  - @labre/affine-gfx-template@0.34.0
  - @labre/affine-model@0.34.0
  - @labre/affine-ext-loader@0.34.0
  - @labre/global@0.34.0
  - @labre/store@0.34.0

## 0.33.0

### Minor Changes

- 48049d6: feat(edgeless): a context map is drawn on a board, and its relationships are typed

  A Context Map now has a **board** to be drawn on — a white card, deliberately
  without axes or zones, because nothing about where a bounded context sits on the
  sheet means anything. What the board is for is the frame: it is what tells the
  tool which artefacts belong to the map, and it is what a per-map level of
  requirement is written on. It is created 1400 × 900 from a new first entry in the
  Context Map palette and can be stretched freely in either direction.

  The nine **relationship patterns changed gesture**. They used to drop a little
  drawing in mid-air — a line between two points, an abbreviation tag, two letters
  — that looked like the notation and said nothing: the line was attached to
  nothing, so nobody, human or machine, could tell which contexts it related, and
  the user still had to drag both ends onto the bubbles by hand. Choosing a pattern
  now arms the link tool, pre-styled (dashed for Separate Ways and Big Ball of Mud,
  an arrowhead towards the downstream end for the five upstream/downstream ones),
  and the user draws the relationship between two contexts. For the patterns that
  have a direction the tool says which way to drag: from the upstream context to
  the downstream one.

  That is what makes the map **readable by the tool**, and five checks come with
  it. It says so when a relationship loops back onto its own context, when the same
  pattern is drawn twice between the same two contexts, when a context is parked
  off the board, and — the two that are really about DDD — when a couple carries
  both a Conformist and an Anticorruption Layer, or a Customer/Supplier plus a
  pattern that contradicts it. An Anticorruption Layer on a Customer/Supplier is
  reported more quietly, at every level of requirement, because it is a question
  and not a mistake: it is legitimate while a model is being retired, and only the
  team knows whether that is the case. Everything else stays silent — a
  relationship drawn onto a cloud, onto a note, onto anything the model has not
  named is somebody sketching.

  Two levels of requirement ship with it, **Sketch** (the default: findings are
  recorded, the canvas says nothing) and **Strict**, chosen per board from the
  board's toolbar, plus a four-point quality checklist the tool cannot judge for
  you: every relationship carries a discussed pattern, Separate Ways are
  documented, every downstream of a Big Ball of Mud is protected, the map has a
  legend.

  **Nothing already drawn changes.** Maps made before this release carry no roles,
  so not one of them is judged, and the old relationship drawings keep rendering
  exactly as they are — they are simply drawings now, and the tool has nothing to
  say about them. Redrawing one with the new tool is what makes it a statement.

- 7136db0: A Core Domain Chart is checked, and its movements are drawn as statements

  Selecting a chart now offers Validation — Sketch (the default, where every
  finding is silent and reaches a report rather than the canvas) or Strict — and
  Work quality, three expectations to tick: the chart has a legend, movements are
  dated and justified, the core has been agreed by the team.

  Four checks ship with it. An outsourced sub-domain plotted in the Core quadrant
  is a strategy contradiction and says so; a movement that does not run from a
  current position to a future one — drawn backwards, or looping onto its own
  start — is reported with both ends named; two sub-domains drawn on top of each
  other are flagged as unreadable; and a dot recoloured off the five legend
  colours is recorded as an audit finding, never as a badge. Everything else stays
  silent: a free connector, a movement onto a big bet or onto a plain shape, a dot
  on blank canvas, and any artefact drawn before today, which carries no semantic
  role and is never judged. No document is migrated and no chart is backfilled.

  "Movement over time" is now a drag rather than an arrow dropped on the canvas:
  picking it arms the connector tool, pre-styled dashed red, and you draw from
  where the context stands today to where it is heading — which is what makes the
  direction a statement the chart can read back. Arrows drawn before this change
  keep working as drawings.

  The chart's own drawing is now declared rather than coded: the same bands, the
  same axes, the same words, to the unit. The declaration also carries a second
  reading of the frame — a migration chart naming its four quadrants low-hanging
  fruit, risk-seeking, risk-averse and last toothpaste — which no rule cites and
  which has no switch in the interface yet.

- cbd9471: feat(edgeless): the three DDD boards generate the legend of what is drawn on them

  Select a **Context Map board**, an **Event Storming board** or a **Core Domain
  Chart** and its toolbar now offers a legend button. Pressing it reads what is
  actually inside the background's perimeter and drops a legend of exactly that,
  bottom-left of the board — the same gesture a Wardley map has had for a while,
  and the same result: a real, editable, movable group of elements, not an overlay.
  A board with three sticky kinds on it gets a three-row legend; add a fourth kind
  and press the button again for a legend that mentions it.

  What each board lists:

  - **Context Map** — the bounded context, and one row per relationship pattern
    drawn, with its DDD Crew abbreviation and its own line style (dashed for
    Separate Ways and Big Ball of Mud, exactly as the board draws them);
  - **Event Storming** — one row per sticky kind stuck to the board, in its own
    colour, hotspot included, plus a Flow row once an arc has been drawn;
  - **Core Domain Chart** — one row per sub-domain kind placed, in its own colour,
    one row per Team Topologies marker used, square and letter included, plus the
    red dashed Movement over time.

  The legend reads the artefacts' **semantic roles**, not their shapes and not
  their fill colours. That is what makes it agree with the validation rules — both
  read the same field — and it is what keeps a restyled sticky in the legend and an
  orange rectangle somebody drew to think with out of it.

  One consequence on the Core Domain Chart, whose legend button already existed and
  used to scan fill colours: a chart the tool recognises nothing on — every chart
  drawn before roles existed — now yields a framed, titled legend with no rows
  instead of the whole notation; a legend lists what is drawn, not what could have
  been. The five sub-domain colours it does list are the same five the palette
  draws with, by construction, and so are the three marker colours.

  Reading by role is also what finally lets the chart list its **Team Topologies
  markers** honestly. Collaboration, X-as-a-Service and Facilitating are now
  artefacts the tool recognises rather than three coloured squares, so a chart with
  a marker on it gets a "Team interaction modes" section naming the ones actually
  used — with the same letter in the same coloured square the chart draws — and a
  chart with none is not told about modes it did not use. Being recognised costs
  them nothing else: a marker is an annotation, not a sub-domain, so the overlap
  and legend-colour checks written on sub-domains still leave it alone, including
  when it is parked right against the dot it comments on.

  Every legend box is now titled **"Legend"**. The three DDD tools shipped with a
  French title on an otherwise English notation; the boxes are elements written
  into the document, so existing ones keep whatever title they were drawn with.

  The **Context Map palette keeps its own Legend entry**, which still lays out the
  full notation, cloud included. The two gestures answer two
  different questions — "what does this notation mean" and "what did we actually
  draw here" — so that module deliberately has both. The cloud is the one artefact
  the automatic legend cannot mention: it carries no role, on purpose, because a
  relationship drawn onto one is a sketch the tool stays silent about.

  Every legend button is available with its framework's button switched off: a
  legend is elements written into the document, not tooling.

- 168617d: feat(edgeless): an event storming board carries a timeline, and its flows are typed

  Event Storming now has a **board** to be stormed on — a wide white roll, 3200 ×
  1400, freely stretchable in either direction — and it carries the one thing the
  method actually has a frame of reference for: a **time axis** along the bottom,
  running left to right. Nothing else is graduated, on purpose. How high a sticky
  sits on the wall means nothing, and drawing lanes to suggest it did would invent
  a meaning the framework does not have; swimlanes are deliberately left for a
  later release rather than half-shipped. The board is created from a new first
  entry in the Event Storming palette. The axis is drawn **heavy, and labelled
  big**: the word "Time" is set large enough to be read at the zoom where a whole
  3200-wide Big Picture fits on screen, which is the zoom a Big Picture is
  actually looked at. It is the only thing the board declares, and it should not
  be the smallest thing on it.

  The palette also gains the **Aggregate**, the pale-yellow sticky a command lands
  on and the thing that raises the event. Without it the canonical sentence —
  command, aggregate, domain event — could not be drawn at all. It is created
  larger than the others, as it is on a real wall, and in a paler yellow chosen so
  that the three yellows of the notation (constraint, actor, aggregate) can be told
  apart at a glance rather than only by position.

  **Flow changed gesture.** It used to drop a little arrow in mid-air, attached to
  nothing: it looked like the notation and said nothing, and the user still had to
  drag both ends onto the stickies by hand. Choosing Flow now arms the link tool
  and says which way to drag — from what happens first to what follows — and the
  arc the user draws references the two stickies for real.

  That is what makes the wall **readable by the tool**, and three checks come with
  it. It says so when a flow runs backwards along the timeline, when an arc is not
  one of the nine sentences Event Storming says (an actor issues a command; the
  command lands on an aggregate or an external system; that raises a domain event;
  the event triggers a policy or feeds a read model), and when two stickies cover
  each other badly enough to hide a word. Everything else stays silent: an arrow
  drawn at a **hotspot** or a constraint is somebody parking a question, not making
  a claim, and the tool has nothing to say about it — nor about an arc onto a note,
  onto a plain rectangle, or onto anything the model has not named. Two flows drawn
  between the same two stickies are not reported either: a wall gets a line drawn
  twice while three people talk at once.

  There is deliberately **no check on how stickies are named**. "Order placed"
  versus "Place order" is the first thing a facilitator corrects and the most
  tempting rule of the lot — and reading marker-pen prose in whatever language the
  room speaks is not something a tool can do without being wrong every fifth
  sticky. It is a checklist item instead, beside four others the tool cannot judge
  for you: the timeline has been read out loud and reordered, every hotspot has
  been discussed, the actors and external systems are identified, the pivotal
  events are marked.

  Three levels of requirement ship with it, chosen per board from the board's own
  toolbar, because Event Storming is not one activity but three. **Big Picture
  (Sketch)** (the default) says nothing at all — a Big Picture is supposed to be
  chaotic, and a tool arguing with that hand is judging one stage of the workshop
  by the criteria of a later one. **Process modelling** turns on the timeline and
  only the timeline: that stage is about ordering the frieze, and the kinds are
  still being settled. **Software design** turns on all three.

  **Nothing already drawn changes.** Walls stormed before this release carry no
  roles, so not one of them is judged, and the old flow arrows keep rendering
  exactly as they are — they are simply drawings now. Redrawing one with the new
  tool is what makes it a statement.

### Patch Changes

- 7ec4478: Senior button components resolve their own label through the translation seam

  The toolbar's navigation tooltips learned to translate a senior tool's
  `labelKey`, but the seven framework senior-button components still carried
  their label as a hard-coded English string. Each button now resolves the same
  `com.labre.framework.<id>` key through `translateKey`, with the previous
  English wording as fallback — so a host catalogue that already translates the
  toolbar translates the buttons too, and a standalone playground reads exactly
  as before.

- Updated dependencies [3fbf69c]
- Updated dependencies [f929e12]
- Updated dependencies [13360cd]
- Updated dependencies [5c39582]
- Updated dependencies [8890efe]
- Updated dependencies [c03090c]
- Updated dependencies [32e4d45]
- Updated dependencies [139d77b]
- Updated dependencies [6bba40c]
- Updated dependencies [a8325bb]
- Updated dependencies [ff19911]
- Updated dependencies [7aa932c]
- Updated dependencies [b03132c]
- Updated dependencies [48049d6]
- Updated dependencies [7136db0]
- Updated dependencies [932bf35]
- Updated dependencies [5737a56]
- Updated dependencies [168617d]
- Updated dependencies [932bf35]
- Updated dependencies [9022c92]
- Updated dependencies [b97efc6]
- Updated dependencies [edfaba2]
- Updated dependencies [46ce0c9]
- Updated dependencies [334bd61]
- Updated dependencies [2ec39c0]
- Updated dependencies [a9eb4f6]
- Updated dependencies [e42e0c0]
- Updated dependencies [256ee0b]
- Updated dependencies [4a3b26e]
- Updated dependencies [48c3b52]
- Updated dependencies [6a20738]
- Updated dependencies [f09f9a3]
  - @labre/affine-block-surface@0.33.0
  - @labre/affine-shared@0.33.0
  - @labre/affine-model@0.33.0
  - @labre/std@0.33.0
  - @labre/affine-widget-edgeless-toolbar@0.33.0
  - @labre/affine-gfx-group@0.33.0
  - @labre/affine-gfx-pointer@0.33.0
  - @labre/affine-gfx-template@0.33.0
  - @labre/affine-ext-loader@0.33.0
  - @labre/global@0.33.0
  - @labre/store@0.33.0

## 0.32.0

### Patch Changes

- Updated dependencies [832c793]
- Updated dependencies [c5c07b9]
- Updated dependencies [a2b7c44]
- Updated dependencies [ff5f060]
- Updated dependencies [1b59f3c]
- Updated dependencies [41ab595]
- Updated dependencies [0bfc872]
- Updated dependencies [9e23b5b]
- Updated dependencies [a3aa598]
- Updated dependencies [6417a2f]
- Updated dependencies [d797f9a]
- Updated dependencies [9fde974]
- Updated dependencies [50ab9ae]
- Updated dependencies [89b90e9]
- Updated dependencies [463989f]
- Updated dependencies [f7f23b2]
- Updated dependencies [751ac44]
- Updated dependencies [54488cd]
- Updated dependencies [9453013]
- Updated dependencies [b746d6b]
- Updated dependencies [5ac0c68]
- Updated dependencies [630633b]
- Updated dependencies [1fa46c1]
- Updated dependencies [0473dcb]
- Updated dependencies [5b6e9bb]
- Updated dependencies [86e7562]
- Updated dependencies [492bac6]
- Updated dependencies [30580db]
- Updated dependencies [08e9b24]
- Updated dependencies [5076cb8]
- Updated dependencies [3c5c97e]
- Updated dependencies [19edf48]
- Updated dependencies [69cdc3d]
- Updated dependencies [7c10406]
- Updated dependencies [02797b5]
- Updated dependencies [413fe7b]
- Updated dependencies [724ed1c]
- Updated dependencies [3e1665b]
- Updated dependencies [0ddfd47]
- Updated dependencies [3639562]
- Updated dependencies [5d16745]
- Updated dependencies [1c37478]
- Updated dependencies [48e90f4]
- Updated dependencies [0991104]
- Updated dependencies [5edd916]
- Updated dependencies [5a16359]
- Updated dependencies [025d6f5]
- Updated dependencies [b1ed4ef]
- Updated dependencies [985a92f]
- Updated dependencies [b889326]
- Updated dependencies [1efc6d5]
- Updated dependencies [4162e4a]
- Updated dependencies [3ac3587]
- Updated dependencies [fad4c08]
- Updated dependencies [7b940cf]
- Updated dependencies [7b66d8d]
- Updated dependencies [184c412]
- Updated dependencies [4bb44ef]
- Updated dependencies [30061cb]
- Updated dependencies [c2735aa]
- Updated dependencies [346b5d9]
- Updated dependencies [77b0100]
- Updated dependencies [8d33c60]
- Updated dependencies [061729e]
- Updated dependencies [7a3458a]
  - @labre/std@0.32.0
  - @labre/affine-shared@0.32.0
  - @labre/store@0.32.0
  - @labre/affine-gfx-template@0.32.0
  - @labre/affine-model@0.32.0
  - @labre/affine-block-surface@0.32.0
  - @labre/affine-gfx-group@0.32.0
  - @labre/global@0.32.0
  - @labre/affine-gfx-pointer@0.32.0
  - @labre/affine-widget-edgeless-toolbar@0.32.0
  - @labre/affine-ext-loader@0.32.0

## 0.31.0

### Patch Changes

- Updated dependencies [6a663b6]
  - @labre/store@0.31.0
  - @labre/affine-block-surface@0.31.0
  - @labre/affine-ext-loader@0.31.0
  - @labre/affine-gfx-group@0.31.0
  - @labre/affine-gfx-pointer@0.31.0
  - @labre/affine-gfx-template@0.31.0
  - @labre/affine-model@0.31.0
  - @labre/affine-shared@0.31.0
  - @labre/std@0.31.0
  - @labre/affine-widget-edgeless-toolbar@0.31.0
  - @labre/global@0.31.0

## 0.30.2

### Patch Changes

- @labre/affine-block-surface@0.30.2
- @labre/affine-ext-loader@0.30.2
- @labre/affine-gfx-group@0.30.2
- @labre/affine-gfx-pointer@0.30.2
- @labre/affine-gfx-template@0.30.2
- @labre/affine-model@0.30.2
- @labre/affine-shared@0.30.2
- @labre/affine-widget-edgeless-toolbar@0.30.2
- @labre/global@0.30.2
- @labre/std@0.30.2
- @labre/store@0.30.2

## 0.30.1

### Patch Changes

- @labre/affine-block-surface@0.30.1
- @labre/affine-ext-loader@0.30.1
- @labre/affine-gfx-group@0.30.1
- @labre/affine-gfx-pointer@0.30.1
- @labre/affine-gfx-template@0.30.1
- @labre/affine-model@0.30.1
- @labre/affine-shared@0.30.1
- @labre/affine-widget-edgeless-toolbar@0.30.1
- @labre/global@0.30.1
- @labre/std@0.30.1
- @labre/store@0.30.1

## 0.30.0

### Minor Changes

- ecba791: Per-framework text-fit defaults. Event Storming stickies and Context Map
  bubbles now carry their label as the shape's own text (contained /
  overflow fit) instead of a separate grouped text element — double-click
  edits in place and the box never deforms; previously created prefabs keep
  their old structure and keep working. Estuarine hexi constraints default
  to contained; BPMN nodes and the Wardley inertia bar default to overflow.

### Patch Changes

- Updated dependencies [9d0fe0c]
- Updated dependencies [ecba791]
- Updated dependencies [8de86f4]
  - @labre/std@0.30.0
  - @labre/affine-model@0.30.0
  - @labre/affine-block-surface@0.30.0
  - @labre/affine-gfx-group@0.30.0
  - @labre/affine-gfx-pointer@0.30.0
  - @labre/affine-gfx-template@0.30.0
  - @labre/affine-shared@0.30.0
  - @labre/affine-widget-edgeless-toolbar@0.30.0
  - @labre/affine-ext-loader@0.30.0
  - @labre/global@0.30.0
  - @labre/store@0.30.0

## 0.29.1

### Patch Changes

- @labre/affine-block-surface@0.29.1
- @labre/affine-ext-loader@0.29.1
- @labre/affine-gfx-group@0.29.1
- @labre/affine-gfx-pointer@0.29.1
- @labre/affine-gfx-template@0.29.1
- @labre/affine-model@0.29.1
- @labre/affine-shared@0.29.1
- @labre/affine-widget-edgeless-toolbar@0.29.1
- @labre/global@0.29.1
- @labre/std@0.29.1
- @labre/store@0.29.1

## 0.29.0

### Patch Changes

- Updated dependencies [7375b9a]
- Updated dependencies [9330750]
  - @labre/affine-shared@0.29.0
  - @labre/std@0.29.0
  - @labre/affine-block-surface@0.29.0
  - @labre/affine-gfx-group@0.29.0
  - @labre/affine-gfx-pointer@0.29.0
  - @labre/affine-gfx-template@0.29.0
  - @labre/affine-widget-edgeless-toolbar@0.29.0
  - @labre/affine-model@0.29.0
  - @labre/affine-ext-loader@0.29.0
  - @labre/global@0.29.0
  - @labre/store@0.29.0

## 0.28.0

### Patch Changes

- Updated dependencies [65cc055]
  - @labre/std@0.28.0
  - @labre/affine-block-surface@0.28.0
  - @labre/affine-gfx-group@0.28.0
  - @labre/affine-gfx-pointer@0.28.0
  - @labre/affine-gfx-template@0.28.0
  - @labre/affine-model@0.28.0
  - @labre/affine-shared@0.28.0
  - @labre/affine-widget-edgeless-toolbar@0.28.0
  - @labre/affine-ext-loader@0.28.0
  - @labre/global@0.28.0
  - @labre/store@0.28.0

## 0.27.0

### Patch Changes

- Updated dependencies [91f6397]
  - @labre/std@0.27.0
  - @labre/affine-block-surface@0.27.0
  - @labre/affine-gfx-group@0.27.0
  - @labre/affine-gfx-pointer@0.27.0
  - @labre/affine-gfx-template@0.27.0
  - @labre/affine-model@0.27.0
  - @labre/affine-shared@0.27.0
  - @labre/affine-widget-edgeless-toolbar@0.27.0
  - @labre/affine-ext-loader@0.27.0
  - @labre/global@0.27.0
  - @labre/store@0.27.0
