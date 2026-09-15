# ADR 0017 — UML ships as one framework, with the diagram kind on the board

- Status: accepted (September 2026)
- Deciders: Mathieu Jolly
- Related ADRs: [0009](0009-reversed-flag-contract.md) (flags gate tooling,
  never content), [0012](0012-framework-interchange-and-foreign-preservation.md)
  (interchange capabilities per framework and format),
  [0013](0013-cynefin-framworks-carries-no-validation-rules.md) (a framework may
  ship no rules, by decision), [0014](0014-senior-submenu-rules.md) (one senior
  button, one sub-menu, one cap per framework),
  [0015](0015-rule-dependency-scope.md) (a rule family declares what its verdict
  depends on), [0016](0016-hollow-endpoint-styles.md) (the hollow endpoint
  styles UML's arrowheads need).

## Context

UML 2.5.1 defines fourteen diagram kinds. The DDD pack, the closest precedent in
this library, ships **three** frameworks — event storming, core domain chart,
context map — each with its own senior button, its own flag and its own board.
Read as a template, that says one framework per diagram, and UML would arrive as
half a dozen buttons in the senior row.

It reads the precedent backwards. What made DDD three frameworks is not that it
draws three pictures; it is that its three boards are **distinct sheets with
disjoint vocabularies**. An orange sticky from an event storming has no meaning
dropped on a context map, the two boards are never drawn on the same surface,
and no notation of the three shares a frame with the others.

UML is the opposite case, and says so in its own text. Annex A gives every
diagram the SAME frame: a rectangle with a cut-corner tag at the top left
carrying `<kind> <name>` — `class Orders`, `uc Login`, `pkg Billing`. The kinds
share that frame, they share a sheet, and they mix on it: a package diagram and
the class diagrams of its packages belong side by side; a use case sits beside
the classifiers that realise it. An architect drawing an application in this
editor draws one board with several frames on it, not several boards.

## Decision

**UML ships as ONE framework, `uml`: one senior button, one flag, one
descriptor, one role namespace. The diagram kind is a FIELD on the board**
(`UmlDiagramElementModel.kind`), not a second framework.

### 1. One framework, and the criterion that says so

The criterion is written into the contributor guide as **R34 — a framework is
one drawing** (`docs/add-a-framework/02-framework-rules.md`). Its practical
test: _can I drop an artefact of A on a board of B and have it mean something?_
Yes — one framework, and the kind is a field. No — two frameworks, two buttons,
two flags.

DDD answers no three times over, which is why it is three frameworks. UML
answers yes across all of its kinds, which is why it is one. The rule is a
convention; no test enforces it, and none could — it is a judgement about a
notation, not a property of the code.

Admissibility ("a use case has no place on a class diagram") is therefore a
`view-admissibility` validation rule reading the board's `kind`, exactly as C4's
level rules read `C4BoardElementModel.level`. It is not a reason to split the
framework: a rule that forbids a placement is cheaper, softer and more honest
than a flag that removes the tool.

### 2. Scope, by kind and by phase

| Phase         | Kinds                                                                          |
| ------------- | ------------------------------------------------------------------------------ |
| 1 (this pack) | class, package (`pkg`), object (`obj`), use case (`uc`)                        |
| 2             | component (`cmp`), deployment (`dep`), activity (`act`), state machine (`stm`) |
| 3             | interaction / sequence (`sd`)                                                  |

Each phase **appends values** to `UmlDiagramKind` and `UmlNodeKind`. Appending a
value to a string union is additive: no new field, no schema change, no
migration, no backfill. A diagram drawn in phase 1 opens unchanged in phase 3,
and a phase-2 frame opened on a phase-1 build prints its own heading verbatim
rather than being coerced to `class`.

**Permanently out of scope**, and not a backlog item:

- **profile diagrams** — the mechanism for extending the metamodel itself;
- **composite structure** — ports and parts drawn outside a component;
- **communication diagrams** — the sequence diagram's numbered-message twin;
- **timing diagrams**;
- **interaction overview diagrams**;
- **information flow diagrams**;
- **templates** (parameterised classifiers and their bindings).

These are not deferred for effort. They are the parts of UML that a
transformation architect does not draw on a whiteboard, and shipping a tool for
them would cost the sub-menu cap (ADR 0014) that the kinds people do draw need.

### 3. One role namespace

Roles are `uml:<local>` — `uml:class`, `uml:actor`, `uml:use-case`,
`uml:package` — one namespace for the whole framework, per R18 and ADR 0007.
There is no `uml-class:` or `uml-uc:` sub-namespace: an artefact keeps the same
identity whichever frame it is drawn in, which is the same fact that makes the
framework one framework.

### 4. What is never validated

The engine judges **a drawing, not a model**. It is given a canvas of shapes and
connectors, and it has no metamodel behind them. So the following are out, by
decision and not by omission — the same call ADR 0013 makes for Cynefin, from
the other direction:

- **the OCL constraints of the UML metamodel** — well-formedness rules stated
  over a repository this editor does not have;
- **slot typing** — whether an object's slot values conform to the attributes of
  its classifier;
- **cross-diagram consistency** — whether the class diagram and the object
  diagram agree, or whether a use case is realised anywhere;
- **profiles and stereotype semantics** — what a `«stereotype»` means, and
  whether it may be applied here.

What IS judged is form: a connector's ends, an artefact's placement against the
frame's declared kind, a label's position. A rule that would need a model
underneath it is not written.

### 5. `obj` is a tool convention, not a normative tag

Annex A's frame kind names are `activity`/`act`, `class` (no abbreviation
given), `component`/`cmp`, `deployment`/`dep`, `interaction`/`sd`,
`package`/`pkg`, `state machine`/`stm` and `use case`/`uc`. There is **no object
diagram** in that list: UML treats it as a class diagram showing instances.

