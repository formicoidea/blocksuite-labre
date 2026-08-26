# @labre/data-view

## 0.32.0

### Patch Changes

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

- 50ab9ae: A date column can group a database, at the grain you choose

  Grouping a table or a kanban board offered tags, text, numbers and booleans —
  never dates, the one axis a roadmap is actually organised along. A date
  property is now groupable, and it is groupable at six grains: relative to
  today (Yesterday, Today, Next 7 days, Last 30 days, then by month further
  out), by day, by week starting Monday, by week starting Sunday, by month, or
  by year.

  The grain and the reading direction live in the group settings menu, beside
  "Group by", and both are stored with the view, so reopening the document
  finds the same reading rather than snapping back to the default. Date groups
  order themselves chronologically — oldest first or newest first — instead of
  offering a manual drag order that a recomputed set of groups could not honour
  anyway; the manual order stays exactly as it was for every other kind of
  grouping.

- f832f27: Dragging a kanban group no longer scrambles the order of the others

  Reordering groups spliced the moved key out of the list by the index of a
  `findIndex` that was never checked. Drop a group onto something the list did not
  know about — a group that had just been renamed away, or the group itself — and
  the index was `-1`: the _last_ group was cut out instead, then the dragged one
  was re-inserted near the end. The manual arrangement, which is what a kanban
  board mostly is, came back wrong and stayed wrong, because that scrambled list
  was written straight to the document.

  A move that cannot be honoured is now a move that does not happen: unknown
  group, unknown drop anchor, or a group dropped where it already sits all leave
  the order exactly as it was, and nothing is written. Legitimate drags behave as
  before.

- 9ffab42: A mobile cell enters and leaves editing mode once, not on every repaint

  On phones, table and kanban cells watched the selection through an effect that
  also read the signal holding the rendered cell component. Every repaint of the
  cell therefore re-ran the branch and called the cell's enter- or exit-editing
  hook again, on a cell whose editing state had not moved. For a number or date
  cell, whose exit hook re-parses and writes back the value, that meant a write on
  every tick — visible as a caret that jumps back, a value reformatted while you
  are still typing, and needless churn in the document.

  Each branch now runs only on a real transition, so the hooks fire once when the
  cell starts being edited and once when it stops.

- c6eac56: A number reads from the left in the record detail panel

  Number cells are right-aligned in a table, where the column edge gives the digits
  something to line up against. The detail panel has no such edge, so it carries a
  rule that flips a number back to the left — except the rule named a class the
  cell never renders, so it matched nothing and every number in the panel stayed
  pushed against the far right of a full-width row, adrift from its own label.

  The rule now names the element the cell actually renders, so numbers in the
  detail panel start where every other field starts.

- 6264dfc: A stored filter resolves to the function it means

  A condition is persisted as a function name and nothing else — the column type
  it was built for is not written down. Resolution took the first function
  answering to that name, whatever type it belonged to, so a name declared by two
  types resolved to the wrong implementation. Its argument then failed
  validation, and a condition that cannot be evaluated reports a match: the
  filter silently let every row through and looked as if it had been ignored.

  Every function answering to the name is now tried, and the first one that can
  actually decide answers. A condition no candidate can apply still lets the row
  through rather than hiding everything, as before.

- c2e1020: A grouped table can be folded down to its headings

  A table grouped by status, owner or phase gives every group its full column
  header, its rows, its add-row line and its statistics bar — useful while you
  work inside one group, in the way while you are looking for another.

  Each group heading now carries a chevron. Clicking it (or pressing Enter or
  Space on it, it is a real focusable control announcing its expanded state)
  folds the group down to its heading alone; clicking again brings the rows
  back. The state is remembered per view and per group for the length of the
  browsing session, so scrolling away and returning finds the table as you left
  it, while a fresh session starts with everything open.

  Both the desktop and the mobile table honour it.

