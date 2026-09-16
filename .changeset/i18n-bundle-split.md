---
'@labre/affine': patch
'@labre/affine-gfx-ddd-aggregate': patch
---

fix(blocks): the Aggregate Design Canvas template's translation keys no longer make `@labre/core` import the ddd-aggregate bundle. The package exports `dddAggregateTranslationEntries` from its root, like a framework bundle exports its `…TranslationEntries`; a bundled host composes them with core's manifest when it installs `@formicoidea/labre-framework-ddd-aggregate`. The monorepo manifest is unchanged.
