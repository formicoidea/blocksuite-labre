# @labre/affine-model

## 0.34.1

### Patch Changes

- 6120f7a: fix(edgeless): a framework background is picked by its border, not its whole area

  Framework backgrounds and boards hit-tested their entire rectangle, so they
  competed with their own content for every click. A board created after the
  shapes it covers sits above them in the paint order and swallowed 100% of the
  clicks on those shapes; one sitting below filled every gap the content left —
  the interior of an unfilled shape, the space beside a small node — which is
  where the "one time in two" came from. Eleven element types were affected: the
  BPMN pool, both C4 frames, the event-storming board, the core domain chart, the
  Wardley background and the context-map board (subclasses of the
  framework-background primitive), plus the EDGY board, the EDGY facets diagram,
  Cynefin and Estuarine (standalone implementations of the same geometry).

  A background is now selected by a band along its border, ten screen pixels wide
  and adjusted for the zoom like every shape's stroke, with two carve-outs:

  - a **BPMN pool** keeps its title bands clickable — the participant strip on the
    left and the lane strip beside it — which is the bpmn.io convention and the
    only part of a pool that is the pool rather than the process drawn on it;
  - **editable label zones** (Wardley axis titles, EDGY facet names, C4 board and
    boundary names) still receive the double-click that renames them, and a BPMN
    pool's lane separators still receive the drag that moves them. Pointer events
    now reach a view through the VIEW's `includesPoint` rather than the model's —
    it delegates to the model by default, so nothing else changes — which is what
    lets a framework declare its own gesture zones beside the code that draws
    them.

  The lasso (`containsBound` / `intersectsBound`) is untouched, and a selected
  background is still dragged from anywhere inside it: the drag path asks about
  the element's visible extent (`ignoreTransparent: false`), which the interior
  still answers, exactly as an unfilled shape does.

- cb49bb1: fix(edgeless): the edgy venn stops hosting the spotlight — board logic lives on
  the edgy board

  The EDGY "Enterprise Design Facets" Venn (`edgy`) was registered as a
  spotlight host alongside the EDGY board (`edgyBoard`), so any element laid
  inside its circles got the hover spotlight: hovering one faded everything else
  on the diagram. That is board logic on a drawing. The Venn frames a notation;
  it does not host a dependency reading.

  `SpotlightHostExtension('edgy')` is gone and the "Enable / disable hover
  spotlight" toggle has left the Venn's contextual toolbar. The board keeps both,
  unchanged. The Venn keeps its appearance toggles — labels, pictos, crop,
  resize — plus its legend, which moves from `d.legend` to `c.legend` now that
  the row is one shorter.

  `spotlightEnabled` STAYS on `EdgyFacetsElementModel`: documents written before
  this change carry the property and must stay loadable. It is simply inert —
  nothing reads it on a Venn any more.

  The host lookup `SpotlightManager` runs on every pointermove is now the
  exported pure `findSpotlightHost(target, elements, hostTypes)`, so the rule a
  Venn grants nothing and a board grants is pinned by a unit test rather than by
  a DI registration read by eye.

  Refs #195

- Updated dependencies [6120f7a]
  - @labre/std@0.34.1
  - @labre/global@0.34.1
  - @labre/store@0.34.1

## 0.34.0

### Patch Changes

- Updated dependencies [881d3f5]
- Updated dependencies [8b00f7d]
- Updated dependencies [5f76ab3]
  - @labre/std@0.34.0
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

- f929e12: a c4 board declares its level, and the view polices it

  C4's levels are not only zooms of an element — they are DIAGRAM TYPES, and each
  one is defined by what appears on it. Until now the canvas had no way to say
  which of them a sheet was: the board's title is free text, so a board called
  "Payments" said nothing about whether it showed the system's context, its
  containers or its components. Every level rule had to guess the level from what
  happened to be drawn, and the level skip that is easiest to draw — a system
  boundary full of components with no container boundary anywhere — was invisible
  to the whole pack, as `c4.component-level-skip` documented at length.

  A C4 board now carries an optional **level**, set from a small dropdown on the
  selected board: Free sketch (the default), then the four C's the notation is
  named after — Context, Containers, Components, Code. It is a declared fact
  sitting beside the title, not a rename — the author keeps whatever words they
  wrote — and choosing Free sketch clears it again, so a board that never states
  one is byte-identical to every C4 board drawn before today.

  Two rules read it, citing C4's diagram types:

  - **a context diagram** draws systems as boxes, with the people and neighbouring
    systems around them. Containers, components and boundaries have no place on
    one;
  - **a container diagram** draws one system's containers inside its system
    boundary. Components and container boundaries belong on the next sheet down.

  Persons, systems, the containers themselves and the system boundary stay legal
  throughout: C4 draws its neighbours at every level, and the rules refuse only
  what the notation actually refuses. Two of the four levels declare no rule at
  all — a component diagram legitimately shows everything C4 names, and a code
  diagram is a level this pack cannot yet speak about, since the editor draws no
  code-level artefact. Both are still an author's to declare: what a sheet may say
  about itself is the notation's business, not this editor's. Both rules are
  remarks on Sketch and warnings once the board is set to Review checklist, which
  now promotes eleven of the sixteen rules — and a board that declares no level is
  silent under both, so no diagram already drawn gains a finding.

  Under it, the engine gains a generic **`view-admissibility`** family: a rule
  names the prop a frame writes its level in, plus the roles each level value does
  not admit. Nothing in it knows C4 — the prop name and the levels are the rule's
  own data — so any framework whose views come in kinds can ask the same question.
  It is the first family whose subject is the sheet rather than an artefact, it
  walks the surface once, and a frame that declares no level costs it nothing.

