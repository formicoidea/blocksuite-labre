---
'@labre/affine-block-callout': minor
'@labre/affine-block-root': minor
'@labre/affine-rich-text': minor
---

"Turn into" now offers Callout for a paragraph, a list item or a code block:
the callout takes the block's place, the text moves into a paragraph inside
it, the block's children move under that paragraph, and the caret lands in it.
One undo step; a conversion that cannot complete leaves every source block as
it was. The entry is hidden inside a callout, answers to the same
`enable_callout` feature flag as the slash-menu item, and disappears with
`{ callout: false }`: it is registered by `CalloutViewExtension` through the
new `TextConversionEntryExtension` of `@labre/affine-rich-text`, which the
"Turn into" menu reads beside the static `textConversionConfigs`. Its label
reuses `com.labre.callout.slash-menu.name` ("Callout"); no new key.
