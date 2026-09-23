# @labre/affine-inline-preset

## 0.43.0

### Patch Changes

- Updated dependencies [da68dbb]
- Updated dependencies [8f54236]
- Updated dependencies [f1a4af7]
- Updated dependencies [8a927dd]
  - @labre/affine-shared@0.43.0
  - @labre/affine-components@0.43.0
  - @labre/affine-inline-comment@0.43.0
  - @labre/affine-inline-footnote@0.43.0
  - @labre/affine-inline-latex@0.43.0
  - @labre/affine-inline-link@0.43.0
  - @labre/affine-inline-mention@0.43.0
  - @labre/affine-inline-reference@0.43.0
  - @labre/affine-rich-text@0.43.0
  - @labre/affine-ext-loader@0.43.0
  - @labre/affine-model@0.43.0
  - @labre/global@0.43.0
  - @labre/std@0.43.0
  - @labre/store@0.43.0

## 0.42.0

### Patch Changes

- f5acc9b: A double hyphen typed inside an unclosed inline-code span keeps its hyphens instead of turning into an em dash.
- Updated dependencies [87ef822]
- Updated dependencies [f294deb]
- Updated dependencies [911d143]
- Updated dependencies [0dcd69b]
- Updated dependencies [4899136]
- Updated dependencies [2f5c621]
- Updated dependencies [911d143]
- Updated dependencies [48213e7]
- Updated dependencies [512ab39]
- Updated dependencies [7437481]
- Updated dependencies [2e179bb]
- Updated dependencies [911d143]
- Updated dependencies [4f5faa3]
- Updated dependencies [f3f412a]
- Updated dependencies [f6ece47]
- Updated dependencies [e2f6ca5]
- Updated dependencies [d1851b1]
- Updated dependencies [5a8ec30]
- Updated dependencies [549056e]
- Updated dependencies [2bb7318]
- Updated dependencies [c73b25f]
- Updated dependencies [911d143]
- Updated dependencies [911d143]
- Updated dependencies [911d143]
- Updated dependencies [55d9f13]
  - @labre/std@0.42.0
  - @labre/affine-model@0.42.0
  - @labre/affine-shared@0.42.0
  - @labre/store@0.42.0
  - @labre/affine-components@0.42.0
  - @labre/global@0.42.0
  - @labre/affine-inline-comment@0.42.0
  - @labre/affine-inline-footnote@0.42.0
  - @labre/affine-inline-latex@0.42.0
  - @labre/affine-inline-link@0.42.0
  - @labre/affine-inline-mention@0.42.0
  - @labre/affine-inline-reference@0.42.0
  - @labre/affine-rich-text@0.42.0
  - @labre/affine-ext-loader@0.42.0

## 0.41.0

### Minor Changes

- feca957: feat(blocks): the shared component library, rich text and the inline nodes (link, reference, mention, latex, the text-format bar, the footnote popup) resolve their chrome, placeholders, aria-labels, toasts, tooltips, dropdown labels, empty states, through the translation seam (translateKey, ADR 0016) instead of hard-coded English. Most of these components have no std of their own; where one now renders inside the editor's DOM it consumes stdContext (the same seam block-caption.ts already used), so with no provider registered every surface reads exactly as it did before.

  ResourceController.blob()'s "Image not found" / "Failed to retrieve Image" pair becomes one key per kind times message (Blob, File, Image, six keys total): the kind set is closed and the seam has no grammar to recompose a sentence from a noun, so each whole sentence gets its own key rather than a parameterised hole. The highlight menu's and icon picker's shared colour names, the icon picker's eight emoji-mart group names, and the Confirm/Cancel/Save/Reset verbs shared by the two embed-card modals and the reference popup, are each declared once and reused rather than re-minted per caller.

  rich-text/src/conversion.ts's text-block primitive names and descriptions (Text, Heading 1 through Heading 6, Bulleted List, Numbered List, To-do List, Code Block, Quote, Divider, the one list the slash menu and the format bar's Turn into menu both read) move to a new Block types section of chrome.ts's shared CHROME_WORDINGS, so the text-block packages (blocks/note, blocks/paragraph, blocks/list, widgets/slash-menu) can point at the same keys instead of minting their own. The LaTeX equation's empty/error placeholders and the untitled-document fallback are declared there too, for the same reason.

  Left untouched, with the reason: the date-picker (components/src/date-picker) is rendered only by the postponed data-view/database/table surfaces; the "A / C" and "e / t" notation letters, SeniorTool.name, and the resize-handle aria-labels are PO decisions out of scope for every lot.

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

