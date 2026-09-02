# @labre/affine-components

## 0.35.0

### Patch Changes

- ea5d249: fix(edgeless): option rows read like the native menus

  Every one-of-N dropdown on the edgeless toolbars now draws its rows the way the
  editor's own menus do — the Regular/Semibold panel, the size dropdowns: **label
  on the left, tick on the right and only on the option in force, the active row
  in the primary colour.**

  Three home-made dropdowns had restated the opposite shape, each keeping a 20 px
  gutter on the left of every row for a tick that was only ever drawn on one of
  them: the tag qualification menu (`element-tag-option`), the validation profile
  menu (`validation-profile-option`, and the "Map quality…" row that held a
  spacer to line up with it) and the C4 level menu (`c4-level-option`). The empty
  gutter did not read as an empty tick slot — it read as a MISSING ICON.

  The shape is not reimplemented three times: `editor-menu-action` gains an
  opt-in `data-option` affordance carrying the geometry and the primary colour,
  next to the `data-selected` it already had. Nothing else changes appearance —
  the more-menu, the conversion menu and the other rows that use `data-selected`
  are untouched, as are every click handler, `data-testid` and ARIA attribute of
  the three menus.

  **The tag-value icon mechanism, added the same day, is removed.** It existed to
  fill that gutter, and the gutter is gone: `TagValueDef.iconKey`,
  `IconTableExtension` and `resolveIconKey` are withdrawn, `getCommandIcon` is
  back to the single function it was, and the four Wardley nature glyphs are gone
  with the icon key table that named them. All of it shipped hours earlier, was
  never consumed by a host, and is removed before any host could bind it — so the
  API surface a host sees is the one it had before that release.

- Updated dependencies [ea5d249]
- Updated dependencies [de3560d]
- Updated dependencies [7f09608]
- Updated dependencies [cf0d8a1]
  - @labre/affine-shared@0.35.0
  - @labre/std@0.35.0
  - @labre/affine-model@0.35.0
  - @labre/global@0.35.0
  - @labre/store@0.35.0
  - @labre/sync@0.35.0

## 0.34.2

### Patch Changes

- @labre/affine-model@0.34.2
- @labre/affine-shared@0.34.2
- @labre/global@0.34.2
- @labre/std@0.34.2
- @labre/store@0.34.2
- @labre/sync@0.34.2

## 0.34.1

### Patch Changes

- Updated dependencies [6120f7a]
- Updated dependencies [cb49bb1]
  - @labre/affine-model@0.34.1
  - @labre/std@0.34.1
  - @labre/affine-shared@0.34.1
  - @labre/global@0.34.1
  - @labre/store@0.34.1
  - @labre/sync@0.34.1

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

- Updated dependencies [881d3f5]
- Updated dependencies [6c1bdfb]
- Updated dependencies [8b00f7d]
- Updated dependencies [5f76ab3]
- Updated dependencies [f09d68c]
  - @labre/std@0.34.0
  - @labre/affine-shared@0.34.0
  - @labre/affine-model@0.34.0
  - @labre/global@0.34.0
  - @labre/store@0.34.0
  - @labre/sync@0.34.0

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

- Updated dependencies [3fbf69c]
- Updated dependencies [f929e12]
- Updated dependencies [13360cd]
- Updated dependencies [c03090c]
- Updated dependencies [32e4d45]
- Updated dependencies [139d77b]
- Updated dependencies [6bba40c]
- Updated dependencies [a8325bb]
- Updated dependencies [ff19911]
- Updated dependencies [b03132c]
- Updated dependencies [48049d6]
- Updated dependencies [7136db0]
- Updated dependencies [5737a56]
- Updated dependencies [168617d]
- Updated dependencies [9022c92]
- Updated dependencies [edfaba2]
- Updated dependencies [e42e0c0]
- Updated dependencies [256ee0b]
- Updated dependencies [4a3b26e]
- Updated dependencies [48c3b52]
- Updated dependencies [6a20738]
- Updated dependencies [f09f9a3]
  - @labre/affine-shared@0.33.0
  - @labre/affine-model@0.33.0
  - @labre/std@0.33.0
  - @labre/global@0.33.0
  - @labre/store@0.33.0
  - @labre/sync@0.33.0

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

