# @labre/affine-block-table

## 0.36.0

### Patch Changes

- Updated dependencies [9fa662a]
- Updated dependencies [60fb357]
- Updated dependencies [3db21ea]
- Updated dependencies [7381b0b]
- Updated dependencies [f7c5b9b]
  - @labre/affine-components@0.36.0
  - @labre/affine-shared@0.36.0
  - @labre/std@0.36.0
  - @labre/affine-model@0.36.0
  - @labre/data-view@0.36.0
  - @labre/affine-inline-preset@0.36.0
  - @labre/affine-rich-text@0.36.0
  - @labre/affine-widget-slash-menu@0.36.0
  - @labre/affine-ext-loader@0.36.0
  - @labre/global@0.36.0
  - @labre/store@0.36.0

## 0.35.0

### Patch Changes

- Updated dependencies [ea5d249]
- Updated dependencies [de3560d]
- Updated dependencies [7f09608]
- Updated dependencies [cf0d8a1]
  - @labre/affine-components@0.35.0
  - @labre/affine-shared@0.35.0
  - @labre/std@0.35.0
  - @labre/affine-model@0.35.0
  - @labre/data-view@0.35.0
  - @labre/affine-inline-preset@0.35.0
  - @labre/affine-rich-text@0.35.0
  - @labre/affine-widget-slash-menu@0.35.0
  - @labre/affine-ext-loader@0.35.0
  - @labre/global@0.35.0
  - @labre/store@0.35.0

## 0.34.2

### Patch Changes

- @labre/affine-components@0.34.2
- @labre/data-view@0.34.2
- @labre/affine-ext-loader@0.34.2
- @labre/affine-inline-preset@0.34.2
- @labre/affine-model@0.34.2
- @labre/affine-rich-text@0.34.2
- @labre/affine-shared@0.34.2
- @labre/affine-widget-slash-menu@0.34.2
- @labre/global@0.34.2
- @labre/std@0.34.2
- @labre/store@0.34.2

## 0.34.1

### Patch Changes

- Updated dependencies [6120f7a]
- Updated dependencies [cb49bb1]
  - @labre/affine-model@0.34.1
  - @labre/std@0.34.1
  - @labre/affine-components@0.34.1
  - @labre/affine-inline-preset@0.34.1
  - @labre/affine-rich-text@0.34.1
  - @labre/affine-shared@0.34.1
  - @labre/data-view@0.34.1
  - @labre/affine-widget-slash-menu@0.34.1
  - @labre/affine-ext-loader@0.34.1
  - @labre/global@0.34.1
  - @labre/store@0.34.1

## 0.34.0

### Patch Changes

- Updated dependencies [881d3f5]
- Updated dependencies [6c1bdfb]
- Updated dependencies [8b00f7d]
- Updated dependencies [5f76ab3]
- Updated dependencies [f09d68c]
  - @labre/std@0.34.0
  - @labre/affine-shared@0.34.0
  - @labre/affine-components@0.34.0
  - @labre/affine-widget-slash-menu@0.34.0
  - @labre/data-view@0.34.0
  - @labre/affine-inline-preset@0.34.0
  - @labre/affine-model@0.34.0
  - @labre/affine-rich-text@0.34.0
  - @labre/affine-ext-loader@0.34.0
  - @labre/global@0.34.0
  - @labre/store@0.34.0

## 0.33.0

### Patch Changes

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
  - @labre/affine-components@0.33.0
  - @labre/affine-shared@0.33.0
  - @labre/affine-model@0.33.0
  - @labre/std@0.33.0
  - @labre/data-view@0.33.0
  - @labre/affine-inline-preset@0.33.0
  - @labre/affine-rich-text@0.33.0
  - @labre/affine-widget-slash-menu@0.33.0
  - @labre/affine-ext-loader@0.33.0
  - @labre/global@0.33.0
  - @labre/store@0.33.0

## 0.32.0

### Patch Changes

- 9c440fb: Table columns resize on the whiteboard again

  On the canvas, grabbing a column edge — or a column/row drag handle — moved the
  whole table instead of the column: the edgeless layer picks up the pointer
  first, so the gesture became a block drag before the table's own listener ever
  saw it. The affordance was there, it just did nothing you wanted.

  The table now claims a gesture that starts on one of its handles, so resizing
  and reordering behave the same on a page and on a whiteboard. Dragging anywhere
  else in the table still selects cells, and moving the table itself is unchanged.