Every tool that draws one nevertheless tags it `obj`, and an architect reading
the sheet expects to. So `obj` is kept, and recorded here as non-normative, so
that nobody later "corrects" it against the standard without knowing it was a
choice.

### 6. Two forward references

- **Connector point styles.** UML's arrowheads — the hollow triangle of
  generalisation, the hollow diamond of aggregation, the filled diamond of
  composition — widen `PointStyle` on the connector model. That widening is its
  own decision, recorded in **ADR 0016**, because it touches a shared element
  every framework draws with.
- **Per-end connector labels.** Multiplicities and role names sit at the ENDS of
  an association, not at its middle, and the connector model carries one label.
  How that is modelled is decided in
  **[ADR 0018](0018-connector-per-end-labels-deferred.md)**: phase 1 puts the
  name, the «stereotype» and the include/extend keyword in that one centre
  label and leaves end multiplicities to free text; the two optional
  `sourceLabel` / `targetLabel` fields are a phase-2 red-zone change of their
  own. Nothing in this pack's phase 1 depends on it.

### 7. What this pack does not ship

Four declarations are **absent by decision, not by omission**, and this section
is what `add-a-framework/01-definition-of-done.md` and
`understand/05-what-is-a-framework.md` point at when they say "per ADR 0017".

- **Natures** — no level-3 tags (`natures.ts`, ADR 0007, R19). A UML artefact's
  meaning IS its role: a class is a class, and there is no second axis along
  which one class differs from another that the notation itself does not already
  draw. A nature table here would be inventing vocabulary UML does not have.
- **Nudges** — no quality checklist (`nudges.ts`). UML's own clauses are the
  checklist, and they are already written as rules with citations; a second,
  softer list of the same sentences would say the same thing twice, once
  checkable and once not.
- **Audit criteria** — no AI audit seam in phase 1. The criteria a framework
  hands the audit panel are judgements about a model, and §4 above says this
  engine has no model behind the drawing. Phase 2 may add them for the form
  questions; nothing is declared now.
- **Imports** — no importer in phase 1. The PlantUML and XMI **writers** ship
  in phase 1 (export only); the readers came in phase 2 under ADR 0019 (PlantUML,
  XMI and draw.io), owing ADR 0012's full preservation contract D1–D6 — sort
  every node into mapped / carried / quarantined, carry the residue on the
  element, keep the file's ids verbatim. Association end labels (multiplicity
  and role) are read and written since ADR 0020 gave the connector its two end
  labels; before that they were carried, not mapped.

## Consequences

- **One line in `FRAMEWORK_DESCRIPTORS`, one key in `OPTIONAL_BLOCKS`, one
  chord prefix.** The senior-row cap and the 13 + 1 sub-menu cap (ADR 0014)
  apply to UML as a whole — which is the binding constraint on how many
  artefacts a phase may add, and the reason phases 2 and 3 exist.
- **The kind is data a document carries**, so a rule can read it and a future
  phase can add to it. It is never a flag: turning the UML flag off removes the
  button, never the frame (ADR 0009).
- **A coverage audit reporting "UML has no profile diagram" is closed against
  this ADR**, as is one reporting missing OCL validation.
- **Widening a kind union needs no ADR** — it is the promise this one makes.
  Narrowing one, or adding a SECOND framework in the `uml` family, does.
- **R34 is a convention with no test.** A contributor who splits a notation that
  should have stayed one will not be stopped by CI; they will be stopped, if at
  all, at review. That is accepted: the alternative is a test that has to encode
  what a notation means.