### Patch Changes

- b2781b5: refactor(blocks): one chrome word, one key. Where several packages declared the same English interface word under different keys (Copy-style verbs, text formats, display modes, Reload, Rename, Settings…), they now share one wording from `@labre/affine-shared/services`, and the key manifest carries 52 fewer entries. Nothing changes on screen, and no key that existed in a previous release is removed: the merged keys were all introduced by this release's translation work. The manifest spec now fails when a new interface word is declared under a second key (real homonyms such as « Light » or « Left » are allow-listed with a reason).
- Updated dependencies [a513f05]
- Updated dependencies [6cfe313]
- Updated dependencies [5776733]
- Updated dependencies [4ed9484]
- Updated dependencies [6271b11]
- Updated dependencies [924f7d6]
- Updated dependencies [5744cfd]
- Updated dependencies [feca957]
- Updated dependencies [1dac32d]
- Updated dependencies [b2781b5]
- Updated dependencies [223b280]
- Updated dependencies [47d4ac6]
  - @labre/affine-shared@0.41.0
  - @labre/std@0.41.0
  - @labre/affine-components@0.41.0
  - @labre/affine-rich-text@0.41.0
  - @labre/affine-inline-latex@0.41.0
  - @labre/affine-inline-link@0.41.0
  - @labre/affine-inline-mention@0.41.0
  - @labre/affine-inline-reference@0.41.0
  - @labre/affine-inline-footnote@0.41.0
  - @labre/affine-inline-comment@0.41.0
  - @labre/affine-model@0.41.0
  - @labre/affine-ext-loader@0.41.0
  - @labre/global@0.41.0
  - @labre/store@0.41.0

## 0.40.0

### Patch Changes

- 5b41d83: feat(blocks): typing `--` followed by a space turns the two hyphens into an em dash (`—`); undo brings them back, and the `---` divider shortcut, `--flag` words and inline code are left alone
- Updated dependencies [95ff0a5]
- Updated dependencies [95ff0a5]
  - @labre/affine-shared@0.40.0
  - @labre/affine-components@0.40.0
  - @labre/affine-inline-comment@0.40.0
  - @labre/affine-inline-footnote@0.40.0
  - @labre/affine-inline-latex@0.40.0
  - @labre/affine-inline-link@0.40.0
  - @labre/affine-inline-mention@0.40.0
  - @labre/affine-inline-reference@0.40.0
  - @labre/affine-rich-text@0.40.0
  - @labre/affine-ext-loader@0.40.0
  - @labre/affine-model@0.40.0
  - @labre/global@0.40.0
  - @labre/std@0.40.0
  - @labre/store@0.40.0

## 0.39.3

### Patch Changes

- Updated dependencies [070e1ec]
  - @labre/affine-components@0.39.3
  - @labre/affine-inline-footnote@0.39.3
  - @labre/affine-inline-latex@0.39.3
  - @labre/affine-inline-link@0.39.3
  - @labre/affine-inline-mention@0.39.3
  - @labre/affine-inline-reference@0.39.3
  - @labre/affine-rich-text@0.39.3
  - @labre/affine-inline-comment@0.39.3
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
  - @labre/affine-components@0.39.2
  - @labre/affine-inline-comment@0.39.2
  - @labre/affine-inline-footnote@0.39.2
  - @labre/affine-inline-latex@0.39.2
  - @labre/affine-inline-link@0.39.2
  - @labre/affine-inline-mention@0.39.2
  - @labre/affine-inline-reference@0.39.2
  - @labre/affine-rich-text@0.39.2
  - @labre/affine-ext-loader@0.39.2
  - @labre/affine-model@0.39.2
  - @labre/global@0.39.2
  - @labre/std@0.39.2
  - @labre/store@0.39.2

