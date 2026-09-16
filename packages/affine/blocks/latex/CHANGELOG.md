# @labre/affine-block-latex

## 0.41.0

### Minor Changes

- 924f7d6: feat(blocks): the text blocks' and the slash menu's AFFiNE chrome resolves through the translation seam instead of raw English literals. The note block's edgeless surface — the style panel (fill color / shadow / border / corner-radius section titles, the custom-color tab, the "Note Style" button), the shadow/border/display-mode dropdowns, the surface toolbar's slicer/size/display-in-page buttons and their four notifications ("Note displayed in Page Mode", "Content removed/added…", "View in Toc") — now carries `translateKey`/`labelWording`/`tooltipWording` pairs everywhere `std` reaches or the toolbar's own static-config seam applies. The note's slash-menu tooltip captions, its conversion/format item names (`nameWording`, reusing the shared block-type words below), and the "Other Headings" submenu follow the same pattern; the move-up/move-down hotkey config's internal label now reads the shared wording's own fallback instead of restating it, so it can never drift from what the slash menu's own "Actions" group says. The paragraph block's placeholders (the empty-paragraph "Type '/' for commands" and the six heading-level placeholders) resolve through a lookup table a host's custom `getPlaceholder` is free to ignore. `gfx/note`'s "add note" senior tool, its quick-tool row (Image/File/Link, and every block kind offered), and its own shadow/display-mode panels are keyed too — distinct from `blocks/note`'s wording where the two surfaces say different words (e.g. "In Both" vs "Both"), including the pre-existing "Floation shadow" typo, kept letter-for-letter apart from `blocks/note`'s "Floating shadow". The code block's toolbar (copy/caption/comment/duplicate/delete/more, wrap/line-number toggles, the language search placeholder, the "Plain Text" fallback and the copy-failure toast) and the latex block's two slash-menu items (name/description/tooltip intro) and its empty/error placeholders are keyed; language names themselves stay English (proper names). The callout block's single slash-menu item is keyed. Block-type words used in more than one of these packages (Text, Heading 1-6, Code Block, Quote, Divider, Bulleted/Numbered/To-do List) and the note shadow options shared between `blocks/note` and `gfx/note` now live once in `@labre/affine-shared`'s `chrome.ts`. With no catalogue registered every surface reads exactly as it did before this change, letter for letter.

### Patch Changes

- b2781b5: refactor(blocks): one chrome word, one key. Where several packages declared the same English interface word under different keys (Copy-style verbs, text formats, display modes, Reload, Rename, Settings…), they now share one wording from `@labre/affine-shared/services`, and the key manifest carries 52 fewer entries. Nothing changes on screen, and no key that existed in a previous release is removed: the merged keys were all introduced by this release's translation work. The manifest spec now fails when a new interface word is declared under a second key (real homonyms such as « Light » or « Left » are allow-listed with a reason).
- Updated dependencies [a513f05]
- Updated dependencies [6cfe313]
- Updated dependencies [5776733]
- Updated dependencies [4ed9484]
- Updated dependencies [c4661f2]
- Updated dependencies [6271b11]
- Updated dependencies [924f7d6]
- Updated dependencies [5744cfd]
- Updated dependencies [feca957]
- Updated dependencies [1dac32d]
- Updated dependencies [b2781b5]
- Updated dependencies [223b280]
- Updated dependencies [47d4ac6]
  - @labre/affine-block-note@0.41.0
  - @labre/affine-shared@0.41.0
  - @labre/affine-widget-slash-menu@0.41.0
  - @labre/std@0.41.0
  - @labre/affine-components@0.41.0
  - @labre/affine-rich-text@0.41.0
  - @labre/affine-inline-latex@0.41.0
  - @labre/affine-model@0.41.0
  - @labre/affine-ext-loader@0.41.0
  - @labre/global@0.41.0
  - @labre/store@0.41.0

## 0.40.0

### Patch Changes

- Updated dependencies [95ff0a5]
- Updated dependencies [95ff0a5]
  - @labre/affine-shared@0.40.0
  - @labre/affine-block-note@0.40.0
  - @labre/affine-components@0.40.0
  - @labre/affine-inline-latex@0.40.0
  - @labre/affine-rich-text@0.40.0
  - @labre/affine-widget-slash-menu@0.40.0
  - @labre/affine-ext-loader@0.40.0
  - @labre/affine-model@0.40.0
  - @labre/global@0.40.0
  - @labre/std@0.40.0
  - @labre/store@0.40.0

