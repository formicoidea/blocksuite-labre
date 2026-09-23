# @labre/affine-gfx-uml

## 0.43.0

### Patch Changes

- Updated dependencies [da68dbb]
- Updated dependencies [72f7282]
- Updated dependencies [f1a4af7]
  - @labre/affine-shared@0.43.0
  - @labre/affine-block-surface@0.43.0
  - @labre/affine-gfx-template@0.43.0
  - @labre/affine-widget-edgeless-toolbar@0.43.0
  - @labre/affine-gfx-shape@0.43.0
  - @labre/affine-gfx-text@0.43.0
  - @labre/affine-gfx-connector@0.43.0
  - @labre/affine-gfx-ddd-shared@0.43.0
  - @labre/affine-gfx-pointer@0.43.0
  - @labre/affine-ext-loader@0.43.0
  - @labre/affine-model@0.43.0
  - @labre/global@0.43.0
  - @labre/std@0.43.0

## 0.42.0

### Minor Changes

- 911d143: feat(blocks): a sixteenth validation rule family, `label-syntax`: a rule hands the engine a parser, and every non-empty line of the role's text that fails to parse becomes a finding naming the line. UML ships four such rules — attribute, operation and transition grammar, and the multiplicity of an association's end labels — audit in the sketch profile, warning in strict. Interchange imports also translate connector end label boxes with the import offset. See `docs/adr/0021-label-syntax-rule-family.md`.
- b1bf440: EDGY, C4 and UML derive their automatic legend from their own commands instead of a table beside them: each entry of the toolbox subscribes the row its artefact draws, and the shared engine scans the board, orders the rows, groups them under the section keys already shipped and draws the box. The rows, the swatches and the wording are unchanged — a UML row still draws the real class, actor or hollow diamond, an EDGY row still shows its facet's fill, a C4 row still reads its role's name — and the one `FrameworkLegendCreated` event keeps its historical values (`uml` still reports `module: 'uml toolbox'`). Two readings move with the command order they now follow: C4 lists Component before Database and its Relations section before Frames, and UML lists its elements in the order the sub-menu offers them. The Legend button of the two EDGY frames leaves the always-on toolbar for the flag-gated one, beside Validation: generating a legend is tooling, while the legend it wrote is content and keeps being painted with the flag off.
- 911d143: feat(edgeless): the strict profile IS the check-up — choosing « Specification » on a frame now puts every rule that level promotes on the drawing path, `moment: 'on-demand'` included, so the findings appear on the canvas on the switch and on every edit afterwards. Until now an explicit `'on-demand'` won against any level, so nine UML rules the strict table raised to `warning` were drawn by nothing at all: the PO emptied a lifeline's head, chose Specification, and the canvas stayed silent. A level that NAMES a rule at a drawn severity is now the statement that decides the moment; a rule no level promotes keeps its declaration, so `uml.unreachable-*` and the Wardley probes stay off the gesture path. The frame bookkeeping and the watched properties follow the same static question, so a promoted naming or spelling rule re-judges as the user types. UML's strict profile also promotes the behaviour sheets' three membership rules (a history outside every region, an action outside every partition), which are glyphs whose whole meaning is the container they sit in.
- 911d143: feat(edgeless): the UML artefact catalogue is filed by DIAGRAM KIND. « Plus d'artefacts… » used to group sixty-nine commands under the four headers C4 lends the library — one "Elements" section held fifty shapes, from a lifeline to a deep history — so the nine sections are now the frame's own kinds, in the order of its kind picker: General, Class diagram, Use case diagram, Component diagram, Deployment diagram, Activity diagram, State machine diagram, Sequence diagram, and the Interchange last. What several kinds share (the frame, the package, the note, and the four relationships no notation owns) sits under General; inside every section the reading is elements, then boundaries, then relations. Each header's wording is the one the kind picker already offers, derived from the category id rather than minted beside it. Nothing moved surface: the fourteen nominations and the thirteen a cold start meets are untouched, and every one of the sixty-nine commands is still in the catalogue.
- 911d143: feat(edgeless): a UML classifier grows to fit what is typed into its compartments. Until now a class box was laid out from its rectangle alone — a name line, three attribute lines, and the operations taking the rest (§11.4.4) — so a fourth attribute was drawn straight over the separator under it. `UmlCompartmentWatcher` measures the tiers when an edit commits (the moment the text editor lets go, never between keystrokes), grows the node to the height the stack now needs and moves the three texts to the compartments that height yields, in one undo entry. The node renderer reads its separators off the tiers, so a rule is always drawn between the compartments as they are. The height only ever goes up: a box dragged taller was dragged taller for the operations, and nothing reclaims it. Registered always-on, like `C4TypeLineWatcher` — it creates nothing and keeps words already in the document readable with the UML button off (`docs/adr/0009`).
- 911d143: feat(blocks): the UML pack's last displayed strings cross the translation seam (ADR 0023). Its automatic legend resolves its box title through the shared `BOARD_LEGEND_TITLE` and its three sections ("Elements", "Frames", "Relations") through keys of its own; its Templates category resolves its tile name through the senior button's `com.labre.framework.uml`; and the nineteen fixed-wording remarks the PlantUML, XMI and draw.io readers and the shared materializer put in an import report now carry a key and its `{{name}}` parameters, resolved at report time like BPMN's. The surface's own "same provisional name" remark is keyed with them. Every one of them reads exactly as before with no `TranslationProvider` registered, with one wording change the seam asks for: the XMI reader's "N elements are declared inside another" is now the plural-neutral "{{count}} element(s) are declared…", since agreement is the host's.
- 911d143: feat(edgeless): UML 2.5.1 pack, phase 1

  A ninth business framework on the edgeless senior row: **UML**, covering the
  four structural diagrams a transformation architect draws by hand — class,
  package, object and use case.

  What it puts on the canvas: a diagram frame with the cut-corner name tag and a
  kind picker (class / package / object / use case), a subject frame for the use
  cases one system offers, and ten artefacts — class, interface, enumeration,
  object, package, note, actor, use case — each arriving as its shape and its own
  compartments rather than as a box to type into. Nine typed relationships:
  association, aggregation, composition, generalization, realization, dependency,
  anchor, include and extend, each drawn with the endpoint UML gives it.

  What it can hand you: the selected diagram as **PlantUML** source, or as **XMI
  2.5.1** — the OMG's own interchange format, read by every UML tool. Both are
  semantic-tier capabilities (`docs/adr/0012`): the attributes and operations you
  typed are parsed and written as model, not as a picture of one.

  Flag-gated like every framework (`uml`, ADR 0009): switching it off removes the
  toolbar button, its menu, the templates shelf and the exports. A diagram already
  drawn keeps painting, stays selectable and stays editable.