- ceb2761: A view survives its own layout change, and a detail cell stops fighting itself

  Four small pieces of database behaviour that all went wrong on the way out of an
  interaction:

  Switching a view's layout — table to kanban and back — kept the old view's
  controller alive, because the cache holding it was keyed by the view id and the
  id does not change when the layout does. The board that appeared was still being
  driven by table logic: wrong hotkeys, wrong selection, wrong drag. The cache now
  remembers the layout alongside the id, and drops the entry of a deleted view
  instead of holding it forever.

  Re-picking the layout a view already has now does nothing, instead of resetting
  that view to the defaults of its own type and throwing away its column widths,
  filters and groups.

  Leaving edit mode in the record detail panel could loop: the cell's exit hook
  writes its value back, the write re-asks for the selection, and the selection
  runs the exit hook again. The panel now publishes the new selection before
  running the hook, and ignores a selection identical to the one already applied,
  so each hook fires once.

  Finally, a number column now reads a pasted "11,451.4" or "$1,200" as the number
  it obviously is, rather than discarding it because the grouping separators made
  it unparseable.

- d8eb24a: The Delete key clears a table selection, like Backspace already did

  Table views bound the clearing shortcut to Backspace only. On a full keyboard —
  and on every keyboard where Delete is the obvious key for "empty this" — pressing
  Delete over a selected cell, a rectangle of cells, or a set of rows did nothing
  at all, with no hint that another key was expected.

  Delete now runs the same handler as Backspace in both the standard and the
  virtualised table: it empties the selected cells, or deletes the selected rows.
  Nothing changes for Backspace, and neither key does anything while a cell is
  being edited, where Delete belongs to the text cursor.

- fc52023: A filter keeps working after its column is hidden

  Table and kanban views evaluated their filters against the visible properties
  only. Hide the column a condition points at — a perfectly ordinary way to tidy a
  table once the filter is set — and the condition evaluated against nothing: the
  rows it was hiding came flooding back, while the filter chip in the toolbar
  still claimed to be active.

  Filters are now evaluated against the view's full property list. Hiding a column
  changes what is drawn, never what is kept. The filter itself was never deleted,
  so views that lost their filtering get it back on reload with no migration.

- 9cf65a2: Typing a letter into a select cell searches instead of creating a broken tag

  Start typing over a focused select or multi-select cell and the first character
  was pushed through the generic "set this cell from a string" path. For a tag
  column that meant fabricating a tag out of a single character, and the picker
  then opened with an empty search box — so a one-letter tag could neither be
  found nor selected, only accidentally created.

  The typed character is now staged on the cell and handed to the tag picker as
  its initial search text. Typing `C` over a status cell opens the picker already
  filtered to `C`: existing one-letter tags show up and can be picked, and
  creating a new one stays a deliberate choice. Text, number and date columns keep
  the old behaviour.

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
- Updated dependencies [1b59f3c]
- Updated dependencies [41ab595]
- Updated dependencies [0bfc872]
- Updated dependencies [8ded589]
- Updated dependencies [9e23b5b]
- Updated dependencies [90a9168]
- Updated dependencies [d797f9a]
- Updated dependencies [9fde974]
- Updated dependencies [d360f72]
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
- Updated dependencies [72b334c]
- Updated dependencies [30580db]
- Updated dependencies [08e9b24]
- Updated dependencies [3c5c97e]
- Updated dependencies [7c10406]
- Updated dependencies [02797b5]
- Updated dependencies [413fe7b]
- Updated dependencies [724ed1c]
- Updated dependencies [c7612da]
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
  - @labre/affine-components@0.32.0
  - @labre/global@0.32.0

## 0.31.0

### Patch Changes

- Updated dependencies [6a663b6]
  - @labre/store@0.31.0
  - @labre/affine-components@0.31.0
  - @labre/affine-shared@0.31.0
  - @labre/std@0.31.0
  - @labre/global@0.31.0

## 0.30.2

### Patch Changes

- @labre/affine-components@0.30.2
- @labre/affine-shared@0.30.2
- @labre/global@0.30.2
- @labre/std@0.30.2
- @labre/store@0.30.2

## 0.30.1

### Patch Changes

- @labre/affine-components@0.30.1
- @labre/affine-shared@0.30.1
- @labre/global@0.30.1
- @labre/std@0.30.1
- @labre/store@0.30.1

## 0.30.0

### Patch Changes

