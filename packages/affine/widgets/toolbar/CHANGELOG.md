# @labre/affine-widget-toolbar

## 0.35.0

### Patch Changes

- Updated dependencies [ea5d249]
- Updated dependencies [e9cd7e1]
- Updated dependencies [de3560d]
- Updated dependencies [7f09608]
- Updated dependencies [cf0d8a1]
  - @labre/affine-components@0.35.0
  - @labre/affine-block-surface@0.35.0
  - @labre/affine-shared@0.35.0
  - @labre/std@0.35.0
  - @labre/affine-model@0.35.0
  - @labre/affine-block-database@0.35.0
  - @labre/affine-block-table@0.35.0
  - @labre/affine-ext-loader@0.35.0
  - @labre/global@0.35.0

## 0.34.2

### Patch Changes

- @labre/affine-block-database@0.34.2
- @labre/affine-block-surface@0.34.2
- @labre/affine-block-table@0.34.2
- @labre/affine-components@0.34.2
- @labre/affine-ext-loader@0.34.2
- @labre/affine-model@0.34.2
- @labre/affine-shared@0.34.2
- @labre/global@0.34.2
- @labre/std@0.34.2

## 0.34.1

### Patch Changes

- Updated dependencies [6120f7a]
- Updated dependencies [cb49bb1]
  - @labre/affine-model@0.34.1
  - @labre/std@0.34.1
  - @labre/affine-block-surface@0.34.1
  - @labre/affine-block-database@0.34.1
  - @labre/affine-block-table@0.34.1
  - @labre/affine-components@0.34.1
  - @labre/affine-shared@0.34.1
  - @labre/affine-ext-loader@0.34.1
  - @labre/global@0.34.1

## 0.34.0

### Patch Changes

