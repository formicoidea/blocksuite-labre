# @labre/affine-widget-linked-doc

## 0.43.0

### Patch Changes

- Updated dependencies [da68dbb]
- Updated dependencies [8f54236]
- Updated dependencies [f1a4af7]
- Updated dependencies [8a927dd]
  - @labre/affine-shared@0.43.0
  - @labre/affine-components@0.43.0
  - @labre/affine-block-image@0.43.0
  - @labre/affine-inline-reference@0.43.0
  - @labre/affine-rich-text@0.43.0
  - @labre/affine-ext-loader@0.43.0
  - @labre/affine-model@0.43.0
  - @labre/global@0.43.0
  - @labre/std@0.43.0
  - @labre/store@0.43.0

## 0.42.0

### Patch Changes

- 4899136: Raise the floor of three runtime dependencies that ship inside the published
  bundles to their smallest patched release: `fflate` (infinite loop on a
  malformed ZIP64 archive), `nanoid` (infinite loop on a negative or zero id
  size) and, transitively, `mdast-util-to-hast` (unsanitized `class` attribute).
  Generated ids are unchanged: same alphabet, same default length.
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
  - @labre/affine-block-image@0.42.0
  - @labre/affine-inline-reference@0.42.0
  - @labre/affine-rich-text@0.42.0
  - @labre/affine-ext-loader@0.42.0

## 0.41.0

### Minor Changes

- 4ed9484: feat(blocks): dates and numbers cross the i18n seam through `Intl`, not a hard-coded English table. `formatLocale(std)` (`hostLocale(std) ?? 'en-US'`) joins `hostLocale` as the one locale every `Intl.*Format` call resolves against. The "@" link-to-doc menu's overflow count ("1,234 more docs") now formats through `Intl.NumberFormat(formatLocale(std))` instead of string concatenation, so a host's locale gets its own thousands separator. The outline (plan) panel's five block-preview placeholders (Bookmark / Code Block / Database / Image / Attachment — shown when a block has nothing else to preview) were misfiled into the same audit lot as date/number formatting although they are plain words; they now carry their own keys (`com.labre.outline.placeholder.*`) and cross the translation seam like the rest of the editor's chrome. With no catalogue registered every surface reads exactly as it did before.
- 1dac32d: feat(blocks): translate the edgeless toolbar, canvas tools and generic widgets at the seam. The edgeless toolbar (font weight/style, style toggles, tool tooltips, zoom bar), the mindmap and shape frameworks (senior/quick tools, style and layout menus, shape names, templates category tab), the text toolbar, the outline panel and its floating mini-viewer, the adapter/debug panel, the document title placeholder, the drag-and-drop preview, the auto-connect index badges, the "+" auto-complete panel and floating link button, the "⋮" overflow menu, and the "@" linked-doc menu (including its import dialog and the remote-cursor fallback name) now resolve through `translateKey`/`ChromeWording` instead of hardcoded English. A new `com.labre.mindmap.seed.new-node` seed replaces the mindmap model's own "New node" default at every call site in these packages. With no `TranslationProvider` registered every surface reads exactly as before, letter for letter.
- 223b280: feat(blocks): close three shared translation seams the earlier i18n lots flagged as missing, then translate every string that was waiting on them. `Template.nameKey` gives a hand-composed template (a worked scene, an example map) a tile name of its own -- `resolveTemplateName` checks it before the `commandId`-derived path -- and every BPMN, Wardley, EDGY, Cynefin, Estuarine and mind-map hand-authored card now carries one. `AutoLegendSpec.titleKey` (already resolved by `createAutoLegend`) is now set for EDGY and C4's own "Legend" boxes, so both translate through the shared `BOARD_LEGEND_TITLE` key exactly like the three DDD boards already did. `MorphSpec.afterMorph` takes an optional 4th `std` parameter, which the morph toolbar now passes through: morphing an untouched TRANSLATED placeholder rewrites it to the target kind's own translated placeholder (`c4MorphedTypeLine`, `wardleyMorphedLabel`), where it used to fall back to English. Beyond the three seams: the note tool's overlay caption and a document's "Untitled" fallback (`inlines/reference`, the linked-doc HTML/Markdown exporters) now resolve through the shared `BLOCK_NAME_TEXT` / `DOC_UNTITLED` wordings instead of a raw literal; the "Template" senior-tool button gained a `labelKey`. Per a PO decision (2026-09-12), the linked-doc import dialog's English fallback now says "Labre" instead of the inherited "AFFiNE" in the two sentences that named it. Every addition is optional and retro-compatible: with no `TranslationProvider` registered, nothing on screen changes.

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
  - @labre/affine-shared@0.41.0
  - @labre/std@0.41.0
  - @labre/affine-block-image@0.41.0
  - @labre/affine-components@0.41.0
  - @labre/affine-rich-text@0.41.0
  - @labre/affine-inline-reference@0.41.0
  - @labre/affine-model@0.41.0
  - @labre/affine-ext-loader@0.41.0
  - @labre/global@0.41.0
  - @labre/store@0.41.0

