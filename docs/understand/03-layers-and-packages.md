# Layers and packages

**Four layers, one direction of dependency, one assembly point.**

```
 ┌──────────────────────────────────────────────────────────────┐
 │  packages/affine/all      the assembly (schemas, extensions,  │
 │                           flags, framework descriptors)       │
 ├──────────────────────────────────────────────────────────────┤
 │  packages/affine/*        blocks, gfx modules, widgets,       │
 │                           fragments, components, shared       │
 ├──────────────────────────────────────────────────────────────┤
 │  packages/affine/model    every schema and element model      │
 ├──────────────────────────────────────────────────────────────┤
 │  packages/framework/*     store, sync, std, global            │
 └──────────────────────────────────────────────────────────────┘
```

A package imports only from layers below it. `model` never imports a view.
`std` never imports an `affine/*` package.

## The framework layer

| Package         | Role                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@labre/global` | utilities with no dependency: disposables, DI container, exceptions, environment                                                                        |
| `@labre/store`  | the document model over Yjs, schemas, snapshots, `WorkspaceImpl`                                                                                        |
| `@labre/sync`   | doc sources, blob sources, awareness sources                                                                                                            |
| `@labre/std`    | the editor runtime: `BlockStdScope`, commands, selection, events, clipboard, gfx (element models, views, renderers, tools), command registry, shortcuts |

## The model layer

`@labre/affine-model` holds every block schema (`affine:paragraph`,
`affine:database`…) and every surface element model (shape, connector,
group, Wardley node, BPMN node…). **This package is the file format.** A
change here must keep every existing document loadable.

## The feature layer

One package per feature, under `packages/affine/`:

- `blocks/<name>`: a block (schema is in model; here: store extension, view
  extension, component, commands, adapters).
- `gfx/<name>`: a canvas module (shape, connector, mindmap, and every business
  framework).
- `widgets/<name>`: UI attached to a block (drag handle, slash menu, toolbar).
- `fragments/<name>`: UI attached to the document, outside the editor.
- `components/`: shared UI atoms (icons, menus, tooltips).
- `shared/`: services, commands, styles, adapters used by several features.
- `inlines/`, `rich-text/`, `data-view/`: text editing and table views.
- `ext-loader/`: the provider classes every feature uses to declare its
  extensions.

Every feature package exposes two entries: `./store` (what the document needs)
and `./view` (what the editor needs). A framework also exposes `.`
(headless data: roles, rules, parsers) and `./commands-manifest` (a tiny
list of commands and chords for a settings pane).

## The assembly layer

`@labre/affine` (folder `packages/affine/all`) is the umbrella. Three
functions assemble everything:

| Function                           | File                      | Reads flags?                |
| ---------------------------------- | ------------------------- | --------------------------- |
| `getAffineSchemas()`               | `src/schemas.ts`          | no (ignored since ADR 0009) |
| `getInternalStoreExtensions()`     | `src/extensions/store.ts` | no (ignored)                |
| `getInternalViewExtensions(flags)` | `src/extensions/view.ts`  | **yes**, tooling only       |

Plus the data files hosts read: `src/flags.ts` (the list of flag keys),
`src/frameworks.ts` (one descriptor per framework), `src/shortcuts.ts`,
`src/translations.ts`, `src/commands.ts`.

## What is published

The 82 workspace packages are private. `scripts/build-bundles.mjs` generates
the npm packages under `@formicoidea/`:

| Bundle                                       | Content                                                                                                                      |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `@formicoidea/labre-core`                    | the whole editor minus the business frameworks                                                                               |
| `@formicoidea/labre-framework-<id>`          | one framework: `wardley`, `edgy`, `bpmn`, `c4`, `cynefin`, `ddd-event-storming`, `ddd-core-domain`, `ddd-context-map`, `uml` |
| `@formicoidea/labre-ddd-shared`              | helpers shared by the DDD frameworks                                                                                         |
| `@formicoidea/labre-framework-ddd-aggregate` | DDD template categories only (not a framework: no senior button)                                                             |

The core bundle keeps the same subpaths as the umbrella (`@labre/affine/std`
becomes `@formicoidea/labre-core/std`). The frameworks are stripped from the
core's flag list and re-enter through their bundle's `./descriptor`.

Next: [04-extensions-and-assembly.md](04-extensions-and-assembly.md).
