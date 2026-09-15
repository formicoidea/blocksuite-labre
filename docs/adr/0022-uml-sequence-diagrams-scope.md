# ADR 0022 — UML sequence diagrams: a grid of lifelines, and time is y

- Status: **accepted** (2026-09-15)
- Deciders: Mathieu Jolly
- Milestone: UML 2.5.1, tranche I (phase 3)
- Related ADRs:
  [0017](0017-uml-one-framework-with-diagram-kinds.md) §2 (the phase table this
  closes: `sd` is the ninth and last kind of the one `uml` framework),
  [0009](0009-reversed-flag-contract.md) (the flag gates the sequence tooling,
  never a stored interaction),
  [0012](0012-framework-interchange-and-foreign-preservation.md) and
  [0019](0019-uml-import-formats.md) (the three formats that gain sequence
  content, without gaining a capability row),
  [0015](0015-rule-dependency-scope.md) (what a rule family may read),
  [0016](0016-hollow-endpoint-styles.md) (the arrowheads the message table
  spends),
  [0020](0020-connector-end-labels.md) (the end labels a message deliberately
  does not use),
  [0021](0021-label-syntax-rule-family.md) (the family the two sequence
  grammars are checked by).

## Context

Phase 3 of ADR 0017 is one kind, `sd`, and it is the only kind in the table
that does not fit the engine the other eight share.

Phases 1 and 2 draw a **graph**: boxes anywhere, arrows between them, and the
position of a box means nothing a rule reads. A class diagram laid out
upside-down is the same class diagram. That is why activity and state machine
cost so little in phase 2 — they are the phase-1 engine with different glyphs.

A sequence diagram is not a graph. It is a **grid**: x is the participant, y is
time, and the specification says so in the two sentences this whole tranche is
built on.

- §17.6.4.1 — "Within an InteractionOperand of a Sequence Diagram the order of
  the InteractionFragments are given simply by the topmost vertical position."
- §17.4.4.1 — the message line "must be such that every line fragment is either
  horizontal or downwards when traversed from send event to receive event."

This library has no time axis, no ordering field and no notion of an event
occurrence. What it has is geometry, and geometry is exactly what those two
sentences make normative. So the third engine is not a new mechanism: it is the
decision to let **y be the model**, and to write down what that costs.

## Decision

### 1. A lifeline is a narrow column; its head is painted, not boxed

`UmlNodeElementModel` gains `kind: 'lifeline'`. Its preset is a **16 × 600**
column (`UML_LIFELINE_SPINE`), `filled: false`, `strokeStyle: None`. The
renderer draws two things over it:

- the **head**, `UML_LIFELINE_HEAD = { w: 160, h: 48 }`, centred horizontally on
  the column and flush with its top;
- the **dashed spine** down the column's centre, from the head's bottom edge to
  the column's bottom (§17.3.4: "a rectangle forming its head followed by a
  vertical line (which may be dashed)").

The element is the column and not the head, for one reason: **a message attaches
to the spine**. Making the column the element puts every native connector anchor
on the spine's own x, 8 units off the line, which is where every UML tool draws
the arrow into. No `getNearestPoint` override, no per-kind anchor table, no
second routing engine beside `ConnectorPathGenerator`. `centerAnchorOnly`
becomes per-kind and is `false` for this one.

The head is 160 wide against a 16-wide element, so it hangs 72 units off each
side of the box the platform knows about. The model pays for that, in the two
places that read a bound:
`elementBound` and `includesPoint` widen to the head rect for
`kind === 'lifeline'`
(`packages/affine/model/src/elements/uml/lifeline.ts`, `umlLifelineHeadRect`,
read by the model's overrides and by the renderer alike). Without them the user
sees a named box and cannot click it, and the frame fits to a 16-wide sliver.

The column is only ever **wanted** taller — a longer spine is the resize a
lifeline ever asks for — but nothing enforces that: the handles are the
platform's, and a wider column simply widens the painted head, which
`umlLifelineHeadRect` sizes at `max(160, w)`. The label is a grouped text
laid out inside the head, carrying its own flat tier role
**`uml:lifeline-ident`** and spelled by §17.3.4's `<lifelineident>`
(`parseLifelineIdent`: `name [: Type]`, or `self`). A role of its own rather
than the pack's generic `uml:label`, because §17.3.4 gives these words a grammar
and two rules read it.

### 2. Execution and destruction are nodes placed by geometry

- `kind: 'execution'` — 12 × 80, card fill, thin stroke, and a **native filled
  rect rather than a glyph**: §17.2.4.4 asks for "thin rectangles (gray or
  white) on the lifeline", which is a shape the platform already draws, so the
  bar takes the shape toolbar's fill, stroke and resize for free.