- 413fe7b: Drag and drop runs on Pragmatic drag-and-drop v2

  `@atlaskit/pragmatic-drag-and-drop` moves to v2, its hitbox companion to v2 and
  its auto-scroll companion to v3. The three majors only drop the legacy
  TypeScript 4 type declarations, which we never consumed — the runtime API is
  unchanged, so dragging blocks, table rows and columns, and the edge detection
  that decides where a drop lands, all behave exactly as before.

  The bump also brings in the fixes released since 1.x: custom native drag
  previews now render in the browser's top layer instead of relying on a maximal
  `z-index`, and previews inside Safari's top layer no longer pick up stray user
  agent styles.

- 141de0e: Keyboard shortcuts work inside a table cell, and stay there

  A table cell used to swallow every keystroke that was not Escape or Tab, so
  none of the shortcuts a person uses while writing — bold, italic, underline,
  code, the bracket helpers — did anything once the caret was in a table. The
  only way to format text in a cell was the toolbar.

  The cell now lets those keystrokes through to a keymap registered for the table
  itself: the shortcuts work in the cell and are answered there, rather than
  leaking out to the document and acting on the page. Tab still stays inside the
  table, and the framework chords (Wardley and friends) are untouched — they have
  never armed while the caret is in editable text.

- 5cfcc6a: Remove the unused `@atlaskit/pragmatic-drag-and-drop` dependency from the table block. Table drag behaviour goes through `@labre/std`'s `DndController`, which owns the real dependency, so the table package now ships a slimmer dependency set.
- fb26f85: fix(blocks): guard table scale detection against sub-pixel rounding

  `getScale()` compared `getBoundingClientRect().width` to `offsetWidth` to
  detect a CSS transform, but `offsetWidth` is rounded to an integer while the
  rect is fractional. On a fractional devicePixelRatio (Windows 175% → dpr 1.75)
  a plain fractional CSS width therefore read as a phantom ~1.0001 scale, which
  skewed the selection overlay rects and — worse — the column widths persisted
  into the document on resize drag.

  The fix: within rounding distance (|rect.width − offsetWidth| ≤ 0.5) there is
  no transform, return exactly 1. Same guard rationale as the sub-pixel fix
  pattern; the identical unguarded quotient in the std gfx viewport is tracked
  separately.

- Updated dependencies [832c793]
- Updated dependencies [c5c07b9]
- Updated dependencies [a2b7c44]
- Updated dependencies [ff5f060]
- Updated dependencies [1b59f3c]
- Updated dependencies [41ab595]
- Updated dependencies [0bfc872]
- Updated dependencies [8ded589]
- Updated dependencies [50ab9ae]
- Updated dependencies [f832f27]
- Updated dependencies [9e23b5b]
- Updated dependencies [a3aa598]
- Updated dependencies [90a9168]
- Updated dependencies [6417a2f]
- Updated dependencies [9ffab42]
- Updated dependencies [c6eac56]
- Updated dependencies [d797f9a]
- Updated dependencies [9fde974]
- Updated dependencies [d360f72]
- Updated dependencies [50ab9ae]
- Updated dependencies [6264dfc]
- Updated dependencies [c2e1020]
- Updated dependencies [ceb2761]
- Updated dependencies [751ac44]
- Updated dependencies [54488cd]
- Updated dependencies [9453013]
- Updated dependencies [b746d6b]
- Updated dependencies [5ac0c68]
- Updated dependencies [1fa46c1]
- Updated dependencies [d8eb24a]
- Updated dependencies [0473dcb]
- Updated dependencies [5b6e9bb]
- Updated dependencies [492bac6]
- Updated dependencies [72b334c]
- Updated dependencies [fc52023]
- Updated dependencies [30580db]
- Updated dependencies [08e9b24]
- Updated dependencies [5076cb8]
- Updated dependencies [3c5c97e]
- Updated dependencies [9cf65a2]
- Updated dependencies [7c10406]
- Updated dependencies [02797b5]
- Updated dependencies [413fe7b]
- Updated dependencies [724ed1c]
- Updated dependencies [c7612da]
- Updated dependencies [0ddfd47]
- Updated dependencies [3639562]
- Updated dependencies [5d16745]
- Updated dependencies [48e90f4]
- Updated dependencies [5a61fb2]
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
  - @labre/data-view@0.32.0
  - @labre/affine-model@0.32.0
  - @labre/affine-inline-preset@0.32.0
  - @labre/global@0.32.0
  - @labre/affine-widget-slash-menu@0.32.0
  - @labre/affine-rich-text@0.32.0
  - @labre/affine-ext-loader@0.32.0