- Updated dependencies [9d0fe0c]
- Updated dependencies [8de86f4]
  - @labre/std@0.30.0
  - @labre/affine-components@0.30.0
  - @labre/affine-shared@0.30.0
  - @labre/global@0.30.0
  - @labre/store@0.30.0

## 0.29.1

### Patch Changes

- @labre/affine-components@0.29.1
- @labre/affine-shared@0.29.1
- @labre/global@0.29.1
- @labre/std@0.29.1
- @labre/store@0.29.1

## 0.29.0

### Patch Changes

- Updated dependencies [7375b9a]
- Updated dependencies [9330750]
  - @labre/affine-shared@0.29.0
  - @labre/std@0.29.0
  - @labre/affine-components@0.29.0
  - @labre/global@0.29.0
  - @labre/store@0.29.0

## 0.28.0

### Minor Changes

- 1cd6c92: Add `ExternalDataSourceBase` and a rebuildable, disposable database source
  (closes #22).

  Hosts that back an `affine:database` with their own collection (via
  `DatabaseDataSourceProvider`) previously had to reimplement the whole
  `DataSourceBase` (~33 abstract members). They can now extend
  **`ExternalDataSourceBase`**, which keeps the view config in the model blob and
  implements all the generic machinery — view manager / metas / converts, view-data
  CRUD, feature flags, readonly, and the reactive plumbing. A concrete source only
  provides a small synchronous data contract (`getRows`, `getCellValue`,
  `getProperty*`, `getPropertyMetas`) plus the mutations, and calls the protected
  `invalidate()` from its own change observers to refresh the view. The inline blob
  source (`DatabaseBlockDataSource`) now extends this base, so it keeps exercising
  every shared code path.

  `DataSourceBase` gains an overridable `dispose()`. The database block now holds a
  _reference_ to its source: it rebuilds (and disposes the old one) whenever
  `externalSourceId` changes — covering promote-swap, detach, import and re-point —
  and disposes on disconnect, ending the observer leak. The block never couples the
  source's lifecycle to its own (a source may be embedded in several blocks).

### Patch Changes

- Updated dependencies [65cc055]
  - @labre/std@0.28.0
  - @labre/affine-components@0.28.0
  - @labre/affine-shared@0.28.0
  - @labre/global@0.28.0
  - @labre/store@0.28.0

## 0.27.0

### Patch Changes

- Updated dependencies [91f6397]
  - @labre/std@0.27.0
  - @labre/affine-components@0.27.0
  - @labre/affine-shared@0.27.0
  - @labre/global@0.27.0
  - @labre/store@0.27.0

## 0.26.0

### Patch Changes

- Updated dependencies [6795191]
  - @labre/affine-components@0.26.0
  - @labre/affine-shared@0.26.0
  - @labre/global@0.26.0
  - @labre/std@0.26.0
  - @labre/store@0.26.0

## 0.24.0

### Patch Changes

- @labre/affine-components@0.24.0
- @labre/affine-shared@0.24.0
- @labre/global@0.24.0
- @labre/std@0.24.0
- @labre/store@0.24.0

## 0.23.3

### Patch Changes

- Updated dependencies
  - @labre/affine-shared@0.23.3
  - @labre/affine-components@0.23.3
  - @labre/global@0.23.3
  - @labre/std@0.23.3
  - @labre/store@0.23.3

## 0.23.2

### Patch Changes

- Updated dependencies [ee682da]
  - @labre/affine-shared@0.23.2
  - @labre/affine-components@0.23.2
  - @labre/global@0.23.2
  - @labre/std@0.23.2
  - @labre/store@0.23.2

## 0.23.1

### Patch Changes

- Updated dependencies [1beb60e]
  - @labre/affine-shared@0.23.1
  - @labre/affine-components@0.23.1
  - @labre/global@0.23.1
  - @labre/std@0.23.1
  - @labre/store@0.23.1

## 0.23.0

### Patch Changes

- Updated dependencies [9014c87]
  - @labre/affine-shared@0.23.0
  - @labre/affine-components@0.23.0
  - @labre/global@0.23.0
  - @labre/std@0.23.0
  - @labre/store@0.23.0
