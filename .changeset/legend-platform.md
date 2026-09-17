---
'@labre/affine-block-surface': minor
'@labre/std': minor
'@labre/affine-shared': patch
'@labre/affine-gfx-ddd-shared': patch
'@labre/affine-gfx-group': patch
---

The automatic legend becomes a platform: a command can subscribe the legend row its artefact deserves (`CommandDescriptor.legend`) and a board command the box that holds them (`legendBox`), and the surface block derives the whole legend from them — rows in command order, sub-titles from each row's own section or from the command's catalogue category, one row per role. One shared toolbar button and one telemetry emitter replace the seven copies, with the wire values unchanged. Nothing visible moves yet: every framework still draws its legend from its own table, re-exported from `@labre/affine-gfx-ddd-shared` while they migrate.