- 8b00f7d: fix(blocks): core toasts, board tooltips, catalogue headers and seed texts cross the translation seam

  A host that wires `TranslationExtension` now gets a catalogue that covers the
  editor, instead of one that covers everything except the parts a user actually
  reads first. Six families of hard-coded English are gone (refs #182, #183);
  every one of them is a `com.labre.*` key with the previous literal as its
  English fallback, so an editor with no `TranslationProvider` registered reads
  exactly what it read before.

  - **Toasts** — "Copied to clipboard", "Linked doc created", "Note removed from
    Page Mode", "Frame inserted into Page.", "No link found".
  - **Board toolbars** — the resize toggle every framework board carries, and the
    two legend wordings, declared once in `@labre/affine-shared` rather than
    eight times.
  - **Editor chrome** — the toolbar verbs (Copy, Duplicate, Delete, Lock, Link,
    More, Bring to Front, Send to Back, Create linked doc, Draw connector), the
    view switcher (Switch / Inline / Card / Embed view) and the linked-doc card's
    four "nothing to show" sentences. `ToolbarAction` gained `labelWording` /
    `tooltipWording`: a declared `[key, English]` pair the toolbar resolves when
    it builds the row, which keeps a call site one line and keeps the row's width
    planning honest about what it is about to say.
  - **Catalogue headers** — every framework now contributes its own
    `com.labre.catalogue.category.*` keys. Core's registry names no framework
    category once `build:bundles` has stripped it, so a bundled host was drawing
    translated entries under English headers.
  - **BPMN import remarks** — the three whose wording is a fixed sentence carry a
    key (`InterchangeNote.messageKey`). The ones that name an element, an id or a
    count of lanes do not: the seam has no interpolation.
  - **Seed texts** — the caption a placed BPMN or EDGY artefact is given, and a
    C4 board's name, are resolved AT PLACEMENT. What lands in the document is
    content the author owns from that moment on and is never re-translated.

  `getTranslationKeyManifest()` gains all of it, including a new `'seed'` source
  for the words a framework writes onto the canvas.

  Three surfaces are deliberately left English, and each one is a refusal rather
  than an oversight. The **C4 component tier seeds** (`NODE_LABEL`,
  `C4_TYPE_PLACEHOLDER`, `DESCRIPTION_PLACEHOLDER`) are read back as SENTINELS by
  the morph and by the mermaid exporter, which is a pure function of the board
  and has no `std` to re-resolve them with — translating them would change what
  an export writes. The **code block's "⋮"** is a `MenuItemGroup` rendered over a
  generic context that carries no `std`. The **slash menu** and the **mobile
  keyboard toolbar** item names are their own vocabularies, untouched apart from
  the toasts they raise.

- f09d68c: fix(blocks): contextual toolbar buttons repaint in place under @preact/signals-core 1.14

  Clicking a stateful button in the element toolbar (resize, sketch/strict
  validation modes, profile picker) wrote the new state to the document but left
  the button showing the old one — the toolbar only caught up after
  deselecting and reselecting the element.

  `Flags.refresh()` forced a repaint by toggling a flag off and back on inside a
  `batch()`. Since `@preact/signals-core` 1.14 a batch that ends on its initial
  value no longer notifies subscribers, so every `refresh()` call became a silent
  no-op. `Flags` now carries a revision counter that `refresh()` increments, and
  the toolbar widget subscribes to it alongside the flag value, so a forced
  refresh repaints without ever exposing a transient "no selection" frame.

- Updated dependencies [881d3f5]
- Updated dependencies [6c1bdfb]
- Updated dependencies [8b00f7d]
- Updated dependencies [5f76ab3]
- Updated dependencies [f09d68c]
  - @labre/std@0.34.0
  - @labre/affine-shared@0.34.0
  - @labre/affine-block-surface@0.34.0
  - @labre/affine-block-database@0.34.0
  - @labre/affine-components@0.34.0
  - @labre/affine-block-table@0.34.0
  - @labre/affine-model@0.34.0
  - @labre/affine-ext-loader@0.34.0
  - @labre/global@0.34.0

## 0.33.0

### Patch Changes

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
- Updated dependencies [e42e0c0]
- Updated dependencies [256ee0b]
- Updated dependencies [4a3b26e]
- Updated dependencies [48c3b52]
- Updated dependencies [6a20738]
- Updated dependencies [f09f9a3]
  - @labre/affine-block-surface@0.33.0
  - @labre/affine-components@0.33.0
  - @labre/affine-shared@0.33.0
  - @labre/affine-model@0.33.0
  - @labre/std@0.33.0
  - @labre/affine-block-database@0.33.0
  - @labre/affine-block-table@0.33.0
  - @labre/affine-ext-loader@0.33.0
  - @labre/global@0.33.0

## 0.32.0

### Minor Changes

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

### Patch Changes

- 9e23b5b: A group measures its children once per change, not once per look

  The bound of a group is the union of the bounds of everything it contains, and
  it was recomputed from scratch on every single read of `xywh` — while the
  renderer, the hit test, the selection rect and the toolbar anchor read it many
  times per frame. A board with large groups spent most of a pan or a drag
  re-adding the same rectangles together.

  The union is now computed once per change instead: the surface refreshes the
  group when a child moves, is rotated, hidden, added or removed, and merely
  marks it stale for the props only some elements fold into their own bound (the
  vertices of a polygon, the label of a connector), so the next read still sees
  the right rectangle. On a group of 200 elements, 500 reads between two moves
  went from ~230 ms to ~5 ms.

  The toolbar likewise measures the selection once when it changes, instead of on
  every frame of a pan.

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

- a5eca31: fix(edgeless): a toolbar that flips never flips sideways

  PO recette of 25/08/2026, third video. The map background's contextual row kept
  teleporting between two anchors under zoom while its composition held perfectly
  still — a positioner defect, not a fitter one. Measured frame by frame, the row
  alternated between the LEFT clamp and the RIGHT clamp of the very same
  geometry.

  **Why.** `flip()` ran with its defaults, `crossAxis` and `flipAlignment` both
  on. On a reference far wider than the screen — the definition of a map
  background — every alignment overflows somewhere, so `bestFit` picks between
  `-start` and `-end` by a few pixels of margin, and under a zoom that verdict
  changes from one frame to the next. `-start` is the left clamp, `-end` the
  right one: the teleport, exactly.

  **The fix** gives each middleware back its one job. `flip` now answers only
  "above or below" — `crossAxis: false, flipAlignment: false` — and horizontal
  placement belongs to `shift` alone, which slides instead of teleporting. The
  middleware order and the cap semantics (`size` before `shift`: the room at the
  ANCHORED position) are untouched. One hardening rides along, taken from the
  same measurement trace: a computation that resolves after its loop aborted no
  longer writes at all.

  New guard in the collapse-stability suite: "the background row never hesitates
  between two anchors" — red before the fix, green with it, and mutation-tested
  (reverting only the `flip` options turns it red again). The twelve existing
  collapse-stability tests pass unchanged.

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

- ce64e4f: fix(edgeless): a re-render draws the row it is already wearing

  PO recette of 25/08/2026. Zooming with a component selected still made
  "Read this component" flicker — the entry alternating between its word, its
  icon and a line of the "⋮" while the gesture ran. The PO named the display of
  the label as the culprit, and the measurement agrees.

  **What was flapping, measured.** Not the plan of the previous pass: a bare zoom
  is clean, and stays clean. What the previous pass froze is the path that starts
  from a room that CHANGED. There is a second path into the row, and it was not
  frozen at all: the widget rebuilds the toolbar from the registry whenever
  anything it watches moves — an element updated anywhere on the canvas, a block
  updated, a selection re-emitted, something hovered — and each of those rebuilds
  discarded the plan, painted the undegraded row, and only then measured it and
  degraded it again. One flash of the full label per rebuild, plus a full replan
  at whatever width the gesture happened to be passing through. Sampled entry by
  entry, frame by frame, over a two-dozen frame zoom with one such write every
  fourth frame, the entry read `icon → menu → label → menu`.

  **The plan is state, and the render reads it.** The mode an entry appears in is
  now an argument of its own render in every case: the row is asked which row it
  is BEFORE anything is drawn, and a row that has not changed is drawn wearing
  the plan already on screen — same entries, same modes, no DOM change, nothing
  to see. Only a row that is genuinely different — different entries, different
  words — is rendered whole, measured, and degraded. Re-renders during a gesture
  are therefore free, and the accalmie is once again the only thing that decides.

  Which row it is comes from a signature of the resolved entries, their words
  included: an entry that changes its label changes what the row costs, and a
  plan measured on the old words no longer describes it.

  Nominal collapse is untouched, and so is the freeze of the previous pass: the
  row is still measured whole when it is new, still gives way immediately when
  the editor hands it less width, and is still replanned exactly once when the
  viewport lands.

- f05ff48: fix(edgeless): a row is also what its entries say, not only which entries it has

  PO recette of 25/08/2026, second point. The previous pass stopped the flicker on
  a selected COMPONENT's toolbar, and the PO confirmed it. On the row of a Wardley
  map's BACKGROUND — the one carrying the display toggles, the "Validation"
  dropdown and the level of requirement it names — the toolbar went on flapping.
  His question was the right one: the answer was never generalised.

  **Why it was not.** The previous pass decides whether a re-render is a new row
  by comparing a signature of the row's entries: their ids, their words, their
  icons, their priorities. For a component's row that is a complete description —
  every entry on it is one the WIDGET draws, so listing them is listing their
  widths, and two renders with the same list are two renders of the same row. The
  background's row is mostly entries the widget does NOT draw: a framework groups
  its six toggles behind one entry, and the level of requirement is a dropdown
  that names the profile in force on its own trigger. For that row the list says
  nothing at all about what the row costs.

  **Measured, on the row the PO pointed at.** `Sketch` and `Strict` are the same
  entry with the same id, seventy-four pixels and sixty-four pixels wide. A map
  given a gradient variant grows a sixth toggle inside the same grouped entry —
  one whole button, same list, same signature. So the row could change by thirty
  pixels while the plan on screen, and the measurements that plan was arithmetic
  on, went on describing the row it used to be: with the room set ten pixels above
  the row's width, adding the toggle put the row six pixels outside the room it
  had been given, and nothing measured it again. Every later replan — every
  accalmie of every gesture — then started from those stale numbers, which is the
  row settling on one composition and correcting itself out of another.

  **What a row is, in two values.** Which entries it HAS decides whether a PLAN
  still applies — a plan is a list of entry ids. What those entries SAY decides
  whether a MEASUREMENT still applies. They are now asked separately:

  - entries changed → a new row, planned from scratch, exactly as before;
  - **only what they say changed → the plan stays on the row** and the row is
    re-measured where it stands. What the plan took off is added back from the
    numbers that made it, so the row is measured whole without ever being SHOWN
    whole — no undegraded frame, which is the flash the previous pass removed;
  - neither → free, which is what makes a gesture's re-renders cost nothing.

  **And what a row says is a value, never an identity.** An opaque entry only says
  what it says once its template has been built, and that template is a fresh
  object on every single render — comparing those would make every rebuild a new
  row and bring the per-frame flash back on every toolbar in the editor. So the
  template is walked for the things that end up as characters on the row: its
  words and its numbers, plus a stable name for each template shape. Event
  handlers are dropped (a fresh closure per render is how one is written) and so
  are booleans (`?active` changes how an entry looks, never how wide it is) and
  anything else that is an object rather than something to read.

  Nothing here names a block, a framework or a dropdown: it is the same treatment
  for every row, and the components' row behaves exactly as it did — the previous
  passes' tests pass unchanged, including "a re-render does not put the word back,
  not even for a frame".

- Updated dependencies [832c793]
- Updated dependencies [c5c07b9]
- Updated dependencies [ff5f060]
- Updated dependencies [1b59f3c]
- Updated dependencies [41ab595]
- Updated dependencies [0bfc872]
- Updated dependencies [8ded589]
- Updated dependencies [9e23b5b]
- Updated dependencies [a3aa598]
- Updated dependencies [90a9168]
- Updated dependencies [6417a2f]
- Updated dependencies [acbec17]
- Updated dependencies [d797f9a]
- Updated dependencies [9fde974]
- Updated dependencies [d360f72]
- Updated dependencies [50ab9ae]
- Updated dependencies [89b90e9]
- Updated dependencies [9c440fb]
- Updated dependencies [f7f23b2]
- Updated dependencies [751ac44]
- Updated dependencies [9453013]
- Updated dependencies [b746d6b]
- Updated dependencies [5ac0c68]
- Updated dependencies [630633b]
- Updated dependencies [1fa46c1]
- Updated dependencies [0473dcb]
- Updated dependencies [5b6e9bb]
- Updated dependencies [86e7562]
- Updated dependencies [492bac6]
- Updated dependencies [72b334c]
- Updated dependencies [9bf1d3e]
- Updated dependencies [30580db]
- Updated dependencies [08e9b24]
- Updated dependencies [5076cb8]
- Updated dependencies [3c5c97e]
- Updated dependencies [7c10406]
- Updated dependencies [02797b5]
- Updated dependencies [413fe7b]
- Updated dependencies [724ed1c]
- Updated dependencies [c7612da]
- Updated dependencies [3e1665b]
- Updated dependencies [0ddfd47]
- Updated dependencies [3639562]
- Updated dependencies [5d16745]
- Updated dependencies [1c37478]
- Updated dependencies [48e90f4]
- Updated dependencies [141de0e]
- Updated dependencies [5cfcc6a]
- Updated dependencies [fb26f85]
- Updated dependencies [5edd916]
- Updated dependencies [5a16359]
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
  - @labre/affine-components@0.32.0
  - @labre/affine-block-database@0.32.0
  - @labre/affine-model@0.32.0
  - @labre/affine-block-surface@0.32.0
  - @labre/affine-block-table@0.32.0
  - @labre/global@0.32.0
  - @labre/affine-ext-loader@0.32.0

## 0.31.0

### Patch Changes

- @labre/affine-block-database@0.31.0
- @labre/affine-block-surface@0.31.0
- @labre/affine-block-table@0.31.0
- @labre/affine-components@0.31.0
- @labre/affine-ext-loader@0.31.0
- @labre/affine-model@0.31.0
- @labre/affine-shared@0.31.0
- @labre/std@0.31.0
- @labre/global@0.31.0

## 0.30.2

### Patch Changes

- @labre/affine-block-database@0.30.2
- @labre/affine-block-surface@0.30.2
- @labre/affine-block-table@0.30.2
- @labre/affine-components@0.30.2
- @labre/affine-ext-loader@0.30.2
- @labre/affine-model@0.30.2
- @labre/affine-shared@0.30.2
- @labre/global@0.30.2
- @labre/std@0.30.2

## 0.30.1

### Patch Changes

- @labre/affine-block-database@0.30.1
- @labre/affine-block-surface@0.30.1
- @labre/affine-block-table@0.30.1
- @labre/affine-components@0.30.1
- @labre/affine-ext-loader@0.30.1
- @labre/affine-model@0.30.1
- @labre/affine-shared@0.30.1
- @labre/global@0.30.1
- @labre/std@0.30.1

## 0.30.0

### Patch Changes

- Updated dependencies [9d0fe0c]
- Updated dependencies [ecba791]
- Updated dependencies [8de86f4]
  - @labre/std@0.30.0
  - @labre/affine-model@0.30.0
  - @labre/affine-block-database@0.30.0
  - @labre/affine-block-surface@0.30.0
  - @labre/affine-block-table@0.30.0
  - @labre/affine-components@0.30.0
  - @labre/affine-shared@0.30.0
  - @labre/affine-ext-loader@0.30.0
  - @labre/global@0.30.0

## 0.29.1

### Patch Changes

- @labre/affine-block-database@0.29.1
- @labre/affine-block-surface@0.29.1
- @labre/affine-block-table@0.29.1
- @labre/affine-components@0.29.1
- @labre/affine-ext-loader@0.29.1
- @labre/affine-model@0.29.1
- @labre/affine-shared@0.29.1
- @labre/global@0.29.1
- @labre/std@0.29.1

## 0.29.0

### Patch Changes

- Updated dependencies [7375b9a]
- Updated dependencies [9330750]
  - @labre/affine-shared@0.29.0
  - @labre/std@0.29.0
  - @labre/affine-block-database@0.29.0
  - @labre/affine-block-surface@0.29.0
  - @labre/affine-block-table@0.29.0
  - @labre/affine-components@0.29.0
  - @labre/affine-model@0.29.0
  - @labre/affine-ext-loader@0.29.0
  - @labre/global@0.29.0

## 0.28.0

### Patch Changes

- Updated dependencies [1cd6c92]
- Updated dependencies [65cc055]
  - @labre/affine-block-database@0.28.0
  - @labre/std@0.28.0
  - @labre/affine-block-table@0.28.0
  - @labre/affine-block-surface@0.28.0
  - @labre/affine-components@0.28.0
  - @labre/affine-model@0.28.0
  - @labre/affine-shared@0.28.0
  - @labre/affine-ext-loader@0.28.0
  - @labre/global@0.28.0

## 0.27.0

### Patch Changes

- Updated dependencies [14ef3e7]
- Updated dependencies [91f6397]
  - @labre/affine-block-database@0.27.0
  - @labre/std@0.27.0
  - @labre/affine-block-surface@0.27.0
  - @labre/affine-block-table@0.27.0
  - @labre/affine-components@0.27.0
  - @labre/affine-model@0.27.0
  - @labre/affine-shared@0.27.0
  - @labre/affine-ext-loader@0.27.0
  - @labre/global@0.27.0

## 0.26.0

### Patch Changes

- 6795191: fix(edgeless): keep mobile canvas toolbars within the viewport

  On narrow (mobile) viewports two canvas toolbars overflowed off-screen,
  hiding actions:

  - The selected-element contextual toolbar grew to `max-content` with no
    upper bound. It is now capped to the available viewport width (floating-ui
    `size` middleware) and wraps to a second row instead of overflowing. (A
    scroll container was avoided on purpose: the "More" dropdown is a descendant
    of the toolbar, so `overflow` would clip it and make it unclickable.)
  - The senior framework slide-menu was sized to `max-width: calc(100vw - 16px)`
    but right-aligned to a center-ish toolbar button, so a near-full-width menu
    hung off the LEFT edge on mobile. It is now centered on the main toolbar and
    capped to 95% of the toolbar's width (the existing slide-menu scroll handles
    any remaining overflow), via a shared `clampSeniorMenuToToolbar` helper that
    replaces the duplicated inline positioning in all six framework senior
    buttons (Wardley, BPMN, Cynefin, EDGY, Mind Map, DDD). Desktop is unaffected
    since those menus are narrower than the cap.

