# blocksuite-labre documentation

blocksuite-labre is the editor library behind **Labre**: a document editor
(text) and a whiteboard (canvas) in one, with business frameworks drawn on the
canvas (Wardley maps, EDGY, BPMN, C4, Cynefin, DDD). It is a fork of
BlockSuite, the editor of AFFiNE, that no longer follows upstream.

This documentation is written for people and for AI agents. Every page is
short, states the rule first, then the reason, then where the code is.

## Pick your door

| You want to…                            | Start here                                                                           | Then                                                                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Understand how the library works**    | [understand/01-big-picture.md](understand/01-big-picture.md)                         | the rest of `understand/`, then [principles.md](principles.md)                                                                            |
| **Put the editor in your own software** | [integrate/01-install.md](integrate/01-install.md)                                   | `integrate/` in order, especially [04-host-seams.md](integrate/04-host-seams.md) and [08-host-panels.md](integrate/08-host-panels.md)     |
| **Contribute a fix or a feature**       | [contribute/01-setup.md](contribute/01-setup.md)                                     | [02-workflow.md](contribute/02-workflow.md), [03-rules.md](contribute/03-rules.md), [07-dev-practices.md](contribute/07-dev-practices.md) |
| **Add a business framework**            | [add-a-framework/01-definition-of-done.md](add-a-framework/01-definition-of-done.md) | [02-framework-rules.md](add-a-framework/02-framework-rules.md), then the step-by-step                                                     |

## Cross-cutting pages

- [principles.md](principles.md): the design principles we keep, inherited
  from BlockSuite and added by Labre. Read this before changing anything
  structural.
- [lessons.md](lessons.md): what went wrong once and the rule we derived.
- [adr/README.md](adr/README.md): the architecture decision records. A
  decision that changes a stored format or a host contract is written there
  before the code.

## Prerequisites shared by every door

- Node `>=18.19 <23`, yarn 4 (the repo pins it in `package.json`).
- TypeScript strict. Web components rendered with Lit. State in Yjs.
- Comments, identifiers, commit messages and documentation are in English.

## Vocabulary you will meet on every page

| Word                      | Meaning                                                                                                              |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| document / doc            | One editable thing (a page or a board). Stored as a Yjs document.                                                    |
| block                     | A node of the document tree: paragraph, list, image, note, surface… Each has a `flavour` such as `affine:paragraph`. |
| surface                   | The block that holds the whiteboard. Its `elements` are the shapes, connectors, text and framework artefacts.        |
| element                   | A graphic object on the surface (not a block).                                                                       |
| page mode / edgeless mode | The two views of the same document: text view and canvas view.                                                       |
| extension                 | A unit of behaviour registered into the editor's container (a view, a service, a command…).                          |
| framework                 | A business notation shipped as a canvas module: Wardley, EDGY, BPMN, C4, Cynefin/Estuarine, DDD.                     |
| board / background        | The framework's frame drawn on the canvas (a Wardley map, a BPMN pool, a C4 board).                                  |
| senior button             | The framework's button in the whiteboard toolbar; it opens the framework's sub-menu.                                 |
| flag                      | A host-side switch that removes a module's tooling. Never its content.                                               |
| seam                      | A place where the host application plugs its own implementation (telemetry, notifications, search…).                 |

The full list is in [understand/06-glossary.md](understand/06-glossary.md).
