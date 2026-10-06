---
'@labre/data-view': patch
'@labre/affine-shared': patch
'@labre/affine-components': patch
---

The core bundle no longer installs a test runner: `vitest` leaves its
dependencies, and the `vitest` helpers it used to carry as unreachable files
are gone. It also no longer ships `getAttachmentFileIconRC` in
`components/icons`, a React helper that loaded `react/jsx-runtime` although
the bundle never declared `react`; `getAttachmentFileIcon` (Lit) is the icon
lookup to use. No other API change.
