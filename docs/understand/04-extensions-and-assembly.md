# Extensions and assembly

**Everything the editor does is an extension registered in a container that
belongs to one editor instance.**

## The container

When the host creates an editor, it creates a `BlockStdScope` with a store
and a list of extensions. The scope owns a dependency-injection container.
Every service, view, command, watcher and renderer is registered into it.
When the editor is removed, the container is gone. Nothing needs cleaning up
across editors.

```ts
const std = new BlockStdScope({ store, extensions });
host.append(std.render());
```

## What an extension is

An object with a `setup(di)` function, or a class with a static `setup`.
Helpers build the common kinds:

| Helper                                              | Registers                                                  |
| --------------------------------------------------- | ---------------------------------------------------------- |
| `FlavourExtension('affine:x')`                      | the flavour itself                                         |
| `BlockViewExtension('affine:x', literal`affine-x`)` | the Lit component that renders the block                   |
| `WidgetViewExtension(...)`                          | a widget attached to a block                               |
| `KeymapExtension(...)`                              | keyboard bindings                                          |
| `ConfigExtensionFactory<T>('name')`                 | a typed configuration slot the host can fill               |
| `ElementRendererExtension(type, fn)`                | a canvas renderer for a surface element type               |
| `CommandExtension(descriptors, icons)`              | a framework's commands (senior menu, shortcuts, catalogue) |
| `TelemetryExtension(service)`                       | the host's analytics adapter                               |

A service is registered with an identifier:

```ts
export const MyProvider = createIdentifier<MyService>('MyService');
export const MyExtension = (service: MyService): ExtensionType => ({
  setup: di => di.override(MyProvider, () => service),
});
```

And consumed with `std.get(MyProvider)` when the library registers it
itself, or `std.getOptional(MyProvider)` when the host may not have provided
it.

A stateful service that needs the editor lifecycle extends
`LifeCycleWatcher` (`created`, `rendered`, `mounted`, `unmounted`).

## Providers group extensions

A feature package does not export forty extensions. It exports one or two
**providers** (from `@labre/affine-ext-loader`):

- a `StoreExtensionProvider`: what a document needs to load (schemas, block
  services, adapters). Registered into the workspace.
- a `ViewExtensionProvider`: what an editor needs to show and edit it
  (components, renderers, widgets, commands, toolbars). Registered into the
  `BlockStdScope`.

A view provider has a `setup(context)` that calls `context.register([...])`
and can branch on `context.scope` (`page`, `edgeless`, `preview-page`,
`mobile-edgeless`…), and an `effect()` that runs once per class and is where
`customElements.define` happens.

## The three assembly functions

`packages/affine/all` collects every provider:

```ts
schema.register(getAffineSchemas()); // file format
workspace.storeExtensions = new StoreExtensionManager(
  getInternalStoreExtensions()
).get('store'); // document behaviour
const view = new ViewExtensionManager(getInternalViewExtensions(flags)); // editor behaviour
const edgelessSpecs = view.get('edgeless');
const pageSpecs = view.get('page');
```

## What a flag does

`flags` is a plain object `{ database: false, wardley: false }`. A key that
is missing means enabled. Only `getInternalViewExtensions` reads it, and it
removes **tooling**: the senior button, its sub-menu, the framework's
shortcuts, its rules and its templates category. The schema, the store
extension and the framework's **renderer** stay registered, so a document
that already contains the framework still paints and stays editable.

This is why every canvas framework ships two view providers:

| Provider               | Registered                        | Contains                                                                                                                                      |
| ---------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `XRenderViewExtension` | always                            | element views, renderers, interaction, contextual toolbar of a placed element, role vocabulary                                                |
| `XViewExtension`       | only when the flag is not `false` | senior button, sub-menu, commands and shortcuts, validation rules and profiles, templates category, interchange capabilities, nudges, reading |

Blocks inherited from AFFiNE have not been split yet, the callout excepted:
`CalloutRenderViewExtension` (block view, keymap, block toolbar) is always
registered and `CalloutViewExtension` (slash item, "Turn into → Callout") is
gated. Any other disabled block's content is safe in the store but renders
nothing until its flag is back (ADR 0009, consequences section and its
2026-10-11 amendment).

## Framework descriptors

`packages/affine/all/src/frameworks.ts` is a data-only list: one entry per
framework with its id, label key, icon key, chord prefix, telemetry key,
bundle name, and the pair of view extensions. The senior toolbar row, the
build script and the host all read this list. It is the one place a
framework's identity is spelled.

Next: [05-what-is-a-framework.md](05-what-is-a-framework.md).
