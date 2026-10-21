---
'@labre/affine': minor
---

`@formicoidea/labre-core` now ships the library's architecture map under `architecture/`: the generated `code.c4` (layers, packages and `src/*` folders, with their imports), the hand-written `model.c4` (specification and views) and the `likec4.config.json` that names the likeC4 project `blocksuite` (ADR 0040). Each release carries the map of its own version. A host imports it as the `blocksuite` project (`import { framework } from 'blocksuite'` in its own `.c4` files; the top-level elements are the layers) once it has copied the folder out of `node_modules`, which likeC4 never scans; see "Architecture map" in `docs/integrate/01-install.md`. Nothing changes at runtime: no new export, no new dependency, no stored format change.
