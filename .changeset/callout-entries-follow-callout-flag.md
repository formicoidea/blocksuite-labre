---
'@labre/affine-block-callout': minor
'@labre/affine-shared': minor
---

Callout now appears by default in the slash menu and in "Turn into": both entries follow the `callout` key of `OPTIONAL_BLOCKS` alone, so `{ callout: false }` removes them. `FeatureFlagService`'s `enable_callout` is deprecated and ignored; a host that set it to `true` to show Callout can drop it, and setting it to `false` no longer hides Callout — use `{ callout: false }`.