## 0.39.1

### Patch Changes

- Updated dependencies [00eab3d]
  - @labre/affine-model@0.39.1
  - @labre/affine-components@0.39.1
  - @labre/affine-inline-comment@0.39.1
  - @labre/affine-inline-footnote@0.39.1
  - @labre/affine-inline-latex@0.39.1
  - @labre/affine-inline-link@0.39.1
  - @labre/affine-inline-mention@0.39.1
  - @labre/affine-inline-reference@0.39.1
  - @labre/affine-rich-text@0.39.1
  - @labre/affine-shared@0.39.1
  - @labre/affine-ext-loader@0.39.1
  - @labre/global@0.39.1
  - @labre/std@0.39.1
  - @labre/store@0.39.1

## 0.39.0

### Patch Changes

- @labre/affine-components@0.39.0
- @labre/affine-ext-loader@0.39.0
- @labre/affine-inline-comment@0.39.0
- @labre/affine-inline-footnote@0.39.0
- @labre/affine-inline-latex@0.39.0
- @labre/affine-inline-link@0.39.0
- @labre/affine-inline-mention@0.39.0
- @labre/affine-inline-reference@0.39.0
- @labre/affine-model@0.39.0
- @labre/affine-rich-text@0.39.0
- @labre/affine-shared@0.39.0
- @labre/global@0.39.0
- @labre/std@0.39.0
- @labre/store@0.39.0

## 0.38.2

### Patch Changes

- Updated dependencies [0ffa45b]
  - @labre/std@0.38.2
  - @labre/affine-components@0.38.2
  - @labre/affine-inline-comment@0.38.2
  - @labre/affine-inline-footnote@0.38.2
  - @labre/affine-inline-latex@0.38.2
  - @labre/affine-inline-link@0.38.2
  - @labre/affine-inline-mention@0.38.2
  - @labre/affine-inline-reference@0.38.2
  - @labre/affine-model@0.38.2
  - @labre/affine-rich-text@0.38.2
  - @labre/affine-shared@0.38.2
  - @labre/affine-ext-loader@0.38.2
  - @labre/global@0.38.2
  - @labre/store@0.38.2

## 0.38.1

### Patch Changes

- @labre/affine-components@0.38.1
- @labre/affine-ext-loader@0.38.1
- @labre/affine-inline-comment@0.38.1
- @labre/affine-inline-footnote@0.38.1
- @labre/affine-inline-latex@0.38.1
- @labre/affine-inline-link@0.38.1
- @labre/affine-inline-mention@0.38.1
- @labre/affine-inline-reference@0.38.1
- @labre/affine-model@0.38.1
- @labre/affine-rich-text@0.38.1
- @labre/affine-shared@0.38.1
- @labre/global@0.38.1
- @labre/std@0.38.1
- @labre/store@0.38.1

## 0.38.0

### Patch Changes

- Updated dependencies [6a7c31a]
- Updated dependencies [4566e8f]
- Updated dependencies [6aa0081]
  - @labre/affine-model@0.38.0
  - @labre/affine-inline-link@0.38.0
  - @labre/affine-shared@0.38.0
  - @labre/affine-components@0.38.0
  - @labre/affine-inline-comment@0.38.0
  - @labre/affine-inline-footnote@0.38.0
  - @labre/affine-inline-latex@0.38.0
  - @labre/affine-inline-mention@0.38.0
  - @labre/affine-inline-reference@0.38.0
  - @labre/affine-rich-text@0.38.0
  - @labre/affine-ext-loader@0.38.0
  - @labre/global@0.38.0
  - @labre/std@0.38.0
  - @labre/store@0.38.0

## 0.37.0

### Patch Changes