- `kind: 'destruction'` — a bare 24 × 24 X glyph (§17.4.4's
  DestructionOccurrenceSpecification symbol), and one of the two sequence kinds
  that IS a glyph.

Both are **plain nodes the author drops on a spine**, with no parent link to the
lifeline they sit on. Attachment is geometric, which is what containment is
everywhere else in this library (R11: a board is not a container; membership is
computed at read time). A stored parent would be a second truth the drawing
could contradict, and every drag would have to maintain it.

A message may target either a lifeline or an execution: §17.4.4 attaches a
MessageEnd to an occurrence, and on the canvas both spellings draw the same
arrow.

### 3. A fragment is a background with operand zones, exactly like a BPMN pool

`umlFragment` extends `FrameworkBackgroundElementModel`: transparent fill, solid
border, a pentagon tag in the upper-left corner carrying the operator
(§17.6.4.3, drawn by the same `withUmlFrameTag` the Annex-A frame heading uses).
Fields are `operator` (`alt | opt | loop | par | break | critical | ref | seq |
strict | neg | assert | ignore | consider`, default `alt`) and `name` — the
guard of the first operand, or the `ref` name.

Its **operands are zones**, `instanceZones` as BPMN lanes are: horizontal bands
separated by **dashed** lines (§17.6.4.1), one `uml:operand` role per band, a
second operand added from the fragment's toolbar exactly as a lane is added to a
pool. That makes the operand band the second UML zone in R9, after the activity
partition. The fragment's whole **top band is carved out of the transparent
frame's hit test**, so the pentagon and the first guard are clickable on a board
that otherwise lets every click through to what is drawn on it.

**A guard is stored with its brackets.** The canvas text is exactly what the
author types, and §17.6.4.4 prints a guard as `[guard]` — so the board holds
`[x > 0]` and `[else]`, the renderer prints them verbatim, the two exporters
strip exactly one surrounding pair (`umlGuardText`, tolerant of a condition
typed without them) and the three importers put a pair back on (`import.ts`).
A `ref`'s `name` is an interaction's, never a condition, and is written as it
is read.

**A guard lives in one of two places, and which one is structural.** An UNSPLIT
fragment already IS the one-operand fragment, so its single guard is the
background's own `name`. The first press of "add operand" writes **two** bands —
the one that was implicit and the new one — and from then on each guard is that
band's `operands[].name`. There is no third state and nothing is seeded into a
guard: `[else]` is a word the author types, because a default guard is a
sentence the tool asserted and the author did not.

An **interaction use is the same element**. §17.7.4.1 is explicit: an
InteractionUse "is shown as a CombinedFragment symbol where the operator is
called `ref`". One element, one field, one toolbar — not a second background
that would draw the identical rectangle.

### 4. Five message roles, and the arrow table is §17.4.4's

| role                 | line  | head            | §17.4.4 `messageSort`                  |
| -------------------- | ----- | --------------- | -------------------------------------- |
| `uml:message-sync`   | Solid | filled triangle | `synchCall`                            |
| `uml:message-async`  | Solid | open arrow      | `asynchCall` / `asynchSignal`          |
| `uml:message-reply`  | Dash  | open arrow      | `reply`                                |
| `uml:message-create` | Dash  | open arrow      | `createMessage`, targets a lifeline    |
| `uml:message-delete` | Solid | filled triangle | `deleteMessage`, ends in a destruction |

All five specialise a parent role `uml:message`, so a rule, a reading profile or
a morph family names the family once. Mode is `Straight`: §17.4.4.1's line is a
segment between two lifelines, and an orthogonal route would draw a vertical
fragment the clause forbids.

Two readings of the clause are settled here rather than offered as options.
§17.4.4 allows a reply's head to be "either an open or filled arrow head"; we
draw it **open**, because a picker with two entries that mean the same thing is
a choice a user can neither get right nor wrong. And a delete message keeps the
filled head of the synchronous call it usually is — what makes it a deletion is
the destruction it ends in, not its head.

A message's words are the connector's **centre `text`**, spelled by §17.4.4's
`<message-label>` (`parseMessageLabel`: `[assign =] name([args]) [: return]`).
The two end labels of ADR 0020 stay empty on a message: an association puts a
multiplicity at each end, an interaction puts one sentence in the middle.