- c03090c: feat(edgeless): the BPMN pack draws the whole descriptive profile

  The BPMN pack knew four artefacts: a start event, an end event, a task and an
  exclusive gateway. That is enough to draw a diagram and not enough to draw a
  PROCESS — the moment an architect has to say what starts the thing, who does the
  work, what the parallel branch is, or which system of record it writes to, they
  were drawing rectangles and explaining them in a meeting. Seventeen artefacts now
  ship: the **descriptive conformance subclass** of BPMN 2.0, which is the subset
  the standard itself defines for people who model processes rather than execute
  them.

  What arrives: the **message** and **timer** starts and the **message** and
  **terminate** ends; the **user** and **service** tasks, the collapsed
  **sub-process** and the **call activity**; the **parallel gateway**; the three
  artefacts a process needs to point at things outside itself — the **data
  object**, the **data store** and the **text annotation**; and the **group**.

  The group is the one that is not a node at all. It is a lasso: a dashed grey
  rectangle drawn AROUND part of the picture, to say "this much of it is the
  returns process" without claiming any of it. The spec exempts it from every
  connection and containment rule there is — it attaches to no flow, it is not
  bounded by the pool it overlaps, and it may straddle several at once — and it
  behaves that way here because it has no fill: it is grabbed by its border and
  its name, so it never steals a click from the work inside it, and the work
  inside it never becomes its content. Its label sits in the top-left corner
  rather than the middle, for the obvious reason.

  Each is drawn the way the notation draws it, and each is drawn ON the shape it
  already was: a message start is the same thin green ring with an envelope in it,
  a user task the same rounded rectangle with a person in its corner, a call
  activity the same rectangle with the border thickened to say "this stands for a
  whole process defined somewhere else". Nothing was re-skinned, so a process drawn
  last month sits beside one drawn today and they are the same picture.

  Two deliberate simplifications against the reference rendering, both noted in the
  code: a message END event's envelope is drawn hollow rather than solid — the
  thick red ring already says it is an end, and it says it from further away — and
  the timer has no hour ticks. An expanded (drilled-into) sub-process is not here
  either: `subProcess` is the collapsed representation, the `+` box, because an
  expanded one is a container with its own flow inside it and that is a different
  feature.

  **Fifteen roles** join the vocabulary underneath the families that were declared
  for exactly this — the message and timer starts under `bpmn:start-event`, the
  user and service tasks under `bpmn:task`, the parallel gateway under
  `bpmn:gateway` — so everything already written about "an event" or "an activity"
  keeps applying, unchanged, to artefacts that did not exist when it was written.

  Two of them sit outside every family that existed. **`bpmn:data`** is a new
  family of its own — the paperwork is not the work, and a rule about what a
  process DOES must never reach a data store. **`bpmn:text-annotation`** and
  **`bpmn:group`** are families of one, parent-less and childless, because
  commentary is never evidence and a lasso is not a thing the process does — and
  because a parent anywhere in the tree would have inherited the group exactly the
  containment rules the spec exempts it from. And one new edge role,
  **`bpmn:association`**, is the only one in this library
  with no verb at all: "this note is about that task" reads the same from either
  end, so it has no direction to be wrong about and none to fix.

  **Nothing already drawn changes.** The new artefacts are new VALUES of the field
  every BPMN node already carries — no schema change, no migration, no backfill. A
  process authored before this release loads byte for byte and paints exactly as it
  did.

  The palette entries, shortcuts and templates for the thirteen new artefacts
  follow in the next release; this one is the model, the vocabulary and the
  rendering.

- 139d77b: refactor(edgeless): the BPMN pool is a declared framework background

  The pool was the last background in the library still drawn by hand: ninety
  lines of canvas code, and a model class that restated the five geometry answers
  every other background inherits. It is now an **instantiation of the
  framework-background primitive**, declared as data in `background.ts` like the
  Wardley map, the Core Domain Chart and the Event Storming board before it.

  One thing changes on screen, and it was asked for: **a pool now paints an opaque
  white card**, like every other framework background. It used to be transparent
  — a decision taken at the red-zone review of 26/08/2026, on the ground that a
  pool IS a map background, and a board where one framework's backdrop is
  see-through and every other one is not reads as a bug. A pool dropped over
  strokes already on the canvas covers them, exactly as a Wardley map dropped over
  them always has; sending the background to the back is the answer in both cases.

  Everything else is reproduced operation for operation — the frame, its rounded
  corners, the filled name band, the divider and the participant name rotated up
  the band — and pinned by a fidelity suite that asserts every literal the deleted
  renderer used to emit. Three further differences are known and recorded there,
  none of them visible: the divider is stroked before the frame instead of after
  (same ink, same width), a `lineJoin` that had nothing to act on is no longer
  set, and the participant name is no longer hidden on a pool narrower than twelve
  model units — a pool narrower than one character of its own name.

  The primitive gains the one concept the pool needed: **side bands**, a filled
  strip painted over a margin, with its own divider and its own label. A band has
  no width of its own — it IS the margin it covers — and it belongs to the card,
  painted over the card's fill and under its border so the frame keeps outlining
  the whole element. A text can now also declare a `middle` baseline, which is
  what centres a name across a band rather than sitting it on a line inside one.

  **Assumed behaviour change: a frame no longer adopts a pool.** Frames have
  excluded framework backgrounds since PF2 — a backdrop the frame was drawn on top
  of would be permanently buried behind its own child — and the pool, now one of
  them, joins that rule. Drawing a frame over a lane groups the flow objects
  inside it and leaves the lane where it is, which is what already happens on a
  Wardley map, a Core Domain Chart and a Context Map board.

  **No document changes.** The persisted element type is still `bpmnPool` and its
  props are still the four it has always written (`name`, `resizeEnabled`,
  `rotate`, `xywh`), with the same defaults, in the same order. A pool authored
  before this change opens, round-trips and paints identically.

