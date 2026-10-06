# Glossary

Plain words for the names you will meet in the code.

| Term                   | Meaning                                                                                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ADR**                | Architecture decision record, in `docs/adr/`. A numbered page: context, decision, consequences.                                                                |
| **adapter**            | Converts a document snapshot to or from another format (Markdown, HTML, clipboard).                                                                            |
| **artefact**           | A framework element drawn on a board (a Wardley component, a BPMN task). The catalogue and the sub-menu list artefact commands.                                |
| **awareness**          | The channel for cursors, selections and presence. Not stored, no history.                                                                                      |
| **background**         | The code name of a framework **board**. `FrameworkBackgroundElementModel`.                                                                                     |
| **block**              | A node of the document tree, with a flavour, props and children.                                                                                               |
| **BlockStdScope**      | The editor runtime for one document in one editor: the container plus commands, selection, events, clipboard, gfx. Called `std` everywhere.                    |
| **board**              | The product name of a framework's frame on the canvas: map, pool, diagram frame.                                                                               |
| **bundle**             | A generated npm package under `@formicoidea/`. Not a workspace package.                                                                                        |
| **catalogue**          | The side panel listing every command of a framework.                                                                                                           |
| **changeset**          | A file under `.changeset/` describing a user-facing change; consumed at release to bump versions and write changelogs.                                         |
| **chord**              | A two-key shortcut: press `w` then `c`. Each framework may own one prefix letter.                                                                              |
| **command descriptor** | The declaration of one user-facing action: id, label key, icon key, chord, surfaces, `run`. The one source the menus and shortcuts derive from.                |
| **contextual toolbar** | The toolbar shown above a selected element.                                                                                                                    |
| **CRUD service**       | `EdgelessCRUDIdentifier`: the service that adds, updates and deletes surface elements.                                                                         |
| **doc / store**        | A `Doc` is a document handle in the workspace; its `Store` is the block tree you edit.                                                                         |
| **edgeless**           | The whiteboard mode.                                                                                                                                           |
| **element**            | A graphic object in `surface.elements`. Not a block.                                                                                                           |
| **extension**          | A unit registered in the container: view, service, command, renderer, watcher.                                                                                 |
| **flag**               | A host switch `{ key: false }` that removes a module's tooling. Absent means enabled.                                                                          |
| **flavour**            | A block type name: `affine:paragraph`.                                                                                                                         |
| **fragment**           | UI attached to the document outside the editor: outline, title, frame panel.                                                                                   |
| **framework**          | A business notation shipped as a canvas module. Also, confusingly, `packages/framework/` is the runtime layer (store, sync, std). Context tells them apart.    |
| **gfx**                | The graphics subsystem in `std`: element models, views, renderers, tools, viewport, selection on the canvas.                                                   |
| **group**              | A surface element that holds other elements. Compound artefacts are groups.                                                                                    |
| **host**               | The application that mounts the editor (Labre, the playground, your app).                                                                                      |
| **interchange**        | Import/export of a framework's native format. A capability is `framework:format:direction`.                                                                    |
| **layer (user)**       | A named, ordered container of canvas content the user manages in the selection pane: `SurfaceLayerRecord` on the surface, `layer` on each model (ADR 0031).    |
| **layer manager**      | `LayerManager`: cuts the paint order into runs of canvas elements and of DOM blocks. A rendering device, not a user layer. See `02-data-flow.md`.              |
| **legend**             | The auto-generated key of symbols placed on a board.                                                                                                           |
| **nature**             | A level-3 qualification of a role (`wardley:nature = data`).                                                                                                   |
| **nudge**              | A quality checklist item shown to the user and never evaluated by the engine.                                                                                  |
| **page**               | The text mode.                                                                                                                                                 |
| **palette**            | The Templates panel entry derived from an artefact command.                                                                                                    |
| **pivot**              | A host-owned record an element can point to (`pivotDocId`). Opaque to the library.                                                                             |
| **profile**            | A set of severities for a framework's rules. The default is the most permissive.                                                                               |
| **provider**           | A class grouping extensions for one feature (`StoreExtensionProvider`, `ViewExtensionProvider`), or a service identifier the host fills (`TelemetryProvider`). |
| **reading**            | What the tool proposes about a clicked component (a role, a tag), never written without confirmation.                                                          |
| **red zone**           | Code where a bad change corrupts documents or breaks legal obligations. Human review required. See `CLAUDE.md`.                                                |
| **render extension**   | The always-on half of a framework's view: renderer, element view, contextual toolbar.                                                                          |
| **role**               | The semantic identity of an element: `wardley:component`. Namespaced by framework.                                                                             |
| **rule**               | A validation check producing findings. Never blocks.                                                                                                           |
| **seam**               | A place where the host plugs its own implementation through an identifier.                                                                                     |
| **selection pane**     | The side panel listing the canvas by layer and paint order, top first; a projection of the canvas (`selectionPaneTree(std)`), seam `SelectionPaneExtension`.   |
| **senior button**      | A framework's button in the whiteboard toolbar. Opens the senior sub-menu.                                                                                     |
| **signal**             | A reactive value from `@preact/signals-core`. Model props are signals (`x$`).                                                                                  |
| **snapshot**           | The JSON form of a document or a slice of it.                                                                                                                  |
| **store extension**    | What a document needs to load: schema, block service, adapters.                                                                                                |
| **surface**            | The block holding the whiteboard's elements.                                                                                                                   |
| **template**           | A snapshot the user inserts from the Templates panel.                                                                                                          |
| **view extension**     | What an editor needs to show and edit: components, renderers, widgets, commands.                                                                               |
| **widget**             | UI attached to a block: drag handle, slash menu, toolbar.                                                                                                      |
| **workspace**          | Many documents plus shared metadata. `WorkspaceImpl` in production.                                                                                            |
| **Yjs**                | The CRDT library the document is stored in.                                                                                                                    |
