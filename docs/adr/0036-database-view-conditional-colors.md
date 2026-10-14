# ADR 0036 — Conditional colours of a database view: one optional `colorRules` field, filter conditions, the options' palette

- Status: accepted
- Date: 2026-10-14
- Deciders: Mathieu Jolly
- **Red zone.** This ADR adds an optional field to the stored view data of
  `affine:database` (`props.views[i].colorRules`, typed by
  `ViewBasicDataType` in `packages/affine/model`, the file format). It needs a
  maintainer's explicit approval.
- Relates to [ADR 0035](./0035-core-database-bundle-and-panel-seams.md)
  (§8, the first optional view fields `sourceId` and `openIn`; its amendment
  of 2026-10-14 "This view" and importing a view, which left conditional
  colours to this change), [ADR 0009](./0009-reversed-flag-contract.md)
  (flags gate tooling, never content) and
  [ADR 0023](./0023-every-displayed-string-through-a-key.md) (every string a
  key).
- Host side: labre PRD « Labre v2 », REQ-DB-4 (a view template carries the
  conditional colours) and REQ-DB-10 ("This view" exposes the view's
  settings). Reference product: Notion, a row or card coloured by a condition
  on a property.

## Context

A view of a database shows rows (table, list) or cards (board, gallery). The
product owner wants a row or a card coloured when it matches a condition on
its properties, the way Notion does, set from the view's settings and the
full page's "This view", carried by a view template and by an imported view.

The library already has everything such a rule is made of: a view's filter
(`FilterGroup` of `@labre/data-view`: a group of conditions, each a property
reference, a filter function name and literal arguments, with its evaluator
`evalFilter`, its editor `<filter-root-view>` and its condition picker
`popCreateFilter`), and a colour palette, the select options' (`selectOptionColors`: ten colours, light in a light theme and dark in a dark
one, made to carry text). What it lacks is a place to store the rules.

## Decision

1. **One optional stored field.** `colorRules` on `ViewBasicDataType`, typed `DatabaseViewColorRule[] | undefined`, on every view whatever its mode. A rule is

   ```ts
   type DatabaseViewColorRule = {
     id: string; // nanoid, names the rule for the editor
     color: string; // a colour of the options' palette, as an option stores it
     filter: { type: 'group'; op: 'and' | 'or'; conditions: unknown[] };
   };
   ```

   `filter` is exactly the shape a view stores as its `filter`: same
   functions, same arguments, same nesting. The model types it opaquely
   (it does not know the filter functions); data-view's `ViewColorRule` is
   `{ id, color, filter: FilterGroup }`, held assignable to the model type
   by `color-rules.unit.spec.ts`.

2. **Absent by default, never written on load.** The field is `undefined`
   until a gesture adds a rule (`colorRuleAdd`); nothing writes it on load,
   on mount or on opening the editor; a write that changes nothing is not
   made (no empty undo step); a read-only or fallback view (ADR 0035 §6) is
   never written. No migration: a view stored by 0.49 or earlier is a valid
   view with no rule. Removing the last rule leaves `colorRules: []`, which
   reads as no rule.

3. **Order decides: the first rule that matches wins.** Rules are evaluated
   in stored order; the first whose filter matches the row gives its colour.
   A rule with no condition matches nothing, and a condition that cannot
   decide (a property picked, no value yet) does not match:
   `evalFilter(filter, row, undecided = false)`. The view filter keeps its
   own reading (`undecided = true`: an unfinished condition hides no row).
   "Move up" / "Move down" in a rule's menu change the order.

