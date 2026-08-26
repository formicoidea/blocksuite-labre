# @labre/affine-components

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