- 1b59f3c: A closed popup stops following its anchor

  Menus, sub-menus and the edgeless template panel are kept glued to the element
  that opened them by a floating-ui positioning loop. That loop installs scroll
  and resize listeners on every ancestor plus a resize observer, and it hands
  back a function that removes them again. Three of them threw that function
  away: the loop kept measuring a popup that had already been removed, and its
  listeners kept the popup, its anchor and everything they closed over alive.
  Opening and closing a context menu or the template panel repeatedly therefore
  grew memory and slowly made scrolling heavier.

  Each of the three now stops its loop: a sub-menu when its owning item is
  removed even though the sub-menu is still open, a popup when it closes, and the
  template panel both when it closes and when the toolbar button goes away.
  Positioning while a popup is open is unchanged.

- 8ded589: A database can now be read as a month

  Until now a database offered two shapes: a table and a kanban board. Neither
  of them answers the question a transformation roadmap asks first — what is
  happening in March? A calendar view now sits beside them: pick it from the
  slash menu ("Calendar View"), from the view switcher, or convert an existing
  table or kanban into one and keep its filters and sort.

  The view maps one date property to the grid and, optionally, a second one to
  close a range, so a workstream that runs from the 4th to the 19th is drawn as
  a single bar across the weeks it spans rather than as a dot on its start day.
  Cards can be dragged from one day to another (a range keeps its length), a
  range can be stretched by its edges, and clicking an empty day creates a row
  already dated. Months are navigated with the arrows or the "Today" button.

  Hosts can feed the same grid from outside the document by registering a
  `CalendarExternalSourceProvider`; the editor ships none, so a standalone
  playground simply shows the database's own rows.

- 90a9168: A menu opened near the edge of a narrow window stays on screen

  Menus were allowed to pick between four corners of their button and were then
  nudged four pixels away from it, but nothing kept the result inside the window.
  On a constrained viewport — a split view, a small laptop screen, the editor
  embedded in a panel — all four corners can overflow, and the menu simply hung
  off the edge with its items out of reach.

  Menus now slide back into view when they would otherwise overflow, keeping an
  eight pixel margin. A menu that already fits does not move, so toolbars and
  their submenus open exactly where they used to.

- d360f72: A reusable emoji and icon picker, ready for the business frameworks to adopt

  Frameworks that want to let an author brand a node — a Wardley component, an
  EDGY element, a callout — each had to invent their own emoji affordance, and
  the only one that existed was a bare third-party emoji panel bolted onto the
  callout block.

  `@labre/affine-components/icon-picker` now offers `<affine-icon-picker>`: two
  tabs (Emoji and Icons), a filter box on each, recents remembered per viewer,
  skin tones for emojis and nine tints for icons, and a Remove affordance. It
  emits a single bubbling `select` event carrying either
  `{ type: 'emoji', unicode }`, `{ type: 'affine-icon', name, color }`, or
  `null` when the author asks for the icon to be taken away.

  The two panels — `<affine-emoji-picker-panel>` and
  `<affine-icon-picker-panel>` — are exported on their own for hosts that only
  want one of them. Nothing in the editor is wired to the picker yet: it is
  offered, not imposed, so no existing toolbar or menu changes behaviour.

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

- 72b334c: Enter commits a column rename instead of dropping it

  Pressing Enter in a menu input closed the menu straight away. Unmounting a
  focused input emits no `blur` event, so the value never reached the listener
  that saves it, and a column header renamed with Enter came back with its old
  name.

  The input now blurs itself before the menu closes. Enter, Escape and clicking
  outside all end on the same code path, so the typed value is written exactly
  once whichever way the edit is finished.