## 0.40.0

### Patch Changes

- Updated dependencies [95ff0a5]
- Updated dependencies [95ff0a5]
  - @labre/affine-shared@0.40.0
  - @labre/affine-block-image@0.40.0
  - @labre/affine-components@0.40.0
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
  - @labre/affine-block-image@0.39.3
  - @labre/affine-inline-reference@0.39.3
  - @labre/affine-rich-text@0.39.3
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
  - @labre/affine-block-image@0.39.2
  - @labre/affine-components@0.39.2
  - @labre/affine-inline-reference@0.39.2
  - @labre/affine-rich-text@0.39.2
  - @labre/affine-ext-loader@0.39.2
  - @labre/affine-model@0.39.2
  - @labre/global@0.39.2
  - @labre/std@0.39.2
  - @labre/store@0.39.2

## 0.39.1

### Patch Changes

- 82c0d48: Opening a page-mode document in a mobile browser no longer throws when the host
  registers no `VirtualKeyboardProvider`. That provider is host-supplied, and the
  keyboard toolbar and the mobile linked-doc menu were both demanding it outright:
  on a plain web host the document open died with
  `Service [VirtualKeyboardProvider] not found in container`. Both now treat it as
  optional — the keyboard toolbar falls back to its built-in behaviour, and the
  linked-doc menu sits at a zero keyboard offset.
- Updated dependencies [00eab3d]
  - @labre/affine-model@0.39.1
  - @labre/affine-block-image@0.39.1
  - @labre/affine-components@0.39.1
  - @labre/affine-inline-reference@0.39.1
  - @labre/affine-rich-text@0.39.1
  - @labre/affine-shared@0.39.1
  - @labre/affine-ext-loader@0.39.1
  - @labre/global@0.39.1
  - @labre/std@0.39.1
  - @labre/store@0.39.1

## 0.39.0

### Patch Changes

- @labre/affine-block-image@0.39.0
- @labre/affine-components@0.39.0
- @labre/affine-ext-loader@0.39.0
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
  - @labre/affine-block-image@0.38.2
  - @labre/affine-components@0.38.2
  - @labre/affine-inline-reference@0.38.2
  - @labre/affine-model@0.38.2
  - @labre/affine-rich-text@0.38.2
  - @labre/affine-shared@0.38.2
  - @labre/affine-ext-loader@0.38.2
  - @labre/global@0.38.2
  - @labre/store@0.38.2

## 0.38.1

### Patch Changes

- @labre/affine-block-image@0.38.1
- @labre/affine-components@0.38.1
- @labre/affine-ext-loader@0.38.1
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
- Updated dependencies [6aa0081]
  - @labre/affine-model@0.38.0
  - @labre/affine-shared@0.38.0
  - @labre/affine-block-image@0.38.0
  - @labre/affine-components@0.38.0
  - @labre/affine-inline-reference@0.38.0
  - @labre/affine-rich-text@0.38.0
  - @labre/affine-ext-loader@0.38.0
  - @labre/global@0.38.0
  - @labre/std@0.38.0
  - @labre/store@0.38.0

## 0.37.0

### Patch Changes

- @labre/affine-block-image@0.37.0
- @labre/affine-components@0.37.0
- @labre/affine-ext-loader@0.37.0
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
  - @labre/affine-block-image@0.36.0
  - @labre/affine-inline-reference@0.36.0
  - @labre/affine-rich-text@0.36.0
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
  - @labre/affine-block-image@0.35.0
  - @labre/affine-inline-reference@0.35.0
  - @labre/affine-rich-text@0.35.0
  - @labre/affine-ext-loader@0.35.0
  - @labre/global@0.35.0
  - @labre/store@0.35.0

## 0.34.2

### Patch Changes

- @labre/affine-block-image@0.34.2
- @labre/affine-components@0.34.2
- @labre/affine-ext-loader@0.34.2
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
  - @labre/affine-block-image@0.34.1
  - @labre/affine-components@0.34.1
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
  - @labre/affine-block-image@0.34.0
  - @labre/affine-components@0.34.0
  - @labre/affine-inline-reference@0.34.0
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
  - @labre/affine-block-image@0.33.0
  - @labre/affine-inline-reference@0.33.0
  - @labre/affine-rich-text@0.33.0
  - @labre/affine-ext-loader@0.33.0
  - @labre/global@0.33.0
  - @labre/store@0.33.0

## 0.32.0

### Patch Changes

- 864f07a: fix(blocks): switching keyboard layout no longer closes the @ popover

  Typing `@`, then pressing Alt+Shift to switch keyboard layout — the ordinary
  gesture of anyone writing in two languages — closed the linked-doc popover and
  threw away the query. The browser reports that switch as a keydown whose key is
  `GroupNext` or `GroupPrevious`, and the popover's shared keydown observer reads
  "a modifier plus another key" as a reason to abort.

  The popover now swallows those two keys: the layout changes, the popover, the
  query and the selection stay exactly as they were.