## 0.39.3

### Patch Changes

- Updated dependencies [070e1ec]
  - @labre/affine-components@0.39.3
  - @labre/affine-block-note@0.39.3
  - @labre/affine-inline-latex@0.39.3
  - @labre/affine-rich-text@0.39.3
  - @labre/affine-widget-slash-menu@0.39.3
  - @labre/affine-ext-loader@0.39.3
  - @labre/affine-model@0.39.3
  - @labre/affine-shared@0.39.3
  - @labre/global@0.39.3
  - @labre/std@0.39.3
  - @labre/store@0.39.3

## 0.39.2

### Patch Changes

- Updated dependencies [07b47b8]
  - @labre/affine-shared@0.39.2
  - @labre/affine-block-note@0.39.2
  - @labre/affine-components@0.39.2
  - @labre/affine-inline-latex@0.39.2
  - @labre/affine-rich-text@0.39.2
  - @labre/affine-widget-slash-menu@0.39.2
  - @labre/affine-ext-loader@0.39.2
  - @labre/affine-model@0.39.2
  - @labre/global@0.39.2
  - @labre/std@0.39.2
  - @labre/store@0.39.2

## 0.39.1

### Patch Changes

- Updated dependencies [00eab3d]
  - @labre/affine-model@0.39.1
  - @labre/affine-block-note@0.39.1
  - @labre/affine-components@0.39.1
  - @labre/affine-inline-latex@0.39.1
  - @labre/affine-rich-text@0.39.1
  - @labre/affine-shared@0.39.1
  - @labre/affine-widget-slash-menu@0.39.1
  - @labre/affine-ext-loader@0.39.1
  - @labre/global@0.39.1
  - @labre/std@0.39.1
  - @labre/store@0.39.1

## 0.39.0

### Patch Changes

- @labre/affine-block-note@0.39.0
- @labre/affine-components@0.39.0
- @labre/affine-ext-loader@0.39.0
- @labre/affine-inline-latex@0.39.0
- @labre/affine-model@0.39.0
- @labre/affine-rich-text@0.39.0
- @labre/affine-shared@0.39.0
- @labre/affine-widget-slash-menu@0.39.0
- @labre/global@0.39.0
- @labre/std@0.39.0
- @labre/store@0.39.0

## 0.38.2

### Patch Changes

- Updated dependencies [0ffa45b]
  - @labre/std@0.38.2
  - @labre/affine-block-note@0.38.2
  - @labre/affine-components@0.38.2
  - @labre/affine-inline-latex@0.38.2
  - @labre/affine-model@0.38.2
  - @labre/affine-rich-text@0.38.2
  - @labre/affine-shared@0.38.2
  - @labre/affine-widget-slash-menu@0.38.2
  - @labre/affine-ext-loader@0.38.2
  - @labre/global@0.38.2
  - @labre/store@0.38.2

## 0.38.1

### Patch Changes

- @labre/affine-block-note@0.38.1
- @labre/affine-components@0.38.1
- @labre/affine-ext-loader@0.38.1
- @labre/affine-inline-latex@0.38.1
- @labre/affine-model@0.38.1
- @labre/affine-rich-text@0.38.1
- @labre/affine-shared@0.38.1
- @labre/affine-widget-slash-menu@0.38.1
- @labre/global@0.38.1
- @labre/std@0.38.1
- @labre/store@0.38.1

## 0.38.0

### Patch Changes

- Updated dependencies [6a7c31a]
- Updated dependencies [6aa0081]
  - @labre/affine-model@0.38.0
  - @labre/affine-shared@0.38.0
  - @labre/affine-block-note@0.38.0
  - @labre/affine-components@0.38.0
  - @labre/affine-inline-latex@0.38.0
  - @labre/affine-rich-text@0.38.0
  - @labre/affine-widget-slash-menu@0.38.0
  - @labre/affine-ext-loader@0.38.0
  - @labre/global@0.38.0
  - @labre/std@0.38.0
  - @labre/store@0.38.0

