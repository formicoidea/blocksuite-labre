# @labre/affine-shared

## 0.33.0

### Patch Changes

- 3fbf69c: feat(edgeless): a BPMN node changes into a nearby kind from its own toolbar

  Realising mid-draft that the rectangle should have been a **user task** used to
  cost a delete, a re-draw, a re-connect and a re-typed label — and every sequence
  flow attached to the node with it. Select a BPMN node now and its contextual
  toolbar carries a **Change type** dropdown: pick the user task, the timer start,
  the parallel gateway, the call activity, and the element stays the same element.
  Same box, same words, same wires, same id. What DOES change is the artefact's
  kind, its role and its appearance: a morph resets styling to what the target
  kind is born as, so a morphed node and one drawn fresh from the palette are the
  same element. One ctrl+z puts it back.

  What a node may become is **declared data**, not a derivation: six families —
  the three tasks, the three starts, the three ends, the two gateways, the two
  data artefacts, and the sub-process with the call activity. Nothing crosses
  between them, because a task and an end event are not the same claim about a
  process; and the text annotation and the group belong to no family at all, so
  the dropdown never appears on them. The role tree was the tempting source and
  the wrong one — it makes a task and a sub-process both activities, and only a
  human knows which pairs a reader accepts as "the same artefact, said more
  precisely".

  The capability itself is generic (`morphToolbarConfig`, in the surface package)
  and names no framework: a second framework gets the same dropdown by declaring
  its own families, its own patch per kind and its own icons, exactly as it
  already registers its validation rules. BPMN is the first taker, and registers
  it from its flag-gated half — a morph is tooling, so switching the framework off
  takes the menu away and leaves every node drawn, painted and checked as before.

  Kind and role are rewritten together in one atomic write per element, so the
  validation engine re-judges the board on its own and no rule ever sees an
  element that is half one artefact and half another. The patch is the shipped
  creation preset in full, which matters concretely for one pair on today's
  table: a sub-process and a call activity are the same rounded rectangle and
  differ only in border thickness, so a call activity really does come out with
  the thick border that IS the distinction between them. Everywhere else the
  members of a family already share a preset, and the full patch is kept anyway —
  insurance for the day a family gains a member that styles itself differently,
  and the guarantee that morph and palette can never disagree.

  One new telemetry event, `FrameworkElementMorphed`, carrying the two roles, the
  framework and how many elements one gesture rewrote — never board content. It is
  its own event rather than a creation one for the reason `FrameworkElementPromoted`
  is: a morph inserts nothing, and counting it as a creation would inflate
  "elements added per framework" forever.

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

- 13360cd: feat(edgeless): a C4 element changes into a nearby kind from its own toolbar

  Discovering, halfway through a container diagram, that the box should have been
  the **cylinder** used to cost a delete, a re-draw, a re-connect and three tiers
  of retyped words. Select a C4 element now and its contextual toolbar carries a
  **Change type** dropdown: turn a container into a database, a mobile app or a
  web app; turn a person or a software system into its external, grey twin. The
  component stays the same component — same box, same name, same description,
  same relationships, same ids — and one ctrl+z puts it back.

  What an element may become is **declared data**: three families — the two
  people, the two software systems, and the four containers (the plain box, the
  cylinder, the phone and the browser window). Every member of a family lays its
  words out identically, which is what makes the swap free of any re-layout: the
  three tiers stay exactly where they were. Nothing crosses between the families,
  and the **component** is deliberately in none of them — a component is a part of
  a container, not another drawing of one, and offering that swap would invite a
  diagram that mixes two levels of the model. Boundaries and boards are frames and
  are never offered it either.

  What changes is the shape's kind, its role and its full appearance, taken from
  the very table the palette draws from — so a morphed database and one drawn
  fresh from the sub-menu are the same element. That matters visibly here: a
  container paints its body natively and a cylinder, a phone and a browser window
  hand it to the renderer, so a two-field patch would have left a rectangle
  painted behind the cylinder. The grey of an external element moves with it for
  the same reason.

  The component's own words follow the shape too, under one timid rule: **only
  what the notation itself wrote is rewritten, never what you typed.** An
  untouched container morphed to a database is renamed "Database" and captioned
  `[Container: technology]`, because a cylinder captioned "Container" is a picture
  contradicting itself. A container you called "Customer database", built with
  React, keeps both — the name verbatim, and the technology carried across into
  the new caption.

  Under the hood, the generic morph module now supports **composite** artefacts: a
  C4 element is a native group holding the shape and its three lines of words, so
  a spec may say which element inside the selection the kind is actually written
  on, and what else the artefact owes the change — both inside one undo step.
  BPMN's own declaration is untouched. Registering it also lifted an invisible
  ceiling: a toolbar flavour used to hold at most two modules, and both of the
  group's slots were already taken (native group operations, and Wardley's
  qualification dropdown, which is on the group for the very same reason). A
  module may now name its owner, so several frameworks can contribute to one
  element's row, and a morph's toolbar entry is scoped by the framework that
  declared it so two of them on one row can never be merged into one dropdown.
  The whole view layer is mounted in a test that fails on the collision that used
  to be silent until the editor refused to open.