- 6bba40c: feat(blocks): a BPMN pool carries its lanes

  A pool can now be divided into lanes (couloirs). "Add lane" and "Remove lane"
  sit on the pool's own toolbar; each lane wears a title band down its leading
  edge, inside the participant's own, with its name turned on its side — the way
  BPMN 2.0 draws a lane. Double-clicking a title band renames what is written in
  it, and the separator between two lanes is dragged to give one of them more
  room. The lanes are DATA on the pool — how many there are, what they are called
  and how the height is shared between them — so the background primitive paints
  them and the audit reports an element's lane the same way it reports any other
  zone.

  A new lane arrives named `Lane 1`, `Lane 2`, and so on: a plain string written
  into the document, exactly like the pool's own `Pool` default, and yours to
  rewrite immediately. It is what makes the first "Add lane" click visible — a
  titled band appears on a pool that had none.

  The title band is chrome INSIDE the lane, not a gutter beside it: an element
  dropped on a lane's band is in that lane, and naming a lane does not shrink its
  share of the pool.

  Renaming is now zoned. A double-click renames the band it landed in — the
  participant in the pool's own strip, a lane in that lane's — and does nothing
  on open canvas. Previously a double-click anywhere on the pool renamed the
  participant, which with a name per lane would have made the flow area a
  rename target for the one name that is not written there. The `text` cursor
  over either band is what says where the names are.

  The framework-background primitive grew the band placement to make this
  possible (`BackgroundInstanceZonesDef.label.band`). It is purely additive: a
  framework that declares no band keeps the corner placement it had, unchanged
  down to the painting operation.

  Nothing changes for a pool that has none. `lanes` is an optional field with no
  default, so no key is written until the first lane exists: a document authored
  before this release opens and paints byte for byte as it did, with no migration
  and no schema version bump. Removing the last lane takes the key back out
  rather than leaving an empty array, so a pool returns to exactly the bytes it
  had. In the other direction, a pool WITH lanes opened by an older build keeps
  them: unknown element props are preserved verbatim (#73), so the lanes survive
  the round trip and are still there when the newer build opens the document
  again.

  Removing a lane moves nothing. An element is in a lane because its centre falls
  in that band, so the lane below simply grows over whatever was drawn in the one
  that went — nothing on the canvas jumps, and the sequence flows still land
  where they were drawn.

  The band placement, the default names and the zoned renaming all come from the
  PO's visual recette of 2026-08-26, which replaced a first pass that wrote each
  lane name across the lane's top-left corner.

- a8325bb: feat(edgeless): a c4 component is the shape and its own text, grouped

  The PO's recette rejected the mechanism the last change shipped, and it was
  right to: an element's technology and its description were typed into a
  "Details" popover on the toolbar and painted back onto the box by the renderer.
  Two lines of the notation that an architect could read and never write on. On a
  whiteboard you write on the picture.

  **So a C4 element is now five elements that behave as one.** The shape, which
  carries no text at all; a canvas text holding the NAME; one holding the type
  line — `[Person]`, `[Container: Java and Spring MVC]`; one holding the
  description; and a group joining the four. One click selects the whole component
  and moves, copies or deletes it as one thing. A double-click opens the ordinary
  in-place editor on whichever line is under the pointer — the same gesture, the
  same editor and the same toolbar as any other words on the canvas, for all three
  of them. There is no form left anywhere in the pack, and no second kind of text.

  Double-clicking the BODY of the shape edits the name, which is what everybody's
  hand does anyway: the gesture is routed to the name's own editor rather than
  opening the shape's, so an element can never grow an invisible second name under
  its real one.

  **All three tiers exist from the moment you draw one**, carrying the official
  stencil's own prompts: the kind's label as the name, `[Container: technology]`
  under it and `description` under that. You meet three lines of stencil and
  overwrite what you have something to say about, rather than a bare box and three
  invisible slots somebody has to tell you about. A prompt is not a value: an
  element whose tiers are untouched exports as `Container(alias, "Container")`,
  not as one built with a technology called "technology". The NAME is the
  exception and goes out verbatim — an unnamed container really is a container,
  and saying so beats printing `?`.

  **Elements are taller, because the words now need the room.** A default box goes
  from 212.6 × 148.8 to **212.6 × 172.8**, and a person from 212.6 × 244.4 to
  **212.6 × 268.3**. The width is untouched — every glyph is proportioned off it,
  a person's head included. The height is no longer the stencil's textRect but the
  sum of what the box actually holds: a margin, two lines for the name, a small
  gap, the type line, a wider gap, two lines for the description, the same margin
  again. Two lines for the name is what drove the growth: "Internet Banking
  System" does not fit on one at this size, and it should not have to. Change a
  tier's size or a gap and the footprint follows, so a box can never disagree with
  its own contents. **Existing elements keep the size they were drawn at.**

  **The type line stays half the notation's.** Which of the four levels a box is,
  is the diagram's business — it comes from the element's kind, which is what the
  picture paints — so the bracketed word is rewritten from the kind whenever you
  finish editing the line, and only the TECHNOLOGY is kept. Type `Java` into a
  container's type line and it becomes `[Container: Java]`; type
  `[Person: Java]` and it still becomes `[Container: Java]`; clear it and it
  becomes `[Container]`. The rewrite happens when the editor closes, never while
  you are typing, and it is one undo away.

  The reading is deliberately forgiving, because you are typing on a picture and
  not filling in a field: a line left as `Container: Java`, as `Java`, or split
  over two lines all state the same technology. A colon that is not the notation's
  is left alone — an author whose technology is `https://internal/docs` gets to
  keep it.

  **The two removed model fields.** `technology` and `description` are gone from
  the C4 node's schema: they were added in the previous change, never released,
  and are now written on the canvas instead. Nothing in any document is migrated
  or lost — a node that never stated one wrote no key for it, which is exactly why
  they could be added without a schema bump and why they can be removed the same
  way.

  **The mermaid export says exactly what it said before**, byte for byte on the
  same diagram: the name, the technology and the description all come out of the
  words the author typed, resolved through the group and the role each text
  carries. Which text belongs to which box is answered by the GROUP, and which of
  a component's texts is the name by its ROLE — never by the order the elements
  happen to sit in, so reordering, copying or regrouping cannot swap one
  architect's technology onto another's box.

  Four behaviours worth knowing, all of them pinned:

  - an element drawn **before this change** keeps its name in the shape's own
    text, which is where the previous iteration put it, and the export reads it
    from there. Nothing is migrated or rewritten, and double-clicking such an
    element still opens the editor its name is actually in;
  - an **ungrouped** element — one whose group was released, or whose texts were
    deleted — exports with no name, no technology and no description. It is still
    a C4 element, the role being on the shape, and nothing is invented for it;
  - a **relationship dropped on the component** rather than exactly on its shape —
    on the group, or on one of the two lines of words — is written against the
    shape all the same. All four parts accept a connector and all four look like
    the same box on the canvas, so without this every such arrow would have
    vanished from the exported file with no sign that it had;
  - a group holding **two** C4 elements speaks for neither. That is a lasso drawn
    round two boxes, and an arrow landing on it points at nothing in particular.

  The node renderer no longer paints any text at all: the glyphs — the person, the
  cylinder, the phone, the browser window — are untouched, and every word on a
  component is a real element.

- ff19911: feat(edgeless): c4 nodes carry their name, type and description, and every node edits its text

  Three things the PO's recette asked for, on the C4 pack.

  **Every node now edits its text.** A person, a database, a mobile app and a web
  browser are drawn by their glyph rather than by a native rectangle, so the shape
  underneath them is created unfilled — and an unfilled shape is hit only near its
  border and on the few characters of its own label. The body you could plainly
  see was not a target: double-clicking it opened nothing, and dragging or
  selecting from the middle missed too. A C4 element is a BOX and its whole area
  belongs to it, so it now says so, whatever its fill. Nothing is stored and
  nothing is migrated: a diagram drawn last week behaves the same way the moment
  it is opened.

  **Nodes carry three tiers, as the notation does.** The name is the shape's own
  inner text, edited in place on a double-click. Under it the type line —
  `[Person]`, `[Software System]`, `[Container: Java]` — whose bracketed word says
  what the element is and can therefore never disagree with the picture; and under
  that the author's description. How those two are edited changed again before
  release, in the very next entry: they are canvas text you write on directly, not
  a popover, and the model carries no field for either.

  The type wording follows the official stencil, including the one entry that
  looks like a mistake: a **database says `[Container: technology]`**, not
  `[Database: …]`. A database is a container and the cylinder is a picture of one,
  not a fourth level. The mermaid export still writes `ContainerDb` — a different
  question in a different grammar. An external element says the same word as the
  kind it is external to; what "external" changes is the colour.

  **The mermaid export carries them.** `Person(alias, "name", "description")`,
  `Container(alias, "name", "technology", "description")`, and — the case worth
  knowing — `ContainerDb(alias, "name", "", "description")` when there is a
  description and no technology: those arguments are positional, and a sentence
  written in the technology's slot would be read as the technology. An author's own
  technology now wins over the default a phone or a browser window carries. A
  technology typed on a person is drawn on the canvas and does not survive the
  export, because mermaid's `Person` has no slot for one.

  **The glyphs are redrawn against the reference stencil**, path by path, from the
  PO's own model file rather than from memory. The person is a circular head about
  half the box wide, its top flush with the element, fused into a strongly rounded
  body — one silhouette, not a disc parked over a block. The phone and the browser
  window are no longer a band painted over a coloured box: their outer rectangle
  is the darker colour — the bezel, the frame — with a lighter screen inset in it,
  a home button and a speaker slot on the one, three dots and an address bar on
  the other. The four boxed levels lose their rounded corners, because the stencil
  draws them square. Every border is the stencil's own darker shade of its fill
  rather than one darkened by eye, which is what makes the two devices read at all.

  **Sizes change.** Seven of the nine kinds now share one footprint — 212 × 148,
  the stencil's single repeated box at ×2 — so a row of elements lines up without
  anybody arranging them. The two people are 212 × 244, and that is the stencil's
  own exception rather than a preference: its person path puts the head clear
  above a body that is itself the standard height, and its sheet shifts the person
  down the page to make room. Squeezing that into the shared box would turn the
  head into a flat ellipse, which is the one thing about a C4 person everybody
  recognises. **Existing nodes keep the size they were drawn at** — this is a
  creation-time default, like every other value here.

  Boundaries and relationships pick up the stencil's own line work too: both are
  drawn in one neutral grey at the stencil's weights and dashes, and a boundary's
  corners are square. A boundary now writes its level under its name —
  `[Software System]` or `[Container]` — derived from the variant, so a boundary
  drawn before this change gets its line as well. That line is vocabulary rather
  than the author's words: it goes through the host's catalogue like every other
  piece of framework wording, and the in-place editor still opens on the name and
  only the name.

  One limit, stated rather than worked around: the relationship's label is drawn
  by the connector primitive, which has no white background pill of the kind the
  stencil puts behind "Uses [technology]". The line, its dash, its weight, its
  grey and its filled arrowhead all match; the label sits on the diagram.

- 4a3b26e: feat(edgeless): the C4 pack draws people, systems, containers and boundaries

  C4 is the notation an architect reaches for when somebody asks "what IS this
  system" — four levels, drawn one zoom at a time: the people and systems around
  it, the containers it is made of, the components inside one of those. Until now
  it was drawn here with rectangles and explained in a meeting. The pack now ships
  its model, its vocabulary and its rendering.

  **Nine artefacts.** A **person** and an **external person**, drawn as the
  stencil draws them — a head over a rounded body block; a **software system** and
  an **external system**; a **container**, and the three flavours C4 gives a
  picture of their own: a **database** (a cylinder), a **mobile app** (a phone
  bezel down its leading edge) and a **web app** (a browser chrome band with its
  three dots); and a **component**.

  They are drawn in C4's own colour code, which is not decoration but the
  notation: the four levels run from the near-navy of a person through the blue of
  a system and the lighter blue of a container to the pale wash of a component,
  and anything outside the scope of the diagram is grey. That colour is what tells
  a container from a component when both are rounded rectangles with words in
  them — and it is why the pack has nine artefacts but only five element roles.

  **Two frames.** The **C4 board** is a plain titled white card: no axes, no
  zones, because a C4 diagram is a graph and a system drawn top left says nothing
  more than one drawn bottom right. Its title is what names the level being drawn,
  and a double-click on it renames it in place.

  The **boundary** is the dashed rectangle drawn round a group of elements to say
  "all of this is one system". It is the first background in the library that is
  deliberately TRANSPARENT: every other one is a card you put things on, and this
  one is drawn OVER a diagram that is already there — an opaque card would hide
  the very thing it is pointing at. Its name sits in the bottom-left corner, where
  C4 puts it, and renames the same way. A boundary can say which level it encloses
  (a system boundary or a container boundary); the field is optional, and a
  boundary that says nothing reads as the outer one.

  **Eight roles** join the vocabulary: `c4:person`, `c4:system`, `c4:container`,
  `c4:database`, `c4:component`, the two frames, and one edge —
  `c4:relationship`, because C4 has exactly one kind of line and its label is
  where the author says which kind of using it is. The four LEVELS are deliberately
  flat: a container is _part of_ a system, not _a kind of_ system, so filing them
  in a chain would make every rule about systems fall on every container. The one
  specialisation declared is the one C4 itself draws — a database is a container,
  so everything written about containers already reaches it.

  **Nothing already drawn changes.** The three element types are new; no existing
  model is touched, no field is renamed, and the one optional field in the pack
  writes nothing when it is not used — so there is no schema version bump and no
  migration.

  The framework-background primitive gains one thing along the way: a background
  may now declare its card's border DASHED. That is what the boundary is, and it
  belongs in the declaration a reviewer can read rather than in a renderer only
  one framework would ever have. Every existing declaration is unchanged and
  paints the solid line it always painted.

  The palette entries, shortcuts, templates and the senior toolbar button follow
  in the next release; this one is the model, the vocabulary and the rendering.

- Updated dependencies [b03132c]
- Updated dependencies [5737a56]
- Updated dependencies [e42e0c0]
- Updated dependencies [48c3b52]
- Updated dependencies [f09f9a3]
  - @labre/std@0.33.0
  - @labre/global@0.33.0
  - @labre/store@0.33.0

## 0.32.0

### Minor Changes

- 5b6e9bb: feat(edgeless): EDGY dynamic template, blank EDGY board and dependency spotlight

  - New "EDGY dynamic" template (template panel + EDGY senior menu): the facets
    background (without writings) with the 12 EDGY elements as prefab nodes,
    linked by the 24 canonical relations of the metamodel, each carrying its
    verb as a native connector label.
  - New blank "EDGY board" background element for free-form EDGY modelling.
  - New modular spotlight-on-hover: backgrounds registered as spotlight hosts
    (`SpotlightHostExtension`) grant the elements laid inside their bounds a
    dependency highlight — hovering a node fades everything but the node, its
    connectors and their endpoints. Enabled for the EDGY facets diagram and the
    EDGY board; other frameworks (e.g. Wardley) can opt in with one line.
  - The facets element gains optional backward-compatible `showPictos`,
    `cropToCircles` and `spotlightEnabled` flags; the board gains
    `spotlightEnabled`. Both background toolbars expose a spotlight toggle.
  - The classic "Enterprise Design facets" diagram (senior menu + template
    panel) is now cropped to the circles plus a facet-label allowance — no
    more dead margins around the Venn. Existing documents keep the previous
    letterboxed rendering (`cropToCircles` defaults to false).
  - Fix: canvas view events (click/dblclick) now route to the TOPMOST view
    under the pointer (paint order), so elements laid on a background stay
    editable — previously the background could swallow the double-click.
  - EDGY template gallery: Customer journey, Service blueprint and
    Organisation chart connectors are now ATTACHED to their elements (they
    follow moves, endpoints clip to edges); the blueprint's diagonal arrows
    no longer render as orthogonal zigzags.

- 5076cb8: feat(edgeless): a declared framework background, and Wardley rebuilt on it (PF2)

  Every framework that needed a background — Wardley, Cynefin, Estuarine, the
  BPMN pool — got one by writing a renderer: two hundred lines of `ctx.fillText`,
  its own hit-testing for editable labels, its own resize gate, its own copy of
  the same four hit-test methods on the model. Four dialects of the same idea,
  and the framework that happened to be written last inherited none of the
  niceties the first one had.

  There is now ONE background, configured by DECLARATION.

  - **The primitive** (`FrameworkBackgroundDef` in `@labre/affine-block-surface`)
    describes a background as data: its **geometry** (reference size, whether the
    proportion is locked, whether the handles are offered, the plot margin), its
    **frame of reference** (named axes, orientation, arrowheads, graduations),
    its **named zones**, and its **chrome** (card, colour washes, and a palette so
    a colour is named once and referenced by name). Not one line of it is a
    function, a class or a closure — same philosophy as the validation rules and
    the role defs, for the same reason: a declaration is comparable,
    serialisable, reviewable by someone who does not read TypeScript, and can one
    day be shipped by a host.
  - **The vocabulary is only as wide as its callers.** Every optional field has a
    named consumer cited in its doc comment — the BPMN pool's free aspect ratio
    and `600` name weight, Estuarine's double-headed energy axis and its Georgia
    italic axis letters. Anything nobody had asked for yet is simply absent: a
    drawn grid, a drawn legend box, tick stubs, per-tick labels, free-floating
    annotations and vertical washes were all written and then cut. They are
    cheap to add back the day a framework needs one, and dead weight until then.
  - **The default is deliberately dull.** A declaration that says nothing but its
    size paints a plain white rectangle: no axis, no zone, no decoration. A new
    framework gets a usable background before it has decided what it looks like.
  - **Labels are vocabulary, not prose.** Each one names an i18n key resolved
    through the house seam (`TranslationProvider`), and optionally a model prop
    holding the user's own wording, which always wins. A key nothing resolves and
    nothing defaults shows the raw key, exactly as everywhere else in the library.
    For that key to be REACHABLE, Wardley's ten label fields now default to
    `undefined` instead of to English: an `undefined` default is written nowhere,
    so a map nobody has renamed carries no label text and falls through to the
    vocabulary. Without a catalogue it reads exactly as it always did — the same
    words in the same places — and the first in-place edit writes the prop and
    wins from then on. The in-place editor opens on the words CURRENTLY DRAWN
    rather than on the raw prop, so a never-renamed label does not offer an empty
    box for a name the user can plainly see.
  - **A broken declaration fails loudly.** A `@name` with no palette entry, or a
    wash colour that cannot carry an alpha, used to produce `transparent` or
    `rgba(NaN,NaN,NaN,…)` — painting nothing and explaining nothing. Both now warn
    once and paint magenta.
  - **One walk, two uses.** The declaration's texts are enumerated once and drive
    both the painting and the double-click hit-testing, so a label can no longer
    be drawn in one place and clicked in another.
  - **The model half** (`FrameworkBackgroundElementModel` in
    `@labre/affine-model`) carries what every background shares: a rotated
    rectangle you drop elements onto, selectable, movable and part of undo/redo,
    but a passive canvas connectors must not snap to.

  **Wardley is the first instance, and the Wardley-specific implementation is
  gone** — renderer, label layout and resize gate alike. Two implementations
  coexisting would have meant Wardley quietly keeping behaviours no other
  framework could have.

  No document is invalidated. The persisted element type is still `wardley` and
  every one of its props keeps its name and its meaning — `variant`, `banded`,
  the ten editable label texts, the six visibility toggles. A map authored before
  this change opens with the same geometry, the same zones and the same words,
  and its snapshot round-trips byte-identical; that is asserted end to end
  against the real assembly points, with every expected coordinate written as a
  literal rather than recomputed from the declaration under test.

  What a map created from now on WRITES is smaller by ten keys: the label texts
  are only persisted once the user actually types one. Reading is unaffected in
  both directions — an old map keeps its ten, a new one falls through to the
  vocabulary — and that is precisely the mechanism optional fields exist for.

  The four gradient variants are still the same curves. They are now TABULATED
  ONCE, at module load, into `[offset, alpha]` stop tables the declaration ships:
  nothing is evaluated at paint time, and a wash is data like everything else.

  Wardley's role, element type, reference size, locked 16:9 proportion and
  resize default now come from the declaration, at the toolbox AND at the
  templates. One pre-existing drift is left alone and now documented: the
  templates lay their nodes out in a plot of their own (`x 70 → 1540`), inset
  further than the plot the declaration actually draws (`x 40 → 1570`). Aligning
  them would move every node of every canned map, which is a visual change to
  shipped content and not this slice's business.

  `wardley:map` is still stamped at creation and `wardley.component-outside-map`
  still frames against it, unchanged.

  Two things the next slice owes. The per-variant creation defaults
  (`BACKGROUND_VARIANT_DEFAULTS`, duplicated in the templates) still write English
  prose into the document for the two value-chain variants, so a map created as
  `opportunity` or `benefit` lands with "Opportunity" / "Benefit" / "Investment"
  already persisted as if the user had typed them: only `classic` and
  `evolution-gradient` are fully localisable today. The fix is to make the variant
  part of the declaration — one axis and end-label set per variant, each naming
  its own key — rather than a bag of prop overrides applied at creation, which
  changes what a variant IS and does not belong here. Both copies carry a TODO.

  Only Wardley is migrated. Cynefin, Estuarine and the BPMN pool keep their own
  renderers for now: the declaration expresses the BPMN pool as it stands, but
  Cynefin and Estuarine are built on hand-traced bezier and arc paths, which the
  vocabulary deliberately does not yet cover. Migrating them means adding a
  path-data layer to the declaration, and that is a slice of its own.

### Patch Changes

- a3aa598: A long code snippet can be folded away

  A pasted stack trace or a whole config file took over the page: the code block
  grew to the height of its content and pushed everything after it below the
  fold, and the only way back was to delete lines.

  The code toolbar now carries a collapse toggle. A folded block shows its first
  eight lines and fades out into its own background; the language preview is
  hidden while it is folded, and unfolding brings both back. The fold is written
  onto the block, so it survives a reload and travels with the document — a block
  that was never folded keeps no such state and loads exactly as before.

- 6417a2f: A mindmap node wraps instead of stretching across the board

  A node whose text was long grew a single line as wide as the sentence, pushing
  the rest of the branch off screen and making the map unreadable. The four
  mindmap styles now cap their nodes at 512px: past that width the text wraps and
  the node grows downwards. The cap is applied while typing too — the editor
  measures the wrapped text rather than the line it would have drawn, so what is
  being written stays inside the node.

  This is a deliberate change of rendering for documents that already contain
  long nodes. Opening such a document changes nothing: no layout runs on load, so
  the map paints exactly as it was stored. The first layout of the session — the
  first node added, moved, collapsed or edited — is what adopts the cap, and the
  long nodes then re-wrap. Nothing else moves: nodes shorter than 512px are laid
  out exactly as before.

  Shapes other than mindmap nodes are untouched. They carry no maximum width, and
  the editor keeps measuring them the way it always has, so the Grow mode of the
  Wardley, EDGY, DDD and Cynefin shapes behaves identically.

  Also fixes a mindmap that wrote its node positions to the document mid-edit: a
  layout requested while the tree was already stashed used to un-stash it and
  flush every intermediate position into the history.

- 5ac0c68: fix(edgeless): hit-testing a degraded connector (empty path) no longer throws

  Follow-up to the absent-endpoint render fix: a connector whose endpoint
  references a vanished element keeps its last bound, so it stays indexed and
  hoverable — and `getElementByPoint` calls `includesPoint` on every mouse
  move. `includesPoint` (Curve mode), `getNearestPoint`,
  `getPointByOffsetDistance` and `getOffsetDistanceByPoint` now degrade on an
  empty path (miss / element origin / bound center / midpoint) instead of
  throwing. At the source, `getBezierParameters` handles a zero-length path
  the same way it already handled a single point.

  Also: `_getConnectorEndElement` no longer casts away null, and
  `updatePath` skips the redundant `path = []` rewrite (no signal
  notification when the path is already empty).

- 5edd916: A big board stays responsive: the canvas redraws only what changed

  Every element event repainted the whole surface, and every stacking canvas was
  allocated at full viewport size however little of it a layer occupied — on a
  1440x900 screen at device pixel ratio 2 that is about 20 MB of pixel buffer per
  layer, whether the layer held one shape or a hundred. Editing a large map spent
  most of its frame budget in redraws nothing on screen could tell apart.

  A stacking canvas is now sized to the bound of the elements it actually holds,
  clipped to the viewport, and canvases freed by a layer change are pooled for
  reuse instead of being thrown away. A change to one element marks only the
  layer it lives in, so a pan, a zoom or a single edit no longer forces a full
  repaint. During a drag a layer's canvas is allowed to grow but never to shrink,
  so the dragged element does not flicker at the edge of its own canvas; the full
  redraw comes once, when the drag ends.

  The DOM renderers for brush, highlighter, shape and connector now keep the
  nodes they already built and overwrite their attributes, instead of rebuilding
  the whole SVG subtree on every frame — a hundred redraws of one stroke now
  allocate two nodes in total instead of two hundred.

  Alongside: a block host re-reads its stacking order when the layers change, so
  a reorder shows immediately; sending a mindmap node backwards moves the whole
  mindmap once rather than each selected node in turn; and a connector whose path
  is momentarily empty answers its geometry questions instead of throwing.

- Updated dependencies [832c793]
- Updated dependencies [a2b7c44]
- Updated dependencies [0bfc872]
- Updated dependencies [9e23b5b]
- Updated dependencies [d797f9a]
- Updated dependencies [54488cd]
- Updated dependencies [5ac0c68]
- Updated dependencies [1fa46c1]
- Updated dependencies [5b6e9bb]
- Updated dependencies [492bac6]
- Updated dependencies [30580db]
- Updated dependencies [3c5c97e]
- Updated dependencies [02797b5]
- Updated dependencies [413fe7b]
- Updated dependencies [724ed1c]
- Updated dependencies [0ddfd47]
- Updated dependencies [3639562]
- Updated dependencies [48e90f4]
- Updated dependencies [5edd916]
- Updated dependencies [025d6f5]
- Updated dependencies [b889326]
- Updated dependencies [1efc6d5]
- Updated dependencies [4162e4a]
- Updated dependencies [fad4c08]
- Updated dependencies [7b66d8d]
- Updated dependencies [4bb44ef]
- Updated dependencies [8d33c60]
- Updated dependencies [7a3458a]
  - @labre/std@0.32.0
  - @labre/store@0.32.0
  - @labre/global@0.32.0

## 0.31.0

### Patch Changes

- Updated dependencies [6a663b6]
  - @labre/store@0.31.0
  - @labre/std@0.31.0
  - @labre/global@0.31.0

## 0.30.2

### Patch Changes

- @labre/global@0.30.2
- @labre/std@0.30.2
- @labre/store@0.30.2

## 0.30.1

### Patch Changes

- @labre/global@0.30.1
- @labre/std@0.30.1
- @labre/store@0.30.1

## 0.30.0

### Minor Changes

- ecba791: Shape text fit modes: a new `textFitMode` prop on shapes (and polygons)
  chooses how text and bounds reconcile — `grow` (fixed font, the shape grows;
  the previous and default behavior), `contained` (fixed shape, the font size
  shrinks so the text fits — post-it behavior) or `overflow` (fixed shape and
  font; the text may paint past the bounds). Existing documents are untouched:
  the prop reads `grow` via the field fallback. In contained/overflow the
  resize clamp ("cannot shrink below the text") is lifted.

### Patch Changes

- Updated dependencies [9d0fe0c]
- Updated dependencies [8de86f4]
  - @labre/std@0.30.0
  - @labre/global@0.30.0
  - @labre/store@0.30.0

## 0.29.1

### Patch Changes

- @labre/global@0.29.1
- @labre/std@0.29.1
- @labre/store@0.29.1

## 0.29.0

### Patch Changes

- Updated dependencies [9330750]
  - @labre/std@0.29.0
  - @labre/global@0.29.0
  - @labre/store@0.29.0

## 0.28.0

### Patch Changes

- Updated dependencies [65cc055]
  - @labre/std@0.28.0
  - @labre/global@0.28.0
  - @labre/store@0.28.0

## 0.27.0

### Patch Changes

- Updated dependencies [91f6397]
  - @labre/std@0.27.0
  - @labre/global@0.27.0
  - @labre/store@0.27.0

## 0.26.0

### Minor Changes

- 8960a6c: feat(database): pluggable DataSource for affine:database (injection seam)

  The inline database block (`affine:database`) always built its own
  `DatabaseBlockDataSource`, so a host app could not back it with an external
  source. This adds a minimal, backward-compatible injection seam:

  - New optional model prop `externalSourceId?: string` (schema version 3 → 4;
    no runtime migration — optional prop with a default).
  - New `DatabaseDataSourceProvider` identifier (exported from
    `@labre/affine-block-database`). When a host registers it **and** the block
    carries an `externalSourceId`, the block renders via the injected source.

  With no provider registered and no `externalSourceId`, behavior is identical to
  before. Persistence stays entirely host-side.

### Patch Changes

- @labre/global@0.26.0
- @labre/std@0.26.0
- @labre/store@0.26.0

## 0.25.0

### Minor Changes

- 8960a6c: feat(database): pluggable DataSource for affine:database (injection seam)

  The inline database block (`affine:database`) always built its own
  `DatabaseBlockDataSource`, so a host app could not back it with an external
  source. This adds a minimal, backward-compatible injection seam:

  - New optional model prop `externalSourceId?: string` (schema version 3 → 4;
    no runtime migration — optional prop with a default).
  - New `DatabaseDataSourceProvider` identifier (exported from
    `@labre/affine-block-database`). When a host registers it **and** the block
    carries an `externalSourceId`, the block renders via the injected source.

  With no provider registered and no `externalSourceId`, behavior is identical to
  before. Persistence stays entirely host-side.

### Patch Changes

- @labre/global@0.25.0
- @labre/std@0.25.0
- @labre/store@0.25.0

## 0.24.0

### Patch Changes

- @labre/global@0.24.0
- @labre/std@0.24.0
- @labre/store@0.24.0

## 0.23.3

### Patch Changes

- @labre/global@0.23.3
- @labre/std@0.23.3
- @labre/store@0.23.3

## 0.23.2

### Patch Changes

- @labre/global@0.23.2
- @labre/std@0.23.2
- @labre/store@0.23.2

## 0.23.1

### Patch Changes

- @labre/global@0.23.1
- @labre/std@0.23.1
- @labre/store@0.23.1

## 0.23.0

### Minor Changes

- 9014c87: Add a BPMN process framework (v1, lean) to the edgeless editor. A new
  `@labre/affine-gfx-bpmn` package adds a senior-toolbar BPMN button whose menu
  drops the core BPMN basics onto the canvas:

  - start event (thin green ring), end event (thick red ring), task (rounded
    rectangle with editable label) and exclusive gateway (diamond with an X) -
    all native shapes (editable stroke / fill / text, native resize);
  - a sequence-flow item that arms the native connector tool pre-styled solid
    with a filled triangle head;
  - a pool background container (rounded-rect frame + editable vertical name
    band), with a resize-lock toggle in its element toolbar.

  Visual style is "hybrid": spec-accurate shapes and line weights with accent
  colour only on the event rings. Wired behind a `bpmn` block flag (ships dark
  until the host enables it). Out of scope for v1: intermediate / parallel /
  inclusive gateways, message & association flows, pool lanes, sub-process, data
  objects and task-type icons.

### Patch Changes

- c775151: Update the Estuarine map background to the latest artwork (reference space
  690×801): darker magenta axes (#941253) with larger arrowheads, the Volatile
  boundary redrawn as an explicit curve (instead of a half-circle arc), refreshed
  Liminal / Counter-factual curves, and letter-spaced legends with their own
  colours (green LIMINAL, red VOLATILE, dark COUNTER FACTUAL, red italic e / t
  axis letters). The per-curve and axis-label toggles are unchanged.
  - @labre/global@0.23.0
  - @labre/std@0.23.0
  - @labre/store@0.23.0