- 08e9b24: Folding a code block is reported, and menu labels stop being selectable

  The code toolbar reported the language picker and the HTML preview toggle but
  said nothing about the collapse toggle, so how often long snippets are folded
  away was invisible. It now emits `codeBlockToggleCollapse`, carrying which way
  the fold went. As everywhere else on this bus, a host with no telemetry adapter
  is unaffected.

  Dragging across a menu entry in a toolbar used to select its label as text; the
  entries are buttons, so they no longer take a text selection.

- c7612da: A property name typed in the menu survives the menu closing

  Renaming a database/pivot property meant typing into the little input at the top
  of the property menu. That input only handed its value back on an explicit
  completion — Enter, or Escape. Dismiss the menu the way people actually dismiss
  menus, by clicking somewhere else, and the typed name was thrown away: the
  column kept its old title and the edit had to be done again, this time
  remembering to press Enter.

  Menu inputs now report on blur as well, and the property menu listens to that
  report. Losing focus is a save, so the name is kept whichever way the menu goes
  away. Mobile and desktop now follow the same path — the mobile branch used to
  write on every keystroke, which made an abandoned edit unabandonable.

  `menu.input` gains an optional `onBlur` callback; nothing that already passed
  `onComplete` or `onChange` changes behaviour.

- Updated dependencies [832c793]
- Updated dependencies [c5c07b9]
- Updated dependencies [a2b7c44]
- Updated dependencies [ff5f060]
- Updated dependencies [41ab595]
- Updated dependencies [0bfc872]
- Updated dependencies [9e23b5b]
- Updated dependencies [a3aa598]
- Updated dependencies [6417a2f]
- Updated dependencies [d797f9a]
- Updated dependencies [9fde974]
- Updated dependencies [50ab9ae]
- Updated dependencies [751ac44]
- Updated dependencies [54488cd]
- Updated dependencies [9453013]
- Updated dependencies [b746d6b]
- Updated dependencies [5ac0c68]
- Updated dependencies [1fa46c1]
- Updated dependencies [0473dcb]
- Updated dependencies [5b6e9bb]
- Updated dependencies [492bac6]
- Updated dependencies [30580db]
- Updated dependencies [08e9b24]
- Updated dependencies [5076cb8]
- Updated dependencies [3c5c97e]
- Updated dependencies [7c10406]
- Updated dependencies [02797b5]
- Updated dependencies [413fe7b]
- Updated dependencies [724ed1c]
- Updated dependencies [0ddfd47]
- Updated dependencies [3639562]
- Updated dependencies [5d16745]
- Updated dependencies [48e90f4]
- Updated dependencies [5edd916]
- Updated dependencies [5a16359]
- Updated dependencies [025d6f5]
- Updated dependencies [b1ed4ef]
- Updated dependencies [985a92f]
- Updated dependencies [b889326]
- Updated dependencies [1efc6d5]
- Updated dependencies [4162e4a]
- Updated dependencies [fad4c08]
- Updated dependencies [7b66d8d]
- Updated dependencies [4bb44ef]
- Updated dependencies [30061cb]
- Updated dependencies [77b0100]
- Updated dependencies [8d33c60]
- Updated dependencies [7a3458a]
  - @labre/std@0.32.0
  - @labre/affine-shared@0.32.0
  - @labre/store@0.32.0
  - @labre/affine-model@0.32.0
  - @labre/global@0.32.0
  - @labre/sync@0.32.0

## 0.31.0

### Patch Changes

- Updated dependencies [6a663b6]
  - @labre/store@0.31.0
  - @labre/affine-model@0.31.0
  - @labre/affine-shared@0.31.0
  - @labre/std@0.31.0
  - @labre/global@0.31.0
  - @labre/sync@0.31.0

## 0.30.2

### Patch Changes

- @labre/affine-model@0.30.2
- @labre/affine-shared@0.30.2
- @labre/global@0.30.2
- @labre/std@0.30.2
- @labre/store@0.30.2
- @labre/sync@0.30.2