- @labre/affine-components@0.37.0
- @labre/affine-ext-loader@0.37.0
- @labre/affine-inline-comment@0.37.0
- @labre/affine-inline-footnote@0.37.0
- @labre/affine-inline-latex@0.37.0
- @labre/affine-inline-link@0.37.0
- @labre/affine-inline-mention@0.37.0
- @labre/affine-inline-reference@0.37.0
- @labre/affine-model@0.37.0
- @labre/affine-rich-text@0.37.0
- @labre/affine-shared@0.37.0
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
  - @labre/affine-inline-footnote@0.36.0
  - @labre/affine-inline-latex@0.36.0
  - @labre/affine-inline-link@0.36.0
  - @labre/affine-inline-mention@0.36.0
  - @labre/affine-inline-reference@0.36.0
  - @labre/affine-rich-text@0.36.0
  - @labre/affine-inline-comment@0.36.0
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
  - @labre/affine-inline-footnote@0.35.0
  - @labre/affine-inline-latex@0.35.0
  - @labre/affine-inline-link@0.35.0
  - @labre/affine-inline-mention@0.35.0
  - @labre/affine-inline-reference@0.35.0
  - @labre/affine-rich-text@0.35.0
  - @labre/affine-inline-comment@0.35.0
  - @labre/affine-ext-loader@0.35.0
  - @labre/global@0.35.0
  - @labre/store@0.35.0

## 0.34.2

### Patch Changes

- @labre/affine-components@0.34.2
- @labre/affine-ext-loader@0.34.2
- @labre/affine-inline-comment@0.34.2
- @labre/affine-inline-footnote@0.34.2
- @labre/affine-inline-latex@0.34.2
- @labre/affine-inline-link@0.34.2
- @labre/affine-inline-mention@0.34.2
- @labre/affine-inline-reference@0.34.2
- @labre/affine-model@0.34.2
- @labre/affine-rich-text@0.34.2
- @labre/affine-shared@0.34.2
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
  - @labre/affine-inline-comment@0.34.1
  - @labre/affine-inline-footnote@0.34.1
  - @labre/affine-inline-latex@0.34.1
  - @labre/affine-inline-link@0.34.1
  - @labre/affine-inline-mention@0.34.1
  - @labre/affine-inline-reference@0.34.1
  - @labre/affine-rich-text@0.34.1
  - @labre/affine-shared@0.34.1
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
  - @labre/affine-inline-link@0.34.0
  - @labre/affine-inline-reference@0.34.0
  - @labre/affine-inline-comment@0.34.0
  - @labre/affine-inline-footnote@0.34.0
  - @labre/affine-inline-latex@0.34.0
  - @labre/affine-inline-mention@0.34.0
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
  - @labre/affine-inline-footnote@0.33.0
  - @labre/affine-inline-latex@0.33.0
  - @labre/affine-inline-link@0.33.0
  - @labre/affine-inline-mention@0.33.0
  - @labre/affine-inline-reference@0.33.0
  - @labre/affine-rich-text@0.33.0
  - @labre/affine-inline-comment@0.33.0
  - @labre/affine-ext-loader@0.33.0
  - @labre/global@0.33.0
  - @labre/store@0.33.0

## 0.32.0

### Patch Changes

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

- Updated dependencies [832c793]
- Updated dependencies [c5c07b9]
- Updated dependencies [a2b7c44]
- Updated dependencies [ff5f060]
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
- Updated dependencies [48e90f4]
- Updated dependencies [8f339d1]
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
  - @labre/affine-model@0.32.0
  - @labre/affine-inline-latex@0.32.0
  - @labre/global@0.32.0
  - @labre/affine-inline-link@0.32.0
  - @labre/affine-inline-comment@0.32.0
  - @labre/affine-inline-footnote@0.32.0
  - @labre/affine-inline-mention@0.32.0
  - @labre/affine-inline-reference@0.32.0
  - @labre/affine-rich-text@0.32.0
  - @labre/affine-ext-loader@0.32.0

## 0.31.0

### Patch Changes

- Updated dependencies [6a663b6]
  - @labre/store@0.31.0
  - @labre/affine-components@0.31.0
  - @labre/affine-ext-loader@0.31.0
  - @labre/affine-inline-comment@0.31.0
  - @labre/affine-inline-footnote@0.31.0
  - @labre/affine-inline-latex@0.31.0
  - @labre/affine-inline-link@0.31.0
  - @labre/affine-inline-mention@0.31.0
  - @labre/affine-inline-reference@0.31.0
  - @labre/affine-model@0.31.0
  - @labre/affine-rich-text@0.31.0
  - @labre/affine-shared@0.31.0
  - @labre/std@0.31.0
  - @labre/global@0.31.0