- 911d143: UML 2.5.1 phase 2, structure and behaviour: component and deployment diagrams (component, port, provided and required interfaces, artifact, node, device, execution environment; deploy, manifest, communication path), activity and state machine diagrams (nineteen behaviour artefacts, partitions with an orientation toggle, regions, control flow, object flow, transitions with a parsed trigger/guard/effect label), their rules, readings, morphs, and their XMI and PlantUML exports.
- 911d143: UML 2.5.1 phase 3, sequence diagrams: the `sd` frame and the interaction it holds — lifelines with a named head and a dashed spine, execution bars, destruction marks, combined fragments whose operands are bands you add like a lane (alt, opt, loop, par, break, critical and the rest), and the `ref` interaction use. Five kinds of message (synchronous, asynchronous, reply, create, delete) draw §17.4.4's arrowheads and carry a parsed `name(args) : return` label; a sheet reads top to bottom, so the vertical order of the messages is the order of the conversation. Four rules, their readings, morphs, templates, toolbar and legend rows. PlantUML and XMI now **read** sequence diagrams as well as writing them — a `.puml` or a Papyrus `.xmi` opens as a drawn diagram, and a file this pack wrote comes back byte for byte — and draw.io recognises lifelines, destructions, fragments and messages best effort. Scope and exclusions in ADR 0022.
- 911d143: fix(edgeless): two findings of the UML recette. The imports and exports now sit in their own **Interchange** section at the END of the UML catalogue, where BPMN and Wardley already put theirs — they used to open the panel, filed under "Diagrams" above every artefact the framework draws. `uml.importXmi` keeps its senior-menu nomination and surfaces on the row through use (ADR 0014 § R3) instead of holding a cold-start seat. And **"Read this component" now describes every typed line touching an artefact**, not just one: a reading profile may declare several relation tables (`ReadingProfile.alsoRelations`), so a use case reads its associations, its `«include»` and `«extend»`, a class reads its generalizations, realizations and dependencies, a node its communication paths and an artifact its manifestations. A connector's per-end label (ADR 0020 — a UML multiplicity) is read with the far end's name: "Associated with: OrderLine (1..\*)".
- 911d143: fix(blocks): a framework board is never raised above a board it strictly encloses when it is moved or resized, so a UML frame (or a C4 board) holding inner regions no longer jumps to the front and hides its own content (rule R10). The UML legend draws a real pictogram per notation — class box with its separators, actor, use case ellipse, package tab, component, node cube, lifeline, the typed edges with their hollow heads — instead of a plain chip; the shared legend gains glyph and edge swatches for any framework that wants them.
- 46423ff: A UML artefact dropped in a translated host now arrives named in that host's language: the name a kind is seeded with, and the attribute, operation and slot lines of a fresh classifier, are resolved through the translation seam at placement instead of being written in English into the document. Twenty-six `com.labre.uml.seed.*` keys ship with the pack, derived from `UML_NAME_SEED` itself; with no catalogue registered every seed is the very English the pack wrote before.