### 5. Time is y, and it is only y

There is **no sequence number, no ordering field and no index** on anything in
this tranche. The exporters read the messages of an interaction in **y order,
top to bottom**, and §17.6.4.1 is the licence for that: the order is the topmost
vertical position.

The y they read is the **stored endpoint `position`**, not the connector's
bound. On a 16 × 600 column every message's bound centre is very nearly the same
point, so a bound-derived order would put a whole conversation in a tie; the
endpoint is where the author actually attached the arrow, and it is the number
the drawing means.

§17.4.4.1's other sentence — a message never runs upwards — is the same fact
seen from the arrow's end, and it is **drawn, not checked**. That is the first
of the four entries in the Consequences' skip list.

The cost of making y the model is stated rather than engineered around: **two
messages drawn at the same y export in document order**. A tie in the model is a
tie on the sheet, and an author who cares moves one of them by a pixel.

### 6. Interchange: five capabilities, all five learn the clause

A kind is not a format. UML's five capabilities of ADR 0019 are unchanged and
phase 3 adds none — but unlike phase 1, which shipped writers and no readers,
every one of the five learns the sequence vocabulary in this tranche.

| capability            | a sequence diagram becomes, or comes from                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `uml:xmi:export`      | `uml:Interaction` owning a `lifeline` each (the `: Type` under `<xmi:Extension extender="labre"><represents name=…/>`, because `Lifeline::represents` wants a Property and a whiteboard draws none), two `uml:MessageOccurrenceSpecification` fragments in time order per message plus a `uml:Message` with `messageSort` and `sendEvent` / `receiveEvent`, an execution as `uml:ExecutionOccurrenceSpecification` → `uml:BehaviorExecutionSpecification` → finish occurrence, `uml:DestructionOccurrenceSpecification`, `uml:CombinedFragment` with `interactionOperator` and `covered` and one `uml:InteractionOperand` per band (guard as `uml:InteractionConstraint` / `uml:LiteralString`, nested fragments inside the operand), `uml:InteractionUse` with `refersTo` resolved by name within the same document |
| `uml:xmi:import`      | the same, read back: lifelines with `represents`, the occurrence pairs, `Execution` / `BehaviorExecution` / `ActionExecutionSpecification` alike, destructions, fragments with their operands and guards, `InteractionUse` → the `ref` name. An unknown `interactionOperator` becomes `alt` **with a warning**; everything else unmapped is quarantined; `inferDiagramKind` answers `sd` first                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `uml:plantuml:export` | `participant "name : Type" as a` / `actor`, then `->` (sync), `->>` (async), `-->` (reply), `create`, `destroy`, `activate` / `deactivate` from the execution bars, `alt [g] … else [g] … end`, `opt`, `loop`, `par`, `break`, `critical`, `group <op>` for the six operators PlantUML has no keyword for, and `ref over a, b : Name`. A lifeline's keywords are not written — only `actor`                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `uml:plantuml:import` | all of the above plus what the wild writes: implicit participants, reversed arrow spellings, `**` and `!!`, `++` and `--`, notes and `title`. `autonumber`, `skinparam`, dividers, `...`, `newpage` and `hide` / `show` are **carried** (they say how to draw), as are the constructs §8 puts out of scope — gates, lost and found, coregions, state invariants                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `uml:drawio:import`   | best effort at the `visual` tier: `shape=umlLifeline` → a lifeline, `umlDestroy` → a destruction, a `umlFrame` whose label opens with an operator → a fragment, a narrow child box on a spine → an execution, and edges → messages (dashed → reply, `endArrow=open` → async, otherwise sync). **Create and delete cannot be told apart from a style string**, so they arrive as ordinary messages and the author retypes the two of them                                                                                                                                                                                                                                                                                                                                                                             |

**The layout a reader invents is the model, so it is declared and it is
arithmetic.** Neither PlantUML nor a Papyrus `.uml` carries geometry, and for
this kind ADR 0019 §5's "invented layout" is not a cosmetic default: y IS the
order. Four constants decide it — `UML_SD_COLUMN_GAP` 200 between lifelines in
declaration order, `UML_SD_FIRST_EVENT` 88 for the first slot,
`UML_SD_EVENT_STEP` 40 **per EVENT**, and `UML_SD_FRAGMENT_PADDING` 20 round an
operand's contents.

