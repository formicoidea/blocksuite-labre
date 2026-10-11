---
'@labre/affine-block-callout': patch
'@labre/affine': patch
---

Callouts already in a document keep rendering with `{ callout: false }`: they stay editable and keep their block toolbar (Turn into text, copy, duplicate, delete). The flag now removes only the ways to create one, the slash-menu "Callout" item and the "Turn into → Callout" entry (#418, ADR 0009). The callout view is split in two providers: `CalloutRenderViewExtension`, always registered, and `CalloutViewExtension`, flag-gated; a host that assembles its view extensions itself rather than through `getInternalViewExtensions(flags)` registers both.
