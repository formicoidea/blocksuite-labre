---
'@labre/affine-inline-reference': patch
'@labre/affine-inline-link': patch
---

Two light-DOM popups no longer style the host page: `reference-popup` scoped its `input` rules (they stretched any input of the page to `flex: 1` with no border) and `link-popup` scoped its `input:focus { outline: none }` (it removed the focus ring of every input of the page). A guard (`shadowless-scoped-styles.unit.spec.ts`) fails on any new bare element selector in a `ShadowlessElement`'s styles.
