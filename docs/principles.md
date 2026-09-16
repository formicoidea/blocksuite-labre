# Design principles

Two lists. The first comes from BlockSuite as it was before the fork diverged
(the original guides and blog posts at commit `5cb5cb684`). The second was
added by Labre and is recorded in the ADRs. Each principle is one sentence, a
short reason, and the consequence for the code you write.

## Part 1. Inherited from BlockSuite

1. **The document outlives the editor.** The document is data that exists on
   its own; an editor attaches to it and detaches without touching it.
   _So:_ the host owns the document lifecycle. One document can feed several
   editors. Never store editor state in the document.

2. **Yjs is the only source of truth.** There is no business model kept in sync
   with the CRDT. The Yjs structures are the model.
   _So:_ write to the store, never to the view. Read model props as signals.

3. **Data flows one way.** User event, then command, then store mutation, then
   notification, then view refresh.
   _So:_ a view never modifies another element directly. A view reacts.

4. **Where an update comes from does not matter.** Local edit, undo, remote
   peer: same path, same code.
   _So:_ collaboration is not a plugin. Any code that cascades on a change must
   accept that the change may come from another user, and must not cascade
   again (see `local` guard in [contribute/07-dev-practices.md](contribute/07-dev-practices.md)).

5. **A block tree with flavours.** Every block type has a name of the form
   `namespace:name`. The built-in `affine:*` blocks have no privilege.
   _So:_ a new block or element is an ordinary citizen. No special cases in
   the core for it.

6. **The schema declares the structure.** Props are typed and versioned, never
   `null` or `undefined`; nesting rules are declared.
   _So:_ changing a schema is changing a file format. It goes through an ADR
   and must keep old documents loadable.

7. **A block is schema + service + view.** The same model can have several
   views (page mode and canvas mode render the root block differently).
   _So:_ logic lives in services and commands. Views stay thin.

8. **Everything is an extension, injected per editor.** The container dies with
   the editor; nothing needs un-registering.
   _So:_ a module adds extensions. It never patches the core.

9. **Commands are chainable and typed**, registered by the blocks that own
   them, not by a central file.

10. **Selection is data, not DOM state.** It is serializable and shared through
    awareness, which is why remote cursors come for free.

11. **Inline text editors never nest.** One `Y.Text` per inline editor.

12. **Two persistence paths: snapshot and streaming.** Snapshots (JSON) feed
    the Markdown and HTML adapters; streaming (binary CRDT updates through
    providers) is how documents are stored and synced.
    _So:_ the server stores binary Yjs updates, never JSON.

13. **Web components, Lit to render, no DOM of its own.** Usable from React,
    Vue or vanilla JavaScript.

14. **Page and canvas share one document.** Switching mode converts nothing and
    keeps the undo history.

15. **The canvas holds blocks in `children` and graphics in `elements`.**
    Z-order is a fractional index, not an integer.

16. **Fragments live outside the editor.** Outline, title, panels: they attach
    to the document and have their own lifecycle.

17. **No privileged consumer.** AFFiNE used BlockSuite like anyone else.
    _So:_ the Labre application has no back door into the library. If the app
    needs something, the library exposes a seam that any host could use.

18. **Undo belongs to the document**, not to the editor instance.

19. **A test with every change.** Collaboration is tested with two tabs on the
    same room.

## Part 2. Added by Labre

- **A. Divergence is assumed.** We do not track upstream. We cherry-pick
  security fixes and block bug fixes deliberately, one at a time. We never
  publish under `@blocksuite/*`. (ADR 0001)

- **B. A flag removes tooling, never content.** Schemas and store extensions
  are always registered. A document opens everywhere, forever, whatever the
  flags say. A missing flag means enabled. (ADR 0009, reversing ADR 0002)

- **C. The library emits, the host transports.** Telemetry, notifications,
  network calls, search: the library exposes an injection point and behaves
  sensibly when nothing is injected. (ADR 0003, 0006)

- **D. A framework contributes data, not menus.** Command descriptors, roles,
  rules, templates. The senior sub-menu, the catalogue, the palette, the
  shortcuts pane and the AI agent are all projections of the same
  declarations. One identity per framework, spelled once. (ADR 0008, 0014)

- **E. Parsers are pure functions and live in the library.** Import and
  export of a framework's native format are functions of text and elements,
  callable without an editor. Unknown data is preserved, not lost. (ADR 0012)

- **F. The persisted format is forever.** Store, sync and schemas are red
  zones. Identifiers are deprecated, never removed. Optional fields with an
  `undefined` default need no migration. (ADR 0007, CLAUDE.md)

- **G. Granular source, coarse publication.** 82 private `@labre/*` packages
  in the repo; about ten `@formicoidea/labre-*` bundles on npm. Published code
  must be resolvable by Node as-is.

- **H. Every host seam documents what disappears when it is absent.** See
  [integrate/04-host-seams.md](integrate/04-host-seams.md).

- **I. Nothing in the editor blocks a gesture.** Validation rules produce
  findings with a severity; the most permissive profile is the default. The
  sketch always wins.

- **J. A decision that touches a stored format or a host contract is an ADR
  first**, code second. See [contribute/06-decisions.md](contribute/06-decisions.md).

- **K. Every framework board exports as SVG.** A board is a picture people take
  away: the same renderer that paints the canvas paints the file (svgcanvas
  replays the 2D context into SVG), so every board — present and future — gets
  the export for free, generically, from its contextual toolbar. Native formats
  (OWM, BPMN XML, mermaid) are per framework; the picture is not. (ADR 0017)