## 0.37.0

### Patch Changes

- @labre/affine-block-note@0.37.0
- @labre/affine-components@0.37.0
- @labre/affine-ext-loader@0.37.0
- @labre/affine-inline-latex@0.37.0
- @labre/affine-model@0.37.0
- @labre/affine-rich-text@0.37.0
- @labre/affine-shared@0.37.0
- @labre/affine-widget-slash-menu@0.37.0
- @labre/global@0.37.0
- @labre/std@0.37.0
- @labre/store@0.37.0

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
  - @labre/affine-block-note@0.36.0
  - @labre/affine-inline-latex@0.36.0
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
  - @labre/affine-block-note@0.35.0
  - @labre/affine-inline-latex@0.35.0
  - @labre/affine-rich-text@0.35.0
  - @labre/affine-widget-slash-menu@0.35.0
  - @labre/affine-ext-loader@0.35.0
  - @labre/global@0.35.0
  - @labre/store@0.35.0

## 0.34.2

### Patch Changes

- @labre/affine-block-note@0.34.2
- @labre/affine-components@0.34.2
- @labre/affine-ext-loader@0.34.2
- @labre/affine-inline-latex@0.34.2
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
  - @labre/affine-block-note@0.34.1
  - @labre/affine-components@0.34.1
  - @labre/affine-inline-latex@0.34.1
  - @labre/affine-rich-text@0.34.1
  - @labre/affine-shared@0.34.1
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
  - @labre/affine-block-note@0.34.0
  - @labre/affine-components@0.34.0
  - @labre/affine-widget-slash-menu@0.34.0
  - @labre/affine-inline-latex@0.34.0
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
  - @labre/affine-block-note@0.33.0
  - @labre/affine-inline-latex@0.33.0
  - @labre/affine-rich-text@0.33.0
  - @labre/affine-widget-slash-menu@0.33.0
  - @labre/affine-ext-loader@0.33.0
  - @labre/global@0.33.0
  - @labre/store@0.33.0

## 0.32.0

### Patch Changes

- 865abd4: A wide equation can be scrolled through again

  An equation block centred its rendered formula in a box that scrolls
  sideways, so a long equation was shrunk to its own width and the part that
  overflowed sat outside the scrollable area — you could see it was cut off but
  never reach it. The formula now takes the full width of the block; short
  equations stay centred exactly as before.

- Updated dependencies [832c793]
- Updated dependencies [c5c07b9]
- Updated dependencies [a2b7c44]
- Updated dependencies [ff5f060]
- Updated dependencies [913da26]
- Updated dependencies [1b59f3c]
- Updated dependencies [41ab595]
- Updated dependencies [0bfc872]
- Updated dependencies [8ded589]
- Updated dependencies [9e23b5b]
- Updated dependencies [a3aa598]
- Updated dependencies [90a9168]
- Updated dependencies [6417a2f]
- Updated dependencies [d797f9a]
- Updated dependencies [9fde974]
- Updated dependencies [d360f72]
- Updated dependencies [9fe5773]
- Updated dependencies [50ab9ae]
- Updated dependencies [3b30d8f]
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
- Updated dependencies [5076cb8]
- Updated dependencies [3c5c97e]
- Updated dependencies [7c10406]
- Updated dependencies [02797b5]
- Updated dependencies [413fe7b]
- Updated dependencies [724ed1c]
- Updated dependencies [c7612da]
- Updated dependencies [0ddfd47]
- Updated dependencies [3639562]
- Updated dependencies [5d16745]
- Updated dependencies [b684b4c]
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
  - @labre/affine-block-note@0.32.0
  - @labre/affine-components@0.32.0
  - @labre/affine-model@0.32.0
  - @labre/affine-inline-latex@0.32.0
  - @labre/global@0.32.0
  - @labre/affine-widget-slash-menu@0.32.0
  - @labre/affine-rich-text@0.32.0
  - @labre/affine-ext-loader@0.32.0

## 0.31.0

### Patch Changes

