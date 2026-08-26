---
'@labre/std': patch
'@labre/affine': patch
---

Framework descriptors declare their label fallback

`FrameworkDescriptor` gains a required `fallback` — the English wording behind
`labelKey` — so the translation manifest carries a fallback for the seven
`com.labre.framework.<id>` keys instead of `undefined`. The senior buttons'
restated tooltip wording now has a declared counterpart, and the manifest
drift check holds it to that declaration.