## 0.30.2

### Patch Changes

- @labre/affine-components@0.30.2
- @labre/affine-ext-loader@0.30.2
- @labre/affine-inline-comment@0.30.2
- @labre/affine-inline-footnote@0.30.2
- @labre/affine-inline-latex@0.30.2
- @labre/affine-inline-link@0.30.2
- @labre/affine-inline-mention@0.30.2
- @labre/affine-inline-reference@0.30.2
- @labre/affine-model@0.30.2
- @labre/affine-rich-text@0.30.2
- @labre/affine-shared@0.30.2
- @labre/global@0.30.2
- @labre/std@0.30.2
- @labre/store@0.30.2

## 0.30.1

### Patch Changes

- @labre/affine-components@0.30.1
- @labre/affine-ext-loader@0.30.1
- @labre/affine-inline-comment@0.30.1
- @labre/affine-inline-footnote@0.30.1
- @labre/affine-inline-latex@0.30.1
- @labre/affine-inline-link@0.30.1
- @labre/affine-inline-mention@0.30.1
- @labre/affine-inline-reference@0.30.1
- @labre/affine-model@0.30.1
- @labre/affine-rich-text@0.30.1
- @labre/affine-shared@0.30.1
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
  - @labre/affine-inline-comment@0.30.0
  - @labre/affine-inline-footnote@0.30.0
  - @labre/affine-inline-latex@0.30.0
  - @labre/affine-inline-link@0.30.0
  - @labre/affine-inline-mention@0.30.0
  - @labre/affine-inline-reference@0.30.0
  - @labre/affine-rich-text@0.30.0
  - @labre/affine-shared@0.30.0
  - @labre/affine-ext-loader@0.30.0
  - @labre/global@0.30.0
  - @labre/store@0.30.0

## 0.29.1

### Patch Changes

- @labre/affine-components@0.29.1
- @labre/affine-ext-loader@0.29.1
- @labre/affine-inline-comment@0.29.1
- @labre/affine-inline-footnote@0.29.1
- @labre/affine-inline-latex@0.29.1
- @labre/affine-inline-link@0.29.1
- @labre/affine-inline-mention@0.29.1
- @labre/affine-inline-reference@0.29.1
- @labre/affine-model@0.29.1
- @labre/affine-rich-text@0.29.1
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
  - @labre/affine-inline-comment@0.29.0
  - @labre/affine-inline-footnote@0.29.0
  - @labre/affine-inline-latex@0.29.0
  - @labre/affine-inline-link@0.29.0
  - @labre/affine-inline-mention@0.29.0
  - @labre/affine-inline-reference@0.29.0
  - @labre/affine-rich-text@0.29.0
  - @labre/affine-model@0.29.0
  - @labre/affine-ext-loader@0.29.0
  - @labre/global@0.29.0
  - @labre/store@0.29.0

## 0.28.0

### Patch Changes

- Updated dependencies [65cc055]
  - @labre/std@0.28.0
  - @labre/affine-components@0.28.0
  - @labre/affine-inline-comment@0.28.0
  - @labre/affine-inline-footnote@0.28.0
  - @labre/affine-inline-latex@0.28.0
  - @labre/affine-inline-link@0.28.0
  - @labre/affine-inline-mention@0.28.0
  - @labre/affine-inline-reference@0.28.0
  - @labre/affine-model@0.28.0
  - @labre/affine-rich-text@0.28.0
  - @labre/affine-shared@0.28.0
  - @labre/affine-ext-loader@0.28.0
  - @labre/global@0.28.0
  - @labre/store@0.28.0

## 0.27.0

### Patch Changes