- Updated dependencies [8960a6c]
- Updated dependencies [6795191]
  - @labre/affine-block-database@0.26.0
  - @labre/affine-model@0.26.0
  - @labre/affine-components@0.26.0
  - @labre/affine-block-surface@0.26.0
  - @labre/affine-block-table@0.26.0
  - @labre/affine-shared@0.26.0
  - @labre/affine-ext-loader@0.26.0
  - @labre/global@0.26.0
  - @labre/std@0.26.0

## 0.25.0

### Patch Changes

- 6795191: fix(edgeless): keep mobile canvas toolbars within the viewport

  On narrow (mobile) viewports two canvas toolbars overflowed off-screen,
  hiding actions:

  - The selected-element contextual toolbar grew to `max-content` with no
    upper bound. It is now capped to the available viewport width (floating-ui
    `size` middleware) and wraps to a second row instead of overflowing. (A
    scroll container was avoided on purpose: the "More" dropdown is a descendant
    of the toolbar, so `overflow` would clip it and make it unclickable.)
  - The senior framework slide-menu was sized to `max-width: calc(100vw - 16px)`
    but right-aligned to a center-ish toolbar button, so a near-full-width menu
    hung off the LEFT edge on mobile. It is now centered on the main toolbar and
    capped to 95% of the toolbar's width (the existing slide-menu scroll handles
    any remaining overflow), via a shared `clampSeniorMenuToToolbar` helper that
    replaces the duplicated inline positioning in all six framework senior
    buttons (Wardley, BPMN, Cynefin, EDGY, Mind Map, DDD). Desktop is unaffected
    since those menus are narrower than the cap.

