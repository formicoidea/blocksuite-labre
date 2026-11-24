---
'@labre/affine-components': patch
---

Raise the `@floating-ui/dom` floor to `^1.7.6` in every manifest that declares it, which brings `@floating-ui/utils` to 0.2.12 (from 0.2.9): from 0.2.11 on, popups anchored in a scrolled page are placed where they belong. The lockfile now holds one version of each `@floating-ui/*` package (`@floating-ui/dom` 1.8.0, `@floating-ui/core` 1.8.0).
