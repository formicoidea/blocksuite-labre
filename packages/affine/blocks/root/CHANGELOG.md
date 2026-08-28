# @labre/affine-block-root

## 0.33.0

### Patch Changes

- Updated dependencies [3fbf69c]
- Updated dependencies [f929e12]
- Updated dependencies [13360cd]
- Updated dependencies [5c39582]
- Updated dependencies [8890efe]
- Updated dependencies [c03090c]
- Updated dependencies [32e4d45]
- Updated dependencies [139d77b]
- Updated dependencies [6bba40c]
- Updated dependencies [a8325bb]
- Updated dependencies [ff19911]
- Updated dependencies [7aa932c]
- Updated dependencies [b03132c]
- Updated dependencies [48049d6]
- Updated dependencies [7136db0]
- Updated dependencies [932bf35]
- Updated dependencies [5737a56]
- Updated dependencies [168617d]
- Updated dependencies [932bf35]
- Updated dependencies [1dbd735]
- Updated dependencies [9022c92]
- Updated dependencies [b97efc6]
- Updated dependencies [edfaba2]
- Updated dependencies [46ce0c9]
- Updated dependencies [334bd61]
- Updated dependencies [2ec39c0]
- Updated dependencies [a9eb4f6]
- Updated dependencies [e42e0c0]
- Updated dependencies [256ee0b]
- Updated dependencies [4a3b26e]
- Updated dependencies [48c3b52]
- Updated dependencies [6a20738]
- Updated dependencies [f09f9a3]
  - @labre/affine-block-surface@0.33.0
  - @labre/affine-components@0.33.0
  - @labre/affine-shared@0.33.0
  - @labre/affine-model@0.33.0
  - @labre/std@0.33.0
  - @labre/affine-gfx-connector@0.33.0
  - @labre/affine-widget-edgeless-toolbar@0.33.0
  - @labre/affine-block-attachment@0.33.0
  - @labre/affine-block-bookmark@0.33.0
  - @labre/affine-block-edgeless-text@0.33.0
  - @labre/affine-block-embed@0.33.0
  - @labre/affine-block-frame@0.33.0
  - @labre/affine-block-image@0.33.0
  - @labre/affine-block-note@0.33.0
  - @labre/affine-gfx-brush@0.33.0
  - @labre/affine-gfx-group@0.33.0
  - @labre/affine-gfx-mindmap@0.33.0
  - @labre/affine-gfx-note@0.33.0
  - @labre/affine-gfx-pointer@0.33.0
  - @labre/affine-gfx-shape@0.33.0
  - @labre/affine-gfx-text@0.33.0
  - @labre/affine-widget-edgeless-selected-rect@0.33.0
  - @labre/affine-block-database@0.33.0
  - @labre/affine-block-paragraph@0.33.0
  - @labre/data-view@0.33.0
  - @labre/affine-inline-preset@0.33.0
  - @labre/affine-rich-text@0.33.0
  - @labre/affine-ext-loader@0.33.0
  - @labre/global@0.33.0
  - @labre/store@0.33.0

## 0.32.0

### Minor Changes

- 0473dcb: feat(edgeless): add keyboard shortcuts for duplicate and apply last style

  Duplicate (previously toolbar-only) is now bound to Mod+D on the canvas, and
  Mod+Y applies the last used style to the selection — across element types.
  Both are edgeless-scoped, enumerable and host-rebindable via the shortcut
  manifest (`getShortcutManifest`).

  - Mod+D duplicates the current selection. On mac this is Cmd+D and coexists
    with the existing Ctrl+D = delete binding; on Windows/Linux it is Ctrl+D.
  - Mod+Y repaints the selected elements with every style prop the user last
    set, wherever the target type supports it: a fill picked on a rect applies
    to an ellipse, a font style set on a text applies to a shape. Props foreign
    to the target type are dropped per prop (schema-filtered), geometry and
    content are never touched, and one undo restores the previous styles.

- 02797b5: Surface elements can now be an **occurrence of a pivot record**: a new optional
  `pivotDocId` field on `GfxPrimitiveElementModel`, a `pivot.bind` command that
  writes it, and an injectable `PivotPropertiesProvider` the host implements to
  turn that id into displayable properties. Implements ADRs 0005 and 0006.

  A pivot record is a document owned by the host application holding the durable,
  cross-board identity of a business object ("the Payments component"). A Wardley
  `component` drawn on three maps is the _same_ component; until now the library
  had no way to say so.

  **The field.** `pivotDocId?: string`, declared on the BASE element class next to
  `role` and `validationExceptions`, for the same reason: an element re-created
  from props (paste, duplicate, alt-drag clone, template insertion) only reaches
  the Y.Map through keys with a declared accessor, so a per-subclass declaration
  would be dropped on copy — invisibly, until the next reload. It is **distinct
  from `linkedDocId`**, which is a hyperlink (one target per element, exclusive
  with `externalLink`, opened by the hover arrow) rather than an identity
  (many elements to one record). An element may carry both; code reading one as a
  stand-in for the other is a bug.

  **No version bump, no migration, and none is needed.** Surface elements carry no
  schema version and have no upgrade hook, unlike block schemas — where the
  analogous `externalSourceId` forced `affine:database` from version 3 to 4. The
  field is additive and an absent key reads as `undefined`. An element that never
  binds writes no key at all, so it stays byte-identical to one created before
  this release. Old documents open unbound; documents carrying the field open on
  older builds, which preserve the key without reading it.

  **Release-ordering constraint, and why this release satisfies it.** The
  declaration of a field must ship no later than anything that writes it: on a
  client that does not declare `pivotDocId`, the five element-creation-from-props
  paths drop the key silently — no exception, no warning, no telemetry, the copy
  looks correct in the session and is unbound on reload. Declaration and its one
  writer therefore ship **together**, and the writer is a command with no default
  keyboard binding and no menu entry in the library, so nothing writes the field
  until a host wires its own record picker to it. Fleets that must interoperate
  with clients older than this release should roll the library out before enabling
  that host UI.

  **The command.** `pivot.bind` (owner `core`, availability `selection`, surfaces
  `palette` + `agent`, keyless by intent and still bindable from
  Settings › Shortcuts). Its parameter is `{ pivotDocId: string | null }`, where
  `null` unbinds — the key is required, so a forgotten argument cannot silently
  destroy a binding. The library never chooses a document: which record to bind to
  is the host's decision, passed in. `store.captureSync()` runs **before** the
  write, so a bind issued within 500 ms of a drag is its own undo step rather than
  being reverted together with the drag. Unbinding removes the Y.Map key rather
  than leaving a tombstone.

  The command emits one new telemetry event, `FrameworkElementPromoted`
  (`rung`, `direction`, optional `framework`/`role`, `elementCount`). It is
  deliberately not `FrameworkElementAdded`: a promotion inserts nothing, so
  reusing the creation event would count a drawn-then-bound shape twice and
  inflate "elements added per framework" permanently. Its `labelKey` is the first
  under `com.labre.command.*` rather than `com.labre.keyboardShortcuts.*` — hosts
  shipping a translation catalogue must add `com.labre.command.pivot.bind` and
  `com.labre.command.pivot.bind.description`, or the English `labelFallback` is
  used.

  **The provider.** `PivotPropertiesProvider` + `PivotPropertiesExtension(service,
{ hoverFields })` in `@labre/affine-shared/services`. `properties$(pivotDocId,
{ fields })` returns a `ReadonlySignal` **synchronously** — there is no
  `Promise`-returning method on the read path, so no call site can `await` one and
  the host's latency budget cannot leak into a gesture. Values are typed and
  render-free: no `TemplateResult`, no HTML, ever. The provider is told which
  fields to load and must load only those; `hoverFields: []` means the library
  does not call it at all. **No noop default is registered**: absence is a
  meaningful state (standalone playground, tests, a host build that failed to
  register), so it stays the tested default path. Every provider call is guarded,
  and a throwing host degrades rather than crashing a hover.

  **Backlinks are computed, never persisted.** `collectPivotOccurrences(surface,
pivotDocId?)` walks the surface and returns the occurrences; there is no index,
  no reverse map, no cache and nothing written back. Cross-document aggregation is
  the host's, built from per-document calls.

  The command is gated on `store.readonly` in both its `when` predicate and its
  body. The predicate is what a surface consults; the body guard is what actually
  protects the document, because `runCommand` consults neither `when` nor
  `availability` and the palette and the agent reach `run` directly. Binding in a
  read-only document used to throw out of `runCommand`, and unbinding used to
  **succeed** — `clearField` goes through `Store.transact`, which carries no
  read-only guard of its own.

  Also in `@labre/std`, two additions to the command registry:

  - `AnyCommandDescriptor`, the registry's element type with its parameter
    contract erased. The registry is heterogeneous now that a command takes
    parameters, and `CommandDescriptor<void>` could not express that.
    Registry-facing signatures (`CommandExtension`, `runCommand`,
    `getRegisteredCommands`, the two projections…) use the alias; existing
    `CommandDescriptor[]` declarations are unaffected.
  - `CommandManifestEntry.params?: CommandParam[]` — a minimal serializable
    description (`key`, `kind`, `required`, `nullable`) derived from the
    descriptor's zod schema, so the `'agent'` surface is usable end to end. The
    schema itself never crosses the seam. Derivation is all-or-nothing: a
    parameter the reader cannot describe withdraws the whole contract rather than
    advertising a partial one. Nullary commands are unaffected — they project no
    `params` key at all.

