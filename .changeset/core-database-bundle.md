---
'@labre/affine': minor
'@labre/affine-database-editor': minor
---

New bundle `@formicoidea/labre-core-database`, built from the new package `@labre/affine-database-editor` (ADR 0035 §4). It will hold the database editing chrome (the view bar, the full-page database, the creation entries); in this release its two extensions are registered but empty, so a host can wire them now: `DatabaseEditorViewExtension` always, `DatabaseEditorToolingViewExtension` under the `database` flag, both listed in `coreDatabaseBundle.extensions` from its `./descriptor`. The bundle depends on the exact `@formicoidea/labre-core` version and nothing else; core never imports it, and keeps rendering and editing every stored database without it. The `database` flag stays in core's `flags.ts`. `@labre/affine/frameworks` gains the data-only list `EDITOR_BUNDLES`; the umbrella registers both extensions, so the playground and the integration suite run them. Every other published bundle is unchanged.