## 0.31.0

### Patch Changes

- Updated dependencies [6a663b6]
  - @labre/store@0.31.0
  - @labre/affine-components@0.31.0
  - @labre/data-view@0.31.0
  - @labre/affine-ext-loader@0.31.0
  - @labre/affine-inline-preset@0.31.0
  - @labre/affine-model@0.31.0
  - @labre/affine-rich-text@0.31.0
  - @labre/affine-shared@0.31.0
  - @labre/affine-widget-slash-menu@0.31.0
  - @labre/std@0.31.0
  - @labre/global@0.31.0

## 0.30.2

### Patch Changes

- @labre/affine-components@0.30.2
- @labre/data-view@0.30.2
- @labre/affine-ext-loader@0.30.2
- @labre/affine-inline-preset@0.30.2
- @labre/affine-model@0.30.2
- @labre/affine-rich-text@0.30.2
- @labre/affine-shared@0.30.2
- @labre/affine-widget-slash-menu@0.30.2
- @labre/global@0.30.2
- @labre/std@0.30.2
- @labre/store@0.30.2

## 0.30.1

### Patch Changes

- @labre/affine-components@0.30.1
- @labre/data-view@0.30.1
- @labre/affine-ext-loader@0.30.1
- @labre/affine-inline-preset@0.30.1
- @labre/affine-model@0.30.1
- @labre/affine-rich-text@0.30.1
- @labre/affine-shared@0.30.1
- @labre/affine-widget-slash-menu@0.30.1
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
  - @labre/affine-components@0.30.0
  - @labre/data-view@0.30.0
  - @labre/affine-inline-preset@0.30.0
  - @labre/affine-rich-text@0.30.0
  - @labre/affine-shared@0.30.0
  - @labre/affine-widget-slash-menu@0.30.0
  - @labre/affine-ext-loader@0.30.0
  - @labre/global@0.30.0
  - @labre/store@0.30.0

## 0.29.1

### Patch Changes

- @labre/affine-components@0.29.1
- @labre/data-view@0.29.1
- @labre/affine-ext-loader@0.29.1
- @labre/affine-inline-preset@0.29.1
- @labre/affine-model@0.29.1
- @labre/affine-rich-text@0.29.1
- @labre/affine-shared@0.29.1
- @labre/affine-widget-slash-menu@0.29.1
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
  - @labre/data-view@0.29.0
  - @labre/affine-inline-preset@0.29.0
  - @labre/affine-rich-text@0.29.0
  - @labre/affine-widget-slash-menu@0.29.0
  - @labre/affine-model@0.29.0
  - @labre/affine-ext-loader@0.29.0
  - @labre/global@0.29.0
  - @labre/store@0.29.0

## 0.28.0

### Patch Changes

- Updated dependencies [1cd6c92]
- Updated dependencies [65cc055]
  - @labre/data-view@0.28.0
  - @labre/std@0.28.0
  - @labre/affine-components@0.28.0
  - @labre/affine-inline-preset@0.28.0
  - @labre/affine-model@0.28.0
  - @labre/affine-rich-text@0.28.0
  - @labre/affine-shared@0.28.0
  - @labre/affine-widget-slash-menu@0.28.0
  - @labre/affine-ext-loader@0.28.0
  - @labre/global@0.28.0
  - @labre/store@0.28.0

## 0.27.0

### Patch Changes

- Updated dependencies [91f6397]
  - @labre/std@0.27.0
  - @labre/affine-components@0.27.0
  - @labre/data-view@0.27.0
  - @labre/affine-inline-preset@0.27.0
  - @labre/affine-model@0.27.0
  - @labre/affine-rich-text@0.27.0
  - @labre/affine-shared@0.27.0
  - @labre/affine-widget-slash-menu@0.27.0
  - @labre/affine-ext-loader@0.27.0
  - @labre/global@0.27.0
  - @labre/store@0.27.0