- 5d16745: Clicking a component now asks the tool **what it reads of it**, and offers the
  answer as a proposal: type of node, nature, parent-child relations, evolution
  phase and naming convention — with nothing written anywhere until the user
  confirms. Implements MF3 (reversed reading), on the PO arbitration of
  01/08/2026: _triggered on a click, never by automatic validation, and no write
  without confirmation._

  **The trigger is a gesture, and only a gesture.** A new `element.read` command
  (owner `core`, availability `selection`, surfaces `palette` + `agent`, keyless
  by intent) opens the proposal; the selected component's contextual toolbar gains
  a **Read this component** entry that invokes the same command with the element
  id, so the toolbar, the palette and the agent share one implementation. Nothing
  opens it by itself, and nothing about validation reaches it. `element.read` is
  deliberately **not** read-only gated: reading a board one cannot edit is exactly
  as legitimate as reading one you can.

  **The five readings, each a function of data the document already carries.**

  - **Type of node** — the element's `role`, plus the chain it specialises,
    resolved through the framework's own role vocabulary (`wardley:market` reads
    as "a kind of Component" because the framework said so, not because the panel
    knows what a market is).
  - **Nature** — the type-3 tags the element CARRIES. When it carries none the
    field is empty and stays empty: no nature is inferred from the shape, from the
    name or from the position. That is the whole of the arbitration, and it is the
    one thing the reading refuses to do.
  - **Parent-child relations** — the typed edges touching the element, read with
    the ADR 0010 convention (`source` is the subject of the role's verb; for
    `wardley:dependency` that makes the source the consumer). Consumers read as
    "above", suppliers as "below", and **a link whose declaration contradicts the
    drawing is named as such** — W4 seen from the record's side, reported without
    picking a winner. An edge with an unbound end, a neutral connector and a
    self-loop are all skipped.
  - **Evolution phase** — the declared zone the element's centre falls in, taken
    from the framework background's own `zones`, plus "in the zone of punctuated
    equilibrium" when it sits inside a declared transition band. A component that
    is on no map has no phase, and the panel says so rather than guessing the
    nearest one.
  - **Naming convention** — declarative data per nature, shipped by the framework.
    Wardley's is deliberately **one motif**: does the name read as an action? The
    gerund is expected positively for `activity` and negatively for `data`,
    `practice` and `knowledge` — four entries, no word list, no dictionary the
    library would then own. It is a suggestion with the framework's own wording,
    never a violation, and it is silent on an unnamed element or on a nature no
    convention describes.

    **The motif is English, and the data says so.** A convention declares its
    `lang`, and the engine applies it only when the host says it is serving that
    language — so a board named in French gets silence rather than a confident
    wrong answer in both directions ("Facturation" told to use a verb, "Planning"
    told it reads as an action). A host that declares no language gets silence
    too. Extending the coverage is adding one convention per language for the same
    value, not changing code. This is what `TranslationService.language` (new,
    optional) exists for, and it is the only thing the library reads it for: the
    library still holds no catalogue and still negotiates no locale.

  **Confirming is the only write, and it reuses the existing rungs.** The panel
  proposes a nature only when the LINKED RECORD carries one the element does not,
  **and only after resolving the record's word against the framework's own tag
  def** — by value id, by id case-insensitively, then by label, with no fuzzy
  match anywhere. A pivot record is the host's document and its "nature" property
  holds the host's words (`"Activity"`), while an element carries namespaced value
  ids (`wardley:nature/activity`): they are not the same alphabet. What cannot be
  resolved is named in a sentence and offered no button — writing it would put a
  value no def describes into the document (the naming line vanishes, the
  qualification dropdown shows a raw id, rules stop matching), and comparing it
  would report a permanent false drift on an element that is correctly qualified.
  `tag.set` deliberately does not police its values, so the guard stands at the
  point of proposal. Confirming runs the existing `tag.set`; linking to a record runs the existing
  `pivot.bind` with an id the HOST supplies through a new
  `PivotRecordPickerProvider` — with no picker registered the action does not
  exist (hidden, not disabled), like every other seam whose absence is meaningful.
  In a read-only document the readings are all there and the confirmations are
  not. A unit test and an integration test both assert the invariant that matters:
  opening and closing a proposal a hundred times leaves the document byte-identical.

  **The drift trigger.** A bound element whose position or qualification changes
  gets one informative, non-blocking line: the board and the record disagree, with
  "Update the record" wired to the existing fire-and-forget materiality publisher.
  It is debounced (200 ms), asynchronous and **local-gated** — a colleague's drag
  is their drift to notice — so it is never on the 16 ms path of the gesture that
  caused it, by construction rather than by measurement. The comparison is bounded
  to the two record properties a framework names (`recordKeys`), read through the
  guarded `queryPivotProperties`, and — on the nature — to values the framework's
  own def describes: no provider, no configured fields, a property the record does
  not carry, or a word in the host's alphabet, and the trigger says nothing at
  all. A host whose record spells things differently gets no comparison and no
  drift, and that is now true of the VALUES as well as of the keys.

  **Everything a framework contributes is data.** `ReadingProfile` — roles,
  subject role, nature tag and its conventions, edge role, background declaration
  and phase axis — registered with `ReadingProfileExtension` from the framework's
  **flag-gated** view extension, exactly like its rules and its profiles. Reading a
  map is tooling: switch the Wardley flag off and the entry, the panel and the
  trigger vanish while every element still loads, paints and stays selectable
  (ADR 0009). The engine (`readElement`) is pure and names no framework; the panel
  resolves every word through the host's catalogue with the framework's own
  English fallback.

  `element.read` declares `surfaces: ['palette', 'contextual-toolbar', 'agent']`,
  and the toolbar entry and the panel's confirmations report
  `contextual-toolbar` as their invocation surface — a reading triggered by
  clicking a component is not a palette invocation, and the telemetry says so.

  Hosts shipping a translation catalogue gain the `com.labre.reading.*` keys (the
  panel's chrome and the toolbar entry), `com.labre.command.element.read[.description]`,
  and Wardley's `com.labre.wardley.reading.naming.*`. All of them carry English
  fallbacks, so a host with no catalogue reads correctly. A host that also
  implements the new optional `TranslationService.language` gets the naming
  suggestions; one that does not keeps every other reading and simply never sees
  that line.

- 1efc6d5: feat(edgeless): an element can say what KIND of thing it is (MF3)

  Implements ADR 0007: the level-3 contextual qualification of a surface element,
  the format its definitions take, and the one-way reflection of a bound
  occurrence's qualification onto its pivot record (ADR 0006 § 4).

  Level 2 said what an element IS on a map (`role`, PR #71). Level 3 says what
  kind of thing it is — a Wardley component is an activity, or data, or a
  practice, or knowledge — and that is a different question, authored on the
  element, reflected onto the record, and read by the rules engine.

  - **`tags?: Y.Map<string[]>` on `GfxPrimitiveElementModel`**, keyed by
    namespaced tag def id. A NESTED Y.Map and not a plain object, because
    `@field()` writes straight into the element's Y.Map with no `native2Y` in the
    path: a plain object there is ONE opaque value, so two people qualifying the
    same element on two DIFFERENT tags would silently lose one of the two. The
    nested map merges per tag; the `string[]` of a single tag stays
    last-write-wins, which is correct — one tag's value set is one atomic choice.
    There is no migration runner for surface elements, so the shape is chosen
    once, and an under-powered merge is the harm class the red zone exists to
    prevent.
  - **Default `undefined`, never stamped.** Declared on the BASE class so paste,
    duplicate and alt-drag clone preserve it for every primitive type at once,
    and absent by default so an element that is never qualified stays
    byte-identical to one created before the field existed: no schema version
    bump, no migration. Removing the last tag removes the key rather than leaving
    an empty map behind.
  - **`UniverseTagDefs` + `UniverseTagDefsExtension`**, the tags-only DI registry.
    Variant-parameterized on `packId` with `di.override`, so distinct packs
    accumulate and identical packs REPLACE: a host that re-registers on every
    render never throws and never grows the registry. The merge is total and
    silent — an invalid id, a cross-framework id, an unknown `formatVersion` each
    drop the offending def and record an issue. Nothing throws, ever: a
    misconfigured pack must never cost a user their board.
  - **The Wardley natures** (activity / data / practice / knowledge) ship as the
    library's one real pack, on the same mechanism a host uses for its own
    taxonomy. A client's private extension is a second pack with another
    `packId`, with no library release.
  - **`tag.set`**, a keyless `core` command taking the tag id and its values
    (`[]` clears). Read-only gated in `when` AND in `run`, `captureSync()` BEFORE
    the write, one `FrameworkElementPromoted` per gesture on the `tag` rung. Like
    `pivot.bind` it is self-emitting, and enumerated as such in the registry
    invariants test.
  - **A "Nature" section on the element toolbar**, generic in shape (it names no
    framework and builds from the seeded packs) and parameterized by the
    registrar's `RoleDefs`. It resolves through a canvas group to its single
    role-bearing member, so one click on a Wardley component reaches it.
  - **`PivotMaterialityPublisher`**, the local-gated watcher that reflects a bound
    element's qualification onto its record. Driven by Yjs transactions rather
    than by the setter or the command layer, because undo goes through neither: a
    setter-driven design desyncs the record on the very first Ctrl+Z. Coalesces
    per element per microtask, publishes full state, de-duplicates, and RETRACTS
    (`present: false`) on deletion, unbind and re-bind, so a record never keeps
    materialities attributed to an occurrence that no longer exists.

  **Release ordering, adopted from #67 recommendation #4 and unchanged from
  #89.** This release DECLARES the field; nothing in the product writes it until
  the host wires a qualification surface. Ship the declaration release before any
  release that writes `tags`, so the fleet floor tolerates the key.

  An older client keeps the value through load / edit / save (`syncElementFromY`
  mirrors every entry into `_preserved`), and — unlike `pivotDocId` — it keeps it
  on the five element-creation-from-props paths too, **as a plain object**: an
  undeclared key goes down the unknown-key branch, whose encodability guard
  accepts the serialized nested map because it is flat JSON. Nothing is lost; the
  shape is simply not the specified one. This release therefore also READS that
  degraded shape and CONVERTS it, preserving its content, on the first write —
  without which the declaring release would answer `{}` for a qualified element
  and then overwrite a colleague's tag, which would empty the release-ordering
  rule of its meaning.

  Two supporting changes in `@labre/std`, both consequences of the field being a
  nested Y type on the base class:

  - `syncElementFromY` re-attaches an `@observe`d nested type when the key itself
    is rewritten. Remote peers and undo/redo never reach the accessor's setter,
    the only other caller of `startObserve`, so the observer was left on a dead
    type and every later in-place mutation went unseen.
  - `startObserve` no longer warns for an ABSENT optional Y-type field. An
    unqualified element is the normal case, not a misuse.

### Patch Changes

- 630633b: fix(edgeless): keep both connector endpoints valid on self-loops and partial clones

  Two connector robustness fixes from the ADR 0010 recon (PR #86):

  - `reassociateConnectorsCommand` re-points **both** endpoints of a self-loop
    connector (source and target on the same element). Previously an early
    `continue` left `target` bound to the old element id after a block
    conversion.
  - Turning a partial selection into a linked doc no longer breaks a connector
    whose other end stays behind. That endpoint now becomes an **absolute
    position** — the same conversion the clipboard already applies through
    `serializeConnector` — instead of keeping an element id that means nothing
    in the new document. The connector arrives visible, selectable and at the
    place it occupied in the source document.

- 0ddfd47: fix(edgeless): a readonly board refuses element moves, resizes and tool arming

  Surface-element writes go through `store.transact`. `SurfaceBlockModel` does
  throw on readonly, but that is an exception raised at the bottom of a gesture:
  several paths never reach it, and the ones that do surface an uncaught error on
  `window` instead of a clean refusal.

  What actually changes on a readonly board:

  - **The mouse no longer moves anything.** `DefaultTool.dragStart` went straight
    to `handleElementMove`, which writes `xywh` through a `@field()` accessor —
    raw `store.transact`, no crud, no exception. A drag on a readonly board wrote
    into the Yjs document exactly as on an editable one. The refusal sits in
    `InteractivityManager.handleElementMove` / `handleElementResize` /
    `handleElementRotate` / `requestElementClone` — the layer that actually
    writes, so no gesture entry point can go round it. Panning, rubber-band
    selection and plain selection stay available; moving content, alt-drag
    cloning and resizing do not.
  - **`edgeless-selected-rect` drops its 8 resize handles.** The gate existed but
    only ran on selection change, so a board switched to readonly while something
    was selected kept its handles — and dragging one wrote.
  - **Creation tools refuse to arm** (`p`, `Shift-p`, `c`, `t`, `n`, `f`, `e`,
    `s`). They call `surface.addElement` / `store.addBlock` directly and raised
    uncaught `BlockSuiteError`s on ordinary keystrokes. The whitelist lives on
    `ToolController.setTool`, the single bottleneck every entry point goes
    through — keyboard managers, the toolbar and its mixins, senior buttons —
    because `s` is bound by `shape-draggable.ts` straight onto the mixin and
    never reaches the edgeless keyboard manager. Selection, pan and the
    presentation navigator still switch.
  - **`createGroupFromSelectedCommand` / `ungroupCommand`** refuse **before**
    their `removeChild` calls, which used to run even though the follow-up
    `addElement` would refuse — orphaning the selection out of its parent group,
    or dissolving the group outright on `Shift+Mod+G`. This is the one
    destructive bug of the set.
  - **Mindmap keyboard writes**: node text overwrite on letter-typing (both the
    wrapped hotkeys and the generic keyDown listener), `addNode` on Enter/Tab,
    arrow-key element moves (arrow **navigation** stays), Backspace/Delete.
  - **`ValidationManager.setException` / `setProfile` / `revokeExceptionsOn`**
    return empty/`false`; every caller gates its `track` on those returns, so a
    write that never happened is never reported.
  - **`applyLastStyle`**: no targets, so the command's `when` fails and the
    keystroke falls through to the `redo-windows` alias that shares Mod+Y on
    Windows.

  `EdgelessCRUDExtension` (`addElement` / `updateElement` / `deleteElements` /
  `removeElement`) and `EdgelessRootService.removeElement` / `reorderElement` now
  refuse with a `console.error` instead of letting the model throw — the same
  contract as `store.updateBlock` / `deleteBlock` / `moveBlocks`. That is a change
  of failure MODE, not a new refusal: the surface model already said no.

  `framework/store` and `sync` are untouched.

- 6618345: Shift + wheel scrolls the canvas sideways on every platform

  Holding shift while turning the wheel scrolls the edgeless canvas horizontally.
  That only worked on Windows: elsewhere the gesture was handed straight to the
  vertical pan, so a plain mouse — one with a vertical wheel and nothing else —
  could not scroll sideways at all on macOS or Linux.

  The substitution now also applies whenever the browser reports no horizontal
  delta of its own, which is exactly the plain-mouse case. Trackpads and
  horizontal-capable mice, whose shift+wheel the OS already converts, are
  untouched.

- 5edd916: A big board stays responsive: the canvas redraws only what changed

  Every element event repainted the whole surface, and every stacking canvas was
  allocated at full viewport size however little of it a layer occupied — on a
  1440x900 screen at device pixel ratio 2 that is about 20 MB of pixel buffer per
  layer, whether the layer held one shape or a hundred. Editing a large map spent
  most of its frame budget in redraws nothing on screen could tell apart.

  A stacking canvas is now sized to the bound of the elements it actually holds,
  clipped to the viewport, and canvases freed by a layer change are pooled for
  reuse instead of being thrown away. A change to one element marks only the
  layer it lives in, so a pan, a zoom or a single edit no longer forces a full
  repaint. During a drag a layer's canvas is allowed to grow but never to shrink,
  so the dragged element does not flicker at the edge of its own canvas; the full
  redraw comes once, when the drag ends.

  The DOM renderers for brush, highlighter, shape and connector now keep the
  nodes they already built and overwrite their attributes, instead of rebuilding
  the whole SVG subtree on every frame — a hundred redraws of one stroke now
  allocate two nodes in total instead of two hundred.

  Alongside: a block host re-reads its stacking order when the layers change, so
  a reorder shows immediately; sending a mindmap node backwards moves the whole
  mindmap once rather than each selected node in turn; and a connector whose path
  is momentarily empty answers its geometry questions instead of throwing.

- Updated dependencies [832c793]
- Updated dependencies [c5c07b9]
- Updated dependencies [a2b7c44]
- Updated dependencies [ff5f060]
- Updated dependencies [913da26]
- Updated dependencies [1b59f3c]
- Updated dependencies [41ab595]
- Updated dependencies [0bfc872]
- Updated dependencies [8ded589]
- Updated dependencies [50ab9ae]
- Updated dependencies [f832f27]
- Updated dependencies [9e23b5b]
- Updated dependencies [b9ed412]
- Updated dependencies [a3aa598]
- Updated dependencies [90a9168]
- Updated dependencies [aa08529]
- Updated dependencies [6417a2f]
- Updated dependencies [9ffab42]
- Updated dependencies [c6eac56]
- Updated dependencies [acbec17]
- Updated dependencies [d797f9a]
- Updated dependencies [9fde974]
- Updated dependencies [d360f72]
- Updated dependencies [9fe5773]
- Updated dependencies [50ab9ae]
- Updated dependencies [6264dfc]
- Updated dependencies [89b90e9]
- Updated dependencies [c2e1020]
- Updated dependencies [463989f]
- Updated dependencies [ceb2761]
- Updated dependencies [f7f23b2]
- Updated dependencies [751ac44]
- Updated dependencies [54488cd]
- Updated dependencies [9453013]
- Updated dependencies [695471f]
- Updated dependencies [b746d6b]
- Updated dependencies [b93b43c]
- Updated dependencies [5ac0c68]
- Updated dependencies [630633b]
- Updated dependencies [1fa46c1]
- Updated dependencies [d8eb24a]
- Updated dependencies [be100e3]
- Updated dependencies [ff3a5f7]
- Updated dependencies [0473dcb]
- Updated dependencies [5b6e9bb]
- Updated dependencies [86e7562]
- Updated dependencies [492bac6]
- Updated dependencies [72b334c]
- Updated dependencies [9bf1d3e]
- Updated dependencies [fc52023]
- Updated dependencies [30580db]
- Updated dependencies [08e9b24]
- Updated dependencies [dc5261e]
- Updated dependencies [5076cb8]
- Updated dependencies [3c5c97e]
- Updated dependencies [9cf65a2]
- Updated dependencies [19edf48]
- Updated dependencies [69cdc3d]
- Updated dependencies [7c10406]
- Updated dependencies [02797b5]
- Updated dependencies [413fe7b]
- Updated dependencies [724ed1c]
- Updated dependencies [c7612da]
- Updated dependencies [3e1665b]
- Updated dependencies [0ddfd47]
- Updated dependencies [3639562]
- Updated dependencies [521accb]
- Updated dependencies [5d16745]
- Updated dependencies [1c37478]
- Updated dependencies [b684b4c]
- Updated dependencies [48e90f4]
- Updated dependencies [0991104]
- Updated dependencies [5edd916]
- Updated dependencies [5a16359]
- Updated dependencies [025d6f5]
- Updated dependencies [b1ed4ef]
- Updated dependencies [985a92f]
- Updated dependencies [b889326]
- Updated dependencies [1efc6d5]
- Updated dependencies [4162e4a]
- Updated dependencies [3ac3587]
- Updated dependencies [fad4c08]
- Updated dependencies [7b940cf]
- Updated dependencies [7b66d8d]
- Updated dependencies [184c412]
- Updated dependencies [4bb44ef]
- Updated dependencies [30061cb]
- Updated dependencies [c2735aa]
- Updated dependencies [346b5d9]
- Updated dependencies [77b0100]
- Updated dependencies [8d33c60]
- Updated dependencies [061729e]
- Updated dependencies [7a3458a]
  - @labre/std@0.32.0
  - @labre/affine-shared@0.32.0
  - @labre/store@0.32.0
  - @labre/affine-block-note@0.32.0
  - @labre/affine-components@0.32.0
  - @labre/data-view@0.32.0
  - @labre/affine-block-database@0.32.0
  - @labre/affine-block-edgeless-text@0.32.0
  - @labre/affine-model@0.32.0
  - @labre/affine-gfx-shape@0.32.0
  - @labre/affine-gfx-brush@0.32.0
  - @labre/affine-gfx-connector@0.32.0
  - @labre/affine-block-surface@0.32.0
  - @labre/affine-gfx-text@0.32.0
  - @labre/affine-gfx-group@0.32.0
  - @labre/affine-widget-edgeless-selected-rect@0.32.0
  - @labre/affine-inline-preset@0.32.0
  - @labre/global@0.32.0
  - @labre/affine-block-frame@0.32.0
  - @labre/affine-gfx-pointer@0.32.0
  - @labre/affine-widget-edgeless-toolbar@0.32.0
  - @labre/affine-block-attachment@0.32.0
  - @labre/affine-block-bookmark@0.32.0
  - @labre/affine-block-embed@0.32.0
  - @labre/affine-block-image@0.32.0
  - @labre/affine-block-paragraph@0.32.0
  - @labre/affine-gfx-mindmap@0.32.0
  - @labre/affine-gfx-note@0.32.0
  - @labre/affine-rich-text@0.32.0
  - @labre/affine-ext-loader@0.32.0

## 0.31.0

### Patch Changes

- Updated dependencies [6a663b6]
  - @labre/store@0.31.0
  - @labre/affine-block-attachment@0.31.0
  - @labre/affine-block-bookmark@0.31.0
  - @labre/affine-block-database@0.31.0
  - @labre/affine-block-edgeless-text@0.31.0
  - @labre/affine-block-embed@0.31.0
  - @labre/affine-block-frame@0.31.0
  - @labre/affine-block-image@0.31.0
  - @labre/affine-block-note@0.31.0
  - @labre/affine-block-paragraph@0.31.0
  - @labre/affine-block-surface@0.31.0
  - @labre/affine-components@0.31.0
  - @labre/data-view@0.31.0
  - @labre/affine-ext-loader@0.31.0
  - @labre/affine-gfx-brush@0.31.0
  - @labre/affine-gfx-connector@0.31.0
  - @labre/affine-gfx-group@0.31.0
  - @labre/affine-gfx-mindmap@0.31.0
  - @labre/affine-gfx-note@0.31.0
  - @labre/affine-gfx-pointer@0.31.0
  - @labre/affine-gfx-shape@0.31.0
  - @labre/affine-gfx-text@0.31.0
  - @labre/affine-inline-preset@0.31.0
  - @labre/affine-model@0.31.0
  - @labre/affine-rich-text@0.31.0
  - @labre/affine-shared@0.31.0
  - @labre/std@0.31.0
  - @labre/affine-widget-edgeless-selected-rect@0.31.0
  - @labre/affine-widget-edgeless-toolbar@0.31.0
  - @labre/global@0.31.0

## 0.30.2

### Patch Changes

- @labre/affine-block-attachment@0.30.2
- @labre/affine-block-bookmark@0.30.2
- @labre/affine-block-database@0.30.2
- @labre/affine-block-edgeless-text@0.30.2
- @labre/affine-block-embed@0.30.2
- @labre/affine-block-frame@0.30.2
- @labre/affine-block-image@0.30.2
- @labre/affine-block-note@0.30.2
- @labre/affine-block-paragraph@0.30.2
- @labre/affine-block-surface@0.30.2
- @labre/affine-components@0.30.2
- @labre/data-view@0.30.2
- @labre/affine-ext-loader@0.30.2
- @labre/affine-gfx-brush@0.30.2
- @labre/affine-gfx-connector@0.30.2
- @labre/affine-gfx-group@0.30.2
- @labre/affine-gfx-mindmap@0.30.2
- @labre/affine-gfx-note@0.30.2
- @labre/affine-gfx-pointer@0.30.2
- @labre/affine-gfx-shape@0.30.2
- @labre/affine-gfx-text@0.30.2
- @labre/affine-inline-preset@0.30.2
- @labre/affine-model@0.30.2
- @labre/affine-rich-text@0.30.2
- @labre/affine-shared@0.30.2
- @labre/affine-widget-edgeless-selected-rect@0.30.2
- @labre/affine-widget-edgeless-toolbar@0.30.2
- @labre/global@0.30.2
- @labre/std@0.30.2
- @labre/store@0.30.2

## 0.30.1

### Patch Changes

- @labre/affine-block-attachment@0.30.1
- @labre/affine-block-bookmark@0.30.1
- @labre/affine-block-database@0.30.1
- @labre/affine-block-edgeless-text@0.30.1
- @labre/affine-block-embed@0.30.1
- @labre/affine-block-frame@0.30.1
- @labre/affine-block-image@0.30.1
- @labre/affine-block-note@0.30.1
- @labre/affine-block-paragraph@0.30.1
- @labre/affine-block-surface@0.30.1
- @labre/affine-components@0.30.1
- @labre/data-view@0.30.1
- @labre/affine-ext-loader@0.30.1
- @labre/affine-gfx-brush@0.30.1
- @labre/affine-gfx-connector@0.30.1
- @labre/affine-gfx-group@0.30.1
- @labre/affine-gfx-mindmap@0.30.1
- @labre/affine-gfx-note@0.30.1
- @labre/affine-gfx-pointer@0.30.1
- @labre/affine-gfx-shape@0.30.1
- @labre/affine-gfx-text@0.30.1
- @labre/affine-inline-preset@0.30.1
- @labre/affine-model@0.30.1
- @labre/affine-rich-text@0.30.1
- @labre/affine-shared@0.30.1
- @labre/affine-widget-edgeless-selected-rect@0.30.1
- @labre/affine-widget-edgeless-toolbar@0.30.1
- @labre/global@0.30.1
- @labre/std@0.30.1
- @labre/store@0.30.1

## 0.30.0

### Minor Changes

- 8de86f4: Shortcut manifest: chord sequences and per-mode scoping. A shortcut's keys are
  now a sequence of keystrokes (`['Mod-z']`, or `['w', 'c']` for "press w, then
  c"); the dispatcher keymap resolves multi-keystroke chords with a short arming
  timeout, never while typing in an editable. The `'page'`/`'edgeless'` shortcut
  scopes are now installed by the matching root view-extension branch, so scoped
  shortcuts only exist in that editor mode.

### Patch Changes

- Updated dependencies [9d0fe0c]
- Updated dependencies [4aeb85e]
- Updated dependencies [ecba791]
- Updated dependencies [8de86f4]
  - @labre/std@0.30.0
  - @labre/affine-block-frame@0.30.0
  - @labre/affine-model@0.30.0
  - @labre/affine-gfx-shape@0.30.0
  - @labre/affine-block-attachment@0.30.0
  - @labre/affine-block-bookmark@0.30.0
  - @labre/affine-block-database@0.30.0
  - @labre/affine-block-edgeless-text@0.30.0
  - @labre/affine-block-embed@0.30.0
  - @labre/affine-block-image@0.30.0
  - @labre/affine-block-note@0.30.0
  - @labre/affine-block-paragraph@0.30.0
  - @labre/affine-block-surface@0.30.0
  - @labre/affine-components@0.30.0
  - @labre/data-view@0.30.0
  - @labre/affine-gfx-brush@0.30.0
  - @labre/affine-gfx-connector@0.30.0
  - @labre/affine-gfx-group@0.30.0
  - @labre/affine-gfx-mindmap@0.30.0
  - @labre/affine-gfx-note@0.30.0
  - @labre/affine-gfx-pointer@0.30.0
  - @labre/affine-gfx-text@0.30.0
  - @labre/affine-inline-preset@0.30.0
  - @labre/affine-rich-text@0.30.0
  - @labre/affine-shared@0.30.0
  - @labre/affine-widget-edgeless-selected-rect@0.30.0
  - @labre/affine-widget-edgeless-toolbar@0.30.0
  - @labre/affine-ext-loader@0.30.0
  - @labre/global@0.30.0
  - @labre/store@0.30.0

## 0.29.1

### Patch Changes

- @labre/affine-block-attachment@0.29.1
- @labre/affine-block-bookmark@0.29.1
- @labre/affine-block-database@0.29.1
- @labre/affine-block-edgeless-text@0.29.1
- @labre/affine-block-embed@0.29.1
- @labre/affine-block-frame@0.29.1
- @labre/affine-block-image@0.29.1
- @labre/affine-block-note@0.29.1
- @labre/affine-block-paragraph@0.29.1
- @labre/affine-block-surface@0.29.1
- @labre/affine-components@0.29.1
- @labre/data-view@0.29.1
- @labre/affine-ext-loader@0.29.1
- @labre/affine-gfx-brush@0.29.1
- @labre/affine-gfx-connector@0.29.1
- @labre/affine-gfx-group@0.29.1
- @labre/affine-gfx-mindmap@0.29.1
- @labre/affine-gfx-note@0.29.1
- @labre/affine-gfx-pointer@0.29.1
- @labre/affine-gfx-shape@0.29.1
- @labre/affine-gfx-text@0.29.1
- @labre/affine-inline-preset@0.29.1
- @labre/affine-model@0.29.1
- @labre/affine-rich-text@0.29.1
- @labre/affine-shared@0.29.1
- @labre/affine-widget-edgeless-selected-rect@0.29.1
- @labre/affine-widget-edgeless-toolbar@0.29.1
- @labre/global@0.29.1
- @labre/std@0.29.1
- @labre/store@0.29.1

## 0.29.0

### Minor Changes

- 9330750: Add an enumerable, host-overridable keyboard shortcut system (#30, phase 1).

  - `ShortcutDescriptor` + `ShortcutExtension` register shortcuts that are both
    manifest entries and binding sources; `ShortcutKeymapExtension` installs the
    effective keymap via the normal dispatcher mechanism.
  - `KeymapOverrideExtension(overrides)` lets the host rebind by id
    (`{ undo: ['Ctrl','Shift','Z'] }`) or disable (`'disabled'`); the effective
    combo is `override ?? default`.
  - Combo conflicts within a scope are reported (via an optional
    `ShortcutConflictReporterExtension`, else the console) and the duplicate is
    never bound silently.
  - Core `undo` / `redo` are migrated from the imperative page keymap to core
    descriptors, so they are now enumerable and rebindable.

  The framework-aware manifest (`getShortcutManifest(flags)`) and per-framework
  contributions are phase 2.

### Patch Changes

- 7aab287: Add `getShortcutManifest(flags)` (#30, phase 2): the enumerable, framework-aware
  shortcut manifest for a host "Shortcuts" settings panel. It returns the core
  shortcuts plus the shortcuts contributed by the currently-enabled frameworks
  (flag-gated like `getInternalViewExtensions`), as metadata-only entries (no
  runtime handler). Enumerable without an editor instance. Exposed at
  `@labre/affine/shortcuts`. The per-framework contribution seam is ready
  (`coreShortcuts` is now exported from the root block); no framework ships
  shortcuts yet, so the manifest currently returns core only.
- Updated dependencies [7375b9a]
- Updated dependencies [3a3c99b]
- Updated dependencies [43462b5]
- Updated dependencies [054423b]
- Updated dependencies [ab409c5]
- Updated dependencies [40db887]
- Updated dependencies [9330750]
  - @labre/affine-shared@0.29.0
  - @labre/affine-gfx-mindmap@0.29.0
  - @labre/std@0.29.0
  - @labre/affine-block-attachment@0.29.0
  - @labre/affine-block-bookmark@0.29.0
  - @labre/affine-block-database@0.29.0
  - @labre/affine-block-edgeless-text@0.29.0
  - @labre/affine-block-embed@0.29.0
  - @labre/affine-block-frame@0.29.0
  - @labre/affine-block-image@0.29.0
  - @labre/affine-block-note@0.29.0
  - @labre/affine-block-paragraph@0.29.0
  - @labre/affine-block-surface@0.29.0
  - @labre/affine-components@0.29.0
  - @labre/data-view@0.29.0
  - @labre/affine-gfx-brush@0.29.0
  - @labre/affine-gfx-connector@0.29.0
  - @labre/affine-gfx-group@0.29.0
  - @labre/affine-gfx-note@0.29.0
  - @labre/affine-gfx-pointer@0.29.0
  - @labre/affine-gfx-shape@0.29.0
  - @labre/affine-gfx-text@0.29.0
  - @labre/affine-inline-preset@0.29.0
  - @labre/affine-rich-text@0.29.0
  - @labre/affine-widget-edgeless-selected-rect@0.29.0
  - @labre/affine-widget-edgeless-toolbar@0.29.0
  - @labre/affine-model@0.29.0
  - @labre/affine-ext-loader@0.29.0
  - @labre/global@0.29.0
  - @labre/store@0.29.0

## 0.28.0

### Patch Changes

- Updated dependencies [1cd6c92]
- Updated dependencies [65cc055]
  - @labre/affine-block-database@0.28.0
  - @labre/data-view@0.28.0
  - @labre/std@0.28.0
  - @labre/affine-block-attachment@0.28.0
  - @labre/affine-block-bookmark@0.28.0
  - @labre/affine-block-edgeless-text@0.28.0
  - @labre/affine-block-embed@0.28.0
  - @labre/affine-block-frame@0.28.0
  - @labre/affine-block-image@0.28.0
  - @labre/affine-block-note@0.28.0
  - @labre/affine-block-paragraph@0.28.0
  - @labre/affine-block-surface@0.28.0
  - @labre/affine-components@0.28.0
  - @labre/affine-gfx-brush@0.28.0
  - @labre/affine-gfx-connector@0.28.0
  - @labre/affine-gfx-group@0.28.0
  - @labre/affine-gfx-mindmap@0.28.0
  - @labre/affine-gfx-note@0.28.0
  - @labre/affine-gfx-pointer@0.28.0
  - @labre/affine-gfx-shape@0.28.0
  - @labre/affine-gfx-text@0.28.0
  - @labre/affine-inline-preset@0.28.0
  - @labre/affine-model@0.28.0
  - @labre/affine-rich-text@0.28.0
  - @labre/affine-shared@0.28.0
  - @labre/affine-widget-edgeless-selected-rect@0.28.0
  - @labre/affine-widget-edgeless-toolbar@0.28.0
  - @labre/affine-ext-loader@0.28.0
  - @labre/global@0.28.0
  - @labre/store@0.28.0

## 0.27.0

### Minor Changes

- 91f6397: Round out the canvas element link feature (edit / remove / groups / a11y).

  - The context menu is now link-state aware: an unlinked element shows **Link**,
    a linked one shows **Edit link** (re-pick a doc or URL) and **Remove link**
    (clears the stored target). External-URL links now emit a `Link` telemetry
    event, matching the existing `LinkedDocCreated` for doc links.
  - The hover arrow now resolves to the nearest **linked group**: hovering a child
    of a group that carries a link shows the arrow on the group's bounds (a child
    with its own link still wins).
  - The hover arrow is keyboard accessible: `role="button"`, focusable, with an
    `aria-label`/`title` and Enter/Space activation.
  - **Link** / **Edit link** are hidden when the host does not provide
    `QuickSearchProvider` (they would otherwise no-op); **Remove link** stays
    available since clearing needs no picker.

- 91f6397: Link a canvas drawing element to an existing doc or an external URL.

  A new **Link** item in the edgeless element context menu opens the same
  quick-search modal as the existing link feature (doc of the workspace _or_ an
  internet URL) and attaches the chosen target to the selected drawing element
  (shape, text, connector, group — anything but blocks/frames). The link is
  stored as two optional fields on the surface element base model
  (`externalLink` / `linkedDocId`), which are backward-compatible (old documents
  read `undefined`, no migration).

  When the linked element is hovered on the canvas, a small arrow button appears
  (via the `edgeless-element-link` widget): clicking it opens the doc in the host
  side-view (through `docLinkClicked`) or the URL in a new tab. Minimal by
  design — no embed card, unlike "Create linked doc".

  Out of scope for v1: links on block-type canvas elements (image / note /
  bookmark), selecting-time affordance, and editing/removing the link from the
  menu.

### Patch Changes

- Updated dependencies [14ef3e7]
- Updated dependencies [91f6397]
- Updated dependencies [91f6397]
  - @labre/affine-block-database@0.27.0
  - @labre/affine-widget-edgeless-selected-rect@0.27.0
  - @labre/std@0.27.0
  - @labre/affine-block-attachment@0.27.0
  - @labre/affine-block-bookmark@0.27.0
  - @labre/affine-block-edgeless-text@0.27.0
  - @labre/affine-block-embed@0.27.0
  - @labre/affine-block-frame@0.27.0
  - @labre/affine-block-image@0.27.0
  - @labre/affine-block-note@0.27.0
  - @labre/affine-block-paragraph@0.27.0
  - @labre/affine-block-surface@0.27.0
  - @labre/affine-components@0.27.0
  - @labre/data-view@0.27.0
  - @labre/affine-gfx-brush@0.27.0
  - @labre/affine-gfx-connector@0.27.0
  - @labre/affine-gfx-group@0.27.0
  - @labre/affine-gfx-mindmap@0.27.0
  - @labre/affine-gfx-note@0.27.0
  - @labre/affine-gfx-pointer@0.27.0
  - @labre/affine-gfx-shape@0.27.0
  - @labre/affine-gfx-text@0.27.0
  - @labre/affine-inline-preset@0.27.0
  - @labre/affine-model@0.27.0
  - @labre/affine-rich-text@0.27.0
  - @labre/affine-shared@0.27.0
  - @labre/affine-widget-edgeless-toolbar@0.27.0
  - @labre/affine-ext-loader@0.27.0
  - @labre/global@0.27.0
  - @labre/store@0.27.0

## 0.26.0

### Patch Changes

- Updated dependencies [8960a6c]
- Updated dependencies [6795191]
  - @labre/affine-block-database@0.26.0
  - @labre/affine-model@0.26.0
  - @labre/affine-components@0.26.0
  - @labre/affine-gfx-mindmap@0.26.0
  - @labre/affine-block-attachment@0.26.0
  - @labre/affine-block-bookmark@0.26.0
  - @labre/affine-block-edgeless-text@0.26.0
  - @labre/affine-block-embed@0.26.0
  - @labre/affine-block-frame@0.26.0
  - @labre/affine-block-image@0.26.0
  - @labre/affine-block-note@0.26.0
  - @labre/affine-block-paragraph@0.26.0
  - @labre/affine-block-surface@0.26.0
  - @labre/affine-gfx-brush@0.26.0
  - @labre/affine-gfx-connector@0.26.0
  - @labre/affine-gfx-group@0.26.0
  - @labre/affine-gfx-note@0.26.0
  - @labre/affine-gfx-pointer@0.26.0
  - @labre/affine-gfx-shape@0.26.0
  - @labre/affine-gfx-text@0.26.0
  - @labre/affine-inline-preset@0.26.0
  - @labre/affine-rich-text@0.26.0
  - @labre/affine-shared@0.26.0
  - @labre/affine-widget-edgeless-selected-rect@0.26.0
  - @labre/affine-widget-edgeless-toolbar@0.26.0
  - @labre/data-view@0.26.0
  - @labre/affine-ext-loader@0.26.0
  - @labre/global@0.26.0
  - @labre/std@0.26.0
  - @labre/store@0.26.0

## 0.25.0

### Patch Changes

- Updated dependencies [8960a6c]
- Updated dependencies [6795191]
  - @labre/affine-block-database@0.25.0
  - @labre/affine-model@0.25.0
  - @labre/affine-components@0.25.0
  - @labre/affine-gfx-mindmap@0.25.0
  - @labre/affine-block-attachment@0.25.0
  - @labre/affine-block-bookmark@0.25.0
  - @labre/affine-block-edgeless-text@0.25.0
  - @labre/affine-block-embed@0.25.0
  - @labre/affine-block-frame@0.25.0
  - @labre/affine-block-image@0.25.0
  - @labre/affine-block-note@0.25.0
  - @labre/affine-block-paragraph@0.25.0
  - @labre/affine-block-surface@0.25.0
  - @labre/affine-gfx-brush@0.25.0
  - @labre/affine-gfx-connector@0.25.0
  - @labre/affine-gfx-group@0.25.0
  - @labre/affine-gfx-note@0.25.0
  - @labre/affine-gfx-pointer@0.25.0
  - @labre/affine-gfx-shape@0.25.0
  - @labre/affine-gfx-text@0.25.0
  - @labre/affine-inline-preset@0.25.0
  - @labre/affine-rich-text@0.25.0
  - @labre/affine-shared@0.25.0
  - @labre/affine-widget-edgeless-selected-rect@0.25.0
  - @labre/affine-widget-edgeless-toolbar@0.25.0
  - @labre/data-view@0.25.0
  - @labre/affine-ext-loader@0.25.0
  - @labre/global@0.25.0
  - @labre/std@0.25.0
  - @labre/store@0.25.0

## 0.24.0

### Patch Changes

- Updated dependencies [bc31490]
- Updated dependencies [bc31490]
  - @labre/affine-gfx-mindmap@0.24.0
  - @labre/affine-block-attachment@0.24.0
  - @labre/affine-block-bookmark@0.24.0
  - @labre/affine-block-database@0.24.0
  - @labre/affine-block-edgeless-text@0.24.0
  - @labre/affine-block-embed@0.24.0
  - @labre/affine-block-frame@0.24.0
  - @labre/affine-block-image@0.24.0
  - @labre/affine-block-note@0.24.0
  - @labre/affine-block-paragraph@0.24.0
  - @labre/affine-block-surface@0.24.0
  - @labre/affine-components@0.24.0
  - @labre/data-view@0.24.0
  - @labre/affine-ext-loader@0.24.0
  - @labre/affine-gfx-brush@0.24.0
  - @labre/affine-gfx-connector@0.24.0
  - @labre/affine-gfx-group@0.24.0
  - @labre/affine-gfx-note@0.24.0
  - @labre/affine-gfx-pointer@0.24.0
  - @labre/affine-gfx-shape@0.24.0
  - @labre/affine-gfx-text@0.24.0
  - @labre/affine-inline-preset@0.24.0
  - @labre/affine-model@0.24.0
  - @labre/affine-rich-text@0.24.0
  - @labre/affine-shared@0.24.0
  - @labre/affine-widget-edgeless-selected-rect@0.24.0
  - @labre/affine-widget-edgeless-toolbar@0.24.0
  - @labre/global@0.24.0
  - @labre/std@0.24.0
  - @labre/store@0.24.0

## 0.23.3

### Patch Changes

- Updated dependencies
  - @labre/affine-shared@0.23.3
  - @labre/affine-block-attachment@0.23.3
  - @labre/affine-block-bookmark@0.23.3
  - @labre/affine-block-database@0.23.3
  - @labre/affine-block-edgeless-text@0.23.3
  - @labre/affine-block-embed@0.23.3
  - @labre/affine-block-frame@0.23.3
  - @labre/affine-block-image@0.23.3
  - @labre/affine-block-note@0.23.3
  - @labre/affine-block-paragraph@0.23.3
  - @labre/affine-block-surface@0.23.3
  - @labre/affine-components@0.23.3
  - @labre/data-view@0.23.3
  - @labre/affine-gfx-brush@0.23.3
  - @labre/affine-gfx-connector@0.23.3
  - @labre/affine-gfx-group@0.23.3
  - @labre/affine-gfx-mindmap@0.23.3
  - @labre/affine-gfx-note@0.23.3
  - @labre/affine-gfx-pointer@0.23.3
  - @labre/affine-gfx-shape@0.23.3
  - @labre/affine-gfx-text@0.23.3
  - @labre/affine-inline-preset@0.23.3
  - @labre/affine-rich-text@0.23.3
  - @labre/affine-widget-edgeless-selected-rect@0.23.3
  - @labre/affine-widget-edgeless-toolbar@0.23.3
  - @labre/affine-ext-loader@0.23.3
  - @labre/affine-model@0.23.3
  - @labre/global@0.23.3
  - @labre/std@0.23.3
  - @labre/store@0.23.3

## 0.23.2

### Patch Changes

- Updated dependencies [ee682da]
  - @labre/affine-shared@0.23.2
  - @labre/affine-block-attachment@0.23.2
  - @labre/affine-block-bookmark@0.23.2
  - @labre/affine-block-database@0.23.2
  - @labre/affine-block-edgeless-text@0.23.2
  - @labre/affine-block-embed@0.23.2
  - @labre/affine-block-frame@0.23.2
  - @labre/affine-block-image@0.23.2
  - @labre/affine-block-note@0.23.2
  - @labre/affine-block-paragraph@0.23.2
  - @labre/affine-block-surface@0.23.2
  - @labre/affine-components@0.23.2
  - @labre/data-view@0.23.2
  - @labre/affine-gfx-brush@0.23.2
  - @labre/affine-gfx-connector@0.23.2
  - @labre/affine-gfx-group@0.23.2
  - @labre/affine-gfx-mindmap@0.23.2
  - @labre/affine-gfx-note@0.23.2
  - @labre/affine-gfx-pointer@0.23.2
  - @labre/affine-gfx-shape@0.23.2
  - @labre/affine-gfx-text@0.23.2
  - @labre/affine-inline-preset@0.23.2
  - @labre/affine-rich-text@0.23.2
  - @labre/affine-widget-edgeless-selected-rect@0.23.2
  - @labre/affine-widget-edgeless-toolbar@0.23.2
  - @labre/affine-ext-loader@0.23.2
  - @labre/affine-model@0.23.2
  - @labre/global@0.23.2
  - @labre/std@0.23.2
  - @labre/store@0.23.2

## 0.23.1

### Patch Changes

- Updated dependencies [1beb60e]
  - @labre/affine-shared@0.23.1
  - @labre/affine-block-attachment@0.23.1
  - @labre/affine-block-bookmark@0.23.1
  - @labre/affine-block-database@0.23.1
  - @labre/affine-block-edgeless-text@0.23.1
  - @labre/affine-block-embed@0.23.1
  - @labre/affine-block-frame@0.23.1
  - @labre/affine-block-image@0.23.1
  - @labre/affine-block-note@0.23.1
  - @labre/affine-block-paragraph@0.23.1
  - @labre/affine-block-surface@0.23.1
  - @labre/affine-components@0.23.1
  - @labre/data-view@0.23.1
  - @labre/affine-gfx-brush@0.23.1
  - @labre/affine-gfx-connector@0.23.1
  - @labre/affine-gfx-group@0.23.1
  - @labre/affine-gfx-mindmap@0.23.1
  - @labre/affine-gfx-note@0.23.1
  - @labre/affine-gfx-pointer@0.23.1
  - @labre/affine-gfx-shape@0.23.1
  - @labre/affine-gfx-text@0.23.1
  - @labre/affine-inline-preset@0.23.1
  - @labre/affine-rich-text@0.23.1
  - @labre/affine-widget-edgeless-selected-rect@0.23.1
  - @labre/affine-widget-edgeless-toolbar@0.23.1
  - @labre/affine-ext-loader@0.23.1
  - @labre/affine-model@0.23.1
  - @labre/global@0.23.1
  - @labre/std@0.23.1
  - @labre/store@0.23.1

## 0.23.0

### Patch Changes

- Updated dependencies [9014c87]
- Updated dependencies [c775151]
- Updated dependencies [d2f435f]
  - @labre/affine-model@0.23.0
  - @labre/affine-block-surface@0.23.0
  - @labre/affine-shared@0.23.0
  - @labre/affine-widget-edgeless-toolbar@0.23.0
  - @labre/affine-block-attachment@0.23.0
  - @labre/affine-block-bookmark@0.23.0
  - @labre/affine-block-database@0.23.0
  - @labre/affine-block-edgeless-text@0.23.0
  - @labre/affine-block-embed@0.23.0
  - @labre/affine-block-frame@0.23.0
  - @labre/affine-block-image@0.23.0
  - @labre/affine-block-note@0.23.0
  - @labre/affine-block-paragraph@0.23.0
  - @labre/affine-components@0.23.0
  - @labre/affine-gfx-brush@0.23.0
  - @labre/affine-gfx-connector@0.23.0
  - @labre/affine-gfx-group@0.23.0
  - @labre/affine-gfx-mindmap@0.23.0
  - @labre/affine-gfx-note@0.23.0
  - @labre/affine-gfx-pointer@0.23.0
  - @labre/affine-gfx-shape@0.23.0
  - @labre/affine-gfx-text@0.23.0
  - @labre/affine-inline-preset@0.23.0
  - @labre/affine-rich-text@0.23.0
  - @labre/affine-widget-edgeless-selected-rect@0.23.0
  - @labre/data-view@0.23.0
  - @labre/affine-ext-loader@0.23.0
  - @labre/global@0.23.0
  - @labre/std@0.23.0
  - @labre/store@0.23.0