- Updated dependencies [8960a6c]
- Updated dependencies [6795191]
  - @labre/affine-block-database@0.25.0
  - @labre/affine-model@0.25.0
  - @labre/affine-components@0.25.0
  - @labre/affine-block-surface@0.25.0
  - @labre/affine-block-table@0.25.0
  - @labre/affine-shared@0.25.0
  - @labre/affine-ext-loader@0.25.0
  - @labre/global@0.25.0
  - @labre/std@0.25.0

## 0.24.0

### Patch Changes

- @labre/affine-block-database@0.24.0
- @labre/affine-block-surface@0.24.0
- @labre/affine-block-table@0.24.0
- @labre/affine-components@0.24.0
- @labre/affine-ext-loader@0.24.0
- @labre/affine-model@0.24.0
- @labre/affine-shared@0.24.0
- @labre/global@0.24.0
- @labre/std@0.24.0

## 0.23.3

### Patch Changes

- Updated dependencies
  - @labre/affine-shared@0.23.3
  - @labre/affine-block-database@0.23.3
  - @labre/affine-block-surface@0.23.3
  - @labre/affine-block-table@0.23.3
  - @labre/affine-components@0.23.3
  - @labre/affine-ext-loader@0.23.3
  - @labre/affine-model@0.23.3
  - @labre/global@0.23.3
  - @labre/std@0.23.3

