---
'@labre/std': minor
'@labre/affine': minor
'@labre/affine-gfx-wardley': minor
'@labre/affine-gfx-edgy': minor
'@labre/affine-gfx-cynefin-estuarine': minor
'@labre/affine-gfx-bpmn': minor
'@labre/affine-gfx-c4': minor
'@labre/affine-gfx-ddd-event-storming': minor
'@labre/affine-gfx-ddd-core-domain': minor
'@labre/affine-gfx-ddd-context-map': minor
---

feat(blocks): every framework bundle publishes a data-only ./commands-manifest subpath, and bundle .d.ts stop leaking \_pkgs internals

## `./commands-manifest` (#181)

A host settings pane that lists the framework commands — id, label, chord,
scope, owner — had one published route to them: the bundle's MAIN entry. A
`CommandDescriptor` carries its `run`, so that entry pulls the framework's whole
action graph behind it: the import/export machinery (Wardley's `import.js` alone
is 47 KB), the surface, gfx, model and shared deep paths of core. Nothing can be
tree-shaken away, because every descriptor genuinely references its handler. The
pane's chunk was carrying eight action graphs to draw about a hundred static
rows.

Each framework bundle now also publishes `./commands-manifest`, modelled on the
existing `./descriptor`: the same commands projected to the six fields a
shortcuts panel needs — `id`, `owner`, `labelKey`, `labelFallback`, `scope`,
`defaultKeys` — with no `run`, no `params`, and type-only imports, so the module
references nothing at all. It is a few hundred bytes per framework instead of
megabytes.

The projection is `toShortcutManifestEntry`, new in `@labre/std` beside the two
projections that were already there. `scripts/build-bundles.mjs` refuses to
build a framework whose manifest module reaches for a runtime import, and a unit
test pins every manifest row-for-row against the commands it projects, so the
second copy cannot drift from the first.

## `labelFallback` survives the projection (#181)

`getShortcutManifest`'s row type kept `labelKey` but dropped `labelFallback`,
which left a host with no translation catalogue rendering raw i18n keys — and
forced every host to re-project from the main entry to recover a wording the
library already knew. `ShortcutManifestEntry` now carries it, and it is declared
once, in `@labre/std`, so core's rows and a framework bundle's rows are the same
type: a host concatenates them. `owner` also narrows from `string` to
`CommandOwner`, and the never-populated `when?: string` is gone.

## `_pkgs/*` in the emitted declarations (#60)

The published `.d.ts` named internal core subpaths — `_pkgs/global/utils`,
`_pkgs/global/di`, `_pkgs/affine-widget-edgeless-toolbar` — that core's
`exports` map did not carry. tsc synthesises them when emitting a dependent
bundle's declarations, by reverse-mapping the tsconfig `paths` entry onto the
file a type physically lives in. Only `skipLibCheck: true` hid it; a consumer
that type-checks the bundle declarations got unresolved-module errors.

`scripts/compile-bundles.mjs` now scans the finished emit for those references
and publishes exactly the subpaths it finds, then re-checks every reference
against the map it wrote. Rewriting the specifiers to a public shim was the
alternative and was not taken: a rewrite only has a target when a public shim
happens to re-export that exact module, and nothing guarantees one exists for
every internal declaration tsc may name. Publishing the subpath always has a
target, and deriving the list from the emit keeps the exposure to what the
declarations genuinely need.