4. **Only the palette is painted.** `color` is compared with the options'
   palette (`selectOptionColors`, its current and its older
   `var(--affine-tag-*)` spellings); only a palette colour is ever put into a
   style, never the stored string as is. A matching rule whose colour this
   build does not know (a newer client's) still wins and paints nothing, as
   that client would paint its own colour there, not a later rule's. No new
   colour and no hex value is introduced.

5. **Painted in core, for every reader.** The reading and evaluation live in
   `data-view/src/core/view/color-rules.ts` (`viewColorRules`,
   `colorRulesMatch`, `viewRowColor`); each layout sets the custom property
   `--data-view-row-color` on its row or card and its stylesheet reads it as
   the background in place of its own (`var(--data-view-row-color, …)`, its own background as the fallback): the table row (desktop and mobile), the board card (desktop and
   mobile), the gallery card and the list row. A selection or a hover still
   paints over it. Nothing of it is gated (ADR 0009): a stored rule paints
   whatever bundle or flag the host has.

6. **The editor is a view setting, made of existing parts.** The view
   settings menu gains "Conditional colors" (`ViewSettingKey` gains
   `'color-rules'`, offered where the view has the filter trait: table,
   board, gallery, list; not the calendar). It opens a menu listing the
   rules (swatch, the properties the rule reads, the colour's name) and "Add
   a color rule", which goes through the filter's own `popCreateFilter`. A
   rule's menu holds the filter's own `<filter-root-view>` for its
   conditions, "Add a condition" (`popCreateFilter` again), the options'
   colour entries (`selectOptionColorActions`, now the one copy an option's
   menu and a rule's menu share), "Move up", "Move down" and "Delete". The
   editor lives in core beside the filter and the sort it is made of; the
   full page's "This view" (bundle `labre-core-database`) lists it as one
   more `'view-menu'` command, `database.view.color-rules`, which opens the
   same menu through `openSetting('color-rules')`, as its other settings do.

7. **Templates and imports.** A view template keeps the rules, conditions
   included (REQ-DB-4; `viewTemplateData` keeps every key but the filter's
   conditions, the sort and the manual orders). An import (`remapView`)
   rewrites each rule's conditions through the property mapping as it does
   the filter's (select options by name), but a rule that loses any
   condition (a property ignored, no option of that name here) is removed
   whole: a rule with fewer conditions would colour rows its author never
   meant. `RemapDropped` gains `colorRules: number`, the rules removed, so the
   host's dialog can say so; the field is new in 0.50 and every 0.49 field
   keeps its type (`remap-dropped-signature.unit.spec.ts`).

## What stays loadable, and by whom

- A document written before 0.50 opens unchanged: no view has the field, no
  view gains it.
- A 0.49 client ignores `colorRules`: it paints no colour, and keeps the
  field through its own writes to that view (`updateView` merges into the
  stored view; a layout switch merges the converted data into it). A view it
  duplicates keeps the field too (the whole stored view is copied).
- A view whose mode this build does not know is drawn by the fallback preset
  and trusts none of its stored settings: its rules are neither painted nor
  written (ADR 0035 §6).
- A rule a newer client writes in another shape is skipped when read, never
  thrown on; a value of `colorRules` that is not an array reads as no rule.

## Consequences

- One more optional field on every view, forever: future readers must keep
  the order semantics (first match wins) and the palette rule.
- The colour is a full tile of the chip colour: in the light theme a pale
  tint, in the dark theme a deep one, both made to carry primary text, so
  rows stay readable in both.
- Not done, each a `ponytail:` line or recorded here: the virtual table
  (`enable_table_virtual_scroll`, off by default) paints no rule; the
  calendar offers and paints none; rules are reordered by "Move up" / "Move
  down", not by a drag; no telemetry event is emitted for a rule (the view
  settings' other entries emit none either).
- New keys: `com.labre.data-view.color-rules` (also the "This view" entry),
  `.add`, `.rule`, `.add-condition`, `.no-condition`, `.move-up`,
  `.move-down`; "Delete" reuses `com.labre.toolbar.delete`. The host's
  catalogue gains their French.
- Held by `data-view/src/__tests__/color-rules.unit.spec.ts`,
  `model/src/__tests__/view-basic-data.unit.spec.ts`,
  `database-editor/src/__tests__/remap-view.unit.spec.ts`,
  `import-view.unit.spec.ts`, `remap-dropped-signature.unit.spec.ts`,
  `view-menu-commands.unit.spec.ts`, and the integration specs
  `page/database-color-rules.spec.ts` and
  `page/database-page-view-menu.spec.ts`.

## Amendments

### 2026-10-14: the colour is picked from the canvas swatch grid

Amends the Decision's rule menu ("the options' colour entries") and the
option menu it shares them with. Asked by the product owner: one colour
picker component across the canvas and the databases.

- The ten menu rows (`selectOptionColorActions`) give way to one menu entry,
  `selectOptionColorGrid`: the canvas swatch grid `<edgeless-color-panel>`
  (`@labre/affine-components/color-picker`), five columns, fed by
  `selectOptionColorPalettes` with the same ten `selectOptionColors` in the
  same order. An option's menu, a rule's menu and the kanban group header's
  option menu (`SelectGroupView`, whose colour names were English until
  then) all read it.
- Nothing stored changes. A swatch's value is `selectOptionColors[i].color`
  itself, the string the rows wrote; the rule colour whitelist
  (`colorRulePaint`) is untouched. The scheme handed to the grid is
  irrelevant to these values: they are CSS variable strings the page's theme
  resolves.
- A swatch's label (its `aria-label` and its `title` tooltip, on the canvas
  too) is the colour's name through the
  existing wordings, resolved by the menu's opener and handed to the grid as
  the `labelWording` fallback, since a popup has no `std`. The current colour
  is ringed. A pick closes the menu, as a row did; the rule menu then reopens
  itself as before.
- `EdgelessColorButton`'s swatch paints through an inline `fill` declaration
  as well as the `fill` attribute: `var(...)` in an SVG presentation
  attribute is resolved by Chromium (measured) but is not something every
  engine promises. A plain canvas colour paints exactly as before.
- The grid is keyboard-operable, on the canvas too: a `radiogroup` of
  `radio` swatches with one roving tab stop (the current colour, else the
  first); the arrows move between swatches (up and down by `columns` when
  the grid declares them, else by one), Enter or Space picks through the
  same click a pointer sends, and a focused swatch shows a 2px ring in
  `layer/insideBorder/primaryBorder`. A key the grid handles goes no further,
  so the canvas does not also read it. The menu's own arrow navigation (a
  virtual focus over its rows) does not enter the grid: Tab does.
- Held by `data-view/src/__tests__/color-grid.unit.spec.ts`, the "picking a
  rule's colour" block of `color-rules.unit.spec.ts`,
  `components/src/__tests__/color-button-paint.unit.spec.ts` and
  `components/src/__tests__/color-panel-keyboard.unit.spec.ts`.

### 2026-10-14: framework pages, softened (red zone: widens the accepted stored colours)

Amends Decision §4 ("Only the palette is painted") and the amendment above.
Asked by the product owner: keep the ten high-contrast chip colours as the
first page, and offer every framework's palette as softened variants. **Red
zone**: a rule colour the painter accepts is a stored value, and this widens
what it accepts; a maintainer's explicit approval is needed.

- **Pages.** The grid is paged like the canvas carousel (ADR 0027), with its
  own header, list and paging (`renderPaletteCarousel`,
  `paletteCarouselPage`, hosted by `<dv-color-carousel>` because a menu
  entry is re-called on every render). Page one is the ten
  `selectOptionColors`, never hidden; one page follows per
  `FrameworkPaletteExtension` the editor registered, in the carousel's order
  (`contributedFrameworkPalettes`). Those register from each framework's
  flag-gated view extension, now in both scopes (a database lives in a page),
  so a framework switched off offers no page: tooling only (ADR 0009). The
  openers hand their `std` down (the kanban header's own, the cell's
  `chromeStd` through `TagSelectOptions.std`, the view root's for the rule
  menu); without one, page one alone, in the DOM it had. The grid opens on
  the page that holds the current colour.
- **A softened colour is one stored string**,
  `color-mix(in srgb, #rrggbb NN%, var(--affine-v2-layer-background-primary))`,
  built from the framework colour's light value (`softenedChipColor`): 30%
  of the colour; a colour that is already a mix of at most 35% of some colour
  with white (a pastel) keeps its light look exactly, its source being that
  colour mixed back at the share that reproduces it on white. Light and dark
  follow from the theme's own background token, spelled literally because a
  host may rename `cssVarV2`'s output and keeps the `--affine-v2-*` names as
  aliases (the Labre app's `@labre/theme`, its ADR-0043). Measured with the
  tokens the library's theme ships, every swatch of every framework page
  carries primary text above AA: worst case 8.8:1 in light (black) and
  5.4:1 in dark (white). A swatch that is not a plain `#rrggbb`
  (transparent) offers nothing; identical results on one page are kept once.
  Swatches keep their framework's names. 8 pages today, of 6 to 16 swatches.
- **What paints.** `colorRulePaint` accepts, besides the palette and its old
  spellings, a string passing `isSoftenedChipColor`, a strict match of that
  exact shape: lowercase `#rrggbb`, an integer share from 1 to 100, that one
  token, nothing before or after. Anything else is still refused and paints
  nothing. The check reads the string alone, never a flag or a registered
  palette, so a stored softened colour paints whatever the host switched off.
  An option's colour has no such check, before or after: it is painted as
  stored through `styleMap` (a property value, never a declaration list), so
  nothing changes there.
- **Nothing stored changes shape.** No field, no migration; values written
  before paint as before, and a page-one pick writes exactly the
  `selectOptionColors[i].color` it wrote.
- **Older clients.** A 0.49 client (checked against `chore: version packages
(0.49.0)`) reads no `colorRules` at all and paints none; it keeps the
  field through its writes, as §"What stays loadable" says. It paints an
  option's softened colour as stored (`multi-tag-view.ts` put
  `getColorByColor(option.color)` in `background-color` already), so the
  chip looks the same there, in both themes. A build with this ADR but not
  this amendment would read a softened rule colour as unknown: the rule
  still wins and paints nothing. A browser without `color-mix()` (before
  Chrome 111, Safari 16.2, Firefox 113) drops the declaration and shows the
  chip's or the row's own background.
- **Limits.** The rule list names a softened colour by nothing (the stored
  string does not say which framework swatch it came from). The full page's
  "This view" offers framework pages only where the view's root renders
  inside the editor.
- Held by `data-view/src/__tests__/softened-chip-color.unit.spec.ts` (the
  validator guard, injection attempts included),
  `affine/all/src/__tests__/database/softened-chip-colors.unit.spec.ts`
  (contrast of every swatch in both themes, pastels, dedupe),
  the "framework pages" block of `color-grid.unit.spec.ts`, the framework
  pick in `color-rules.unit.spec.ts` and the page-scope case of
  `framework-palettes-gating.unit.spec.ts`.