- 1b72bcd: Markdown frontmatter becomes the doc's metadata instead of its first paragraph

  Almost every tool that exports markdown puts a YAML frontmatter block at the
  top of the file. Importing one dumped that block into the document as content —
  a horizontal rule followed by a paragraph reading `title: … tags: …` — while
  the doc itself was named after the file. The block is now read before the
  content is parsed: the title, creation and modification dates, tags and
  favourite flag land on the doc's metadata, under the spellings the common
  exporters use, and the content starts at the first real line. A file with no
  frontmatter, or one that merely opens with a horizontal rule, is untouched.

  The frontmatter is read by a small parser for the flat YAML a metadata block
  actually uses, so no YAML dependency joins the tree.

- 55c6597: Importing a zip no longer mangles non-ASCII file names

  The zip spec says an entry name is Latin-1 unless the entry raises the UTF-8
  flag, and fflate obeys it. Plenty of archivers — the macOS `zip` tool first
  among them — write UTF-8 bytes and never raise that flag, so every byte of a
  CJK, Cyrillic or accented name came back as its own Latin-1 character: a
  document called `笔记.md` arrived as `ç¬è®°.md`, and the doc it created wore
  that name too. Such a name only ever holds code points below 0x100, so it is
  now turned back into its bytes and decoded again, strictly, as UTF-8; a name
  that is not valid UTF-8 — one that really was Latin-1, or one fflate already
  decoded from a properly flagged entry — is left exactly as it was.

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
  - @labre/global@0.32.0
  - @labre/affine-block-image@0.32.0
  - @labre/affine-inline-reference@0.32.0
  - @labre/affine-rich-text@0.32.0
  - @labre/affine-ext-loader@0.32.0

## 0.31.0

### Patch Changes

- Updated dependencies [6a663b6]
  - @labre/store@0.31.0
  - @labre/affine-block-image@0.31.0
  - @labre/affine-components@0.31.0
  - @labre/affine-ext-loader@0.31.0
  - @labre/affine-inline-reference@0.31.0
  - @labre/affine-model@0.31.0
  - @labre/affine-rich-text@0.31.0
  - @labre/affine-shared@0.31.0
  - @labre/std@0.31.0
  - @labre/global@0.31.0

## 0.30.2

### Patch Changes

- @labre/affine-block-image@0.30.2
- @labre/affine-components@0.30.2
- @labre/affine-ext-loader@0.30.2
- @labre/affine-inline-reference@0.30.2
- @labre/affine-model@0.30.2
- @labre/affine-rich-text@0.30.2
- @labre/affine-shared@0.30.2
- @labre/global@0.30.2
- @labre/std@0.30.2
- @labre/store@0.30.2

## 0.30.1

### Patch Changes

- @labre/affine-block-image@0.30.1
- @labre/affine-components@0.30.1
- @labre/affine-ext-loader@0.30.1
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
  - @labre/affine-block-image@0.30.0
  - @labre/affine-components@0.30.0
  - @labre/affine-inline-reference@0.30.0
  - @labre/affine-rich-text@0.30.0
  - @labre/affine-shared@0.30.0
  - @labre/affine-ext-loader@0.30.0
  - @labre/global@0.30.0
  - @labre/store@0.30.0

## 0.29.1

### Patch Changes

- @labre/affine-block-image@0.29.1
- @labre/affine-components@0.29.1
- @labre/affine-ext-loader@0.29.1
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
  - @labre/affine-block-image@0.29.0
  - @labre/affine-components@0.29.0
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
  - @labre/affine-block-image@0.28.0
  - @labre/affine-components@0.28.0
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
  - @labre/affine-block-image@0.27.0
  - @labre/affine-components@0.27.0
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
  - @labre/affine-block-image@0.26.0
  - @labre/affine-inline-reference@0.26.0
  - @labre/affine-rich-text@0.26.0
  - @labre/affine-shared@0.26.0
  - @labre/affine-ext-loader@0.26.0
  - @labre/global@0.26.0
  - @labre/std@0.26.0
  - @labre/store@0.26.0

## 0.24.0

### Patch Changes

- @labre/affine-block-image@0.24.0
- @labre/affine-components@0.24.0
- @labre/affine-ext-loader@0.24.0
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
  - @labre/affine-block-image@0.23.3
  - @labre/affine-components@0.23.3
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
  - @labre/affine-block-image@0.23.2
  - @labre/affine-components@0.23.2
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
  - @labre/affine-block-image@0.23.1
  - @labre/affine-components@0.23.1
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
  - @labre/affine-block-image@0.23.0
  - @labre/affine-components@0.23.0
  - @labre/affine-inline-reference@0.23.0
  - @labre/affine-rich-text@0.23.0
  - @labre/affine-ext-loader@0.23.0
  - @labre/global@0.23.0
  - @labre/std@0.23.0
  - @labre/store@0.23.0