## 0.26.0

### Patch Changes

- Updated dependencies [8960a6c]
- Updated dependencies [6795191]
  - @labre/affine-model@0.26.0
  - @labre/affine-components@0.26.0
  - @labre/affine-inline-preset@0.26.0
  - @labre/affine-rich-text@0.26.0
  - @labre/affine-shared@0.26.0
  - @labre/data-view@0.26.0
  - @labre/affine-widget-slash-menu@0.26.0
  - @labre/affine-ext-loader@0.26.0
  - @labre/global@0.26.0
  - @labre/std@0.26.0
  - @labre/store@0.26.0

## 0.25.0

### Patch Changes

- Updated dependencies [8960a6c]
- Updated dependencies [6795191]
  - @labre/affine-model@0.25.0
  - @labre/affine-components@0.25.0
  - @labre/affine-inline-preset@0.25.0
  - @labre/affine-rich-text@0.25.0
  - @labre/affine-shared@0.25.0
  - @labre/data-view@0.25.0
  - @labre/affine-widget-slash-menu@0.25.0
  - @labre/affine-ext-loader@0.25.0
  - @labre/global@0.25.0
  - @labre/std@0.25.0
  - @labre/store@0.25.0

## 0.24.0

### Patch Changes

- @labre/affine-components@0.24.0
- @labre/data-view@0.24.0
- @labre/affine-ext-loader@0.24.0
- @labre/affine-inline-preset@0.24.0
- @labre/affine-model@0.24.0
- @labre/affine-rich-text@0.24.0
- @labre/affine-shared@0.24.0
- @labre/affine-widget-slash-menu@0.24.0
- @labre/global@0.24.0
- @labre/std@0.24.0
- @labre/store@0.24.0

## 0.23.3

### Patch Changes

- Updated dependencies
  - @labre/affine-shared@0.23.3
  - @labre/affine-components@0.23.3
  - @labre/data-view@0.23.3
  - @labre/affine-inline-preset@0.23.3
  - @labre/affine-rich-text@0.23.3
  - @labre/affine-widget-slash-menu@0.23.3
  - @labre/affine-ext-loader@0.23.3
  - @labre/affine-model@0.23.3
  - @labre/global@0.23.3
  - @labre/std@0.23.3
  - @labre/store@0.23.3

## 0.23.2

### Patch Changes

- Updated dependencies [ee682da]
  - @labre/affine-shared@0.23.2
  - @labre/affine-components@0.23.2
  - @labre/data-view@0.23.2
  - @labre/affine-inline-preset@0.23.2
  - @labre/affine-rich-text@0.23.2
  - @labre/affine-widget-slash-menu@0.23.2
  - @labre/affine-ext-loader@0.23.2
  - @labre/affine-model@0.23.2
  - @labre/global@0.23.2
  - @labre/std@0.23.2
  - @labre/store@0.23.2

## 0.23.1

### Patch Changes

- Updated dependencies [1beb60e]
  - @labre/affine-shared@0.23.1
  - @labre/affine-components@0.23.1
  - @labre/data-view@0.23.1
  - @labre/affine-inline-preset@0.23.1
  - @labre/affine-rich-text@0.23.1
  - @labre/affine-widget-slash-menu@0.23.1
  - @labre/affine-ext-loader@0.23.1
  - @labre/affine-model@0.23.1
  - @labre/global@0.23.1
  - @labre/std@0.23.1
  - @labre/store@0.23.1

## 0.23.0

### Patch Changes

- Updated dependencies [9014c87]
- Updated dependencies [c775151]
  - @labre/affine-model@0.23.0
  - @labre/affine-shared@0.23.0
  - @labre/affine-components@0.23.0
  - @labre/affine-inline-preset@0.23.0
  - @labre/affine-rich-text@0.23.0
  - @labre/data-view@0.23.0
  - @labre/affine-widget-slash-menu@0.23.0
  - @labre/affine-ext-loader@0.23.0
  - @labre/global@0.23.0
  - @labre/std@0.23.0
  - @labre/store@0.23.0