Per event, and not per message, is the whole trick: an `activate`, an `else` and
an `end` each take a slot of their own, so the y the reader invents is the y the
writer will read back. That is what makes the round trip **byte-equal** for both
semantic formats — export → import → export is a fixed point from the FIRST
turn, where ADR 0019 §6 could only promise it from the second for a class
diagram's drawn containment. Pinned by twenty-nine round-trip tests in
`import-roundtrip.unit.spec.ts`: seven over the synthetic sheet, ten over the
two corpus files `sequence-order.puml` and `papyrus-sequence.xmi`, five over the
pair a playground build actually exported (`labre-phase3-export.puml` /
`.xmi`), and seven that go the other way — **draw** the model on a board, read
the board back with `umlModelFrom`, and write the same file. That last group is
the one the file-to-file tests cannot stand in for: the order a sequence diagram
states is geometry, so a drawing whose messages and whose boxes disagree about
where the sheet is re-exports a different conversation.

The coverage a fragment states is the one its rectangle DRAWS: a PlantUML block
whose events touch the first and the third participant is one box reaching over
the second, so the reader fills the span in (`coveredSpan`) rather than
recording a gap the drawing cannot keep.

### 7. What is not validated, on top of ADR 0017 §4

The engine judges a drawing. §17.1's interaction semantics is a theory of
traces, and none of it is checked:

- **partial orders, interleaving and weak sequencing** (§17.1.2) — whether the
  drawn messages admit the traces the author means;
- **what an operator asserts** — `assert`, `neg`, `ignore` and `consider` are
  words on a pentagon, and nothing compares the operand's contents to them;
- **whether a `ref` resolves** — the XMI writer binds `refersTo` when another
  frame of the same document declares an interaction of that name, and writes
  the name alone otherwise. No rule reports the "otherwise";
- **whether an execution's start and finish match** the messages that bracket
  it — there are no occurrence specifications on the canvas to match.

### 8. Out of scope, by decision and not by omission

Recorded here so a coverage audit closes against this ADR rather than filing
them as gaps. Out of scope means **not drawn and not tooled**; it does not mean
destroyed. The PlantUML and XMI readers meet the first four of these in real
files and CARRY them (ADR 0012 D1), naming the line or the element, so a build
that later learns one of them has something to learn it from.

- **Gates** — formal, actual, and the inner/outer CombinedFragment gates of
  §17.4.3. A gate is a named point on a frame's boundary that matches another
  frame's by name; it is the only construct in the clause that needs a
  cross-frame resolution this engine does not have.
- **Lost and found messages** — §17.4.4's small black circle at one end. Both
  are a message with one end attached to nothing, and every rule in the pack is
  written about two endpoints.
- **Coregions** — the shorthand for an unordered `par` over one lifeline.
- **Continuations** (§17.6.4.5).
- **State invariants** (§17.5) — the `{ constraint }` drawn on a lifeline.
- **Duration and time constraints and observations** — §17.8's notation for
  §8.5's constructs.
- **General ordering** — the dotted line that orders two occurrences on
  different lifelines.
- **Interaction overview diagrams and timing diagrams** — already permanently
  out under ADR 0017 §2, restated because §17.8–17.9 draw them inside this same
  clause and a reader of §17 would otherwise expect them here.
- **Nested-fragment semantics** — a fragment drawn inside another is drawn
  inside another. Nesting is **geometric only**: nothing reads containment as
  the nesting §17.6.4.3 describes, and the multi-operator pentagon shorthand
  (`sd strict`) is not offered.
- **`refersTo` resolution across documents** — on the canvas a `ref` is a NAME,
  and nothing on the board links it to an interaction. The XMI writer binds
  `refersTo` when another frame of the SAME document answers to that name, which
  is as far as a name can be followed without a repository; a `ref` naming an
  interaction that lives in another document exports as its name and nothing
  reports it.

## Consequences

- **`UmlDiagramKind` gains `sd` and `UmlNodeKind` gains three values**, by
  appending — which ADR 0017 §2 promised costs no schema change, no migration
  and no backfill. A phase-1 board opens unchanged; an `sd` frame opened on a
  phase-2 build prints its own heading verbatim.
- **The model gets its first per-kind geometry override.** `elementBound` and
  `includesPoint` now branch on `kind` in `node.ts`. Any future artefact whose
  painted glyph is larger than the box it routes from — and there will be
  one — takes the same two overrides and the same shared rect helper, rather
  than a third mechanism.