- Updated dependencies [6a663b6]
  - @labre/store@0.31.0
  - @labre/affine-block-note@0.31.0
  - @labre/affine-components@0.31.0
  - @labre/affine-ext-loader@0.31.0
  - @labre/affine-inline-latex@0.31.0
  - @labre/affine-model@0.31.0
  - @labre/affine-rich-text@0.31.0
  - @labre/affine-shared@0.31.0
  - @labre/affine-widget-slash-menu@0.31.0
  - @labre/std@0.31.0
  - @labre/global@0.31.0

## 0.30.2

### Patch Changes

- @labre/affine-block-note@0.30.2
- @labre/affine-components@0.30.2
- @labre/affine-ext-loader@0.30.2
- @labre/affine-inline-latex@0.30.2
- @labre/affine-model@0.30.2
- @labre/affine-rich-text@0.30.2
- @labre/affine-shared@0.30.2
- @labre/affine-widget-slash-menu@0.30.2
- @labre/global@0.30.2
- @labre/std@0.30.2
- @labre/store@0.30.2

## 0.30.1

### Patch Changes

- @labre/affine-block-note@0.30.1
- @labre/affine-components@0.30.1
- @labre/affine-ext-loader@0.30.1
- @labre/affine-inline-latex@0.30.1
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
  - @labre/affine-block-note@0.30.0
  - @labre/affine-components@0.30.0
  - @labre/affine-inline-latex@0.30.0
  - @labre/affine-rich-text@0.30.0
  - @labre/affine-shared@0.30.0
  - @labre/affine-widget-slash-menu@0.30.0
  - @labre/affine-ext-loader@0.30.0
  - @labre/global@0.30.0
  - @labre/store@0.30.0

## 0.29.1

### Patch Changes

- @labre/affine-block-note@0.29.1
- @labre/affine-components@0.29.1
- @labre/affine-ext-loader@0.29.1
- @labre/affine-inline-latex@0.29.1
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
  - @labre/affine-block-note@0.29.0
  - @labre/affine-components@0.29.0
  - @labre/affine-inline-latex@0.29.0
  - @labre/affine-rich-text@0.29.0
  - @labre/affine-widget-slash-menu@0.29.0
  - @labre/affine-model@0.29.0
  - @labre/affine-ext-loader@0.29.0
  - @labre/global@0.29.0
  - @labre/store@0.29.0

## 0.28.0

### Patch Changes

- Updated dependencies [65cc055]
  - @labre/std@0.28.0
  - @labre/affine-block-note@0.28.0
  - @labre/affine-components@0.28.0
  - @labre/affine-inline-latex@0.28.0
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
  - @labre/affine-block-note@0.27.0
  - @labre/affine-components@0.27.0
  - @labre/affine-inline-latex@0.27.0
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
  - @labre/affine-block-note@0.26.0
  - @labre/affine-inline-latex@0.26.0
  - @labre/affine-rich-text@0.26.0
  - @labre/affine-shared@0.26.0
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
  - @labre/affine-block-note@0.25.0
  - @labre/affine-inline-latex@0.25.0
  - @labre/affine-rich-text@0.25.0
  - @labre/affine-shared@0.25.0
  - @labre/affine-widget-slash-menu@0.25.0
  - @labre/affine-ext-loader@0.25.0
  - @labre/global@0.25.0
  - @labre/std@0.25.0
  - @labre/store@0.25.0

## 0.24.0

### Patch Changes

- @labre/affine-block-note@0.24.0
- @labre/affine-components@0.24.0
- @labre/affine-ext-loader@0.24.0
- @labre/affine-inline-latex@0.24.0
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
  - @labre/affine-block-note@0.23.3
  - @labre/affine-components@0.23.3
  - @labre/affine-inline-latex@0.23.3
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
  - @labre/affine-block-note@0.23.2
  - @labre/affine-components@0.23.2
  - @labre/affine-inline-latex@0.23.2
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
  - @labre/affine-block-note@0.23.1
  - @labre/affine-components@0.23.1
  - @labre/affine-inline-latex@0.23.1
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
  - @labre/affine-block-note@0.23.0
  - @labre/affine-components@0.23.0
  - @labre/affine-inline-latex@0.23.0
  - @labre/affine-rich-text@0.23.0
  - @labre/affine-widget-slash-menu@0.23.0
  - @labre/affine-ext-loader@0.23.0
  - @labre/global@0.23.0
  - @labre/std@0.23.0
  - @labre/store@0.23.0
