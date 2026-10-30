---
'@labre/affine': patch
---

The library draws in the border box without asking the host for a global reset: `editor-host` and everything inside it, and every `affine-menu`, set `box-sizing: border-box`. A host without a global `* { box-sizing: border-box }` (labre) now gets the playground's layout; a host with one sees no change. The contract is in `docs/integrate/02-mount.md` « The box model ».
