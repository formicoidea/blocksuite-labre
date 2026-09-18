---
'@labre/affine': patch
---

fix(blocks): the published bundles now ship the MPL-2.0 `LICENSE` file. `scripts/build-bundles.mjs` copies the repo's root `LICENSE` into every generated bundle directory (core, the shared bundle and each framework), so `npm pack` embeds it — it always packs a root `LICENSE`, but only if one is there, and a generated directory holds nothing the script did not write. `scripts/publish-bundles.mjs` refuses to publish a bundle whose directory has no (or an empty) `LICENSE`.