## 0.30.1

### Patch Changes

- @labre/affine-model@0.30.1
- @labre/affine-shared@0.30.1
- @labre/global@0.30.1
- @labre/std@0.30.1
- @labre/store@0.30.1
- @labre/sync@0.30.1

## 0.30.0

### Patch Changes

- Updated dependencies [9d0fe0c]
- Updated dependencies [ecba791]
- Updated dependencies [8de86f4]
  - @labre/std@0.30.0
  - @labre/affine-model@0.30.0
  - @labre/affine-shared@0.30.0
  - @labre/global@0.30.0
  - @labre/store@0.30.0
  - @labre/sync@0.30.0

## 0.29.1

### Patch Changes

- @labre/affine-model@0.29.1
- @labre/affine-shared@0.29.1
- @labre/global@0.29.1
- @labre/std@0.29.1
- @labre/store@0.29.1
- @labre/sync@0.29.1

## 0.29.0

### Patch Changes

- Updated dependencies [7375b9a]
- Updated dependencies [9330750]
  - @labre/affine-shared@0.29.0
  - @labre/std@0.29.0
  - @labre/affine-model@0.29.0
  - @labre/global@0.29.0
  - @labre/store@0.29.0
  - @labre/sync@0.29.0

## 0.28.0

### Patch Changes

- Updated dependencies [65cc055]
  - @labre/std@0.28.0
  - @labre/affine-model@0.28.0
  - @labre/affine-shared@0.28.0
  - @labre/global@0.28.0
  - @labre/store@0.28.0
  - @labre/sync@0.28.0

## 0.27.0

### Patch Changes

- Updated dependencies [91f6397]
  - @labre/std@0.27.0
  - @labre/affine-model@0.27.0
  - @labre/affine-shared@0.27.0
  - @labre/global@0.27.0
  - @labre/store@0.27.0
  - @labre/sync@0.27.0

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
  - @labre/affine-model@0.26.0
  - @labre/affine-shared@0.26.0
  - @labre/global@0.26.0
  - @labre/std@0.26.0
  - @labre/store@0.26.0
  - @labre/sync@0.26.0

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
  - @labre/affine-model@0.25.0
  - @labre/affine-shared@0.25.0
  - @labre/global@0.25.0
  - @labre/std@0.25.0
  - @labre/store@0.25.0
  - @labre/sync@0.25.0

## 0.24.0

### Patch Changes

- @labre/affine-model@0.24.0
- @labre/affine-shared@0.24.0
- @labre/global@0.24.0
- @labre/std@0.24.0
- @labre/store@0.24.0
- @labre/sync@0.24.0

## 0.23.3

### Patch Changes

- Updated dependencies
  - @labre/affine-shared@0.23.3
  - @labre/affine-model@0.23.3
  - @labre/global@0.23.3
  - @labre/std@0.23.3
  - @labre/store@0.23.3
  - @labre/sync@0.23.3

## 0.23.2

### Patch Changes

- Updated dependencies [ee682da]
  - @labre/affine-shared@0.23.2
  - @labre/affine-model@0.23.2
  - @labre/global@0.23.2
  - @labre/std@0.23.2
  - @labre/store@0.23.2
  - @labre/sync@0.23.2

## 0.23.1

### Patch Changes

- Updated dependencies [1beb60e]
  - @labre/affine-shared@0.23.1
  - @labre/affine-model@0.23.1
  - @labre/global@0.23.1
  - @labre/std@0.23.1
  - @labre/store@0.23.1
  - @labre/sync@0.23.1

## 0.23.0

### Patch Changes

- Updated dependencies [9014c87]
- Updated dependencies [c775151]
  - @labre/affine-model@0.23.0
  - @labre/affine-shared@0.23.0
  - @labre/global@0.23.0
  - @labre/std@0.23.0
  - @labre/store@0.23.0
  - @labre/sync@0.23.0