- 32e4d45: feat(edgeless): a `.bpmn` file imports from the catalogue — with an honest report — and export warnings reach the user

  The reader shipped in #160 and nobody could reach it. **Import BPMN XML** is the
  door: open the BPMN catalogue, pick the entry, choose a `.bpmn` file, and the
  process is on the canvas — pools, lanes, all seventeen artefacts, the sequence
  flows, the message flows and the associations, laid out where the file's diagram
  drew them, and brought into view.

  It needs nothing selected, which is the point: the moment you want it most is on
  an empty board. So it declines the pool's contextual toolbar (a contextual
  toolbar is a statement about a selection) and the senior sub-menu (which is what
  you reach for to draw something), and lives in the catalogue, the command
  palette and the agent surface. It does declare one precondition — it writes, so
  it withdraws from every surface on a read-only document rather than sitting
  there lit and doing nothing. It is keyless by default and bindable from
  Settings › Shortcuts like every other framework command.

  The whole imported file arrives in view: the fit is computed from the shapes,
  which is what makes a process a bpmn.io user dragged far across their canvas
  land at a readable size rather than as a speck beside the origin.

  **It is filed in a new `interchange` section, and the export moved in beside
  it.** The two directions of one format are one subject — this board as a `.bpmn`
  file, out and in — and the export was under `swimlanes` only because the pool's
  "⋮" is where it is reached from and a section of one is not a section. Nothing
  moved inside any section: a category is where a command is filed, not where it
  sits.

  **The import says what it cost.** A notification names what was drawn, what was
  carried (kept verbatim in the document, invisible on the canvas, because Labre
  has no artefact for it) and what was quarantined (kept, and deliberately never
  written back, because re-emitting it would produce a file that contradicts the
  drawing) — plus the BPMN version and the tool that wrote the file, so
  "bpmn.io drew it differently" is answerable in one line. When there are remarks,
  a second notification spells them out; past a handful it defers to a
  `console.table` that always holds all of them. That is v1 of the report (ADR
  0012's open question 4): the
  destination is the conformity panel, where an import remark belongs beside a
  validation finding, and the console is named as a stopgap rather than dressed up
  as a home.

  A file that is not a readable BPMN document — malformed XML, a DMN decision
  model, a choreography — is refused with the reader's own sentence, which knows
  which of those it was. Nothing is drawn, and nothing is half-drawn.

  What arrives is a new board beside whatever was already on the surface, never a
  merge, and the whole file is one undo step.

  **And the export's warnings finally reach somebody.** The writer has been
  recording what a board says that BPMN has no way to write down — a message flow
  on a board with no pool, an arrow with a loose end, an artefact drawn outside
  every pool that most tools will not render, an imported id that could not be
  given back — and the command threw the list away. It now raises one
  notification. The file still downloads, and it is still valid: a warning names
  what the format could not carry, not a failure.

  Both notifications go through the host's notification service. A standalone
  playground registers none and degrades to silence — the elements are on the
  surface either way.

- b03132c: feat(std): runCommand feeds an injectable usage store

  The editor now measures how recently and how often each command was invoked,
  and exposes the seam a host needs to persist those measures itself.

  `runCommand` — already the one place a command runs and the one place its
  telemetry is emitted — records every invocation into `CommandUsageIdentifier`.
  Every invocation, not every instrumented one: the call sits outside the
  telemetry condition, so core actions, toggles and the self-emitting commands
  are counted like the rest. Telemetry leaves for a dashboard; usage is local
  state the editor reads back, and the sub-menu that will show a framework's
  seven most relevant commands has to rank artefacts nobody thought to
  instrument.

  The default store keeps the pair of numbers in this browser's `localStorage`,
  capped and best-effort: a browser refusing storage costs a measure, never a
  command. A host that owns per-user state replaces it wholesale with
  `CommandUsageExtension(store)`, so the ranking follows the user from laptop to
  tablet instead of restarting at zero.

  Measurement only — nothing ranks anything yet, and no menu changes.

- 9022c92: feat(blocks): a framework background can declare zones its instances shape

  Until now a background's zones were the framework's: the same four quadrants on
  every Cynefin grid, the same four phases on every Wardley map. A framework can
  now declare that its elements carry a partition of their OWN plot —
  `instanceZones` names the model prop that holds it, which way the pieces stack,
  the line drawn between two of them and the style their names are written in.
  The named consumer is the **BPMN pool's lanes (couloirs)**, arriving in the next
  tranche; this one is the platform capability alone, and no framework in the
  library declares the field yet.

  Sizes are relative **weights**, never lengths. A pool with lanes of `1, 2, 1`
  gives the middle one half its height at any size, and dragging the pool taller
  redistributes the extra space proportionally instead of leaving a gap under the
  last band. It is the same reasoning every position in the primitive is a ratio
  of the plot for: a background survives being stretched, and so must the
  partition the user drew on it. A row with no finite, positive size is dropped
  with a warning and its neighbours share the space — one band fewer, never an
  invented one, and never a broken frame.

  The dividers are painted with the zone tints they separate, under the
  graduations and the axis lines; the names are written horizontally at the
  top-left of each band, with the other texts. Zone names are drawn by the
  renderer and are **not** double-clickable on the canvas: the label walk that
  feeds the hit tester is a function of the declaration alone, and a zone is
  created, deleted and renamed through its framework's own tooling.

  The audit reports an instance's zones after the framework's, namespaced
  (`lane:sales`) so a user-named zone cannot shadow a declared one, and carrying
  the user's own wording in a new optional `name`. An element's `zone` fact
  therefore now reads `lane:<id>` on a frame that partitions itself, with no
  change to how it is resolved.

  **No document changes**, and nothing on screen moves: a declaration that says
  nothing about instance zones paints exactly the picture it painted before, down
  to the canvas operation.

- edfaba2: feat(edgeless): interchange imports share one materializer, reporter and picker — and **Import BPMN XML** joins the senior sub-menu

  **Importing a `.bpmn` file no longer starts with finding the catalogue.** The
  entry is in the BPMN sub-menu, beside the artefacts, which is the first thing a
  user opens on an empty canvas — and an empty canvas is exactly where somebody
  who was just sent a process is standing. The PO decision of 2026-08-28 reverses
  the earlier reading ("the sub-menu is a row of things you draw") for the import
  alone: a board comes _from_ a file. The export keeps the old reading — it is
  what you do to a board you already have, and it is reached from the pool it is
  about. The row itself is unchanged in size: BPMN's toolbox has been past the cap
  for a while, so the sub-menu still shows thirteen ranked buttons plus **More
  artefacts…**, and the import takes a slot only for the user who actually reaches
  for it.

  The picker now filters on what the format itself declares, which is why a
  process saved as `.xml` — half the tools in the wild write one — can be picked
  again where the old hard-coded filter had it greyed out. What the file _is_ is
  still decided by the reader, which refuses anything that is not a BPMN
  `<definitions>`.

  **Under it, the import glue became the platform's rather than BPMN's.** Writing
  an imported board onto the surface, repairing the connector ends that named the
  source file's ids, fitting the drawing into view, and saying what the import
  cost were written once for BPMN and were never about BPMN. They are now five
  functions in `@labre/affine-block-surface` — `materializeInterchangeImport`,
  `reportInterchangeImport`, `importInterchangeFile`, `runInterchangeImportFile`
  and `interchangeImportersByExtension` — and they are the **public import API**:
  a host builds its own canvas import UI on them, and a framework's import command
  is one call. BPMN's own entry points are unchanged and behave identically.

  The two file-shaped entries are a pair, and a host wants the first of them:
  `importInterchangeFile(std, capability, file)` imports a `File` the caller
  ALREADY HAS — a drop, a paste, an "open with", a fetch from a document store —
  while `runInterchangeImportFile(std, capability)` is that same import with the
  picker in front of it, which is what a command wants. A drop zone must not be
  answered with a dialog, and neither should have to re-implement the id
  remapping or the viewport fit to avoid one.

  `interchangeImportersByExtension` answers "what could read a file called this",
  and answers with a **list**: `.svg` will be claimed by several frameworks at
  once, because which framework's vocabulary a picture is a picture _of_ is not a
  fact about a filename, and guessing on the user's behalf is the one thing
  `docs/adr/0012` refuses.

  **One report wording for every format, instead of one per format.** The
  notification composes the format's own name into a shared set of translation
  keys (`com.labre.interchange.import.*`), so a host translates "file imported"
  once rather than once per reader we ship, and a new format is never silently
  untranslated. What a BPMN user reads is unchanged, down to the version line.

  ### Breaking for hosts: seven translation keys are renamed

  `@labre/affine` is a **minor** for this reason alone. A host with its own
  catalogue keeps translating the old keys into nothing, and the notification
  silently falls back to English. The migration is one-for-one — the wordings are
  identical apart from `done`, whose format name is now composed in by the library
  rather than baked into the string:

  | removed                                         | replacement                                | wording                                                                         |
  | ----------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------- |
  | `com.labre.commands.bpmn.importXml.done`        | `com.labre.interchange.import.done`        | `BPMN file imported` → `file imported` (the library prefixes the format's name) |
  | `com.labre.commands.bpmn.importXml.failed`      | `com.labre.interchange.import.failed`      | unchanged                                                                       |
  | `com.labre.commands.bpmn.importXml.remarks`     | `com.labre.interchange.import.remarks`     | unchanged                                                                       |
  | `com.labre.commands.bpmn.importXml.console`     | `com.labre.interchange.import.console`     | unchanged                                                                       |
  | `com.labre.commands.bpmn.importXml.drawn`       | `com.labre.interchange.import.drawn`       | unchanged                                                                       |
  | `com.labre.commands.bpmn.importXml.carried`     | `com.labre.interchange.import.carried`     | unchanged                                                                       |
  | `com.labre.commands.bpmn.importXml.quarantined` | `com.labre.interchange.import.quarantined` | unchanged                                                                       |

  `com.labre.commands.bpmn.importXml` and `…importXml.description` — the command's
  own label and description — are **not** affected; nor is
  `com.labre.commands.bpmn.exportXml.warnings`, which stays BPMN's because no
  other format's writer speaks through it.

- e42e0c0: feat(std): the senior menu caps at fourteen and ranks seven past it

  A framework's senior button opens one row of buttons, and that row holds
  **fourteen**. Until now that number was a design review: the registry test
  refused a framework that _declared_ more than fourteen sub-menu commands, and
  nothing said what a framework should do once its toolbox honestly outgrew them.
  It now has an answer.

  Below the cap nothing changes at all — the sub-menu is the framework's authored
  list, whole and in the order its author wrote it. Past it, the row becomes a
  **shortcut to the seven artefacts this user actually reaches for**: the four
  most-used plus the three most-recent, deduplicated, with a command that tops
  both axes taking one slot and handing the freed one back to frequency. Two axes
  rather than one, because frequency alone never surfaces the tool picked up
  yesterday and recency alone would reshuffle the row at every click.

  The seven are then laid out **in authored order, never in rank order**. What the
  ranking decides is membership; position stays where the framework put it,
  because a menu whose buttons swap places under the cursor is precisely the
  pattern this feature exists to avoid. On a fresh install, with nothing measured
  yet, both axes collapse to authored order and the row shows the first seven — a
  cold start that is deterministic rather than empty.

  The ranking reads the framework's **whole catalogue**, not the fourteen its
  author picked. An artefact left out of the row that a user invokes constantly
  has earned a slot, and a selection that could only ever demote would never learn
  that.

  Beside the seven sits a permanent **More artefacts…** button, opening the
  catalogue sidepanel on the framework's full toolbox — and it appears only when
  something answers the new `ArtefactCatalogueProvider` seam, since a button that
  opens nothing is a dead control. The seam ships here as an interface; the panel
  behind it arrives in its own release.

  **Nothing visible changes today.** The largest framework in the library declares
  thirteen artefacts, so no senior menu is past the cap and every one of them
  still shows its whole toolbox. This is the rule the BPMN full pack will be the
  first to meet.

  > **Superseded later in this same release** — "The senior sub-menu seats
  > thirteen". The PO re-arbitrated on 28/08/2026: the row seats **thirteen**
  > (seven most-recent + six most-used), and the ranking reads the framework's
  > **nominated `senior-menu` list** rather than its whole catalogue. The cap of
  > fourteen, the author-order position law and the deterministic cold start below
  > are unchanged.

- 256ee0b: feat(edgeless): the artefact catalogue sidepanel

  A framework's senior sub-menu is a row of icons, and a row of icons stops
  working somewhere around fourteen. The catalogue is where the rest go: a
  full-height column down the left edge of the editor, listing everything the
  framework declares on the `'catalogue'` surface — grouped by the categories the
  framework itself declared, each artefact spelled out with its icon, its
  translated label and its keyboard chord instead of guessed from a glyph.

  It is drawn from the command registry and nothing else, so a framework that
  adds an artefact gets a row for it with no code written here. Rows are at least
  44px tall because these boards are worked on a tablet as often as on a laptop;
  the list scrolls, the canvas behind it does not. One tap runs the command and
  puts the panel away — and X, Escape and a click on the canvas all close it on
  the first gesture, none of them touching the tool the user had armed.

  `ArtefactCatalogueProvider` is the seam. The library registers its own panel as
  the default implementation, unconditionally; a host that already owns a sidebar
  registers `ArtefactCatalogueExtension(service)` and takes the catalogue over,
  after which the library's widget is never asked to open.

  Dormant until something opens it: no framework overflows its sub-menu yet, so
  today nothing calls `open` — the panel is there for the BPMN pack and for the
  hosts that want the catalogue on their own terms.

- 6a20738: The catalogue scrolls under the wheel, stays open while furnishing, and can be switched off

  Three PO-recette corrections (27/08/2026). A wheel over the sidepanel now
  scrolls the artefact list instead of panning the board behind it — the same
  capture-phase fix the violation bubble earned in PR #103, scoped to the
  panel's own box so the canvas beside it keeps panning. Inserting an artefact
  no longer closes the panel: furnishing a diagram is several artefacts in a
  row, and the exits (close button, Escape, click-away) are all still one
  gesture. And `ArtefactCatalogueExtension(null)` is now the documented
  cold-assembly switch-off: the provider answers nothing, the "More artefacts"
  button is not rendered, the library panel never opens.

- f09f9a3: The senior sub-menu seats thirteen — seven recent, six most-used — and only
  commands that belong there

  Two PO rulings of 28/08/2026 on a framework's senior sub-menu past the cap.
  Both **supersede the arbitration recorded on 26/08/2026** ("the senior menu caps
  at fourteen and ranks seven past it", earlier in this release): that entry's cap
  of fourteen, author-order position law and deterministic cold start all stand —
  its slot count, its 4 + 3 split and its "rank the whole catalogue" rule do not.

  **Only its declarers are eligible.** The ranking used to read the whole
  catalogue, so a command that deliberately declines the sub-menu could be dragged
  into it by its own usage: the PO met "Export BPMN" in a row of things you DRAW
  and rightly asked what it was supposed to export. Membership is now drawn from
  the `senior-menu` surface alone — a declined surface is a statement about where
  a command belongs, not a default usage may out-vote. The overflow trigger still
  reads the catalogue, and the sidepanel's "Recent & frequent" head section still
  ranks it too: that panel is where every command of a framework is reachable, so
  a board action really does belong at its head.

  **Thirteen slots instead of seven, recency first.** Seven buttons in a
  fourteen-wide row left it half-empty; thirteen plus the permanent "More
  artefacts…" button is exactly the cap. The split is inverted to seven
  most-recent plus six most-used, because what you reached for this morning is
  what you are still working on. A command that tops both axes takes a recent
  slot, freeing its most-used slot for the next workhorse down. Display order
  remains author order — the ranking decides membership, never position — and a
  cold start still opens on the authored head, now thirteen deep.

  **The sidepanel's head section stays at seven.** Both PO rulings are about the
  sub-menu, and thirteen is argued from its geometry: a horizontal row of icon
  buttons where thirteen plus "More artefacts…" makes the fourteen cap. None of
  that transfers to a vertical list of 44px rows in a 320px panel, where thirteen
  would fill a laptop's first screen with duplicated shortcuts and push every
  category below the fold. The two surfaces share the arbitration and not its
  magnitude: the head keeps its own split (four recent + three used), so both
  halves of a section labelled "Recent & frequent" survive.

- Updated dependencies [f929e12]
- Updated dependencies [c03090c]
- Updated dependencies [139d77b]
- Updated dependencies [6bba40c]
- Updated dependencies [a8325bb]
- Updated dependencies [ff19911]
- Updated dependencies [b03132c]
- Updated dependencies [48049d6]
- Updated dependencies [7136db0]
- Updated dependencies [5737a56]
- Updated dependencies [168617d]
- Updated dependencies [e42e0c0]
- Updated dependencies [4a3b26e]
- Updated dependencies [48c3b52]
- Updated dependencies [f09f9a3]
  - @labre/affine-model@0.33.0
  - @labre/std@0.33.0
  - @labre/global@0.33.0
  - @labre/store@0.33.0

## 0.32.0

### Minor Changes

- 0473dcb: feat(edgeless): add keyboard shortcuts for duplicate and apply last style

  Duplicate (previously toolbar-only) is now bound to Mod+D on the canvas, and
  Mod+Y applies the last used style to the selection — across element types.
  Both are edgeless-scoped, enumerable and host-rebindable via the shortcut
  manifest (`getShortcutManifest`).

  - Mod+D duplicates the current selection. On mac this is Cmd+D and coexists
    with the existing Ctrl+D = delete binding; on Windows/Linux it is Ctrl+D.
  - Mod+Y repaints the selected elements with every style prop the user last
    set, wherever the target type supports it: a fill picked on a rect applies
    to an ellipse, a font style set on a text applies to a shape. Props foreign
    to the target type are dropped per prop (schema-filtered), geometry and
    content are never touched, and one undo restores the previous styles.

- 3c5c97e: feat(edgeless): map quality — a checklist you tick and a check-up you ask for (PF5.14, PF7.10, PF7.11, PF13.8, PF13.9)
  A rule only belongs in the real-time engine if an algorithm can decide it, on
  persisted data, inside the 16 ms budget. Everything else was homeless. This
  slice gives it a home: a **Map quality** panel on the framework's own instance,
  with the things the tool cannot judge on one side and the things it can — but
  that are not urgent — on the other.
  - **A check-up is about ONE map.** It walks the whole surface — that is where
    the elements are — but the answer is narrowed to the instance the user asked
    about, on the `backgroundId` every family measuring against a frame already
    records. A board carrying two Wardley maps holds two independent answers, and
    a panel showing the neighbour's would be the whole-surface tally the majority
    family goes out of its way not to compute. Narrowed in the engine, not at the
    rendering, so a run reaching a host or the agent is already about one map; the
    run names its instance, and the panel refuses one that is not its own.
  - **A second evaluation moment.** A rule now carries `moment: 'realtime'`
    (the default, and what every rule written so far means) or `'on-demand'`. An
    on-demand rule is not filtered out of the drawing path, it never enters it:
    the moment is tested before the rule reaches a profile lookup, let alone an
    element — and in the frame bookkeeping the manager does around the evaluation,
    which is a full surface walk per rule once per tick and would otherwise have
    handed the drawing budget back exactly what the second moment took away
    (+58 %, and invisible to a bench that times the evaluation alone). Its results
    land on `ValidationManager.checkup# @labre/affine-shared
, a signal of its
    own — so they never reach the timeline, the bracket or the badge, and "outside
    the canvas affordance" is a property of the wiring rather than a filter
    somebody has to remember. A run carries one timestamp, taken when the user
    asked, and yields the thread between rules once it has held it for a frame,
    reporting `done / total`as it goes. A run started while another is still
    yielding supersedes it. A rule that throws ends the run _visibly_ — reported
    finished, carrying`error` — because the one thing a failure must not do is
    leave the panel believing a check-up is in flight, which reads as "Checking…"
    for ever and disables the only button that could try again.
  - **Nudges: expectations the tool cannot check, and does not pretend to.** A
    framework declares them as data — `{ id, framework, labelKey, fallback }` —
    and nothing ever evaluates them. They are offered as a checklist, and ticking
    one is the same gesture as granting an exception: the user says "I have taken
    care of this", and the tool records that rather than claiming to have looked.
  - **One entry, in the dropdown that was built for it.** PF9's Validation
    dropdown was written to render SECTIONS and shipped with one; Map quality is
    the second. It opens a panel — four boxes to tick, a **Run check-up** button
    and the remarks that come back — because a menu that closes on the first click
    is the wrong shape for a surface you work in. The same panel is reachable from
    the command registry (`validation.mapQuality`, palette and agent), so it is
    one command with several surfaces rather than two implementations.
  - **Generic, not Wardley.** Nothing in the panel, the entry or the command names
    a framework, a role or a rule. Whether an instance has a checklist or a
    check-up is derived from what the frameworks registered, exactly as the
    profile picker already derives which profiles it may offer. A second framework
    declaring either gets all of it with no code written anywhere.
  - **Wardley Q1–Q4** ship as data: the title that frames the study, the context,
    the legend, the evolution axis being used and legended. Four things a map needs
    in order to be discussed, and not one of them decidable by a machine.
  - **Wardley Q5 — the tone convention.** A new `tone-convention` rule family: the
    landscape is drawn in greys, red is reserved for what is moving and green for
    benefits. The sanctioned tones are named against the frame's OWN declared
    palette (three new entries: `landscape`, `change`, `benefit`), so a rule
    restates no colour the background owns and a host restyling the frame restyles
    the convention with it. The comparison is by tone family, never byte for byte,
    or every legitimate shade of grey the shape toolbar can produce would be a
    finding. A colour the engine cannot honestly read — a theme variable with no
    tone in its name, a gradient, `transparent`, the stored fill of an unfilled
    shape — yields silence rather than a guess.
  - **Wardley Q6 — shipped inert.** "Most of what you have mapped is an activity;
    the phase names for activities would read better" needs the type-3 **nature**.
    The new `majority-fact` family is built for a fact that may not be there yet:
    a surface where not one subject carries it raises nothing, silently, per map.
    MF3 has since landed the nature — as a tag def pack, with the qualification in
    the element's `tags` (a nested `Y.Map<string[]>`), not as the flat prop this
    family reads. So Q6 still says nothing, now because the fact sits somewhere
    `majority-fact` does not look. Teaching a generic engine family to read a tag
    is its own slice; until then the gap is pinned by two assertions that state
    both ends — the tag id that exists and the flat prop that does not — so it
    cannot rot into "later means never".
    Two new telemetry events, `MapQualityNudgeToggled` and `MapQualityCheckupRun`,
    carry the framework, the nudge id and the counts — never board content. A nudge
    everybody ticks immediately is a reminder nobody needed; a nudge nobody ever
    ticks is an expectation the tool failed to make actionable. Nothing else can say
    either, because nothing here is ever computed.
    **Persistence.** One new optional `@field()` on the base element model,
    `qualityChecklist: string[]` — the ids ticked on the instance. Declared on the
    BASE class for the same reason `role`, `validationExceptions` and
    `validationProfile` are: an element re-created from props only reaches the Y.Map
    through declared accessors, so a per-subclass declaration would be silently
    dropped on copy. Its default is `undefined` and is never written, so an instance
    with nothing ticked stays byte-identical to one created before the field
    existed: no block schema change, no version bump, no migration, and documents
    written before and after remain mutually loadable. Unticking the last one removes
    the KEY through `clearField` rather than leaving an empty array behind, so an
    emptied checklist is byte-identical again too — in the document, and not merely
    through the getter. Ids of nudges no framework declares any more are kept rather
    than pruned: the tooling comes and goes with a flag, the decisions recorded on it
    do not. `setNudgeChecked` enforces read-only itself, at the seam, like
    `setProfile` and `setException` do: a disabled checkbox covers exactly one
    caller, and `clearField` goes through `Store.transact`, which — unlike
    `addBlock` / `updateBlock` / `deleteBlock` — carries no read-only guard of its
    own, so unticking would genuinely delete the key from a document nobody may edit.
    **Cost.** Measured, not asserted: registering the two Wardley check-up rules
    beside the three real-time ones leaves both the verdict and the timing of the
    drawing path unchanged on the 500-element reference map. The two timings are
    measured on INTERLEAVED samples, because taken one after the other they compare
    two moments in the runner's life as much as two rule sets — the same evaluation
    drifts by half again between back-to-back medians, which is several times the
    effect being looked for. That is the whole point of the second moment.
- 02797b5: Surface elements can now be an **occurrence of a pivot record**: a new optional
  `pivotDocId` field on `GfxPrimitiveElementModel`, a `pivot.bind` command that
  writes it, and an injectable `PivotPropertiesProvider` the host implements to
  turn that id into displayable properties. Implements ADRs 0005 and 0006.

  A pivot record is a document owned by the host application holding the durable,
  cross-board identity of a business object ("the Payments component"). A Wardley
  `component` drawn on three maps is the _same_ component; until now the library
  had no way to say so.

  **The field.** `pivotDocId?: string`, declared on the BASE element class next to
  `role` and `validationExceptions`, for the same reason: an element re-created
  from props (paste, duplicate, alt-drag clone, template insertion) only reaches
  the Y.Map through keys with a declared accessor, so a per-subclass declaration
  would be dropped on copy — invisibly, until the next reload. It is **distinct
  from `linkedDocId`**, which is a hyperlink (one target per element, exclusive
  with `externalLink`, opened by the hover arrow) rather than an identity
  (many elements to one record). An element may carry both; code reading one as a
  stand-in for the other is a bug.

  **No version bump, no migration, and none is needed.** Surface elements carry no
  schema version and have no upgrade hook, unlike block schemas — where the
  analogous `externalSourceId` forced `affine:database` from version 3 to 4. The
  field is additive and an absent key reads as `undefined`. An element that never
  binds writes no key at all, so it stays byte-identical to one created before
  this release. Old documents open unbound; documents carrying the field open on
  older builds, which preserve the key without reading it.

  **Release-ordering constraint, and why this release satisfies it.** The
  declaration of a field must ship no later than anything that writes it: on a
  client that does not declare `pivotDocId`, the five element-creation-from-props
  paths drop the key silently — no exception, no warning, no telemetry, the copy
  looks correct in the session and is unbound on reload. Declaration and its one
  writer therefore ship **together**, and the writer is a command with no default
  keyboard binding and no menu entry in the library, so nothing writes the field
  until a host wires its own record picker to it. Fleets that must interoperate
  with clients older than this release should roll the library out before enabling
  that host UI.

  **The command.** `pivot.bind` (owner `core`, availability `selection`, surfaces
  `palette` + `agent`, keyless by intent and still bindable from
  Settings › Shortcuts). Its parameter is `{ pivotDocId: string | null }`, where
  `null` unbinds — the key is required, so a forgotten argument cannot silently
  destroy a binding. The library never chooses a document: which record to bind to
  is the host's decision, passed in. `store.captureSync()` runs **before** the
  write, so a bind issued within 500 ms of a drag is its own undo step rather than
  being reverted together with the drag. Unbinding removes the Y.Map key rather
  than leaving a tombstone.

  The command emits one new telemetry event, `FrameworkElementPromoted`
  (`rung`, `direction`, optional `framework`/`role`, `elementCount`). It is
  deliberately not `FrameworkElementAdded`: a promotion inserts nothing, so
  reusing the creation event would count a drawn-then-bound shape twice and
  inflate "elements added per framework" permanently. Its `labelKey` is the first
  under `com.labre.command.*` rather than `com.labre.keyboardShortcuts.*` — hosts
  shipping a translation catalogue must add `com.labre.command.pivot.bind` and
  `com.labre.command.pivot.bind.description`, or the English `labelFallback` is
  used.

  **The provider.** `PivotPropertiesProvider` + `PivotPropertiesExtension(service,
{ hoverFields })` in `@labre/affine-shared/services`. `properties$(pivotDocId,
{ fields })` returns a `ReadonlySignal` **synchronously** — there is no
  `Promise`-returning method on the read path, so no call site can `await` one and
  the host's latency budget cannot leak into a gesture. Values are typed and
  render-free: no `TemplateResult`, no HTML, ever. The provider is told which
  fields to load and must load only those; `hoverFields: []` means the library
  does not call it at all. **No noop default is registered**: absence is a
  meaningful state (standalone playground, tests, a host build that failed to
  register), so it stays the tested default path. Every provider call is guarded,
  and a throwing host degrades rather than crashing a hover.

  **Backlinks are computed, never persisted.** `collectPivotOccurrences(surface,
pivotDocId?)` walks the surface and returns the occurrences; there is no index,
  no reverse map, no cache and nothing written back. Cross-document aggregation is
  the host's, built from per-document calls.

  The command is gated on `store.readonly` in both its `when` predicate and its
  body. The predicate is what a surface consults; the body guard is what actually
  protects the document, because `runCommand` consults neither `when` nor
  `availability` and the palette and the agent reach `run` directly. Binding in a
  read-only document used to throw out of `runCommand`, and unbinding used to
  **succeed** — `clearField` goes through `Store.transact`, which carries no
  read-only guard of its own.

  Also in `@labre/std`, two additions to the command registry:

  - `AnyCommandDescriptor`, the registry's element type with its parameter
    contract erased. The registry is heterogeneous now that a command takes
    parameters, and `CommandDescriptor<void>` could not express that.
    Registry-facing signatures (`CommandExtension`, `runCommand`,
    `getRegisteredCommands`, the two projections…) use the alias; existing
    `CommandDescriptor[]` declarations are unaffected.
  - `CommandManifestEntry.params?: CommandParam[]` — a minimal serializable
    description (`key`, `kind`, `required`, `nullable`) derived from the
    descriptor's zod schema, so the `'agent'` surface is usable end to end. The
    schema itself never crosses the seam. Derivation is all-or-nothing: a
    parameter the reader cannot describe withdraws the whole contract rather than
    advertising a partial one. Nullary commands are unaffected — they project no
    `params` key at all.

- 5d16745: Clicking a component now asks the tool **what it reads of it**, and offers the
  answer as a proposal: type of node, nature, parent-child relations, evolution
  phase and naming convention — with nothing written anywhere until the user
  confirms. Implements MF3 (reversed reading), on the PO arbitration of
  01/08/2026: _triggered on a click, never by automatic validation, and no write
  without confirmation._

  **The trigger is a gesture, and only a gesture.** A new `element.read` command
  (owner `core`, availability `selection`, surfaces `palette` + `agent`, keyless
  by intent) opens the proposal; the selected component's contextual toolbar gains
  a **Read this component** entry that invokes the same command with the element
  id, so the toolbar, the palette and the agent share one implementation. Nothing
  opens it by itself, and nothing about validation reaches it. `element.read` is
  deliberately **not** read-only gated: reading a board one cannot edit is exactly
  as legitimate as reading one you can.

  **The five readings, each a function of data the document already carries.**

  - **Type of node** — the element's `role`, plus the chain it specialises,
    resolved through the framework's own role vocabulary (`wardley:market` reads
    as "a kind of Component" because the framework said so, not because the panel
    knows what a market is).
  - **Nature** — the type-3 tags the element CARRIES. When it carries none the
    field is empty and stays empty: no nature is inferred from the shape, from the
    name or from the position. That is the whole of the arbitration, and it is the
    one thing the reading refuses to do.
  - **Parent-child relations** — the typed edges touching the element, read with
    the ADR 0010 convention (`source` is the subject of the role's verb; for
    `wardley:dependency` that makes the source the consumer). Consumers read as
    "above", suppliers as "below", and **a link whose declaration contradicts the
    drawing is named as such** — W4 seen from the record's side, reported without
    picking a winner. An edge with an unbound end, a neutral connector and a
    self-loop are all skipped.
  - **Evolution phase** — the declared zone the element's centre falls in, taken
    from the framework background's own `zones`, plus "in the zone of punctuated
    equilibrium" when it sits inside a declared transition band. A component that
    is on no map has no phase, and the panel says so rather than guessing the
    nearest one.
  - **Naming convention** — declarative data per nature, shipped by the framework.
    Wardley's is deliberately **one motif**: does the name read as an action? The
    gerund is expected positively for `activity` and negatively for `data`,
    `practice` and `knowledge` — four entries, no word list, no dictionary the
    library would then own. It is a suggestion with the framework's own wording,
    never a violation, and it is silent on an unnamed element or on a nature no
    convention describes.

    **The motif is English, and the data says so.** A convention declares its
    `lang`, and the engine applies it only when the host says it is serving that
    language — so a board named in French gets silence rather than a confident
    wrong answer in both directions ("Facturation" told to use a verb, "Planning"
    told it reads as an action). A host that declares no language gets silence
    too. Extending the coverage is adding one convention per language for the same
    value, not changing code. This is what `TranslationService.language` (new,
    optional) exists for, and it is the only thing the library reads it for: the
    library still holds no catalogue and still negotiates no locale.

  **Confirming is the only write, and it reuses the existing rungs.** The panel
  proposes a nature only when the LINKED RECORD carries one the element does not,
  **and only after resolving the record's word against the framework's own tag
  def** — by value id, by id case-insensitively, then by label, with no fuzzy
  match anywhere. A pivot record is the host's document and its "nature" property
  holds the host's words (`"Activity"`), while an element carries namespaced value
  ids (`wardley:nature/activity`): they are not the same alphabet. What cannot be
  resolved is named in a sentence and offered no button — writing it would put a
  value no def describes into the document (the naming line vanishes, the
  qualification dropdown shows a raw id, rules stop matching), and comparing it
  would report a permanent false drift on an element that is correctly qualified.
  `tag.set` deliberately does not police its values, so the guard stands at the
  point of proposal. Confirming runs the existing `tag.set`; linking to a record runs the existing
  `pivot.bind` with an id the HOST supplies through a new
  `PivotRecordPickerProvider` — with no picker registered the action does not
  exist (hidden, not disabled), like every other seam whose absence is meaningful.
  In a read-only document the readings are all there and the confirmations are
  not. A unit test and an integration test both assert the invariant that matters:
  opening and closing a proposal a hundred times leaves the document byte-identical.

  **The drift trigger.** A bound element whose position or qualification changes
  gets one informative, non-blocking line: the board and the record disagree, with
  "Update the record" wired to the existing fire-and-forget materiality publisher.
  It is debounced (200 ms), asynchronous and **local-gated** — a colleague's drag
  is their drift to notice — so it is never on the 16 ms path of the gesture that
  caused it, by construction rather than by measurement. The comparison is bounded
  to the two record properties a framework names (`recordKeys`), read through the
  guarded `queryPivotProperties`, and — on the nature — to values the framework's
  own def describes: no provider, no configured fields, a property the record does
  not carry, or a word in the host's alphabet, and the trigger says nothing at
  all. A host whose record spells things differently gets no comparison and no
  drift, and that is now true of the VALUES as well as of the keys.

  **Everything a framework contributes is data.** `ReadingProfile` — roles,
  subject role, nature tag and its conventions, edge role, background declaration
  and phase axis — registered with `ReadingProfileExtension` from the framework's
  **flag-gated** view extension, exactly like its rules and its profiles. Reading a
  map is tooling: switch the Wardley flag off and the entry, the panel and the
  trigger vanish while every element still loads, paints and stays selectable
  (ADR 0009). The engine (`readElement`) is pure and names no framework; the panel
  resolves every word through the host's catalogue with the framework's own
  English fallback.

  `element.read` declares `surfaces: ['palette', 'contextual-toolbar', 'agent']`,
  and the toolbar entry and the panel's confirmations report
  `contextual-toolbar` as their invocation surface — a reading triggered by
  clicking a component is not a palette invocation, and the telemetry says so.

  Hosts shipping a translation catalogue gain the `com.labre.reading.*` keys (the
  panel's chrome and the toolbar entry), `com.labre.command.element.read[.description]`,
  and Wardley's `com.labre.wardley.reading.naming.*`. All of them carry English
  fallbacks, so a host with no catalogue reads correctly. A host that also
  implements the new optional `TranslationService.language` gets the naming
  suggestions; one that does not keeps every other reading and simply never sees
  that line.

- 985a92f: fix(edgeless): the contextual toolbar is one line, and gives way instead of wrapping

  PO arbitration of 02/08/2026. The contextual toolbar of a selected element used
  to WRAP when it ran out of width — which, on the map the PO was looking at, put
  the "⋮" alone on a second line. A toolbar whose height depends on the selection
  is a toolbar that moves under the cursor. It now stays one line at every width,
  and spends its least important entries instead.

  **The row measures itself.** Every render is measured once, whole; when it
  overflows the cap the editor gives it, the widget re-renders it with the entries
  that have to give way. Widen the editor and they come back — the collapse is a
  view state and nothing about it is written to the document.

  **Two ways to give way, in that order.** An entry that declares an `icon` AND a
  `label` drops its label first and keeps it as its tooltip: a row of icons is
  still a row of things you can click. Only then does an entry leave the row for
  the "⋮" menu that is already there, where it keeps its FULL label and its
  behaviour. Every entry that can shrink shrinks before any entry moves.

  **Nothing in the widget names a framework.** Which entry gives way is decided
  entirely by the entries' own config: a new `priority?: number` on every toolbar
  action (higher stays on the row longer, `0` by default), plus whether the entry
  has an icon and a label to trade. Say nothing and you keep exactly the order the
  toolbar has today, minus the wrap — an entry rendered later gives way first. An
  entry that brings its own template (`content`) or its own sub-actions is opaque
  to the widget and keeps its place: the two qualification dropdowns keep their
  text, because a dropdown nested inside a dropdown is worse than a dropdown that
  stayed.

  For our own tranches: **Read this component** gains an eye icon, so a tight row
  turns it into an icon with a tooltip rather than pushing it into the menu; and
  **Revoke exception** — rare, wordy, with no icon to fall back to — declares
  `priority: -1` so it is the first entry to move, despite sorting early.

  The measuring and re-rendering live in the widget; the arithmetic that decides
  which entries are spent is a pure function in `@labre/affine-shared`, pinned by
  its own unit suite.

- 1efc6d5: feat(edgeless): an element can say what KIND of thing it is (MF3)

  Implements ADR 0007: the level-3 contextual qualification of a surface element,
  the format its definitions take, and the one-way reflection of a bound
  occurrence's qualification onto its pivot record (ADR 0006 § 4).

  Level 2 said what an element IS on a map (`role`, PR #71). Level 3 says what
  kind of thing it is — a Wardley component is an activity, or data, or a
  practice, or knowledge — and that is a different question, authored on the
  element, reflected onto the record, and read by the rules engine.

  - **`tags?: Y.Map<string[]>` on `GfxPrimitiveElementModel`**, keyed by
    namespaced tag def id. A NESTED Y.Map and not a plain object, because
    `@field()` writes straight into the element's Y.Map with no `native2Y` in the
    path: a plain object there is ONE opaque value, so two people qualifying the
    same element on two DIFFERENT tags would silently lose one of the two. The
    nested map merges per tag; the `string[]` of a single tag stays
    last-write-wins, which is correct — one tag's value set is one atomic choice.
    There is no migration runner for surface elements, so the shape is chosen
    once, and an under-powered merge is the harm class the red zone exists to
    prevent.
  - **Default `undefined`, never stamped.** Declared on the BASE class so paste,
    duplicate and alt-drag clone preserve it for every primitive type at once,
    and absent by default so an element that is never qualified stays
    byte-identical to one created before the field existed: no schema version
    bump, no migration. Removing the last tag removes the key rather than leaving
    an empty map behind.
  - **`UniverseTagDefs` + `UniverseTagDefsExtension`**, the tags-only DI registry.
    Variant-parameterized on `packId` with `di.override`, so distinct packs
    accumulate and identical packs REPLACE: a host that re-registers on every
    render never throws and never grows the registry. The merge is total and
    silent — an invalid id, a cross-framework id, an unknown `formatVersion` each
    drop the offending def and record an issue. Nothing throws, ever: a
    misconfigured pack must never cost a user their board.
  - **The Wardley natures** (activity / data / practice / knowledge) ship as the
    library's one real pack, on the same mechanism a host uses for its own
    taxonomy. A client's private extension is a second pack with another
    `packId`, with no library release.
  - **`tag.set`**, a keyless `core` command taking the tag id and its values
    (`[]` clears). Read-only gated in `when` AND in `run`, `captureSync()` BEFORE
    the write, one `FrameworkElementPromoted` per gesture on the `tag` rung. Like
    `pivot.bind` it is self-emitting, and enumerated as such in the registry
    invariants test.
  - **A "Nature" section on the element toolbar**, generic in shape (it names no
    framework and builds from the seeded packs) and parameterized by the
    registrar's `RoleDefs`. It resolves through a canvas group to its single
    role-bearing member, so one click on a Wardley component reaches it.
  - **`PivotMaterialityPublisher`**, the local-gated watcher that reflects a bound
    element's qualification onto its record. Driven by Yjs transactions rather
    than by the setter or the command layer, because undo goes through neither: a
    setter-driven design desyncs the record on the very first Ctrl+Z. Coalesces
    per element per microtask, publishes full state, de-duplicates, and RETRACTS
    (`present: false`) on deletion, unbind and re-bind, so a record never keeps
    materialities attributed to an occurrence that no longer exists.

  **Release ordering, adopted from #67 recommendation #4 and unchanged from
  #89.** This release DECLARES the field; nothing in the product writes it until
  the host wires a qualification surface. Ship the declaration release before any
  release that writes `tags`, so the fleet floor tolerates the key.

  An older client keeps the value through load / edit / save (`syncElementFromY`
  mirrors every entry into `_preserved`), and — unlike `pivotDocId` — it keeps it
  on the five element-creation-from-props paths too, **as a plain object**: an
  undeclared key goes down the unknown-key branch, whose encodability guard
  accepts the serialized nested map because it is flat JSON. Nothing is lost; the
  shape is simply not the specified one. This release therefore also READS that
  degraded shape and CONVERTS it, preserving its content, on the first write —
  without which the declaring release would answer `{}` for a qualified element
  and then overwrite a colleague's tag, which would empty the release-ordering
  rule of its meaning.

  Two supporting changes in `@labre/std`, both consequences of the field being a
  nested Y type on the base class:

  - `syncElementFromY` re-attaches an `@observe`d nested type when the key itself
    is rewritten. Remote peers and undo/redo never reach the accessor's setter,
    the only other caller of `startObserve`, so the observer was left on a dead
    type and every later in-place mutation went unseen.
  - `startObserve` no longer warns for an ABSENT optional Y-type field. An
    unqualified element is the normal case, not a misuse.

- fad4c08: feat(edgeless): no rule is a wall — validation exceptions (PF8)

  A rule that cannot be waived is a wall, and a whiteboard with walls stops being
  a thinking tool. Every violation now carries its own way out, on the message
  that reports it.

  - **One click, on the bubble.** Each rule named in the violation bubble carries
    an "Ignore this validation rule" action. No detour through a settings panel,
    and no waiting: the gesture applies immediately.
  - **The exception is written on the element.** It lands in the document as
    `{ ruleId, author?, at }`, on the elements the rule actually indicts — so it
    says nothing about the next component, and nothing about the next rule. It
    rides along on a copy, a duplicate, a "turn into linked doc" and an export,
    and it dies with the element it belongs to.
  - **The finding changes state, it does not vanish.** An excused violation is
    still reported: it drops out of the flash and the bracket and its badge goes
    grey, but it keeps its line in the bubble, now reading "exception" and
    carrying a **Revoke** that puts it straight back. A board can never hide an
    arbitration it was told to make.
  - **One map, once you have said it twice.** After the same rule has been waived
    somewhere else on the board, the bubble offers "Ignore this rule on the whole
    map". Accepting writes the exception on the framework's own background
    element — and on THAT one only. A violation of `element-in-background` now
    records the background it is attributed to: since no background contained the
    element (that is what the violation says), it is the NEAREST one, by
    edge-to-edge gap, with exact ties broken by the smaller id so the answer never
    depends on the order the surface was walked in. A board carrying three maps
    therefore holds three independent arbitrations: waiving a rule on one says
    nothing about the map beside it, and deleting a map takes exactly its own
    arbitration with it. Map scope is just as visible and just as revocable as a
    local one.
  - **Arbitrations survive the framework cycle.** Switching a framework off stops
    evaluation and cleans nothing; switching it back on brings the violations
    back, minus the ones an exception covers. Nothing is ever garbage-collected
    behind the user's back.
  - **And it can always be undone.** `validationExceptions` is the first prop
    whose normal life includes being REMOVED — undoing a waiver deletes the key —
    and a Y.Map delete reports only `oldValues`. Both re-evaluation guards now
    read it, so an undo brings the live violation straight back instead of
    freezing the board on a stale verdict behind a dead Revoke button.

  Two new telemetry events, `ValidationExceptionGranted` and
  `ValidationExceptionRevoked`, carry the rule id, the framework, the scope and
  how many elements one gesture touched — never board content. A rule waived on
  every board is a rule that is wrong, and this is the only place that says so.

  **Persistence.** One new optional `@field()` on the base element model,
  `validationExceptions`. Declared on the BASE class, exactly like `role` before
  it, because an element re-created from props only reaches the Y.Map through
  declared accessors and a per-subclass declaration would be silently dropped on
  copy. Its default is `undefined` and is never written, so an element that never
  got an exception stays byte-identical to one created before the field existed:
  no block schema change, no version bump, no migration, and documents written
  before and after remain mutually loadable. Revoking the last exception removes
  the KEY rather than assigning `undefined`, which the `@field()` setter would
  have written into the Y.Map — so an element whose exceptions were all revoked
  is byte-identical again too, in the document and not merely through the getter.
  `GfxPrimitiveElementModel.clearField` is the counterpart `@field()` was missing.
  It removes DECLARED, non-structural fields only: an undeclared key (an
  annotation preserved verbatim for a newer client) and the fields nothing can
  cope without (`index`, `seed`, `xywh`) are refused with a warning, so a new
  delete path into the document cannot undo what the unknown-props deny-list
  protects.

  A conformant board pays nothing: exceptions are only looked up for a rule that
  actually raised something. On the 500-element reference map, where half the
  population is in violation, the 16 ms budget still has roughly seventy times the
  headroom it needs.

- 7b66d8d: feat(edgeless): one framework, several levels of requirement (PF9)
  A rule used to bite at exactly one strength, decided once by whoever wrote it,
  for everybody. That is the wrong shape for a tool where a rough sketch and a
  deliverable diagram live on the same canvas: the level of requirement is not a
  property of the rule, it is a property of the WORK.
  A framework now ships **profiles** — declarative, versioned data, like its
  rules, its roles and its background. A profile says, for each rule of its
  framework, how hard that rule bites, or that it does not apply at all.
  Wardley ships two:
  - **Sketch** (the default): the pilot rule drops to `audit`. The finding is
    still reported to `violations# @labre/affine-shared
    , so a host panel and a conformance report see
    it — the canvas simply says nothing. Nobody thinking out loud gets
    interrupted.
  - **Strict**: the pilot rule bites at `warning`, and the canvas affordance
    (PF7) appears as before. Still never blocking — strict is a level of
    attention, not a wall.
    **The choice is per ROOT INSTANCE, not per document** (PF9.1). Two maps on one
    board hold two independent levels: a sketch can sit next to a deliverable
    without either dictating the other's requirements. The engine reads the profile
    off the background a finding was measured against — an id it already recorded.
  ### What is persisted
  One optional flat string, `validationProfile`, declared as a `@field()` on the
  element base class — the same place and the same reasoning as `role` (PF1) and
  `validationExceptions` (PF8): an element re-created from props only reaches the
  Y.Map through declared accessors, so anything declared per subclass is silently
  dropped on copy. Duplicating a strict map gives a strict map; an export carries
  it; a peer sees it; undo undoes it.
  The default writes NOTHING. `undefined` resolves to the framework's default
  profile, and choosing the default back again removes the key rather than
  writing it — so a map that never left the default is byte-identical to one
  created before profiles existed, and one that tried strict and came back leaves
  no trace. Optional field, no schema version bump, no migration, no backfill.
  ### Cost
  A rule that is `'off'` under every profile in play is not evaluated at all: the
  engine skips it before touching a single element. It is a skipped rule, not a
  filter over findings. The default counts as in play unconditionally, so the
  short-circuit only fires when the answer cannot change — a missed skip costs a
  linear pass, a wrong skip costs a rule that silently stops firing.
  Bench, 500-element reference map: 0.141 ms unchanged, 0.275 ms with profiles in
  force, 0.032 ms with every rule off, against a 16 ms frame budget. Flag off
  still costs one empty-map check.
  ### Where the choice lives
  Select a map and a small chip above its top-left corner names the level in
  force and offers the others. It is **not** on the violation bubble, on purpose:
  on the permissive default nothing is ever drawn, so a bubble-only selector
  would make the strict profile reachable only through a violation the permissive
  profile has already silenced — a one-way door. Selection is the one gesture
  that is always available. Profile names are i18n keys resolved through the host
  catalogue, with the framework's own wording as the fallback.
  The chip is derived from the REGISTERED rules (`backgroundRole`), so it is
  gated by the framework flag for free: flag off, no rule, no profile offered,
  and the id already written on a map simply goes unread until the flag comes
  back.
  ### What it does not touch
  Exceptions (PF8). Raising the level does not resurrect a decision the user made,
  and lowering it does not quietly delete one — the two are orthogonal, and the
  engine reads exceptions last, independently of the profile.
  A new typed telemetry event, `ValidationProfileChanged`, carries the framework
  and the profile ids and nothing else. A choice that changes nothing is not a
  decision and is not reported.
  ### Behaviour change
  A Wardley map now opens on the permissive default, so an off-map component no
  longer draws a bracket or a badge until its map is put on **Strict**. That is
  the point — the sketch wins — but it does mean the PF7/PF8 canvas affordance is
  opt-in per map from here on.
- 30061cb: feat(edgeless): tell me what is wrong, and keep telling me (PF7)
  The validation affordance stopped at "something here is off": a mute amber
  bracket, drawn for as long as the violation held. It answered neither of the
  two questions a user actually has — _what_ is wrong, and _is it still wrong an
  hour later_. This slice answers both, on two clocks.
  - **The moment it happens.** A violation that APPEARS flashes its bracket at
    full strength for three seconds, then fades out over half a second. That is
    when the user still remembers the gesture that caused it and can undo it in
    one move.
  - **For as long as it holds.** Once — and only once — the bracket has finished
    fading, a small amber badge takes its place, just outside the anchor's
    top-right corner. The two are never on screen together. A board left
    overnight still shows what it breaks, without a canvas full of brackets.
  - **On demand.** Clicking either marker opens a bubble naming the rules broken
    on that anchor: label, severity, and remediation hint when the rule carries
    one. It closes on a click elsewhere, on Escape, or on pan/zoom, and flips
    above or to the left of its marker rather than run off the viewport. Clicking
    a marker does not select the shape underneath — the pointer pair is stopped
    there, so neither selection nor a drag starts.
    Both markers are sized in MODEL units and scale with the board, like the
    elements they annotate. Screen-constant annotations are right for a transient
    snap guide and wrong here: on a hundred-component map, zoomed out, they grow
    relative to the content until the marks are all you can see. Zoomed out far
    enough these shrink with everything else — deliberately. The exception is the
    click target, which keeps a 44 px screen floor as invisible padding around the
    model-sized visual, so a badge three pixels wide is still reachable by thumb
    (the pattern `edgeless-auto-complete` already uses on this canvas). The bubble
    stays in screen pixels: prose rendered at quarter size is not smaller prose,
    it is unreadable prose.
    The bubble consumes normalised violation OBJECTS and nothing else: no rule
    logic reached the UI, and no rule wording is hard-coded in the library. Rule
    labels are i18n keys resolved through a new, optional host seam
    (`TranslationExtension` / `TranslationProvider` in `@labre/affine-shared`,
    mirroring `TelemetryExtension`). With no catalogue registered the raw key is
    shown rather than a sentence the library invented for somebody else's rule;
    only the bubble's own chrome — the severity chip — carries an English default.
    Anchoring is unchanged and shared with the bracket: one badge per outermost
    enclosing group. The bubble lists one line per RULE broken on that anchor, not
    one per element — two components of a group both drawn off the map are two
    violations on the signal, but repeating the same sentence twice would say
    nothing extra.
    `audit` violations are now excluded from the canvas affordance, as their
    severity has always said they should be: collected for reporting, invisible to
    the drawing user. They still reach `violations# @labre/affine-shared
untouched, for a host panel.
Escape is taken only within the editor host, never on `document`: with a bubble
    open it dismisses the bubble instead of clearing the canvas selection, and a
    library has no business making that call for the whole page.
    Nothing here touches evaluation, the violation object or the 16 ms budget, and
    nothing is written to the document — the "first seen" timestamps that drive the
    flash are session state, rebuilt on every reload, so a document records which
    rules it breaks and never when you happened to look. No clock runs without a
    violation: the fade's animation frames stop by themselves once every mark has
    settled, the single timer that wakes the badge for the handover is armed only
    while a bracket is still up, and the element-tracking subscription only exists
    while something is flagged.

### Patch Changes

- c5c07b9: A board opens and pans with less work

  Opening an editor downloaded every canvas font before anything else, even the
  faces no document on screen asks for. The fonts a board paints with on its
  first frame are now fetched straight away and the rest arrive a few seconds
  later, four at a time, while the browser is idle. The same face registered
  twice is now registered once. Nothing observable changes: the canvas is still
  repainted once every font is in.

  Panning or zooming an edgeless board recomputed the drag handle's position
  twice per frame and rewrote six inline styles each time, whether or not the
  handle had moved. The position is now measured once, applied at most once per
  frame, and written only where it actually differs.

  Hovering in page mode ran a note lookup on every straight pointer move and
  skipped it on every diagonal one — a guard that had the test inverted. The
  lookup now runs when the pointer actually reaches a different block, so the
  handle also follows a diagonal move.

- ff5f060: A caret placed past the end of a line no longer blinks once and vanishes

  Clicking in the empty space to the right of a line asks the browser where the
  caret should go, and the browser answers with a position anchored on the
  paragraph _element_ rather than on the text inside it. The editor only tracks
  carets that live in text, so the caret appeared for a frame and was then thrown
  away — the click looked like it had done nothing.

  Such an answer is now walked back to the nearest meaningful text node before the
  selection is set, so the caret lands at the end of the line the user clicked
  next to. Clicks that already land on text are untouched.

- 41ab595: A code block and a quote keep their shape on paper

  Forcing every background to white for printing also flattened the three
  surfaces that give code blocks, quotations and bordered elements their shape:
  the code block lost its tinted panel, the quote lost its left rule and every
  border disappeared into the page.

  The print stylesheet now gives `--affine-background-code-block`,
  `--affine-quote-color` and `--affine-border-color` their own light greys
  instead of white, so those blocks are still recognisable in the printed
  document while the rest of the page stays black on white.

- 9fde974: A printed page is read on white paper, whatever theme it was written in

  Printing to PDF cloned the document into an iframe that inherited whatever
  theme the editor was wearing. In the dark theme that meant light text on a
  background the printer simply leaves white: headings, body text and note
  shadows came out invisible, and a reader got a page of blank paper.

  The print iframe is now pinned to the light theme — the document element, the
  body and the cloned root are all marked `data-theme="light"`, and the injected
  print stylesheet forces a light colour scheme along with black text, white
  backgrounds and light values for the `--affine-text-*` and
  `--affine-background-*` variables. What is on screen is what comes out of the
  printer.

- 50ab9ae: Making a selection costs less

  Selecting blocks did four kinds of avoidable work. De-duplicating the selected
  blocks rescanned the whole list once per block, which is quadratic and shows up
  as soon as a large document is selected at once. A captioned block read its own
  selected flag straight out of its render, so every selection change re-rendered
  the whole block instead of just its selection outline. The toolbar measured
  every selected block twice per positioning pass, and it ran that pass on every
  animation frame even for anchors that only move when the page scrolls.

  The de-duplication now uses a set, the selection outline subscribes on its own,
  the block rectangles are measured once per frame, and the per-frame loop is now
  kept only for canvas anchors, which can move without a scroll or a resize to
  announce it. Selection order and toolbar placement are unchanged.

- 751ac44: An image is on the page before the printer takes it

  Printing to PDF cloned the document into a `display: none` iframe and then
  waited a flat second before opening the print dialog. An iframe hidden that way
  never loads its images at all, and even when they did start loading the one
  second was a guess: a document with more than a handful of pictures printed
  empty frames where the images should be.

  The print iframe is now hidden without being taken out of rendering, lazy
  loading is stripped from the cloned images, and the print dialog waits for
  every image — those inside shadow roots included — to finish loading or fail,
  then for the fonts to be ready, instead of for a fixed delay. A broken image
  resolves rather than hanging the print. The clone also flattens shadow DOM into
  light DOM, so canvases and pictures rendered inside a shadow root reach the
  paper too.

- 9453013: Selection, handles and remote cursors follow their element inside a scaled editor

  An editor embedded in a host that scales it — a synced edgeless doc opened
  inside another document — paints its blocks in the container's already scaled
  space. The overlays drawn over those blocks were instead placed in real screen
  pixels, so the container scaled them a second time: the selection rectangle, the
  resize and element handles, the link chip, the remote cursors and the shape text
  editor all drifted away from the shapes they belong to, and further away with
  every scroll and zoom.

  Every one of them now states its placement the way a block states its own, so
  they sit on their element again. A standalone editor, where the host applies no
  scale, is unaffected.

- b746d6b: Coloured text survives a paste from the web

  Markdown import treated every scrap of inline HTML as literal characters, so
  copying a paragraph out of a web page — or re-importing a document this editor
  had exported — produced `<span style="color: #c83030;">` sitting in the text,
  with the colour lost and the tag on show. A balanced run of inline tags is now
  handed to the HTML converter instead: the text comes back formatted, and a
  `color` declaration is matched against the eight supported text highlights,
  taking whichever of the light or dark reference is nearer. A colour that
  resembles none of them leaves the text uncoloured, which is what keeps a pasted
  document readable in both themes. Unbalanced or block-level HTML is untouched
  and still arrives verbatim, as before.

- 08e9b24: Folding a code block is reported, and menu labels stop being selectable

  The code toolbar reported the language picker and the HTML preview toggle but
  said nothing about the collapse toggle, so how often long snippets are folded
  away was invisible. It now emits `codeBlockToggleCollapse`, carrying which way
  the fold went. As everywhere else on this bus, a host with no telemetry adapter
  is unaffected.

  Dragging across a menu entry in a toolbar used to select its label as text; the
  entries are buttons, so they no longer take a text selection.

- 7c10406: Pasted colours stay readable in both themes

  The colour of pasted HTML was matched against the supported highlights by plain
  RGB distance, which is not how the eye measures sameness: every colour found a
  "nearest" highlight, so ordinary body text at `#333` or `rgb(26, 26, 26)` came
  in painted grey, a translucent `rgba(...)` picked for someone else's background
  came in opaque, and a hue could land on the grey highlight or the other way
  round. Matching now happens in Oklab, where distance is perceptual, and is
  fenced by chroma and hue: a grey only ever becomes the grey highlight, a hue
  only ever a hue, near-black and near-white are left as they are, and anything
  translucent is left alone. Text that matches nothing keeps no colour at all and
  so follows the theme, light or dark. The parser also grew to cover the syntax
  that actually turns up in pasted markup — `hsl()`, percentage channels, the
  `rgb(0 0 0 / 50%)` form, the basic colour keywords — and a `style` value
  containing further colons is no longer truncated.

- 3639562: feat(edgeless): the direction of a typed edge is a statement, and W4 reads it

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
    red _solid_ links stay typed dependencies, which is what they are.
  - **Telemetry.** `EdgeDirectionInverted` (ids only, never board content): how
    often a direction has to be corrected is the measurement of whether the
    drawing gesture announces itself well enough.
  - The inversion acts on the typed edges of the selection, so a lasso holding a
    Wardley link and a plain connector reverses the first and leaves the second
    alone — rather than showing no direction entry at all. A typed edge with a
    free end offers none: there is no relation there to reverse.
  - `VERDICT_PROPS` gains `source` and `target`, so re-pointing or reversing an
    edge re-judges the board instead of waiting for an unrelated drag.

- 5a16359: Auto-complete puts the caret in the note it just created, and its panel where it was clicked

  Completing a shape into a note asked the browser to place the caret at a point
  measured from the editor's own top left corner, while the browser reads such a
  point from the window's. Wherever the editor is not flush against the window —
  a sidebar, a header, a panel — the caret was dropped that far away from the new
  note, and typing went nowhere. The panel of shape and note choices was opened
  from the pointer with the same mismatch, in the opposite direction.

  Both now speak the coordinates the browser does. The panel also states its own
  position, and the edges it keeps away from, in the space of the container an
  embedding host may have scaled, so it stays on screen there too.

- b1ed4ef: fix(edgeless): the contextual toolbar holds still while the map moves

  PO review of 02/08/2026, second pass, point 1. Zooming in or out with an element
  selected made its toolbar hesitate: the row seemed to try several widths, and
  several places, before settling. It now decides ONCE, when the viewport lands.

  **What was oscillating.** Not the anchoring — the position the toolbar is given
  moves once per frame, steadily, in the direction of the zoom, before this change
  as after it. It was the row's own COMPOSITION. A zoom moves the room the row has
  on every frame, and the fitter replanned on every one of them: over a two-dozen
  frame zoom the same entry went from its word, to its icon, into the "⋮" menu,
  and back to its word again. Since the row is anchored by its left edge, each of
  those widths moved its other three, which is what read as the toolbar changing
  its mind about where to sit.

  **Replan at the accalmie.** While the room is still moving, the plan on screen
  is frozen: the row keeps its composition for the whole gesture, however long it
  lasts, and is replanned once — for the width the gesture ENDED on. A viewport
  that has stopped changing for 150ms has landed, and a wheel zoom that breathes
  between two notches is covered by the viewport saying, itself, that it is still
  zooming.

  **Hysteresis.** A change of a few pixels is not a change. Two measurements that
  alternate by a pixel — a rounded rect, a fractional zoom, a scrollbar coming and
  going — used to be two different rooms and could compose the row two different
  ways, forever; below the threshold they are now one room and the row is left
  alone. The threshold is smaller than the narrowest thing the row could give up,
  so no real degradation is ever delayed by it.

  Nominal collapse is untouched: the row is still measured whole on selection and
  still gives way immediately when the editor hands it less width.

- b889326: feat(blocks): every key the library will ever ask for, on one list

  A host wiring `TranslationProvider` had no way to build its catalogue except
  chasing `translateKey` call sites and `labelKey` declarations across the repo
  — and no way to know a library upgrade had added one. This slice closes the
  seam from the other side: the library now says, out loud and exhaustively,
  which keys it can ask for.

  - **`getTranslationKeyManifest()`** (`@labre/affine/translations`) — the i18n
    sibling of `getShortcutManifest` / `getCommandManifest`: every
    `com.labre.*` key with its English fallback and its source
    (`command`, `role`, `rule`, `profile`, `nudge`, `audit-criterion`,
    `reading`, `background`, `framework`, `chrome`), enumerable without an
    editor instance and flag-independent, so one catalogue serves whatever a
    host later toggles on. Data-declared keys are WALKED from the same runtime
    declarations the editor registers — a key added to a rule or a command
    appears by construction. The widget chrome literals, which live in lit
    templates, are restated once; a unit test scans the library source and
    fails when a used key is missing from the manifest, when a manifest entry
    is used by nobody, or when a restated fallback drifts from what the widget
    renders.
  - **The manifest is COMPOSED, not centralised.** Each framework package
    exports its own contribution (`wardleyTranslationEntries`,
    `edgyTranslationEntries`, …) and the core manifest assembles the chrome's
    entries with the frameworks' — the same shape the command registry already
    has, and for the same reason: `@formicoidea/labre-core` is the editor minus
    the frameworks, so a manifest that named them from the core side would be
    complete in the monorepo and 107 keys of 175 short in the distribution hosts
    actually consume. `scripts/build-bundles.mjs` strips the groups from core's
    copy exactly as it strips the command groups, and a bundled host composes
    with `mergeTranslationEntries` (`@labre/std`, new).
  - The chrome wordings that sit behind template-literal keys (violation
    severities, exemption scopes, relation sides) are now EXPORTED tables the
    manifest walks rather than wordings restated a second time — which is what
    lets the drift check reach them.
  - The translation service grew the README the seam deserved
    (`packages/affine/shared/src/services/translation-service/README.md`):
    host wiring, fallback contract, how to bootstrap a catalogue from the
    manifest, how to compose it in the bundled distribution, and why the 22
    entries with no fallback must not be seeded into `en`. The service moved
    from `translation-service.ts` to `translation-service/index.ts` to house it
    — the barrel export is unchanged, no import moves.

- 77b0100: fix(edgeless): an inertia bar is judged on the divider it straddles, and Map quality is the checklist

  Second pass of the PO recette of 02/08/2026, on two points of substance.

  ## W2 changes meaning — read this before updating a catalogue

  The rule was built on a misreading, and the PO settled it with two captures and
  one sentence:

  > "The horizontal position of an inertia bar is only valid if it is astride two
  > evolution phases, that is, superimposed on a dashed vertical axis."

  - **Old rule** — the bar had to sit ON A DEPENDENCY _and_ at a phase transition,
    and the finding named the carrier half first ("This inertia bar is not drawn on
    a dependency."). A bar alone on a divider was flagged.
  - **New rule** — the bar has to STRADDLE a phase transition, and nothing else. A
    bar alone on a divider is valid (the PO's second capture); a bar between two
    dividers is not (the third), with or without a dependency under it.

  What that means in practice:

  - The carrier condition is gone, with the second message that existed only to
    tell the two halves apart. Both
    `com.labre.wardley.validation.inertia-off-carrier` and
    `com.labre.wardley.validation.inertia-off-equilibrium-zone` (and their
    suggestion keys) are retired; the rule now speaks one sentence, under
    `com.labre.wardley.validation.inertia-off-transition` — "This inertia bar sits
    inside a phase, not astride a phase transition." A host shipping a catalogue
    replaces the two keys with this one. `Violation.boundaryId` still names the
    frontier the bar missed.
  - **"Astride", as geometry:** the bar's own EXTENT along the evolution axis must
    intersect the transition BAND — the divider widened by the frame's declared
    `transitionBandWidth`. One interval overlap, saying both halves of
    "superimposed on the axis": a bar wide enough to cover the divider is accepted
    whatever the band says, and a bar too thin to cover anything (the toolbox draws
    it eight units wide) is accepted inside the band the map itself declares. It is
    measured on the ink, never on the centre, and the band stays a ratio of the
    plot so a resized map gets the same verdict.
  - `AttachmentDef.carrierRole` and `tolerance` are now OPTIONAL: the family still
    supports "posed on a carrier" for a rule that wants it, W2 simply no longer
    declares one. `AttachmentDef.offBoundary` is only read by a rule that declares
    both.
  - The Kodak template is unaffected: its bar is computed at the crossing of the
    `capture → storage` dependency with the Commodity divider, so it is centred on
    that divider and stays green.

  ## Map quality is the checklist, and only the checklist

  The panel carried three different kinds of statement — the nudges, a "Run
  check-up" button with its remarks and the families it walked, and a count of the
  real-time warnings on the map. All three were true, and reading them together
  was work. The PO's decision is to keep the one the panel is for:

  - the **check-up section** and the **real-time warning count** are gone from the
    panel and from the contextual toolbar's entry;
  - Wardley no longer declares **Q5** (`wardley.tone-off-convention`) or **Q6**
    (`wardley.phase-nomenclature`); `WARDLEY_CHECKUP_RULES` is gone and
    `gfx/wardley`'s `quality.ts` is now `nudges.ts`, exporting `WARDLEY_NUDGES`;
  - `ValidationManager.hasMapQuality()` now answers on the checklist alone, so a
    framework declaring only on-demand rules is not offered an empty panel;
  - the `MapQualityCheckupRun` telemetry event is removed, having lost its only
    emitter.

  **Nothing was removed from the engine.** The on-demand moment (PF5.14) —
  `moment: 'on-demand'`, `runCheckup`, `checkupRulesFor`, `evaluateCheckup` — and
  the `tone-convention` and `majority-fact` families are still there and still
  tested, including the zero-cost guarantee at the bench. The next framework that
  wants a check-up declares one; Wardley stopped exposing one.

- Updated dependencies [832c793]
- Updated dependencies [a2b7c44]
- Updated dependencies [0bfc872]
- Updated dependencies [9e23b5b]
- Updated dependencies [a3aa598]
- Updated dependencies [6417a2f]
- Updated dependencies [d797f9a]
- Updated dependencies [54488cd]
- Updated dependencies [5ac0c68]
- Updated dependencies [1fa46c1]
- Updated dependencies [5b6e9bb]
- Updated dependencies [492bac6]
- Updated dependencies [30580db]
- Updated dependencies [5076cb8]
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
  - @labre/affine-model@0.32.0
  - @labre/global@0.32.0

## 0.31.0

### Patch Changes

- Updated dependencies [6a663b6]
  - @labre/store@0.31.0
  - @labre/affine-model@0.31.0
  - @labre/std@0.31.0
  - @labre/global@0.31.0

## 0.30.2

### Patch Changes

- @labre/affine-model@0.30.2
- @labre/global@0.30.2
- @labre/std@0.30.2
- @labre/store@0.30.2

## 0.30.1

### Patch Changes

- @labre/affine-model@0.30.1
- @labre/global@0.30.1
- @labre/std@0.30.1
- @labre/store@0.30.1

## 0.30.0

### Patch Changes

- Updated dependencies [9d0fe0c]
- Updated dependencies [ecba791]
- Updated dependencies [8de86f4]
  - @labre/std@0.30.0
  - @labre/affine-model@0.30.0
  - @labre/global@0.30.0
  - @labre/store@0.30.0

## 0.29.1

### Patch Changes

- @labre/affine-model@0.29.1
- @labre/global@0.29.1
- @labre/std@0.29.1
- @labre/store@0.29.1

## 0.29.0

### Minor Changes

- 7375b9a: Stop the linked-doc preview from spinning forever when the referenced doc isn't
  loaded (#37). The embed-linked-doc and embed-synced-doc cards now wait for the
  doc's content for a bounded time and then degrade to a title-only card instead
  of an indefinite loader.

  Adds a host content-resolution seam: `LinkedDocContentResolverExtension` lets an
  app that doesn't preload its whole corpus hydrate a referenced doc on demand
  (`resolve(docId)`) and tune the fallback timeout (`timeoutMs`, default 8000ms).
  When the resolver supplies the content, the preview renders it; otherwise it
  degrades cleanly.

- 9330750: Add an enumerable, host-overridable keyboard shortcut system (#30, phase 1).

  - `ShortcutDescriptor` + `ShortcutExtension` register shortcuts that are both
    manifest entries and binding sources; `ShortcutKeymapExtension` installs the
    effective keymap via the normal dispatcher mechanism.
  - `KeymapOverrideExtension(overrides)` lets the host rebind by id
    (`{ undo: ['Ctrl','Shift','Z'] }`) or disable (`'disabled'`); the effective
    combo is `override ?? default`.
  - Combo conflicts within a scope are reported (via an optional
    `ShortcutConflictReporterExtension`, else the console) and the duplicate is
    never bound silently.
  - Core `undo` / `redo` are migrated from the imperative page keymap to core
    descriptors, so they are now enumerable and rebindable.

  The framework-aware manifest (`getShortcutManifest(flags)`) and per-framework
  contributions are phase 2.

### Patch Changes

- Updated dependencies [9330750]
  - @labre/std@0.29.0
  - @labre/affine-model@0.29.0
  - @labre/global@0.29.0
  - @labre/store@0.29.0

## 0.28.0

### Patch Changes

- Updated dependencies [65cc055]
  - @labre/std@0.28.0
  - @labre/affine-model@0.28.0
  - @labre/global@0.28.0
  - @labre/store@0.28.0

## 0.27.0

### Patch Changes

- Updated dependencies [91f6397]
  - @labre/std@0.27.0
  - @labre/affine-model@0.27.0
  - @labre/global@0.27.0
  - @labre/store@0.27.0

## 0.26.0

### Patch Changes

- Updated dependencies [8960a6c]
  - @labre/affine-model@0.26.0
  - @labre/global@0.26.0
  - @labre/std@0.26.0
  - @labre/store@0.26.0

## 0.25.0

### Patch Changes

- Updated dependencies [8960a6c]
  - @labre/affine-model@0.25.0
  - @labre/global@0.25.0
  - @labre/std@0.25.0
  - @labre/store@0.25.0

## 0.24.0

### Patch Changes

- @labre/affine-model@0.24.0
- @labre/global@0.24.0
- @labre/std@0.24.0
- @labre/store@0.24.0

## 0.23.3

### Patch Changes

- Release 0.23.3: ships the `LinkedDocCreationProvider` seam and the
  `@formicoidea` bundle-scope fix in a compiled build (0.23.2 was a source-only
  generator publish that breaks downstream `tsc`/build).
  - @labre/affine-model@0.23.3
  - @labre/global@0.23.3
  - @labre/std@0.23.3
  - @labre/store@0.23.3

## 0.23.2

### Patch Changes

- ee682da: Publish the `LinkedDocCreationProvider` seam (the edgeless "Create linked doc"
  injection point) and the `@formicoidea` bundle-scope fix. Forces a fresh,
  publishable version — npm 0.23.1 was a prior manual publish that predates these
  changes.
  - @labre/affine-model@0.23.2
  - @labre/global@0.23.2
  - @labre/std@0.23.2
  - @labre/store@0.23.2

## 0.23.1

### Patch Changes

- 1beb60e: feat(edgeless): injectable `LinkedDocCreationProvider`

  Adds a DI seam (mirrors `DocModeProvider`) so a host app can control how the
  edgeless "Create linked doc" action creates its new doc — e.g. to route creation
  through a persistence layer instead of an ephemeral in-workspace doc.
  `createLinkedDocFromEdgelessElements` resolves it via `std.getOptional` and falls
  back to the previous behaviour when no provider is registered.

  - @labre/affine-model@0.23.1
  - @labre/global@0.23.1
  - @labre/std@0.23.1
  - @labre/store@0.23.1

## 0.23.0

### Patch Changes

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

- Updated dependencies [9014c87]
- Updated dependencies [c775151]
  - @labre/affine-model@0.23.0
  - @labre/global@0.23.0
  - @labre/std@0.23.0
  - @labre/store@0.23.0