- Updated dependencies [91f6397]
  - @labre/std@0.27.0
  - @labre/affine-components@0.27.0
  - @labre/affine-inline-comment@0.27.0
  - @labre/affine-inline-footnote@0.27.0
  - @labre/affine-inline-latex@0.27.0
  - @labre/affine-inline-link@0.27.0
  - @labre/affine-inline-mention@0.27.0
  - @labre/affine-inline-reference@0.27.0
  - @labre/affine-model@0.27.0
  - @labre/affine-rich-text@0.27.0
  - @labre/affine-shared@0.27.0
  - @labre/affine-ext-loader@0.27.0
  - @labre/global@0.27.0
  - @labre/store@0.27.0

## 0.26.0

### Patch Changes

- Updated dependencies [8960a6c]
- Updated dependencies [6795191]
  - @labre/affine-model@0.26.0
  - @labre/affine-components@0.26.0
  - @labre/affine-inline-comment@0.26.0
  - @labre/affine-inline-footnote@0.26.0
  - @labre/affine-inline-latex@0.26.0
  - @labre/affine-inline-link@0.26.0
  - @labre/affine-inline-mention@0.26.0
  - @labre/affine-inline-reference@0.26.0
  - @labre/affine-rich-text@0.26.0
  - @labre/affine-shared@0.26.0
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
  - @labre/affine-inline-comment@0.25.0
  - @labre/affine-inline-footnote@0.25.0
  - @labre/affine-inline-latex@0.25.0
  - @labre/affine-inline-link@0.25.0
  - @labre/affine-inline-mention@0.25.0
  - @labre/affine-inline-reference@0.25.0
  - @labre/affine-rich-text@0.25.0
  - @labre/affine-shared@0.25.0
  - @labre/affine-ext-loader@0.25.0
  - @labre/global@0.25.0
  - @labre/std@0.25.0
  - @labre/store@0.25.0

## 0.24.0

### Patch Changes

- @labre/affine-components@0.24.0
- @labre/affine-ext-loader@0.24.0
- @labre/affine-inline-comment@0.24.0
- @labre/affine-inline-footnote@0.24.0
- @labre/affine-inline-latex@0.24.0
- @labre/affine-inline-link@0.24.0
- @labre/affine-inline-mention@0.24.0
- @labre/affine-inline-reference@0.24.0
- @labre/affine-model@0.24.0
- @labre/affine-rich-text@0.24.0
- @labre/affine-shared@0.24.0
- @labre/global@0.24.0
- @labre/std@0.24.0
- @labre/store@0.24.0

## 0.23.3

### Patch Changes

- Updated dependencies
  - @labre/affine-shared@0.23.3
  - @labre/affine-components@0.23.3
  - @labre/affine-inline-comment@0.23.3
  - @labre/affine-inline-footnote@0.23.3
  - @labre/affine-inline-latex@0.23.3
  - @labre/affine-inline-link@0.23.3
  - @labre/affine-inline-mention@0.23.3
  - @labre/affine-inline-reference@0.23.3
  - @labre/affine-rich-text@0.23.3
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
  - @labre/affine-inline-comment@0.23.2
  - @labre/affine-inline-footnote@0.23.2
  - @labre/affine-inline-latex@0.23.2
  - @labre/affine-inline-link@0.23.2
  - @labre/affine-inline-mention@0.23.2
  - @labre/affine-inline-reference@0.23.2
  - @labre/affine-rich-text@0.23.2
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
  - @labre/affine-inline-comment@0.23.1
  - @labre/affine-inline-footnote@0.23.1
  - @labre/affine-inline-latex@0.23.1
  - @labre/affine-inline-link@0.23.1
  - @labre/affine-inline-mention@0.23.1
  - @labre/affine-inline-reference@0.23.1
  - @labre/affine-rich-text@0.23.1
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
  - @labre/affine-inline-comment@0.23.0
  - @labre/affine-inline-footnote@0.23.0
  - @labre/affine-inline-latex@0.23.0
  - @labre/affine-inline-link@0.23.0
  - @labre/affine-inline-mention@0.23.0
  - @labre/affine-inline-reference@0.23.0
  - @labre/affine-rich-text@0.23.0
  - @labre/affine-ext-loader@0.23.0
  - @labre/global@0.23.0
  - @labre/std@0.23.0
  - @labre/store@0.23.0