### Patch Changes

- 911d143: Export SVG now works for a sequence diagram with a lifeline (it used to fail silently), and keeps the frames nested inside the exported board — UML subjects, partitions, regions and fragments, C4 boundaries — while still leaving out a neighbouring board that only overlaps it.
- 911d143: feat(blocks): a UML port dragged into the middle of its component is now reported. The validation engine gains a seventeenth rule family, `border-proximity` (ADR 0024): the subject's centre must sit within a declared tolerance, in model units, of the outline of a carrier node it overlaps. Overlap is the gate, so a glyph touching no carrier raises nothing and a sketch stays a sketch; the finding indicts the carrier and the carried element together, measured against the nearest carrier. UML ships its first rule of the family, `uml.port-on-border` (§11.3.4, tolerance 16 — the port glyph's own side), an audit on the sketch and a warning under Specification.
- 911d143: fix(edgeless): a combined fragment's rename gestures follow the words the canvas actually paints. A split fragment stored before operands existed can carry both a declared `name` and its `operands`, and the renderer already hides the declared guard behind operand zero's so the corner is not painted twice — but the hit test still derived a rename box from the stored model, so a double-click in that corner opened an in-place editor on a string nothing draws. The view now hit-tests against the same painted declaration the renderer is handed, so no label is clickable where none is drawn.
- 911d143: refactor(edgeless): the UML frames (diagram, subject, partition, composite state, combined fragment) now use the shared double-click rename of every framework board instead of a copy of it; nothing changes for the user. The shared editor accepts an optional `commit` on a label, for a name that a single property write cannot store (a fragment's operand guard). The UML diagram toolbar uses the shared "⋮" command entry.
- 9877228: A UML file whose ids are `__proto__`, `constructor` or `toString` — valid in XMI, in draw.io and in PlantUML — is read as ids and nothing more: the readers no longer write through to `Object.prototype`, and every shape still comes out with a box.
- 911d143: fix(edgeless): uml compartments, empty tiers and connector end labels

  Four things the PO's manual recette of the UML framework found:

  - **A classifier now grows to the height it is actually PAINTED at.** A tier
    wraps its words at the compartment's width, and the box was sized from the
    author's newlines alone — so one long attribute line was drawn through the
    separator under it and the node never grew for it. The line count is now the
    renderer's own wrap.
  - **A compartment emptied to its placeholder stays.** A canvas text with no
    words was deleted on commit, which took a classifier's whole name compartment
    out of its group and left the next double-click opening the shape's invisible
    inner text. A text that carries a framework ROLE **and a fixed width** is a
    compartment tier and survives being emptied; a roled label sized to its own
    words — a Wardley component's name, a BPMN task's — still goes.
  - **Morphing a classifier re-lays its compartments.** `«interface»` is a LINE
    (§9.5.4), so a class called `Ligne` becomes a two-line heading — and nothing
    re-fitted the box for it. The keyword is also written once now, never stacked
    on one that is already there.
  - **A double-click aimed at an arrowhead opens that end's label.** The 24-unit
    grab of `docs/adr/0018` was unreachable: a connector answered for its line
    only, so the gesture reached no view and the editor's add-text-here handler
    dropped a stray text block at the arrowhead instead. Only a connector a
    framework typed claims the discs — a plain arrow keeps its hairline — and each
    disc stops at the box of the element the end is bound to, a note or a frame as
    much as a shape.
  - **A board moved over a peer board no longer hides its own content.** Clearing
    the board it overlaps raised it just above the topmost background it covered,
    which for a UML diagram frame was the subject drawn inside it.
  - **A framework's toolbox re-ranks when it is reopened.** The popover was cached
    on the way out and handed straight back on the way in, so a command that had
    just earned its seat — an import, say — only appeared after a reload.

- Updated dependencies [87ef822]
- Updated dependencies [90ddf64]
- Updated dependencies [f294deb]
- Updated dependencies [911d143]
- Updated dependencies [911d143]
- Updated dependencies [0dcd69b]
- Updated dependencies [911d143]
- Updated dependencies [a441d96]
- Updated dependencies [4899136]
- Updated dependencies [2f5c621]
- Updated dependencies [911d143]
- Updated dependencies [8506cc4]
- Updated dependencies [9ecfc77]
- Updated dependencies [48213e7]
- Updated dependencies [dd1c772]
- Updated dependencies [512ab39]
- Updated dependencies [7437481]
- Updated dependencies [2e179bb]
- Updated dependencies [911d143]
- Updated dependencies [4f5faa3]
- Updated dependencies [e5d0e6e]
- Updated dependencies [911d143]
- Updated dependencies [f3f412a]
- Updated dependencies [d756a4a]
- Updated dependencies [6bc897b]
- Updated dependencies [f6ece47]
- Updated dependencies [ef0e3da]
- Updated dependencies [e2f6ca5]
- Updated dependencies [fff6bea]
- Updated dependencies [d1851b1]
- Updated dependencies [5a8ec30]
- Updated dependencies [549056e]
- Updated dependencies [2bb7318]
- Updated dependencies [7898f84]
- Updated dependencies [911d143]
- Updated dependencies [911d143]
- Updated dependencies [911d143]
- Updated dependencies [911d143]
- Updated dependencies [911d143]
- Updated dependencies [911d143]
- Updated dependencies [911d143]
- Updated dependencies [911d143]
- Updated dependencies [ad28f94]
- Updated dependencies [55d9f13]
  - @labre/affine-widget-edgeless-toolbar@0.42.0
  - @labre/std@0.42.0
  - @labre/affine-block-surface@0.42.0
  - @labre/affine-gfx-template@0.42.0
  - @labre/affine-gfx-ddd-shared@0.42.0
  - @labre/affine-model@0.42.0
  - @labre/affine-shared@0.42.0
  - @labre/affine-gfx-text@0.42.0
  - @labre/affine-gfx-connector@0.42.0
  - @labre/affine-gfx-shape@0.42.0
  - @labre/global@0.42.0
  - @labre/affine-gfx-pointer@0.42.0
  - @labre/affine-ext-loader@0.42.0