- **Moving a lifeline does not move its executions.** Decision 2's price. The
  author drags the column and the bars stay; on a diagram with more than a
  handful this is the complaint we expect first, and the answer if it lands is a
  drag-time geometric follow, never a persisted parent.
- **R9 gains its second UML zone** (the fragment's operand band, after the
  activity partition), and R11's "centre point for inner regions" now decides
  which operand a message belongs to.
- **The sheet ships FOUR rules**, taking the pack to forty-two, and every one of
  them is a family the pack already had:

  - `uml.message-endpoints` (`relation-endpoints`) on the parent role
    `uml:message`, so one matrix tells the five sorts apart. A create lands on a
    lifeline and nothing else; a delete ends on a destruction, with a lifeline
    **tolerated** because §17.4.4's cross is an occurrence ON a lifeline and an
    author who has not drawn the X yet has not drawn a wrong diagram;
  - `uml.message-syntax` (`label-syntax`, ADR 0021, `perLine: false`) on the
    same parent role, reading §17.4.4's request and reply productions with
    `checkMessageLabel`. It is silent about an unlabelled arrow, which the
    clause allows and a sequence diagram is drawn with;
  - `uml.unnamed-lifeline` (`label-presence`) and `uml.lifeline-ident-syntax`
    (`label-syntax`, `checkLifelineIdent`) on a **new flat tier role,
    `uml:lifeline-ident`**, carried by the text in the head. §17.3.4 says in as
    many words that `<lifelineident>` cannot be empty, which is the rare case
    where a presence rule and a syntax rule on the same words are both the
    specification's own sentence; `uml.strict` promotes all four, taking the
    strict profile to twenty-nine.

  Plus the `sd` row of `view-admissibility`, the strictest list in that table:
  an `sd` frame refuses all eight other vocabularies — the package included,
  which `act` and `stm` admit — because an artefact that is not a participant
  has no position on an axis that is time.

- **Four requirements of Clause 17 that no rule family can state**, skipped
  rather than approximated, each for a named mechanical reason:

  - **a message never traversed upwards** (§17.4.4) — `relative-order-along-axis`
    wants an axis declared on a background, and UML declares none; and it
    compares the two ends' bound CENTRES, which on a 16 × 600 column is the same
    point for every message on the sheet. It would take a `measure: 'endpoints'`
    option on the family, which is a change to a family six packs share;
  - **an execution bar sitting on a lifeline's spine** (§17.3.4) — `attachment`
    wants its `carrierRole` to be an EDGE, and `element-in-zone` wants a
    background; a lifeline is neither, it is a node;
  - **a create message landing on the head** rather than partway down the
    spine — no family measures "the endpoint is in the target's top 48 units";
  - **an operand's guard written in brackets** (§17.6.4.2) — `label-syntax`
    reads `text`, `sourceLabel` and `targetLabel`, and a guard is a prop on a
    background.

  Adding a seventeenth family for any of them was refused for the reason ADR
  0021 gives about the sixteenth: a family earns its entry by being a shape
  several notations need, and each of these is one clause of one diagram. All
  four are mistakes a reader sees on the drawing, which is the honest bar for
  skipping a rule; a rule that fires on the wrong thing costs more than a
  requirement nobody checks.

- **No new interchange capability, and no new format id — but all five learn the
  clause.** Phase 1 shipped writers and no readers; phase 3 ships both halves in
  one tranche, and a `.puml` or `.xmi` sequence that used to arrive as carried
  remarks now arrives as a diagram. The round trip it closes is byte-equal
  (§6), which no earlier phase could promise.

- **Three tooling shapes worth writing down**, because each is a deviation a
  reader of the pack would otherwise read as an oversight:

  - there is **no `createUmlLifeline` wrapper**. `createUmlNode(std, kind)` is
    the creation path for all three sequence kinds, as it is for the rest of the
    pack's nodes;
  - **"add operand" is a flag-gated toolbar BUTTON, not a command**, so it emits
    no command telemetry. That is an open product point rather than a decision:
    a gesture people use to shape a diagram is a gesture worth counting, and the
    day it needs counting it becomes a `CommandDescriptor` like the rest;
  - **`message-create` and `message-delete` belong to no morph family.** Only
    sync, async and reply morph into one another. The other two are identified
    by their far END — a head, a cross — so a morph that kept the endpoints
    would produce exactly the drawing `uml.message-endpoints` refuses.

## Amendments

None.
