---
'@labre/affine': minor
---

feat(blocks): ship each DDD senior button as its own package + bundle

DDD was a single package holding three senior buttons (Event Storming, Core
Domain Chart, Context Map), so the release bundler vendored it into
`labre-core` instead of emitting framework bundles. It is now split per the
"one senior button = one package" rule:

- `@labre/affine-gfx-ddd-shared` → published as `@formicoidea/labre-ddd-shared`
  (shared base: consts/prefabs/menu-base/icons/template builders).
- `@labre/affine-gfx-ddd-event-storming`, `-core-domain`, `-context-map`,
  `-aggregate` → published as `@formicoidea/labre-framework-ddd-*`, each
  depending on `labre-core` + `labre-ddd-shared`.

`scripts/build-bundles.mjs` is now data-driven (adding a senior-button package
is one `FRAMEWORKS` entry, with multi-extension/flag support), and
`compile-/publish-bundles.mjs` resolve and order bundle→bundle dependencies
(core → shared → frameworks). DDD no longer ships inside `labre-core` —
consumers import it from the dedicated framework packages.