## 0.23.2

### Patch Changes

- Updated dependencies [ee682da]
  - @labre/affine-shared@0.23.2
  - @labre/affine-block-database@0.23.2
  - @labre/affine-block-surface@0.23.2
  - @labre/affine-block-table@0.23.2
  - @labre/affine-components@0.23.2
  - @labre/affine-ext-loader@0.23.2
  - @labre/affine-model@0.23.2
  - @labre/global@0.23.2
  - @labre/std@0.23.2

## 0.23.1

### Patch Changes

- Updated dependencies [1beb60e]
  - @labre/affine-shared@0.23.1
  - @labre/affine-block-database@0.23.1
  - @labre/affine-block-surface@0.23.1
  - @labre/affine-block-table@0.23.1
  - @labre/affine-components@0.23.1
  - @labre/affine-ext-loader@0.23.1
  - @labre/affine-model@0.23.1
  - @labre/global@0.23.1
  - @labre/std@0.23.1

## 0.23.0

### Patch Changes

- Updated dependencies [9014c87]
- Updated dependencies [c775151]
  - @labre/affine-model@0.23.0
  - @labre/affine-block-surface@0.23.0
  - @labre/affine-shared@0.23.0
  - @labre/affine-block-database@0.23.0
  - @labre/affine-block-table@0.23.0
  - @labre/affine-components@0.23.0
  - @labre/affine-ext-loader@0.23.0
  - @labre/global@0.23.0
  - @labre/std@0.23.0
