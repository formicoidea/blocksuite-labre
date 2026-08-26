# @labre/affine

## 0.32.0

### Minor Changes

- bb482e8: The AI audit seam, for a host-side assistant (PF14.1)
  A framework can now declare **audit criteria** as versioned data, and a host can
  plug an assistant in to evaluate them. The library ships the seam and nothing
  else: no model, no prompt runner, and no dependency on one. Wardley ships the
  first three criteria — A1 positioning is justified (contextual ubiquity, not
  technical maturity), A2 the value chain is legible, A3 the model applies here
  (competitive landscapes only). See `docs/adr/0008` § surface `'agent'`.
  **The invariant.** The deterministic engine never depends on the AI. Levels 1
  and 2 — the rules evaluated inside the 16 ms frame budget — are computed,
  rendered and arbitrated with no knowledge that the seam exists. Audit results
  land in a **separate signal** (`ValidationManager.auditFindings# @labre/affine
), never in
  `violations# @labre/affine
  , and their severity is forced to `audit` library-side rather than
  trusted, so a provider cannot put a model's opinion behind a canvas bracket. A
  bench asserts the numeric half: a board carrying a finding per element re-judges
  in the same time as a clean one.
  **What hosts get.**
  1. `AuditExtension(service)` injects an `AuditService`:

     ```ts
     runAudit(
       request: { criteria: AuditCriterion[]; facts: AuditFacts },
       options: { onProgress?: (p: AuditProgress) => void; signal?: AbortSignal }
     ): Promise<AuditResult>
     ```

     `facts` is render-free and serializable end to end (ADR 0006 § 5): the role
     vocabulary, each framework frame with its axes and named zones as plot
     ratios, every role-carrying element placed inside its frame, and the level
     1/2 findings the engine already computed. No element model, no `Bound`, no
     template, no function — it survives a `postMessage`.

  2. The `map.audit` command, on the `'agent'` and `'palette'` surfaces,
     `availability: 'selection:framework'`, keyless but bindable.

  3. Three telemetry events — `MapAuditStarted`, `MapAuditCompleted`,
     `MapAuditInterrupted` — carrying counts and ids only.
  **A new switch axis: `OPTIONAL_CAPABILITIES`.** `ai-audit` gates the command,
  with the same contract as a block flag (missing key = enabled, disabling removes
  tooling only) but on its **own list**, because `OPTIONAL_BLOCKS` answers "does
  this block or framework exist for this user" and every entry there names
  something a document can contain. A capability names none. Hosts still pass one
  object: `LabreFlags = BlockFlags & CapabilityFlags`, and the two key spaces are
  disjoint, so a host that only ever spoke `BlockFlags` keeps compiling and
  behaving identically.
  Nothing here is persisted — criteria are code, findings are session state — so
  switching `ai-audit` off cannot lose data even in principle.
  **The request is isolated on the way out.** `requestAudit` hands the provider a
  `structuredClone` of the request, not the caller's objects. This is the outbound
  half of "a provider is not believed", symmetric with the finding normalisation:
  some facts are not fresh objects — an axis `forward` vector came straight from a
  module constant the engine multiplies against — so a provider writing into its
  own input could flip an axis convention and turn correct arrows into violations
  on the canvas. The clone closes the whole class, at a cost the seam already
  claims (the request must be serializable).
  **Two audits at once: the newest wins.** An audit is a network call and takes
  seconds, so a user asking again while the first is in flight is ordinary. Runs
  carry a generation; a run superseded by a newer one publishes nothing and
  reports `MapAuditInterrupted` with `reason: 'superseded'` rather than a
  completion whose `findingCount` describes findings nobody will see.
  **Degradation is the default path.** No noop provider is registered. With none
  injected (the standalone playground, every unit suite), `map.audit` is still
  enumerable but refuses cleanly with `status: 'unavailable'` — not a throw, not a
  console error — and levels 1 and 2 are untouched. A registered provider may also
  _declare_ itself unavailable (assistant behind an app-side feature flag, quota
  exhausted, no model configured); that is passed through rather than folded into
  `complete`. A provider that throws becomes `status: 'error'`; an abort, whatever
  shape it arrives in, becomes `status: 'aborted'` and **keeps the findings already
  produced**.
  **Host panels must tolerate stale element ids.** `AuditFinding.elementIds` is
  checked for type and not validated against the surface: the board moves on while
  an audit is in flight, so an id naming a departed element is stale rather than
  wrong, and a lookup per id would be paid on every finding to say so.
  **`map.audit` carries no read-only guard, deliberately.** Unlike `pivot.bind`,
  it writes nothing: reviewing a map you have been given and cannot change is not
  an edge case for an audit, it is the case. A test asserts it runs to completion
  against a read-only store that throws on any write.
- 612c859: One command registry behind every surface (PF3)

  Every framework artefact is now declared exactly once, as a `CommandDescriptor`
  in `@labre/std`. The senior button sub-menu, the keyboard bindings and
  Settings › Shortcuts all read that one list instead of each keeping their own
  — which is how Wardley's menu had drifted to 13 artefacts against 7 in the
  shortcut manifest, and how EDGY, BPMN, Cynefin/Estuarine and the three DDD
  palettes were completely absent from Settings › Shortcuts. See
  `docs/adr/0008`.

  60 framework commands were converted in one release (wardley 13, edgy 7, bpmn
  6, cynefin-estuarine 3, ddd-event-storming 9, ddd-core-domain 10,
  ddd-context-map 12), plus the 6 core ones.

  **What users see.** Settings › Shortcuts grows from ~10 rows to 66: every
  command is listed and bindable, including the ~53 that ship with no default
  chord. The effective keymap is unchanged — the same combos trigger the same
  actions, and existing override tables keep working (a golden test compares the
  resolved keymap, per platform and per scope, against the pre-switchover one).
  Cynefin/Estuarine starts reporting telemetry, which it never did.

  **What hosts must change.**

  1. `ShortcutManifestEntry` changes shape. It still describes shortcuts and
     nothing else — no `iconKey`, no `category` — but `when?: string` is gone (no
     descriptor in the library ever set it), `defaultKeys` is always present, and
     `owner` narrows from `string` to `CommandOwner`. Recompile; nothing changes
     at runtime.
  2. Framework bundles' `descriptor.ts` renames `telemetry` to `telemetryKey`,
     which now carries the historical analytics value in every case (it used to
     echo the flag key, so the three DDD bundles advertised a value the library
     never sent):

     ```diff
     - import { dddEventStormingFramework } from '@formicoidea/labre-framework-ddd-event-storming/descriptor';
     - registerFramework(dddEventStormingFramework.telemetry);   // 'ddd-event-storming'
     + registerFramework(dddEventStormingFramework.telemetryKey); // 'event-storming'
     ```

  3. Menu tooltips are i18n keys now (`com.labre.commands.<id>`). Each command
     also ships the English wording it replaced as a fallback, so a host with no
     catalogue entry reads exactly as before — but a host that wants them
     localised must extend its catalogue with the new keys. **No existing key was
     renamed**: `com.affine.keyboardShortcuts.*` and the seven
     `com.labre.keyboardShortcuts.wardley.*` are carried over verbatim.
  4. **`undo` / `redo` now stop propagation.** Their handlers used to return
     `undefined` after `preventDefault()`, so the keystroke kept travelling; the
     projection returns `true` uniformly. Nothing inside the editor was reading
     `Mod-z` / `Shift-Mod-z` — they are the only handlers bound to those combos —
     but **an application listener mounted above the editor will no longer see
     those keystrokes**. This does not fail at compile time; if you rely on it,
     listen in the capture phase.
  5. New entry points: `@labre/affine/commands` (`getCommands`,
     `getCommandManifest`, `getCommandManifestForSurface`) and
     `@labre/affine/frameworks` (`FRAMEWORK_DESCRIPTORS` — per-framework label,
     icon, chord prefix, analytics keys and packaging, the identity that was
     previously spelled five times and had drifted).

  **Analytics are unaffected.** The per-menu `track()` helpers are gone; emission
  happens once, in the registry's `run()`. `framework` and `segment` keep their
  historical PostHog values through `FrameworkDescriptor.telemetryKey` /
  `telemetrySegment`, and events gain one field — `control`, naming which surface
  invoked the command. Existing dashboards keep working untouched.

  Disabling a framework's flag now removes its commands from the registry, the
  keymap and the sub-menu at once, while its already-drawn elements keep painting
  as before.

  **Known limitation.** Telemetry reports that a command was _invoked_, not that
  its gesture _completed_: `edgy.insertDynamic` is asynchronous and emits while
  its template insertion is still pending. That was already true of the per-menu
  `track()` it replaces, so no metric changes — but it is now one central
  decision rather than five scattered ones, and therefore worth revisiting when
  outcome-level reporting is needed.

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

- 499b305: Add a font size selector to the edgeless text toolbar

  The context toolbar of a free text component on the canvas offered font,
  color, style and alignment but no size — the only way to size text was
  dragging the selection handles, which makes consistent sizing across a board
  tedious. The edgeless text block has no `fontSize` prop by design (its visual
  size is `scale` over the 15px base font), so the new dropdown drives `scale`:
  presets (16–128) plus a custom integer input, displayed as the pixel size
  users reason about. Picking a size rescales the block exactly like
  ratio-locked corner resizing (top-left anchored, layout width preserved, so
  text wrapping does not change), and undo restores each step.

  Also registers the surface and edgeless-text packages in the root vitest
  workspace so their unit tests run in CI.

- 3c5c97e: feat(edgeless): map quality — a checklist you tick and a check-up you ask for (PF5.14, PF7.10, PF7.11, PF13.8, PF13.9)
  A rule only belongs in the real-time engine if an algorithm can decide it, on
  persisted data, inside the 16 ms budget. Everything else was homeless. This
  slice gives it a home: a **Map quality** panel on the framework's own instance,
  with the things the tool cannot judge on one side and the things it can — but
  that are not urgent — on the other.
  - **A check-up is about ONE map.** It walks the whole surface — that is where
    the elements are — but the answer is narrowed to the instance the user asked
    about, on the `backgroundId` every family measuring against a frame already
    records. A board carrying two Wardley maps holds two independent answers, and
    a panel showing the neighbour's would be the whole-surface tally the majority
    family goes out of its way not to compute. Narrowed in the engine, not at the
    rendering, so a run reaching a host or the agent is already about one map; the
    run names its instance, and the panel refuses one that is not its own.
  - **A second evaluation moment.** A rule now carries `moment: 'realtime'`
    (the default, and what every rule written so far means) or `'on-demand'`. An
    on-demand rule is not filtered out of the drawing path, it never enters it:
    the moment is tested before the rule reaches a profile lookup, let alone an
    element — and in the frame bookkeeping the manager does around the evaluation,
    which is a full surface walk per rule once per tick and would otherwise have
    handed the drawing budget back exactly what the second moment took away
    (+58 %, and invisible to a bench that times the evaluation alone). Its results
    land on `ValidationManager.checkup# @labre/affine
, a signal of its
    own — so they never reach the timeline, the bracket or the badge, and "outside
    the canvas affordance" is a property of the wiring rather than a filter
    somebody has to remember. A run carries one timestamp, taken when the user
    asked, and yields the thread between rules once it has held it for a frame,
    reporting `done / total`as it goes. A run started while another is still
    yielding supersedes it. A rule that throws ends the run _visibly_ — reported
    finished, carrying`error` — because the one thing a failure must not do is
    leave the panel believing a check-up is in flight, which reads as "Checking…"
    for ever and disables the only button that could try again.
  - **Nudges: expectations the tool cannot check, and does not pretend to.** A
    framework declares them as data — `{ id, framework, labelKey, fallback }` —
    and nothing ever evaluates them. They are offered as a checklist, and ticking
    one is the same gesture as granting an exception: the user says "I have taken
    care of this", and the tool records that rather than claiming to have looked.
  - **One entry, in the dropdown that was built for it.** PF9's Validation
    dropdown was written to render SECTIONS and shipped with one; Map quality is
    the second. It opens a panel — four boxes to tick, a **Run check-up** button
    and the remarks that come back — because a menu that closes on the first click
    is the wrong shape for a surface you work in. The same panel is reachable from
    the command registry (`validation.mapQuality`, palette and agent), so it is
    one command with several surfaces rather than two implementations.
  - **Generic, not Wardley.** Nothing in the panel, the entry or the command names
    a framework, a role or a rule. Whether an instance has a checklist or a
    check-up is derived from what the frameworks registered, exactly as the
    profile picker already derives which profiles it may offer. A second framework
    declaring either gets all of it with no code written anywhere.
  - **Wardley Q1–Q4** ship as data: the title that frames the study, the context,
    the legend, the evolution axis being used and legended. Four things a map needs
    in order to be discussed, and not one of them decidable by a machine.
  - **Wardley Q5 — the tone convention.** A new `tone-convention` rule family: the
    landscape is drawn in greys, red is reserved for what is moving and green for
    benefits. The sanctioned tones are named against the frame's OWN declared
    palette (three new entries: `landscape`, `change`, `benefit`), so a rule
    restates no colour the background owns and a host restyling the frame restyles
    the convention with it. The comparison is by tone family, never byte for byte,
    or every legitimate shade of grey the shape toolbar can produce would be a
    finding. A colour the engine cannot honestly read — a theme variable with no
    tone in its name, a gradient, `transparent`, the stored fill of an unfilled
    shape — yields silence rather than a guess.
  - **Wardley Q6 — shipped inert.** "Most of what you have mapped is an activity;
    the phase names for activities would read better" needs the type-3 **nature**.
    The new `majority-fact` family is built for a fact that may not be there yet:
    a surface where not one subject carries it raises nothing, silently, per map.
    MF3 has since landed the nature — as a tag def pack, with the qualification in
    the element's `tags` (a nested `Y.Map<string[]>`), not as the flat prop this
    family reads. So Q6 still says nothing, now because the fact sits somewhere
    `majority-fact` does not look. Teaching a generic engine family to read a tag
    is its own slice; until then the gap is pinned by two assertions that state
    both ends — the tag id that exists and the flat prop that does not — so it
    cannot rot into "later means never".
  Two new telemetry events, `MapQualityNudgeToggled` and `MapQualityCheckupRun`,
  carry the framework, the nudge id and the counts — never board content. A nudge
  everybody ticks immediately is a reminder nobody needed; a nudge nobody ever
  ticks is an expectation the tool failed to make actionable. Nothing else can say
  either, because nothing here is ever computed.
  **Persistence.** One new optional `@field()` on the base element model,
  `qualityChecklist: string[]` — the ids ticked on the instance. Declared on the
  BASE class for the same reason `role`, `validationExceptions` and
  `validationProfile` are: an element re-created from props only reaches the Y.Map
  through declared accessors, so a per-subclass declaration would be silently
  dropped on copy. Its default is `undefined` and is never written, so an instance
  with nothing ticked stays byte-identical to one created before the field
  existed: no block schema change, no version bump, no migration, and documents
  written before and after remain mutually loadable. Unticking the last one removes
  the KEY through `clearField` rather than leaving an empty array behind, so an
  emptied checklist is byte-identical again too — in the document, and not merely
  through the getter. Ids of nudges no framework declares any more are kept rather
  than pruned: the tooling comes and goes with a flag, the decisions recorded on it
  do not. `setNudgeChecked` enforces read-only itself, at the seam, like
  `setProfile` and `setException` do: a disabled checkbox covers exactly one
  caller, and `clearField` goes through `Store.transact`, which — unlike
  `addBlock` / `updateBlock` / `deleteBlock` — carries no read-only guard of its
  own, so unticking would genuinely delete the key from a document nobody may edit.
  **Cost.** Measured, not asserted: registering the two Wardley check-up rules
  beside the three real-time ones leaves both the verdict and the timing of the
  drawing path unchanged on the 500-element reference map. The two timings are
  measured on INTERLEAVED samples, because taken one after the other they compare
  two moments in the runner's life as much as two rule sets — the same evaluation
  drifts by half again between back-to-back medians, which is several times the
  effect being looked for. That is the whole point of the second moment.
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

- 3e1665b: The reversed reading comes back from the PO recette of 02/08/2026 with a place
  of its own and a sentence it was missing.

  **It is no longer hidden behind the toolbars.** The proposal shipped as a bubble
  floating beside the element, and it rendered BEHIND the contextual toolbar: the
  widget host sat at `z-index: 2`, while `editor-toolbar` takes
  `--affine-z-index-popover`, which the theme sets to `1000`. It is now anchored
  to the EDITOR — bottom-centre, at a comfortable 480px measure instead of the
  300px of a bubble — in a layer above every toolbar, the senior menu and its
  sub-menu included. The panel is what the user is reading; the toolbars can wait
  underneath it.

  The layer is `calc(var(--affine-z-index-popover, 1000) + 10)`, set on the HOST
  rather than on the panel, because every widget host is a sibling in
  `.widgets-container` and `affine-toolbar-widget` declares no stacking context of
  its own — that sibling level is where the contest is actually decided. The
  fallback is not decoration: it is the host's theme stylesheet that defines the
  variable, never this library. What still paints above it, correctly, is what
  mounts outside the contained widgets layer: `popMenu` context menus and the
  toolbar drag preview.

  The host stays ZERO-SIZED, and that is not a style choice either:
  `.widgets-container > * { pointer-events: auto }` is an outer-tree rule on a
  shadowless component and beats `:host { pointer-events: none }` outright, so a
  host with a real box would swallow canvas clicks across the whole bottom of the
  board. The panel carries the box; the host only carries the anchor.

  A pan or a zoom no longer closes the panel. It closed because it hung off an
  element that the gesture moved out from under it; anchored to the editor,
  following what the reading is talking about while the reading is on screen is
  simply the obvious thing to want. A resize still re-renders it, because its box
  is clamped to the editor's.

  **A new section: value flow.** For each typed edge touching the component, one
  sentence saying which way the VALUE runs — up, from the supplier to the
  consumer: _"Value flows up from Kettle to Brewing tea"_. It is the opposite
  direction from the dependency arrow, which is the whole reason it deserves its
  own words: ADR 0010 § 2 fixes `source` as the consumer and `target` as what it
  needs, so a map read from the bottom up is a map read against its arrows. The
  section is derived from the relations already read — no second traversal, no
  second convention to keep in step with ADR 0010 — and an element with no typed
  link gets no section at all rather than an empty heading.

  Two i18n slots (`com.labre.reading.value-flow` and its `.to` suffix) so a host
  catalogue can put the halves where its own grammar wants them; the English
  fallback is what a silent host gets.

  `ElementReading` gains a `name` field — what the subject is CALLED, its own text
  or its label sibling's — because both ends of a flow sentence must be said by
  name, and every renderer re-deriving it was one renderer too many.

- 521accb: feat(blocks): flags gate tooling only — a disabled framework stays visible in documents

  Block flags used to decide whether a block was registered at all. A document
  containing a block or framework whose flag was off degraded on load: the schema
  was missing, the block and its whole subtree silently disappeared from the
  model, and snapshot export / copy-paste broke for the entire document.

  The contract is now reversed (see `docs/adr/0009`):

  - **Content is never gated.** `getAffineSchemas` and
    `getInternalStoreExtensions` register everything unconditionally. Every
    document opens, renders, round-trips and saves identically whatever the flags
    say — no deletion, no downgrade, no schema-validation failure on load. Both
    keep their `flags` parameter (now ignored) so existing calls compile
    unchanged.
  - **Only tooling is gated.** A flag removes the framework's senior toolbar
    button, its submenus, its Templates-panel category and its keyboard
    shortcuts. Turning a framework off no longer touches what is already drawn:
    elements keep painting, stay selectable and stay editable, and an OFF → ON
    cycle requires no re-entry of anything.
  - Brush, Wardley, EDGY, BPMN and Cynefin/Estuarine now expose two view
    extensions — an always-registered `…RenderViewExtension` and a flag-gated
    `…ViewExtension` — mirroring what Mindmap and DDD Core Domain already did.

  Consequence accepted: the bundle now always carries every framework's renderer,
  so a framework can no longer ship fully "dark" behind a flag.

  **BREAKING — published framework descriptors.** The four split framework
  bundles (`@formicoidea/labre-framework-{wardley,edgy,bpmn,cynefin}`) change the
  shape of their exported descriptor:

  ```diff
    export const wardleyFramework = {
      flag: 'wardley',
      telemetry: 'wardley',
  -   viewExtension: WardleyViewExtension,
  +   extensions: [
  +     { viewExtension: WardleyRenderViewExtension },
  +     { flag: 'wardley', viewExtension: WardleyViewExtension },
  +   ],
    } as const;
  ```

  `flag` and `telemetry` are unchanged. **`viewExtension` is removed** and is
  deliberately not aliased: no single extension has the old
  `flags[flag] ? register(viewExtension) : skip` semantics any more — aliasing it
  to the gated extension would leave the renderer unregistered even with the flag
  ON, and aliasing it to a composite would drop rendering with the flag OFF.

  Host migration — register every entry in `extensions`, applying `flag` only
  where present:

  ```ts
  const exts = wardleyFramework.extensions
    .filter(e => !e.flag || flags[e.flag] !== false)
    .map(e => e.viewExtension);
  ```

  `@formicoidea/labre-framework-ddd-core-domain` already shipped this list shape;
  the three single-extension DDD bundles keep the original shape untouched.

  Known residual: block view extensions (`database`, `code`, `image`, `frame`, …)
  still bundle renderer and tooling together, so a disabled _block_ renders as
  nothing. Its data is now safe in every case and comes back untouched when the
  flag is re-enabled.

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

- b889326: feat(blocks): every key the library will ever ask for, on one list

  A host wiring `TranslationProvider` had no way to build its catalogue except
  chasing `translateKey` call sites and `labelKey` declarations across the repo
  — and no way to know a library upgrade had added one. This slice closes the
  seam from the other side: the library now says, out loud and exhaustively,
  which keys it can ask for.

  - **`getTranslationKeyManifest()`** (`@labre/affine/translations`) — the i18n
    sibling of `getShortcutManifest` / `getCommandManifest`: every
    `com.labre.*` key with its English fallback and its source
    (`command`, `role`, `rule`, `profile`, `nudge`, `audit-criterion`,
    `reading`, `background`, `framework`, `chrome`), enumerable without an
    editor instance and flag-independent, so one catalogue serves whatever a
    host later toggles on. Data-declared keys are WALKED from the same runtime
    declarations the editor registers — a key added to a rule or a command
    appears by construction. The widget chrome literals, which live in lit
    templates, are restated once; a unit test scans the library source and
    fails when a used key is missing from the manifest, when a manifest entry
    is used by nobody, or when a restated fallback drifts from what the widget
    renders.
  - **The manifest is COMPOSED, not centralised.** Each framework package
    exports its own contribution (`wardleyTranslationEntries`,
    `edgyTranslationEntries`, …) and the core manifest assembles the chrome's
    entries with the frameworks' — the same shape the command registry already
    has, and for the same reason: `@formicoidea/labre-core` is the editor minus
    the frameworks, so a manifest that named them from the core side would be
    complete in the monorepo and 107 keys of 175 short in the distribution hosts
    actually consume. `scripts/build-bundles.mjs` strips the groups from core's
    copy exactly as it strips the command groups, and a bundled host composes
    with `mergeTranslationEntries` (`@labre/std`, new).
  - The chrome wordings that sit behind template-literal keys (violation
    severities, exemption scopes, relation sides) are now EXPORTED tables the
    manifest walks rather than wordings restated a second time — which is what
    lets the drift check reach them.
  - The translation service grew the README the seam deserved
    (`packages/affine/shared/src/services/translation-service/README.md`):
    host wiring, fallback contract, how to bootstrap a catalogue from the
    manifest, how to compose it in the bundled distribution, and why the 22
    entries with no fallback must not be seeded into `en`. The service moved
    from `translation-service.ts` to `translation-service/index.ts` to house it
    — the barrel export is unchanged, no import moves.

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

- be100e3: fix(edgeless): the direction reveal is one sentence, laid along the link

  PO acceptance of 02/08/2026, point 5: `depends on` was hiding the chevron and
  did not say what it was about. It now reads as the whole statement, turned onto
  the line it describes:

  ```
  Kettle | depends on > Electricity
  ```

  - **The sentence, not the verb.** The label is `{consumer} {verb} {provider}`,
    the two names read from the document — an element's own text, or the text of
    the sibling in its group carrying a role of `kind: 'text'`, which is how a
    framework artefact is composed on this canvas. Read generically, by kind: no
    framework's label role is named. An unnamed end is dropped rather than
    blanked, so a bare map still reads `depends on`.
  - **Along the link.** The label centres on the middle of the drawn path by ARC
    LENGTH and is rotated to the angle of the median segment. The old placement
    took the middle VERTEX, which on a two-point path is the target endpoint —
    which is how the tooltip ended up on the tip of the link, on top of the
    chevron. When the angle would stand the text on its head the box is turned by
    180°; the sentence itself never reverses.
  - **The point IS the arrow.** The box ends in a point on the side facing the
    target, so the reveal is one mark instead of two that cover each other. On a
    box turned 180° the point moves to its other end, because that is the end
    still facing the provider. Reversing the edge (M3) turns the box over and
    moves the point with it.
  - **The canvas chevron is gone**, and with it `EdgeDirectionOverlay`: there is
    nothing left for it to draw. The reveal is DOM only now, still in model units
    (the box scales with the zoom), still on hover AND selection, still silent on
    an edge bound to nothing, and still wording the verb through the host's
    catalogue.

  Breaking for a host that reached into these: `EdgeDirectionOverlay`,
  `targetAnchorOf` and `midpointOf` are removed in favour of `labelAnchorOf`, and
  the label's test id is `edge-direction-label` (was `edge-direction-verb`).

- ff3a5f7: fix(edgeless): the direction label is the verb alone, and it stays under the toolbars

  Second PO pass on the direction reveal (recette of 02/08/2026, points 4 and 5).
  Two complaints, one about the layer and one about the length.

  **It painted over the senior menu.** The label belongs to the canvas — it is
  glued to a link, in model units, turning and scaling with the map — and the
  toolbars overhang the canvas. Its host sat at `z-index: 2`, which cleared
  `edgeless-toolbar-widget`'s `1`, and the senior menu rides on that host's
  z-index because its sub-menus are appended inside its own subtree. The host is
  at `0` now: under the bottom toolbar and under `editor-toolbar`'s
  `--affine-z-index-popover`, and still over the canvas, since
  `.widgets-container` has `contain: layout` and paints as a whole above
  `.edgeless-container`. This is the deliberate reverse of the reading panel's
  choice — that panel is what the user is reading, so the toolbars wait
  underneath it; this one is part of the drawing.

  The armed tool's hint now hangs upwards from its anchor line rather than
  downwards, so the whole box clears the toolbar strip instead of having its
  lower third clipped by the toolbar it no longer paints over.

  **The label said too much.** `Kettle depends on Electricity` is a box longer
  than most links: it overhung both ends and covered the very components it was
  naming. The label is the **verb alone** now — `depends on` — still laid along
  the link, still ending in a point aimed at the provider, and still turning that
  point over when the edge is reversed. The two names are already drawn at both
  ends of the line; what the drawing does not say is what the line MEANS.

  Reading the names out of the document (`endpointNamesOf`) had no consumer left
  and is deleted. The reading panel resolves its own names through
  `readRelations`, where a name in prose is the point rather than an overlay.

- f0b2a0b: Fix the empty font style menu outside Firefox

  Surface fonts are registered with quoted family names (`"blocksuite:surface:Inter"`)
  while models store them unquoted (`blocksuite:surface:Inter`). `isSameFontFamily`
  branched on `IS_FIREFOX` and only added the quotes on the Firefox path, so on
  Chrome — and every other non-Firefox browser — `getFontFacesByFontFamily` matched
  nothing.

  With no matching font face, `edgeless-font-weight-and-style-panel` rendered zero
  rows: opening "Font style" on a text, shape, connector or edgeless text element
  showed an empty 124×36 box, making weight and italic unreachable. Family matching
  is now quote-insensitive on both sides and no longer depends on the engine.

- 3639562: feat(edgeless): the direction of a typed edge is a statement, and W4 reads it

  `docs/adr/0010` in one slice. For a connector carrying an edge role, the
  persisted `source → target` pair IS the relation's orientation and part of the
  document's meaning. That was already true of the data since #71 — and it was
  invisible: the Wardley link tool draws no arrowhead, nothing said which way to
  drag, nothing showed which way it came out, and nothing could change it. A rule
  on top of that would have been a rule on top of an accident, so the three
  mechanisms that turn the by-product into a statement ship WITH the rule, never
  before it.

  - **M1 — say it.** An edge role now declares its own `direction`: the verb the
    relation is read with (`depends on`), and the sentence that tells the user
    which way to draw it. The Wardley link tool shows it under its label in the
    senior sub-menu ("Drag from the component that has the need to what it
    needs"), and the evolution arrow shows its own. Keys and framework fallbacks,
    resolved through the host's catalogue: the library still puts no words in a
    framework's mouth. `CommandDescriptor.descriptionFallback` is new, beside the
    `descriptionKey` that already crossed the manifest seam and was never
    rendered.
  - **M2 — show it.** Hovering or selecting a typed edge reveals a chevron at its
    TARGET end plus the role's verb — an `Overlay` and a widget
    (`affine-edge-direction-widget`), never the element renderer, which knows
    neither hover nor selection. At rest the map keeps its canonical arrowless
    look: on a Wardley map a permanent head already means evolution movement, and
    two meanings on one glyph make both unreadable. Nothing is revealed for an
    edge bound to nothing — a stroke that relates nothing says nothing.
  - **M3 — let them fix it.** `edge.invert-direction` swaps `source` ↔ `target`
    AND the two endpoint styles, in one undo step, from the contextual toolbar,
    the palette, Settings › Shortcuts or the agent. `curveControlPoint` is
    deliberately untouched (an absolute pass-through point at t = 0.5, symmetric
    under a `P0` ↔ `P3` exchange, so the drawn curve does not move — an
    integration spec pins it). It writes through the surface and not through
    `EdgelessCRUDIdentifier`, so an inversion never becomes the default style of
    the next connector drawn.
  - **`b.flip-direction` is hidden for a typed edge.** It swaps the arrowhead
    STYLES without touching the ends: honest on a generalist connector, a lie on
    an edge whose direction is the relation. Reverse direction takes its place.
    Gated on the ROLE vocabulary, not on a framework flag — a stored typed edge
    stays protected on a board whose framework tooling is switched off.
  - **W4, a new rule family — `relative-order-along-axis`.** Given a typed edge,
    the two elements it links are compared along one declared axis of the frame,
    in the order the edge states. Wardley ships
    `wardley.provider-above-consumer`: "a provider may not sit above its
    consumer", `warning` under strict, `audit` under sketch, with 2% of the map's
    height of slack (a ratio, never model units — two components drawn level are
    not a mistake). Its finding names THREE elements for the first time: the two
    nodes and the edge, because reversing the edge is one of the two honest ways
    out and that gesture lives on the edge. It stays silent on an edge with a
    free end, a dangling end, a pair straddling two maps, a self-loop, and any
    edge whose role is not the one it names. Cost is linear in the RELATIONS
    somebody drew — a 200-node chain is 199 findings, not 19 900 comparisons —
    and measures ~0.3 ms on the 500-element reference map.
  - **The role VOCABULARY is now registered** (`RoleVocabularyExtension`, from a
    framework's always-on render extension) and readable
    (`findRoleDef`, `isTypedEdgeRole`). The library had the "is this a typed
    edge?" predicate since PF1 and used it nowhere.
  - **Templates.** The palette's "Link" and "Evolution arrow" swatches are
    de-typed: a horizontal stroke bound to nothing is a sample of a style, and it
    must claim nothing. Both template kits now decide what a stroke MEANS with
    one flag (`evolution`) instead of two different colour tests — a style
    inconsistency until W4 read these edges, a semantic one afterwards. Kodak's
    red _solid_ links stay typed dependencies, which is what they are.
  - **Telemetry.** `EdgeDirectionInverted` (ids only, never board content): how
    often a direction has to be corrected is the measurement of whether the
    drawing gesture announces itself well enough.
  - The inversion acts on the typed edges of the selection, so a lasso holding a
    Wardley link and a plain connector reverses the first and leaves the second
    alone — rather than showing no direction entry at all. A typed edge with a
    free end offers none: there is no relation there to reverse.
  - `VERDICT_PROPS` gains `source` and `target`, so re-pointing or reversing an
    edge re-judges the board instead of waiting for an unrelated drag.

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
- Updated dependencies [d6a0c71]
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
- Updated dependencies [4868d70]
- Updated dependencies [9c440fb]
- Updated dependencies [c2e1020]
- Updated dependencies [463989f]
- Updated dependencies [a5eca31]
- Updated dependencies [ceb2761]
- Updated dependencies [f7f23b2]
- Updated dependencies [865abd4]
- Updated dependencies [3b30d8f]
- Updated dependencies [751ac44]
- Updated dependencies [54488cd]
- Updated dependencies [9453013]
- Updated dependencies [695471f]
- Updated dependencies [c4c9b9e]
- Updated dependencies [cef3b1a]
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
- Updated dependencies [7a12ce2]
- Updated dependencies [864f07a]
- Updated dependencies [3c5c97e]
- Updated dependencies [1b72bcd]
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
- Updated dependencies [6618345]
- Updated dependencies [48e90f4]
- Updated dependencies [141de0e]
- Updated dependencies [5a61fb2]
- Updated dependencies [8f339d1]
- Updated dependencies [5cfcc6a]
- Updated dependencies [fb26f85]
- Updated dependencies [0991104]
- Updated dependencies [5edd916]
- Updated dependencies [5a16359]
- Updated dependencies [4668921]
- Updated dependencies [025d6f5]
- Updated dependencies [9acadeb]
- Updated dependencies [b1ed4ef]
- Updated dependencies [ce64e4f]
- Updated dependencies [985a92f]
- Updated dependencies [f05ff48]
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
- Updated dependencies [55c6597]
  - @labre/std@0.32.0
  - @labre/affine-shared@0.32.0
  - @labre/affine-widget-drag-handle@0.32.0
  - @labre/store@0.32.0
  - @labre/affine-block-embed-doc@0.32.0
  - @labre/affine-block-note@0.32.0
  - @labre/affine-components@0.32.0
  - @labre/affine-gfx-template@0.32.0
  - @labre/data-view@0.32.0
  - @labre/affine-block-database@0.32.0
  - @labre/affine-block-data-view@0.32.0
  - @labre/affine-block-code@0.32.0
  - @labre/affine-widget-toolbar@0.32.0
  - @labre/affine-block-edgeless-text@0.32.0
  - @labre/affine-model@0.32.0
  - @labre/affine-gfx-shape@0.32.0
  - @labre/affine-gfx-brush@0.32.0
  - @labre/affine-gfx-connector@0.32.0
  - @labre/affine-block-surface@0.32.0
  - @labre/affine-block-table@0.32.0
  - @labre/affine-gfx-text@0.32.0
  - @labre/affine-gfx-group@0.32.0
  - @labre/affine-widget-frame-title@0.32.0
  - @labre/affine-block-latex@0.32.0
  - @labre/affine-inline-latex@0.32.0
  - @labre/affine-widget-edgeless-selected-rect@0.32.0
  - @labre/affine-widget-remote-selection@0.32.0
  - @labre/affine-block-callout@0.32.0
  - @labre/affine-inline-preset@0.32.0
  - @labre/global@0.32.0
  - @labre/affine-block-root@0.32.0
  - @labre/affine-gfx-edgy@0.32.0
  - @labre/affine-block-frame@0.32.0
  - @labre/affine-gfx-wardley@0.32.0
  - @labre/affine-widget-linked-doc@0.32.0
  - @labre/affine-gfx-pointer@0.32.0
  - @labre/affine-widget-edgeless-toolbar@0.32.0
  - @labre/affine-gfx-bpmn@0.32.0
  - @labre/affine-gfx-cynefin-estuarine@0.32.0
  - @labre/affine-widget-slash-menu@0.32.0
  - @labre/affine-inline-link@0.32.0
  - @labre/affine-gfx-ddd-event-storming@0.32.0
  - @labre/affine-gfx-ddd-core-domain@0.32.0
  - @labre/affine-gfx-ddd-context-map@0.32.0
  - @labre/affine-foundation@0.32.0
  - @labre/affine-block-attachment@0.32.0
  - @labre/affine-block-bookmark@0.32.0
  - @labre/affine-block-divider@0.32.0
  - @labre/affine-block-embed@0.32.0
  - @labre/affine-block-image@0.32.0
  - @labre/affine-block-list@0.32.0
  - @labre/affine-block-paragraph@0.32.0
  - @labre/affine-block-surface-ref@0.32.0
  - @labre/affine-fragment-adapter-panel@0.32.0
  - @labre/affine-fragment-doc-title@0.32.0
  - @labre/affine-fragment-frame-panel@0.32.0
  - @labre/affine-fragment-outline@0.32.0
  - @labre/affine-gfx-ddd-aggregate@0.32.0
  - @labre/affine-gfx-ddd-shared@0.32.0
  - @labre/affine-gfx-link@0.32.0
  - @labre/affine-gfx-mindmap@0.32.0
  - @labre/affine-gfx-note@0.32.0
  - @labre/affine-gfx-turbo-renderer@0.32.0
  - @labre/affine-inline-comment@0.32.0
  - @labre/affine-inline-footnote@0.32.0
  - @labre/affine-inline-mention@0.32.0
  - @labre/affine-inline-reference@0.32.0
  - @labre/affine-rich-text@0.32.0
  - @labre/affine-widget-edgeless-auto-connect@0.32.0
  - @labre/affine-widget-edgeless-dragging-area@0.32.0
  - @labre/affine-widget-edgeless-zoom-toolbar@0.32.0
  - @labre/affine-widget-keyboard-toolbar@0.32.0
  - @labre/affine-widget-note-slicer@0.32.0
  - @labre/affine-widget-page-dragging-area@0.32.0
  - @labre/affine-widget-scroll-anchoring@0.32.0
  - @labre/affine-widget-viewport-overlay@0.32.0
  - @labre/affine-ext-loader@0.32.0
  - @labre/sync@0.32.0

## 0.31.0

### Patch Changes

- Updated dependencies [6a663b6]
  - @labre/store@0.31.0
  - @labre/affine-block-attachment@0.31.0
  - @labre/affine-block-bookmark@0.31.0
  - @labre/affine-block-callout@0.31.0
  - @labre/affine-block-code@0.31.0
  - @labre/affine-block-data-view@0.31.0
  - @labre/affine-block-database@0.31.0
  - @labre/affine-block-divider@0.31.0
  - @labre/affine-block-edgeless-text@0.31.0
  - @labre/affine-block-embed@0.31.0
  - @labre/affine-block-embed-doc@0.31.0
  - @labre/affine-block-frame@0.31.0
  - @labre/affine-block-image@0.31.0
  - @labre/affine-block-latex@0.31.0
  - @labre/affine-block-list@0.31.0
  - @labre/affine-block-note@0.31.0
  - @labre/affine-block-paragraph@0.31.0
  - @labre/affine-block-root@0.31.0
  - @labre/affine-block-surface@0.31.0
  - @labre/affine-block-surface-ref@0.31.0
  - @labre/affine-block-table@0.31.0
  - @labre/affine-components@0.31.0
  - @labre/data-view@0.31.0
  - @labre/affine-ext-loader@0.31.0
  - @labre/affine-foundation@0.31.0
  - @labre/affine-fragment-adapter-panel@0.31.0
  - @labre/affine-fragment-doc-title@0.31.0
  - @labre/affine-fragment-frame-panel@0.31.0
  - @labre/affine-fragment-outline@0.31.0
  - @labre/affine-gfx-bpmn@0.31.0
  - @labre/affine-gfx-brush@0.31.0
  - @labre/affine-gfx-connector@0.31.0
  - @labre/affine-gfx-cynefin-estuarine@0.31.0
  - @labre/affine-gfx-ddd-aggregate@0.31.0
  - @labre/affine-gfx-ddd-context-map@0.31.0
  - @labre/affine-gfx-ddd-core-domain@0.31.0
  - @labre/affine-gfx-ddd-event-storming@0.31.0
  - @labre/affine-gfx-ddd-shared@0.31.0
  - @labre/affine-gfx-edgy@0.31.0
  - @labre/affine-gfx-group@0.31.0
  - @labre/affine-gfx-link@0.31.0
  - @labre/affine-gfx-mindmap@0.31.0
  - @labre/affine-gfx-note@0.31.0
  - @labre/affine-gfx-pointer@0.31.0
  - @labre/affine-gfx-shape@0.31.0
  - @labre/affine-gfx-template@0.31.0
  - @labre/affine-gfx-text@0.31.0
  - @labre/affine-gfx-turbo-renderer@0.31.0
  - @labre/affine-gfx-wardley@0.31.0
  - @labre/affine-inline-comment@0.31.0
  - @labre/affine-inline-footnote@0.31.0
  - @labre/affine-inline-latex@0.31.0
  - @labre/affine-inline-link@0.31.0
  - @labre/affine-inline-mention@0.31.0
  - @labre/affine-inline-preset@0.31.0
  - @labre/affine-inline-reference@0.31.0
  - @labre/affine-model@0.31.0
  - @labre/affine-rich-text@0.31.0
  - @labre/affine-shared@0.31.0
  - @labre/affine-widget-drag-handle@0.31.0
  - @labre/affine-widget-keyboard-toolbar@0.31.0
  - @labre/affine-widget-linked-doc@0.31.0
  - @labre/affine-widget-page-dragging-area@0.31.0
  - @labre/affine-widget-slash-menu@0.31.0
  - @labre/std@0.31.0
  - @labre/affine-widget-toolbar@0.31.0
  - @labre/affine-widget-edgeless-selected-rect@0.31.0
  - @labre/affine-widget-edgeless-auto-connect@0.31.0
  - @labre/affine-widget-edgeless-dragging-area@0.31.0
  - @labre/affine-widget-note-slicer@0.31.0
  - @labre/affine-widget-edgeless-toolbar@0.31.0
  - @labre/affine-widget-edgeless-zoom-toolbar@0.31.0
  - @labre/affine-widget-frame-title@0.31.0
  - @labre/affine-widget-remote-selection@0.31.0
  - @labre/affine-widget-viewport-overlay@0.31.0
  - @labre/affine-widget-scroll-anchoring@0.31.0
  - @labre/global@0.31.0
  - @labre/sync@0.31.0

## 0.30.2

### Patch Changes

- 33acdfa: Publish bundles whose ESM specifiers Node can resolve

  The compiled bundles emitted specifiers verbatim from the vendored source, so
  `dist` shipped extensionless relative imports (`from './shortcuts'`), extensionless
  subpath imports (`from 'lodash-es/last'`), and bare imports of bundler-only proxy
  directories (`@atlaskit/pragmatic-drag-and-drop/element/adapter`). Bundlers accept
  all three; Node's ESM resolver accepts none, so any consumer that let Node resolve
  the bundles — a test runner treating them as externalized deps, a bundler-less
  import — failed with ERR_MODULE_NOT_FOUND / ERR_UNSUPPORTED_DIR_IMPORT.

  `compile-bundles.mjs` now rewrites every emitted specifier to an explicit one and
  fails the build on any relative import that resolves to nothing.

  - @labre/affine-block-attachment@0.30.2
  - @labre/affine-block-bookmark@0.30.2
  - @labre/affine-block-callout@0.30.2
  - @labre/affine-block-code@0.30.2
  - @labre/affine-block-data-view@0.30.2
  - @labre/affine-block-database@0.30.2
  - @labre/affine-block-divider@0.30.2
  - @labre/affine-block-edgeless-text@0.30.2
  - @labre/affine-block-embed@0.30.2
  - @labre/affine-block-embed-doc@0.30.2
  - @labre/affine-block-frame@0.30.2
  - @labre/affine-block-image@0.30.2
  - @labre/affine-block-latex@0.30.2
  - @labre/affine-block-list@0.30.2
  - @labre/affine-block-note@0.30.2
  - @labre/affine-block-paragraph@0.30.2
  - @labre/affine-block-root@0.30.2
  - @labre/affine-block-surface@0.30.2
  - @labre/affine-block-surface-ref@0.30.2
  - @labre/affine-block-table@0.30.2
  - @labre/affine-components@0.30.2
  - @labre/data-view@0.30.2
  - @labre/affine-ext-loader@0.30.2
  - @labre/affine-foundation@0.30.2
  - @labre/affine-fragment-adapter-panel@0.30.2
  - @labre/affine-fragment-doc-title@0.30.2
  - @labre/affine-fragment-frame-panel@0.30.2
  - @labre/affine-fragment-outline@0.30.2
  - @labre/affine-gfx-bpmn@0.30.2
  - @labre/affine-gfx-brush@0.30.2
  - @labre/affine-gfx-connector@0.30.2
  - @labre/affine-gfx-cynefin-estuarine@0.30.2
  - @labre/affine-gfx-ddd-aggregate@0.30.2
  - @labre/affine-gfx-ddd-context-map@0.30.2
  - @labre/affine-gfx-ddd-core-domain@0.30.2
  - @labre/affine-gfx-ddd-event-storming@0.30.2
  - @labre/affine-gfx-ddd-shared@0.30.2
  - @labre/affine-gfx-edgy@0.30.2
  - @labre/affine-gfx-group@0.30.2
  - @labre/affine-gfx-link@0.30.2
  - @labre/affine-gfx-mindmap@0.30.2
  - @labre/affine-gfx-note@0.30.2
  - @labre/affine-gfx-pointer@0.30.2
  - @labre/affine-gfx-shape@0.30.2
  - @labre/affine-gfx-template@0.30.2
  - @labre/affine-gfx-text@0.30.2
  - @labre/affine-gfx-turbo-renderer@0.30.2
  - @labre/affine-gfx-wardley@0.30.2
  - @labre/affine-inline-comment@0.30.2
  - @labre/affine-inline-footnote@0.30.2
  - @labre/affine-inline-latex@0.30.2
  - @labre/affine-inline-link@0.30.2
  - @labre/affine-inline-mention@0.30.2
  - @labre/affine-inline-preset@0.30.2
  - @labre/affine-inline-reference@0.30.2
  - @labre/affine-model@0.30.2
  - @labre/affine-rich-text@0.30.2
  - @labre/affine-shared@0.30.2
  - @labre/affine-widget-drag-handle@0.30.2
  - @labre/affine-widget-edgeless-auto-connect@0.30.2
  - @labre/affine-widget-edgeless-dragging-area@0.30.2
  - @labre/affine-widget-edgeless-selected-rect@0.30.2
  - @labre/affine-widget-edgeless-toolbar@0.30.2
  - @labre/affine-widget-edgeless-zoom-toolbar@0.30.2
  - @labre/affine-widget-frame-title@0.30.2
  - @labre/affine-widget-keyboard-toolbar@0.30.2
  - @labre/affine-widget-linked-doc@0.30.2
  - @labre/affine-widget-note-slicer@0.30.2
  - @labre/affine-widget-page-dragging-area@0.30.2
  - @labre/affine-widget-remote-selection@0.30.2
  - @labre/affine-widget-scroll-anchoring@0.30.2
  - @labre/affine-widget-slash-menu@0.30.2
  - @labre/affine-widget-toolbar@0.30.2
  - @labre/affine-widget-viewport-overlay@0.30.2
  - @labre/global@0.30.2
  - @labre/std@0.30.2
  - @labre/store@0.30.2
  - @labre/sync@0.30.2

## 0.30.1

### Patch Changes

- Updated dependencies [09f1d82]
  - @labre/affine-gfx-cynefin-estuarine@0.30.1
  - @labre/affine-block-attachment@0.30.1
  - @labre/affine-block-bookmark@0.30.1
  - @labre/affine-block-callout@0.30.1
  - @labre/affine-block-code@0.30.1
  - @labre/affine-block-data-view@0.30.1
  - @labre/affine-block-database@0.30.1
  - @labre/affine-block-divider@0.30.1
  - @labre/affine-block-edgeless-text@0.30.1
  - @labre/affine-block-embed@0.30.1
  - @labre/affine-block-embed-doc@0.30.1
  - @labre/affine-block-frame@0.30.1
  - @labre/affine-block-image@0.30.1
  - @labre/affine-block-latex@0.30.1
  - @labre/affine-block-list@0.30.1
  - @labre/affine-block-note@0.30.1
  - @labre/affine-block-paragraph@0.30.1
  - @labre/affine-block-root@0.30.1
  - @labre/affine-block-surface@0.30.1
  - @labre/affine-block-surface-ref@0.30.1
  - @labre/affine-block-table@0.30.1
  - @labre/affine-components@0.30.1
  - @labre/data-view@0.30.1
  - @labre/affine-ext-loader@0.30.1
  - @labre/affine-foundation@0.30.1
  - @labre/affine-fragment-adapter-panel@0.30.1
  - @labre/affine-fragment-doc-title@0.30.1
  - @labre/affine-fragment-frame-panel@0.30.1
  - @labre/affine-fragment-outline@0.30.1
  - @labre/affine-gfx-bpmn@0.30.1
  - @labre/affine-gfx-brush@0.30.1
  - @labre/affine-gfx-connector@0.30.1
  - @labre/affine-gfx-ddd-aggregate@0.30.1
  - @labre/affine-gfx-ddd-context-map@0.30.1
  - @labre/affine-gfx-ddd-core-domain@0.30.1
  - @labre/affine-gfx-ddd-event-storming@0.30.1
  - @labre/affine-gfx-ddd-shared@0.30.1
  - @labre/affine-gfx-edgy@0.30.1
  - @labre/affine-gfx-group@0.30.1
  - @labre/affine-gfx-link@0.30.1
  - @labre/affine-gfx-mindmap@0.30.1
  - @labre/affine-gfx-note@0.30.1
  - @labre/affine-gfx-pointer@0.30.1
  - @labre/affine-gfx-shape@0.30.1
  - @labre/affine-gfx-template@0.30.1
  - @labre/affine-gfx-text@0.30.1
  - @labre/affine-gfx-turbo-renderer@0.30.1
  - @labre/affine-gfx-wardley@0.30.1
  - @labre/affine-inline-comment@0.30.1
  - @labre/affine-inline-footnote@0.30.1
  - @labre/affine-inline-latex@0.30.1
  - @labre/affine-inline-link@0.30.1
  - @labre/affine-inline-mention@0.30.1
  - @labre/affine-inline-preset@0.30.1
  - @labre/affine-inline-reference@0.30.1
  - @labre/affine-model@0.30.1
  - @labre/affine-rich-text@0.30.1
  - @labre/affine-shared@0.30.1
  - @labre/affine-widget-drag-handle@0.30.1
  - @labre/affine-widget-edgeless-auto-connect@0.30.1
  - @labre/affine-widget-edgeless-dragging-area@0.30.1
  - @labre/affine-widget-edgeless-selected-rect@0.30.1
  - @labre/affine-widget-edgeless-toolbar@0.30.1
  - @labre/affine-widget-edgeless-zoom-toolbar@0.30.1
  - @labre/affine-widget-frame-title@0.30.1
  - @labre/affine-widget-keyboard-toolbar@0.30.1
  - @labre/affine-widget-linked-doc@0.30.1
  - @labre/affine-widget-note-slicer@0.30.1
  - @labre/affine-widget-page-dragging-area@0.30.1
  - @labre/affine-widget-remote-selection@0.30.1
  - @labre/affine-widget-scroll-anchoring@0.30.1
  - @labre/affine-widget-slash-menu@0.30.1
  - @labre/affine-widget-toolbar@0.30.1
  - @labre/affine-widget-viewport-overlay@0.30.1
  - @labre/global@0.30.1
  - @labre/std@0.30.1
  - @labre/store@0.30.1
  - @labre/sync@0.30.1

## 0.30.0

### Minor Changes

- 8deda2d: Wardley canvas keyboard chords: press `w`, then `c` (component), `l` (link
  tool), `a` (evolution arrow), `i` (inertia), `p` (pipeline), `m` (method) or
  `b` (classic background). Edgeless-only, disabled with the `wardley` block
  flag, host-rebindable via the shortcut manifest (`getShortcutManifest` now
  lists the `wardley` group). The wardley menu actions were extracted into
  standalone functions shared by the toolbar and the shortcuts.

### Patch Changes

- Updated dependencies [9d0fe0c]
- Updated dependencies [4aeb85e]
- Updated dependencies [ecba791]
- Updated dependencies [ecba791]
- Updated dependencies [8de86f4]
- Updated dependencies [d295c58]
- Updated dependencies [8deda2d]
  - @labre/std@0.30.0
  - @labre/affine-block-frame@0.30.0
  - @labre/affine-gfx-ddd-shared@0.30.0
  - @labre/affine-gfx-ddd-context-map@0.30.0
  - @labre/affine-gfx-cynefin-estuarine@0.30.0
  - @labre/affine-gfx-bpmn@0.30.0
  - @labre/affine-gfx-wardley@0.30.0
  - @labre/affine-model@0.30.0
  - @labre/affine-gfx-shape@0.30.0
  - @labre/affine-block-root@0.30.0
  - @labre/affine-block-attachment@0.30.0
  - @labre/affine-block-bookmark@0.30.0
  - @labre/affine-block-callout@0.30.0
  - @labre/affine-block-code@0.30.0
  - @labre/affine-block-data-view@0.30.0
  - @labre/affine-block-database@0.30.0
  - @labre/affine-block-divider@0.30.0
  - @labre/affine-block-edgeless-text@0.30.0
  - @labre/affine-block-embed@0.30.0
  - @labre/affine-block-embed-doc@0.30.0
  - @labre/affine-block-image@0.30.0
  - @labre/affine-block-latex@0.30.0
  - @labre/affine-block-list@0.30.0
  - @labre/affine-block-note@0.30.0
  - @labre/affine-block-paragraph@0.30.0
  - @labre/affine-block-surface@0.30.0
  - @labre/affine-block-surface-ref@0.30.0
  - @labre/affine-block-table@0.30.0
  - @labre/affine-components@0.30.0
  - @labre/data-view@0.30.0
  - @labre/affine-foundation@0.30.0
  - @labre/affine-fragment-adapter-panel@0.30.0
  - @labre/affine-fragment-doc-title@0.30.0
  - @labre/affine-fragment-frame-panel@0.30.0
  - @labre/affine-fragment-outline@0.30.0
  - @labre/affine-gfx-brush@0.30.0
  - @labre/affine-gfx-connector@0.30.0
  - @labre/affine-gfx-ddd-aggregate@0.30.0
  - @labre/affine-gfx-ddd-core-domain@0.30.0
  - @labre/affine-gfx-ddd-event-storming@0.30.0
  - @labre/affine-gfx-edgy@0.30.0
  - @labre/affine-gfx-group@0.30.0
  - @labre/affine-gfx-link@0.30.0
  - @labre/affine-gfx-mindmap@0.30.0
  - @labre/affine-gfx-note@0.30.0
  - @labre/affine-gfx-pointer@0.30.0
  - @labre/affine-gfx-template@0.30.0
  - @labre/affine-gfx-text@0.30.0
  - @labre/affine-gfx-turbo-renderer@0.30.0
  - @labre/affine-inline-comment@0.30.0
  - @labre/affine-inline-footnote@0.30.0
  - @labre/affine-inline-latex@0.30.0
  - @labre/affine-inline-link@0.30.0
  - @labre/affine-inline-mention@0.30.0
  - @labre/affine-inline-preset@0.30.0
  - @labre/affine-inline-reference@0.30.0
  - @labre/affine-rich-text@0.30.0
  - @labre/affine-shared@0.30.0
  - @labre/affine-widget-drag-handle@0.30.0
  - @labre/affine-widget-edgeless-auto-connect@0.30.0
  - @labre/affine-widget-edgeless-dragging-area@0.30.0
  - @labre/affine-widget-edgeless-selected-rect@0.30.0
  - @labre/affine-widget-edgeless-toolbar@0.30.0
  - @labre/affine-widget-edgeless-zoom-toolbar@0.30.0
  - @labre/affine-widget-frame-title@0.30.0
  - @labre/affine-widget-keyboard-toolbar@0.30.0
  - @labre/affine-widget-linked-doc@0.30.0
  - @labre/affine-widget-note-slicer@0.30.0
  - @labre/affine-widget-page-dragging-area@0.30.0
  - @labre/affine-widget-remote-selection@0.30.0
  - @labre/affine-widget-scroll-anchoring@0.30.0
  - @labre/affine-widget-slash-menu@0.30.0
  - @labre/affine-widget-toolbar@0.30.0
  - @labre/affine-widget-viewport-overlay@0.30.0
  - @labre/affine-ext-loader@0.30.0
  - @labre/global@0.30.0
  - @labre/store@0.30.0
  - @labre/sync@0.30.0

## 0.29.1

### Patch Changes

- Re-publish so the host seams shipped in #30 and #37 are reachable from the
  published bundle via `@formicoidea/labre-core/shared/services`:

  - `KeymapOverrideExtension`, `ShortcutConflictReporterExtension`, `canonicalCombo`
    and the `ShortcutOverrides` / `ShortcutManifestEntry` / `ShortcutConflict` types (#30)
  - `LinkedDocContentResolverExtension`, `LinkedDocContentResolverIdentifier`
    and the `LinkedDocContentResolver` type (#37)

  The re-exports already exist in source (`shared/services` barrel); they only
  predated the `0.29.0` npm tarball, so the host could not import them. No code
  change — a fresh release exposes them. Closes #43.

  - @labre/affine-block-attachment@0.29.1
  - @labre/affine-block-bookmark@0.29.1
  - @labre/affine-block-callout@0.29.1
  - @labre/affine-block-code@0.29.1
  - @labre/affine-block-data-view@0.29.1
  - @labre/affine-block-database@0.29.1
  - @labre/affine-block-divider@0.29.1
  - @labre/affine-block-edgeless-text@0.29.1
  - @labre/affine-block-embed@0.29.1
  - @labre/affine-block-embed-doc@0.29.1
  - @labre/affine-block-frame@0.29.1
  - @labre/affine-block-image@0.29.1
  - @labre/affine-block-latex@0.29.1
  - @labre/affine-block-list@0.29.1
  - @labre/affine-block-note@0.29.1
  - @labre/affine-block-paragraph@0.29.1
  - @labre/affine-block-root@0.29.1
  - @labre/affine-block-surface@0.29.1
  - @labre/affine-block-surface-ref@0.29.1
  - @labre/affine-block-table@0.29.1
  - @labre/affine-components@0.29.1
  - @labre/data-view@0.29.1
  - @labre/affine-ext-loader@0.29.1
  - @labre/affine-foundation@0.29.1
  - @labre/affine-fragment-adapter-panel@0.29.1
  - @labre/affine-fragment-doc-title@0.29.1
  - @labre/affine-fragment-frame-panel@0.29.1
  - @labre/affine-fragment-outline@0.29.1
  - @labre/affine-gfx-bpmn@0.29.1
  - @labre/affine-gfx-brush@0.29.1
  - @labre/affine-gfx-connector@0.29.1
  - @labre/affine-gfx-cynefin-estuarine@0.29.1
  - @labre/affine-gfx-ddd-aggregate@0.29.1
  - @labre/affine-gfx-ddd-context-map@0.29.1
  - @labre/affine-gfx-ddd-core-domain@0.29.1
  - @labre/affine-gfx-ddd-event-storming@0.29.1
  - @labre/affine-gfx-ddd-shared@0.29.1
  - @labre/affine-gfx-edgy@0.29.1
  - @labre/affine-gfx-group@0.29.1
  - @labre/affine-gfx-link@0.29.1
  - @labre/affine-gfx-mindmap@0.29.1
  - @labre/affine-gfx-note@0.29.1
  - @labre/affine-gfx-pointer@0.29.1
  - @labre/affine-gfx-shape@0.29.1
  - @labre/affine-gfx-template@0.29.1
  - @labre/affine-gfx-text@0.29.1
  - @labre/affine-gfx-turbo-renderer@0.29.1
  - @labre/affine-gfx-wardley@0.29.1
  - @labre/affine-inline-comment@0.29.1
  - @labre/affine-inline-footnote@0.29.1
  - @labre/affine-inline-latex@0.29.1
  - @labre/affine-inline-link@0.29.1
  - @labre/affine-inline-mention@0.29.1
  - @labre/affine-inline-preset@0.29.1
  - @labre/affine-inline-reference@0.29.1
  - @labre/affine-model@0.29.1
  - @labre/affine-rich-text@0.29.1
  - @labre/affine-shared@0.29.1
  - @labre/affine-widget-drag-handle@0.29.1
  - @labre/affine-widget-edgeless-auto-connect@0.29.1
  - @labre/affine-widget-edgeless-dragging-area@0.29.1
  - @labre/affine-widget-edgeless-selected-rect@0.29.1
  - @labre/affine-widget-edgeless-toolbar@0.29.1
  - @labre/affine-widget-edgeless-zoom-toolbar@0.29.1
  - @labre/affine-widget-frame-title@0.29.1
  - @labre/affine-widget-keyboard-toolbar@0.29.1
  - @labre/affine-widget-linked-doc@0.29.1
  - @labre/affine-widget-note-slicer@0.29.1
  - @labre/affine-widget-page-dragging-area@0.29.1
  - @labre/affine-widget-remote-selection@0.29.1
  - @labre/affine-widget-scroll-anchoring@0.29.1
  - @labre/affine-widget-slash-menu@0.29.1
  - @labre/affine-widget-toolbar@0.29.1
  - @labre/affine-widget-viewport-overlay@0.29.1
  - @labre/global@0.29.1
  - @labre/std@0.29.1
  - @labre/store@0.29.1
  - @labre/sync@0.29.1

## 0.29.0

### Minor Changes

- 054423b: Replace the edgeless "Others" senior toolbar button (and its submenu) with two
  standalone senior buttons placed next to pen/eraser: **Text** (insert an
  editable text element) and **Add file** (open the file picker and insert the
  image/attachment). Each is a single tap and is individually flag-gated
  (`edgeless-text`, `edgeless-media`, replacing the old `other` flag). The actions
  reuse the former submenu's `textRender` / `mediaRender`, so text/file insertion
  is unchanged.
- 7aab287: Add `getShortcutManifest(flags)` (#30, phase 2): the enumerable, framework-aware
  shortcut manifest for a host "Shortcuts" settings panel. It returns the core
  shortcuts plus the shortcuts contributed by the currently-enabled frameworks
  (flag-gated like `getInternalViewExtensions`), as metadata-only entries (no
  runtime handler). Enumerable without an editor instance. Exposed at
  `@labre/affine/shortcuts`. The per-framework contribution seam is ready
  (`coreShortcuts` is now exported from the root block); no framework ships
  shortcuts yet, so the manifest currently returns core only.

### Patch Changes

- Updated dependencies [cbdd8c6]
- Updated dependencies [ad7a655]
- Updated dependencies [7375b9a]
- Updated dependencies [3a3c99b]
- Updated dependencies [43462b5]
- Updated dependencies [054423b]
- Updated dependencies [ab409c5]
- Updated dependencies [40db887]
- Updated dependencies [7aab287]
- Updated dependencies [9330750]
  - @labre/affine-gfx-ddd-core-domain@0.29.0
  - @labre/affine-gfx-link@0.29.0
  - @labre/affine-shared@0.29.0
  - @labre/affine-block-embed-doc@0.29.0
  - @labre/affine-gfx-mindmap@0.29.0
  - @labre/affine-block-root@0.29.0
  - @labre/std@0.29.0
  - @labre/affine-block-attachment@0.29.0
  - @labre/affine-block-bookmark@0.29.0
  - @labre/affine-block-callout@0.29.0
  - @labre/affine-block-code@0.29.0
  - @labre/affine-block-data-view@0.29.0
  - @labre/affine-block-database@0.29.0
  - @labre/affine-block-divider@0.29.0
  - @labre/affine-block-edgeless-text@0.29.0
  - @labre/affine-block-embed@0.29.0
  - @labre/affine-block-frame@0.29.0
  - @labre/affine-block-image@0.29.0
  - @labre/affine-block-latex@0.29.0
  - @labre/affine-block-list@0.29.0
  - @labre/affine-block-note@0.29.0
  - @labre/affine-block-paragraph@0.29.0
  - @labre/affine-block-surface@0.29.0
  - @labre/affine-block-surface-ref@0.29.0
  - @labre/affine-block-table@0.29.0
  - @labre/affine-components@0.29.0
  - @labre/data-view@0.29.0
  - @labre/affine-foundation@0.29.0
  - @labre/affine-fragment-adapter-panel@0.29.0
  - @labre/affine-fragment-doc-title@0.29.0
  - @labre/affine-fragment-frame-panel@0.29.0
  - @labre/affine-fragment-outline@0.29.0
  - @labre/affine-gfx-bpmn@0.29.0
  - @labre/affine-gfx-brush@0.29.0
  - @labre/affine-gfx-connector@0.29.0
  - @labre/affine-gfx-cynefin-estuarine@0.29.0
  - @labre/affine-gfx-ddd-aggregate@0.29.0
  - @labre/affine-gfx-ddd-context-map@0.29.0
  - @labre/affine-gfx-ddd-event-storming@0.29.0
  - @labre/affine-gfx-ddd-shared@0.29.0
  - @labre/affine-gfx-edgy@0.29.0
  - @labre/affine-gfx-group@0.29.0
  - @labre/affine-gfx-note@0.29.0
  - @labre/affine-gfx-pointer@0.29.0
  - @labre/affine-gfx-shape@0.29.0
  - @labre/affine-gfx-template@0.29.0
  - @labre/affine-gfx-text@0.29.0
  - @labre/affine-gfx-wardley@0.29.0
  - @labre/affine-inline-comment@0.29.0
  - @labre/affine-inline-footnote@0.29.0
  - @labre/affine-inline-latex@0.29.0
  - @labre/affine-inline-link@0.29.0
  - @labre/affine-inline-mention@0.29.0
  - @labre/affine-inline-preset@0.29.0
  - @labre/affine-inline-reference@0.29.0
  - @labre/affine-rich-text@0.29.0
  - @labre/affine-widget-drag-handle@0.29.0
  - @labre/affine-widget-edgeless-auto-connect@0.29.0
  - @labre/affine-widget-edgeless-dragging-area@0.29.0
  - @labre/affine-widget-edgeless-selected-rect@0.29.0
  - @labre/affine-widget-edgeless-toolbar@0.29.0
  - @labre/affine-widget-edgeless-zoom-toolbar@0.29.0
  - @labre/affine-widget-frame-title@0.29.0
  - @labre/affine-widget-keyboard-toolbar@0.29.0
  - @labre/affine-widget-linked-doc@0.29.0
  - @labre/affine-widget-note-slicer@0.29.0
  - @labre/affine-widget-page-dragging-area@0.29.0
  - @labre/affine-widget-remote-selection@0.29.0
  - @labre/affine-widget-scroll-anchoring@0.29.0
  - @labre/affine-widget-slash-menu@0.29.0
  - @labre/affine-widget-toolbar@0.29.0
  - @labre/affine-widget-viewport-overlay@0.29.0
  - @labre/affine-gfx-turbo-renderer@0.29.0
  - @labre/affine-model@0.29.0
  - @labre/affine-ext-loader@0.29.0
  - @labre/global@0.29.0
  - @labre/store@0.29.0
  - @labre/sync@0.29.0

## 0.28.0

### Patch Changes

- Updated dependencies [1cd6c92]
- Updated dependencies [65cc055]
  - @labre/affine-block-database@0.28.0
  - @labre/data-view@0.28.0
  - @labre/std@0.28.0
  - @labre/affine-block-data-view@0.28.0
  - @labre/affine-block-root@0.28.0
  - @labre/affine-widget-keyboard-toolbar@0.28.0
  - @labre/affine-widget-toolbar@0.28.0
  - @labre/affine-block-table@0.28.0
  - @labre/affine-foundation@0.28.0
  - @labre/affine-block-attachment@0.28.0
  - @labre/affine-block-bookmark@0.28.0
  - @labre/affine-block-callout@0.28.0
  - @labre/affine-block-code@0.28.0
  - @labre/affine-block-divider@0.28.0
  - @labre/affine-block-edgeless-text@0.28.0
  - @labre/affine-block-embed@0.28.0
  - @labre/affine-block-embed-doc@0.28.0
  - @labre/affine-block-frame@0.28.0
  - @labre/affine-block-image@0.28.0
  - @labre/affine-block-latex@0.28.0
  - @labre/affine-block-list@0.28.0
  - @labre/affine-block-note@0.28.0
  - @labre/affine-block-paragraph@0.28.0
  - @labre/affine-block-surface@0.28.0
  - @labre/affine-block-surface-ref@0.28.0
  - @labre/affine-components@0.28.0
  - @labre/affine-fragment-adapter-panel@0.28.0
  - @labre/affine-fragment-doc-title@0.28.0
  - @labre/affine-fragment-frame-panel@0.28.0
  - @labre/affine-fragment-outline@0.28.0
  - @labre/affine-gfx-bpmn@0.28.0
  - @labre/affine-gfx-brush@0.28.0
  - @labre/affine-gfx-connector@0.28.0
  - @labre/affine-gfx-cynefin-estuarine@0.28.0
  - @labre/affine-gfx-ddd-aggregate@0.28.0
  - @labre/affine-gfx-ddd-context-map@0.28.0
  - @labre/affine-gfx-ddd-core-domain@0.28.0
  - @labre/affine-gfx-ddd-event-storming@0.28.0
  - @labre/affine-gfx-ddd-shared@0.28.0
  - @labre/affine-gfx-edgy@0.28.0
  - @labre/affine-gfx-group@0.28.0
  - @labre/affine-gfx-link@0.28.0
  - @labre/affine-gfx-mindmap@0.28.0
  - @labre/affine-gfx-note@0.28.0
  - @labre/affine-gfx-pointer@0.28.0
  - @labre/affine-gfx-shape@0.28.0
  - @labre/affine-gfx-template@0.28.0
  - @labre/affine-gfx-text@0.28.0
  - @labre/affine-gfx-turbo-renderer@0.28.0
  - @labre/affine-gfx-wardley@0.28.0
  - @labre/affine-inline-comment@0.28.0
  - @labre/affine-inline-footnote@0.28.0
  - @labre/affine-inline-latex@0.28.0
  - @labre/affine-inline-link@0.28.0
  - @labre/affine-inline-mention@0.28.0
  - @labre/affine-inline-preset@0.28.0
  - @labre/affine-inline-reference@0.28.0
  - @labre/affine-model@0.28.0
  - @labre/affine-rich-text@0.28.0
  - @labre/affine-shared@0.28.0
  - @labre/affine-widget-drag-handle@0.28.0
  - @labre/affine-widget-edgeless-auto-connect@0.28.0
  - @labre/affine-widget-edgeless-dragging-area@0.28.0
  - @labre/affine-widget-edgeless-selected-rect@0.28.0
  - @labre/affine-widget-edgeless-toolbar@0.28.0
  - @labre/affine-widget-edgeless-zoom-toolbar@0.28.0
  - @labre/affine-widget-frame-title@0.28.0
  - @labre/affine-widget-linked-doc@0.28.0
  - @labre/affine-widget-note-slicer@0.28.0
  - @labre/affine-widget-page-dragging-area@0.28.0
  - @labre/affine-widget-remote-selection@0.28.0
  - @labre/affine-widget-scroll-anchoring@0.28.0
  - @labre/affine-widget-slash-menu@0.28.0
  - @labre/affine-widget-viewport-overlay@0.28.0
  - @labre/affine-ext-loader@0.28.0
  - @labre/global@0.28.0
  - @labre/store@0.28.0
  - @labre/sync@0.28.0

## 0.27.0

### Patch Changes

- Updated dependencies [14ef3e7]
- Updated dependencies [91f6397]
- Updated dependencies [91f6397]
  - @labre/affine-block-database@0.27.0
  - @labre/affine-block-root@0.27.0
  - @labre/affine-widget-edgeless-selected-rect@0.27.0
  - @labre/std@0.27.0
  - @labre/affine-block-data-view@0.27.0
  - @labre/affine-widget-keyboard-toolbar@0.27.0
  - @labre/affine-widget-toolbar@0.27.0
  - @labre/affine-widget-note-slicer@0.27.0
  - @labre/affine-block-attachment@0.27.0
  - @labre/affine-block-bookmark@0.27.0
  - @labre/affine-block-callout@0.27.0
  - @labre/affine-block-code@0.27.0
  - @labre/affine-block-divider@0.27.0
  - @labre/affine-block-edgeless-text@0.27.0
  - @labre/affine-block-embed@0.27.0
  - @labre/affine-block-embed-doc@0.27.0
  - @labre/affine-block-frame@0.27.0
  - @labre/affine-block-image@0.27.0
  - @labre/affine-block-latex@0.27.0
  - @labre/affine-block-list@0.27.0
  - @labre/affine-block-note@0.27.0
  - @labre/affine-block-paragraph@0.27.0
  - @labre/affine-block-surface@0.27.0
  - @labre/affine-block-surface-ref@0.27.0
  - @labre/affine-block-table@0.27.0
  - @labre/affine-components@0.27.0
  - @labre/data-view@0.27.0
  - @labre/affine-foundation@0.27.0
  - @labre/affine-fragment-adapter-panel@0.27.0
  - @labre/affine-fragment-doc-title@0.27.0
  - @labre/affine-fragment-frame-panel@0.27.0
  - @labre/affine-fragment-outline@0.27.0
  - @labre/affine-gfx-bpmn@0.27.0
  - @labre/affine-gfx-brush@0.27.0
  - @labre/affine-gfx-connector@0.27.0
  - @labre/affine-gfx-cynefin-estuarine@0.27.0
  - @labre/affine-gfx-ddd-aggregate@0.27.0
  - @labre/affine-gfx-ddd-context-map@0.27.0
  - @labre/affine-gfx-ddd-core-domain@0.27.0
  - @labre/affine-gfx-ddd-event-storming@0.27.0
  - @labre/affine-gfx-ddd-shared@0.27.0
  - @labre/affine-gfx-edgy@0.27.0
  - @labre/affine-gfx-group@0.27.0
  - @labre/affine-gfx-link@0.27.0
  - @labre/affine-gfx-mindmap@0.27.0
  - @labre/affine-gfx-note@0.27.0
  - @labre/affine-gfx-pointer@0.27.0
  - @labre/affine-gfx-shape@0.27.0
  - @labre/affine-gfx-template@0.27.0
  - @labre/affine-gfx-text@0.27.0
  - @labre/affine-gfx-turbo-renderer@0.27.0
  - @labre/affine-gfx-wardley@0.27.0
  - @labre/affine-inline-comment@0.27.0
  - @labre/affine-inline-footnote@0.27.0
  - @labre/affine-inline-latex@0.27.0
  - @labre/affine-inline-link@0.27.0
  - @labre/affine-inline-mention@0.27.0
  - @labre/affine-inline-preset@0.27.0
  - @labre/affine-inline-reference@0.27.0
  - @labre/affine-model@0.27.0
  - @labre/affine-rich-text@0.27.0
  - @labre/affine-shared@0.27.0
  - @labre/affine-widget-drag-handle@0.27.0
  - @labre/affine-widget-edgeless-auto-connect@0.27.0
  - @labre/affine-widget-edgeless-dragging-area@0.27.0
  - @labre/affine-widget-edgeless-toolbar@0.27.0
  - @labre/affine-widget-edgeless-zoom-toolbar@0.27.0
  - @labre/affine-widget-frame-title@0.27.0
  - @labre/affine-widget-linked-doc@0.27.0
  - @labre/affine-widget-page-dragging-area@0.27.0
  - @labre/affine-widget-remote-selection@0.27.0
  - @labre/affine-widget-scroll-anchoring@0.27.0
  - @labre/affine-widget-slash-menu@0.27.0
  - @labre/affine-widget-viewport-overlay@0.27.0
  - @labre/affine-ext-loader@0.27.0
  - @labre/global@0.27.0
  - @labre/store@0.27.0
  - @labre/sync@0.27.0

## 0.26.0

### Minor Changes

- 66cd7e6: feat(blocks): ship each DDD senior button as its own package + bundle

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

### Patch Changes

- Updated dependencies [8960a6c]
- Updated dependencies [6795191]
  - @labre/affine-block-database@0.26.0
  - @labre/affine-model@0.26.0
  - @labre/affine-components@0.26.0
  - @labre/affine-widget-toolbar@0.26.0
  - @labre/affine-gfx-wardley@0.26.0
  - @labre/affine-gfx-bpmn@0.26.0
  - @labre/affine-gfx-cynefin-estuarine@0.26.0
  - @labre/affine-gfx-edgy@0.26.0
  - @labre/affine-gfx-mindmap@0.26.0
  - @labre/affine-gfx-ddd-shared@0.26.0
  - @labre/affine-block-data-view@0.26.0
  - @labre/affine-block-root@0.26.0
  - @labre/affine-widget-keyboard-toolbar@0.26.0
  - @labre/affine-block-attachment@0.26.0
  - @labre/affine-block-bookmark@0.26.0
  - @labre/affine-block-callout@0.26.0
  - @labre/affine-block-code@0.26.0
  - @labre/affine-block-divider@0.26.0
  - @labre/affine-block-edgeless-text@0.26.0
  - @labre/affine-block-embed@0.26.0
  - @labre/affine-block-embed-doc@0.26.0
  - @labre/affine-block-frame@0.26.0
  - @labre/affine-block-image@0.26.0
  - @labre/affine-block-latex@0.26.0
  - @labre/affine-block-list@0.26.0
  - @labre/affine-block-note@0.26.0
  - @labre/affine-block-paragraph@0.26.0
  - @labre/affine-block-surface@0.26.0
  - @labre/affine-block-surface-ref@0.26.0
  - @labre/affine-block-table@0.26.0
  - @labre/affine-fragment-adapter-panel@0.26.0
  - @labre/affine-fragment-doc-title@0.26.0
  - @labre/affine-fragment-frame-panel@0.26.0
  - @labre/affine-fragment-outline@0.26.0
  - @labre/affine-gfx-brush@0.26.0
  - @labre/affine-gfx-connector@0.26.0
  - @labre/affine-gfx-ddd-aggregate@0.26.0
  - @labre/affine-gfx-ddd-context-map@0.26.0
  - @labre/affine-gfx-ddd-core-domain@0.26.0
  - @labre/affine-gfx-ddd-event-storming@0.26.0
  - @labre/affine-gfx-group@0.26.0
  - @labre/affine-gfx-link@0.26.0
  - @labre/affine-gfx-note@0.26.0
  - @labre/affine-gfx-pointer@0.26.0
  - @labre/affine-gfx-shape@0.26.0
  - @labre/affine-gfx-template@0.26.0
  - @labre/affine-gfx-text@0.26.0
  - @labre/affine-inline-comment@0.26.0
  - @labre/affine-inline-footnote@0.26.0
  - @labre/affine-inline-latex@0.26.0
  - @labre/affine-inline-link@0.26.0
  - @labre/affine-inline-mention@0.26.0
  - @labre/affine-inline-preset@0.26.0
  - @labre/affine-inline-reference@0.26.0
  - @labre/affine-rich-text@0.26.0
  - @labre/affine-shared@0.26.0
  - @labre/affine-widget-drag-handle@0.26.0
  - @labre/affine-widget-edgeless-auto-connect@0.26.0
  - @labre/affine-widget-edgeless-dragging-area@0.26.0
  - @labre/affine-widget-edgeless-selected-rect@0.26.0
  - @labre/affine-widget-edgeless-toolbar@0.26.0
  - @labre/affine-widget-edgeless-zoom-toolbar@0.26.0
  - @labre/affine-widget-frame-title@0.26.0
  - @labre/affine-widget-linked-doc@0.26.0
  - @labre/affine-widget-note-slicer@0.26.0
  - @labre/affine-widget-page-dragging-area@0.26.0
  - @labre/affine-widget-remote-selection@0.26.0
  - @labre/affine-widget-scroll-anchoring@0.26.0
  - @labre/affine-widget-viewport-overlay@0.26.0
  - @labre/data-view@0.26.0
  - @labre/affine-foundation@0.26.0
  - @labre/affine-widget-slash-menu@0.26.0
  - @labre/affine-ext-loader@0.26.0
  - @labre/affine-gfx-turbo-renderer@0.26.0
  - @labre/global@0.26.0
  - @labre/std@0.26.0
  - @labre/store@0.26.0
  - @labre/sync@0.26.0

## 0.25.0

### Minor Changes

- 66cd7e6: feat(blocks): ship each DDD senior button as its own package + bundle

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

### Patch Changes

- Updated dependencies [8960a6c]
- Updated dependencies [6795191]
  - @labre/affine-block-database@0.25.0
  - @labre/affine-model@0.25.0
  - @labre/affine-components@0.25.0
  - @labre/affine-widget-toolbar@0.25.0
  - @labre/affine-gfx-wardley@0.25.0
  - @labre/affine-gfx-bpmn@0.25.0
  - @labre/affine-gfx-cynefin-estuarine@0.25.0
  - @labre/affine-gfx-edgy@0.25.0
  - @labre/affine-gfx-mindmap@0.25.0
  - @labre/affine-gfx-ddd-shared@0.25.0
  - @labre/affine-block-data-view@0.25.0
  - @labre/affine-block-root@0.25.0
  - @labre/affine-widget-keyboard-toolbar@0.25.0
  - @labre/affine-block-attachment@0.25.0
  - @labre/affine-block-bookmark@0.25.0
  - @labre/affine-block-callout@0.25.0
  - @labre/affine-block-code@0.25.0
  - @labre/affine-block-divider@0.25.0
  - @labre/affine-block-edgeless-text@0.25.0
  - @labre/affine-block-embed@0.25.0
  - @labre/affine-block-embed-doc@0.25.0
  - @labre/affine-block-frame@0.25.0
  - @labre/affine-block-image@0.25.0
  - @labre/affine-block-latex@0.25.0
  - @labre/affine-block-list@0.25.0
  - @labre/affine-block-note@0.25.0
  - @labre/affine-block-paragraph@0.25.0
  - @labre/affine-block-surface@0.25.0
  - @labre/affine-block-surface-ref@0.25.0
  - @labre/affine-block-table@0.25.0
  - @labre/affine-fragment-adapter-panel@0.25.0
  - @labre/affine-fragment-doc-title@0.25.0
  - @labre/affine-fragment-frame-panel@0.25.0
  - @labre/affine-fragment-outline@0.25.0
  - @labre/affine-gfx-brush@0.25.0
  - @labre/affine-gfx-connector@0.25.0
  - @labre/affine-gfx-ddd-aggregate@0.25.0
  - @labre/affine-gfx-ddd-context-map@0.25.0
  - @labre/affine-gfx-ddd-core-domain@0.25.0
  - @labre/affine-gfx-ddd-event-storming@0.25.0
  - @labre/affine-gfx-group@0.25.0
  - @labre/affine-gfx-link@0.25.0
  - @labre/affine-gfx-note@0.25.0
  - @labre/affine-gfx-pointer@0.25.0
  - @labre/affine-gfx-shape@0.25.0
  - @labre/affine-gfx-template@0.25.0
  - @labre/affine-gfx-text@0.25.0
  - @labre/affine-inline-comment@0.25.0
  - @labre/affine-inline-footnote@0.25.0
  - @labre/affine-inline-latex@0.25.0
  - @labre/affine-inline-link@0.25.0
  - @labre/affine-inline-mention@0.25.0
  - @labre/affine-inline-preset@0.25.0
  - @labre/affine-inline-reference@0.25.0
  - @labre/affine-rich-text@0.25.0
  - @labre/affine-shared@0.25.0
  - @labre/affine-widget-drag-handle@0.25.0
  - @labre/affine-widget-edgeless-auto-connect@0.25.0
  - @labre/affine-widget-edgeless-dragging-area@0.25.0
  - @labre/affine-widget-edgeless-selected-rect@0.25.0
  - @labre/affine-widget-edgeless-toolbar@0.25.0
  - @labre/affine-widget-edgeless-zoom-toolbar@0.25.0
  - @labre/affine-widget-frame-title@0.25.0
  - @labre/affine-widget-linked-doc@0.25.0
  - @labre/affine-widget-note-slicer@0.25.0
  - @labre/affine-widget-page-dragging-area@0.25.0
  - @labre/affine-widget-remote-selection@0.25.0
  - @labre/affine-widget-scroll-anchoring@0.25.0
  - @labre/affine-widget-viewport-overlay@0.25.0
  - @labre/data-view@0.25.0
  - @labre/affine-foundation@0.25.0
  - @labre/affine-widget-slash-menu@0.25.0
  - @labre/affine-ext-loader@0.25.0
  - @labre/affine-gfx-turbo-renderer@0.25.0
  - @labre/global@0.25.0
  - @labre/std@0.25.0
  - @labre/store@0.25.0
  - @labre/sync@0.25.0

## 0.24.0

### Minor Changes

- bc31490: feat(edgeless): add Domain-Driven Design framework tools

  Three independently flag-gated edgeless senior buttons — Event Storming
  (Brandolini colour-coded stickies), Core Domain Chart (a new drawn background
  element + sub-domain dots, movement arrows and a Notation legend) and Context
  Map (bounded-context bubbles + the nine relationship patterns) — plus
  dedicated Templates-panel sections: one per senior button (Event Storming,
  Core Domain Chart, Context Map) and a standalone Aggregate Design Canvas.

  All three sub-menus compose the same shared prefab builders (sticky, dot,
  bubble, connector, group) over native shape/connector/text/group elements, so
  only the Core Domain Chart background adds a new element model. Flags:
  `ddd-event-storming`, `ddd-core-domain`, `ddd-context-map`, `ddd-templates`.

  A senior-button flag gates only its toolbar button: Core Domain Chart
  rendering (element view, painter, interaction and contextual toolbar) is
  always registered, so disabling `ddd-core-domain` no longer un-paints existing
  charts, and Templates-panel insertion still renders them.

- bc31490: feat(edgeless): split the "Others" toolbox into a dedicated Mind Map button

  The combined senior button now splits in two:

  - **Mind Map** — a dedicated senior button (the mindmap glyph, the `m` shortcut,
    the style picker + import), flag-gated by `mindmap`.
  - **Others** — keeps free-text and add-file, flag-gated by a new `other` flag
    (it no longer rides the `mindmap` flag), same basket icon minus the mindmap.

  Both buttons share one parameterized component/menu (`variant`). Mindmap
  rendering (element view, painter, interaction, contextual toolbars) is now
  always registered, independent of either flag — so disabling a button never
  un-paints existing mindmaps nor breaks Templates-panel insertion.

  A new **"Mind Map"** section in the Templates panel offers the 4 built-in styles
  as starter mindmaps. Inserting a mindmap template required teaching the
  template id-regeneration middleware (`replaceIdMiddleware`) to remap a mindmap's
  node-id references (`children` keys + `parent` back-refs), so inserted mindmaps
  rebuild correctly.

### Patch Changes

- Updated dependencies [bc31490]
- Updated dependencies [bc31490]
- Updated dependencies [bc31490]
  - @labre/affine-gfx-ddd@0.24.0
  - @labre/affine-gfx-mindmap@0.24.0
  - @labre/affine-gfx-template@0.24.0
  - @labre/affine-gfx-wardley@0.24.0
  - @labre/affine-block-root@0.24.0
  - @labre/affine-gfx-bpmn@0.24.0
  - @labre/affine-gfx-cynefin-estuarine@0.24.0
  - @labre/affine-gfx-edgy@0.24.0
  - @labre/affine-block-attachment@0.24.0
  - @labre/affine-block-bookmark@0.24.0
  - @labre/affine-block-callout@0.24.0
  - @labre/affine-block-code@0.24.0
  - @labre/affine-block-data-view@0.24.0
  - @labre/affine-block-database@0.24.0
  - @labre/affine-block-divider@0.24.0
  - @labre/affine-block-edgeless-text@0.24.0
  - @labre/affine-block-embed@0.24.0
  - @labre/affine-block-embed-doc@0.24.0
  - @labre/affine-block-frame@0.24.0
  - @labre/affine-block-image@0.24.0
  - @labre/affine-block-latex@0.24.0
  - @labre/affine-block-list@0.24.0
  - @labre/affine-block-note@0.24.0
  - @labre/affine-block-paragraph@0.24.0
  - @labre/affine-block-surface@0.24.0
  - @labre/affine-block-surface-ref@0.24.0
  - @labre/affine-block-table@0.24.0
  - @labre/affine-components@0.24.0
  - @labre/data-view@0.24.0
  - @labre/affine-ext-loader@0.24.0
  - @labre/affine-foundation@0.24.0
  - @labre/affine-fragment-adapter-panel@0.24.0
  - @labre/affine-fragment-doc-title@0.24.0
  - @labre/affine-fragment-frame-panel@0.24.0
  - @labre/affine-fragment-outline@0.24.0
  - @labre/affine-gfx-brush@0.24.0
  - @labre/affine-gfx-connector@0.24.0
  - @labre/affine-gfx-group@0.24.0
  - @labre/affine-gfx-link@0.24.0
  - @labre/affine-gfx-note@0.24.0
  - @labre/affine-gfx-pointer@0.24.0
  - @labre/affine-gfx-shape@0.24.0
  - @labre/affine-gfx-text@0.24.0
  - @labre/affine-gfx-turbo-renderer@0.24.0
  - @labre/affine-inline-comment@0.24.0
  - @labre/affine-inline-footnote@0.24.0
  - @labre/affine-inline-latex@0.24.0
  - @labre/affine-inline-link@0.24.0
  - @labre/affine-inline-mention@0.24.0
  - @labre/affine-inline-preset@0.24.0
  - @labre/affine-inline-reference@0.24.0
  - @labre/affine-model@0.24.0
  - @labre/affine-rich-text@0.24.0
  - @labre/affine-shared@0.24.0
  - @labre/affine-widget-drag-handle@0.24.0
  - @labre/affine-widget-edgeless-auto-connect@0.24.0
  - @labre/affine-widget-edgeless-dragging-area@0.24.0
  - @labre/affine-widget-edgeless-selected-rect@0.24.0
  - @labre/affine-widget-edgeless-toolbar@0.24.0
  - @labre/affine-widget-edgeless-zoom-toolbar@0.24.0
  - @labre/affine-widget-frame-title@0.24.0
  - @labre/affine-widget-keyboard-toolbar@0.24.0
  - @labre/affine-widget-linked-doc@0.24.0
  - @labre/affine-widget-note-slicer@0.24.0
  - @labre/affine-widget-page-dragging-area@0.24.0
  - @labre/affine-widget-remote-selection@0.24.0
  - @labre/affine-widget-scroll-anchoring@0.24.0
  - @labre/affine-widget-slash-menu@0.24.0
  - @labre/affine-widget-toolbar@0.24.0
  - @labre/affine-widget-viewport-overlay@0.24.0
  - @labre/global@0.24.0
  - @labre/std@0.24.0
  - @labre/store@0.24.0
  - @labre/sync@0.24.0

## 0.23.3

### Patch Changes

- Updated dependencies
  - @labre/affine-shared@0.23.3
  - @labre/affine-block-attachment@0.23.3
  - @labre/affine-block-bookmark@0.23.3
  - @labre/affine-block-callout@0.23.3
  - @labre/affine-block-code@0.23.3
  - @labre/affine-block-data-view@0.23.3
  - @labre/affine-block-database@0.23.3
  - @labre/affine-block-divider@0.23.3
  - @labre/affine-block-edgeless-text@0.23.3
  - @labre/affine-block-embed@0.23.3
  - @labre/affine-block-embed-doc@0.23.3
  - @labre/affine-block-frame@0.23.3
  - @labre/affine-block-image@0.23.3
  - @labre/affine-block-latex@0.23.3
  - @labre/affine-block-list@0.23.3
  - @labre/affine-block-note@0.23.3
  - @labre/affine-block-paragraph@0.23.3
  - @labre/affine-block-root@0.23.3
  - @labre/affine-block-surface@0.23.3
  - @labre/affine-block-surface-ref@0.23.3
  - @labre/affine-block-table@0.23.3
  - @labre/affine-components@0.23.3
  - @labre/data-view@0.23.3
  - @labre/affine-foundation@0.23.3
  - @labre/affine-fragment-adapter-panel@0.23.3
  - @labre/affine-fragment-doc-title@0.23.3
  - @labre/affine-fragment-frame-panel@0.23.3
  - @labre/affine-fragment-outline@0.23.3
  - @labre/affine-gfx-bpmn@0.23.3
  - @labre/affine-gfx-brush@0.23.3
  - @labre/affine-gfx-connector@0.23.3
  - @labre/affine-gfx-cynefin-estuarine@0.23.3
  - @labre/affine-gfx-edgy@0.23.3
  - @labre/affine-gfx-group@0.23.3
  - @labre/affine-gfx-link@0.23.3
  - @labre/affine-gfx-mindmap@0.23.3
  - @labre/affine-gfx-note@0.23.3
  - @labre/affine-gfx-pointer@0.23.3
  - @labre/affine-gfx-shape@0.23.3
  - @labre/affine-gfx-template@0.23.3
  - @labre/affine-gfx-text@0.23.3
  - @labre/affine-gfx-wardley@0.23.3
  - @labre/affine-inline-comment@0.23.3
  - @labre/affine-inline-footnote@0.23.3
  - @labre/affine-inline-latex@0.23.3
  - @labre/affine-inline-link@0.23.3
  - @labre/affine-inline-mention@0.23.3
  - @labre/affine-inline-preset@0.23.3
  - @labre/affine-inline-reference@0.23.3
  - @labre/affine-rich-text@0.23.3
  - @labre/affine-widget-drag-handle@0.23.3
  - @labre/affine-widget-edgeless-auto-connect@0.23.3
  - @labre/affine-widget-edgeless-dragging-area@0.23.3
  - @labre/affine-widget-edgeless-selected-rect@0.23.3
  - @labre/affine-widget-edgeless-toolbar@0.23.3
  - @labre/affine-widget-edgeless-zoom-toolbar@0.23.3
  - @labre/affine-widget-frame-title@0.23.3
  - @labre/affine-widget-keyboard-toolbar@0.23.3
  - @labre/affine-widget-linked-doc@0.23.3
  - @labre/affine-widget-note-slicer@0.23.3
  - @labre/affine-widget-page-dragging-area@0.23.3
  - @labre/affine-widget-remote-selection@0.23.3
  - @labre/affine-widget-scroll-anchoring@0.23.3
  - @labre/affine-widget-slash-menu@0.23.3
  - @labre/affine-widget-toolbar@0.23.3
  - @labre/affine-widget-viewport-overlay@0.23.3
  - @labre/affine-ext-loader@0.23.3
  - @labre/affine-gfx-turbo-renderer@0.23.3
  - @labre/affine-model@0.23.3
  - @labre/global@0.23.3
  - @labre/std@0.23.3
  - @labre/store@0.23.3
  - @labre/sync@0.23.3

## 0.23.2

### Patch Changes

- Updated dependencies [ee682da]
  - @labre/affine-shared@0.23.2
  - @labre/affine-block-attachment@0.23.2
  - @labre/affine-block-bookmark@0.23.2
  - @labre/affine-block-callout@0.23.2
  - @labre/affine-block-code@0.23.2
  - @labre/affine-block-data-view@0.23.2
  - @labre/affine-block-database@0.23.2
  - @labre/affine-block-divider@0.23.2
  - @labre/affine-block-edgeless-text@0.23.2
  - @labre/affine-block-embed@0.23.2
  - @labre/affine-block-embed-doc@0.23.2
  - @labre/affine-block-frame@0.23.2
  - @labre/affine-block-image@0.23.2
  - @labre/affine-block-latex@0.23.2
  - @labre/affine-block-list@0.23.2
  - @labre/affine-block-note@0.23.2
  - @labre/affine-block-paragraph@0.23.2
  - @labre/affine-block-root@0.23.2
  - @labre/affine-block-surface@0.23.2
  - @labre/affine-block-surface-ref@0.23.2
  - @labre/affine-block-table@0.23.2
  - @labre/affine-components@0.23.2
  - @labre/data-view@0.23.2
  - @labre/affine-foundation@0.23.2
  - @labre/affine-fragment-adapter-panel@0.23.2
  - @labre/affine-fragment-doc-title@0.23.2
  - @labre/affine-fragment-frame-panel@0.23.2
  - @labre/affine-fragment-outline@0.23.2
  - @labre/affine-gfx-bpmn@0.23.2
  - @labre/affine-gfx-brush@0.23.2
  - @labre/affine-gfx-connector@0.23.2
  - @labre/affine-gfx-cynefin-estuarine@0.23.2
  - @labre/affine-gfx-edgy@0.23.2
  - @labre/affine-gfx-group@0.23.2
  - @labre/affine-gfx-link@0.23.2
  - @labre/affine-gfx-mindmap@0.23.2
  - @labre/affine-gfx-note@0.23.2
  - @labre/affine-gfx-pointer@0.23.2
  - @labre/affine-gfx-shape@0.23.2
  - @labre/affine-gfx-template@0.23.2
  - @labre/affine-gfx-text@0.23.2
  - @labre/affine-gfx-wardley@0.23.2
  - @labre/affine-inline-comment@0.23.2
  - @labre/affine-inline-footnote@0.23.2
  - @labre/affine-inline-latex@0.23.2
  - @labre/affine-inline-link@0.23.2
  - @labre/affine-inline-mention@0.23.2
  - @labre/affine-inline-preset@0.23.2
  - @labre/affine-inline-reference@0.23.2
  - @labre/affine-rich-text@0.23.2
  - @labre/affine-widget-drag-handle@0.23.2
  - @labre/affine-widget-edgeless-auto-connect@0.23.2
  - @labre/affine-widget-edgeless-dragging-area@0.23.2
  - @labre/affine-widget-edgeless-selected-rect@0.23.2
  - @labre/affine-widget-edgeless-toolbar@0.23.2
  - @labre/affine-widget-edgeless-zoom-toolbar@0.23.2
  - @labre/affine-widget-frame-title@0.23.2
  - @labre/affine-widget-keyboard-toolbar@0.23.2
  - @labre/affine-widget-linked-doc@0.23.2
  - @labre/affine-widget-note-slicer@0.23.2
  - @labre/affine-widget-page-dragging-area@0.23.2
  - @labre/affine-widget-remote-selection@0.23.2
  - @labre/affine-widget-scroll-anchoring@0.23.2
  - @labre/affine-widget-slash-menu@0.23.2
  - @labre/affine-widget-toolbar@0.23.2
  - @labre/affine-widget-viewport-overlay@0.23.2
  - @labre/affine-ext-loader@0.23.2
  - @labre/affine-gfx-turbo-renderer@0.23.2
  - @labre/affine-model@0.23.2
  - @labre/global@0.23.2
  - @labre/std@0.23.2
  - @labre/store@0.23.2
  - @labre/sync@0.23.2

## 0.23.1

### Patch Changes

- Updated dependencies [1beb60e]
  - @labre/affine-shared@0.23.1
  - @labre/affine-block-attachment@0.23.1
  - @labre/affine-block-bookmark@0.23.1
  - @labre/affine-block-callout@0.23.1
  - @labre/affine-block-code@0.23.1
  - @labre/affine-block-data-view@0.23.1
  - @labre/affine-block-database@0.23.1
  - @labre/affine-block-divider@0.23.1
  - @labre/affine-block-edgeless-text@0.23.1
  - @labre/affine-block-embed@0.23.1
  - @labre/affine-block-embed-doc@0.23.1
  - @labre/affine-block-frame@0.23.1
  - @labre/affine-block-image@0.23.1
  - @labre/affine-block-latex@0.23.1
  - @labre/affine-block-list@0.23.1
  - @labre/affine-block-note@0.23.1
  - @labre/affine-block-paragraph@0.23.1
  - @labre/affine-block-root@0.23.1
  - @labre/affine-block-surface@0.23.1
  - @labre/affine-block-surface-ref@0.23.1
  - @labre/affine-block-table@0.23.1
  - @labre/affine-components@0.23.1
  - @labre/data-view@0.23.1
  - @labre/affine-foundation@0.23.1
  - @labre/affine-fragment-adapter-panel@0.23.1
  - @labre/affine-fragment-doc-title@0.23.1
  - @labre/affine-fragment-frame-panel@0.23.1
  - @labre/affine-fragment-outline@0.23.1
  - @labre/affine-gfx-bpmn@0.23.1
  - @labre/affine-gfx-brush@0.23.1
  - @labre/affine-gfx-connector@0.23.1
  - @labre/affine-gfx-cynefin-estuarine@0.23.1
  - @labre/affine-gfx-edgy@0.23.1
  - @labre/affine-gfx-group@0.23.1
  - @labre/affine-gfx-link@0.23.1
  - @labre/affine-gfx-mindmap@0.23.1
  - @labre/affine-gfx-note@0.23.1
  - @labre/affine-gfx-pointer@0.23.1
  - @labre/affine-gfx-shape@0.23.1
  - @labre/affine-gfx-template@0.23.1
  - @labre/affine-gfx-text@0.23.1
  - @labre/affine-gfx-wardley@0.23.1
  - @labre/affine-inline-comment@0.23.1
  - @labre/affine-inline-footnote@0.23.1
  - @labre/affine-inline-latex@0.23.1
  - @labre/affine-inline-link@0.23.1
  - @labre/affine-inline-mention@0.23.1
  - @labre/affine-inline-preset@0.23.1
  - @labre/affine-inline-reference@0.23.1
  - @labre/affine-rich-text@0.23.1
  - @labre/affine-widget-drag-handle@0.23.1
  - @labre/affine-widget-edgeless-auto-connect@0.23.1
  - @labre/affine-widget-edgeless-dragging-area@0.23.1
  - @labre/affine-widget-edgeless-selected-rect@0.23.1
  - @labre/affine-widget-edgeless-toolbar@0.23.1
  - @labre/affine-widget-edgeless-zoom-toolbar@0.23.1
  - @labre/affine-widget-frame-title@0.23.1
  - @labre/affine-widget-keyboard-toolbar@0.23.1
  - @labre/affine-widget-linked-doc@0.23.1
  - @labre/affine-widget-note-slicer@0.23.1
  - @labre/affine-widget-page-dragging-area@0.23.1
  - @labre/affine-widget-remote-selection@0.23.1
  - @labre/affine-widget-scroll-anchoring@0.23.1
  - @labre/affine-widget-slash-menu@0.23.1
  - @labre/affine-widget-toolbar@0.23.1
  - @labre/affine-widget-viewport-overlay@0.23.1
  - @labre/affine-ext-loader@0.23.1
  - @labre/affine-gfx-turbo-renderer@0.23.1
  - @labre/affine-model@0.23.1
  - @labre/global@0.23.1
  - @labre/std@0.23.1
  - @labre/store@0.23.1
  - @labre/sync@0.23.1

## 0.23.0

### Patch Changes

- Updated dependencies [9014c87]
- Updated dependencies [c775151]
- Updated dependencies [c775151]
- Updated dependencies [d2f435f]
  - @labre/affine-gfx-bpmn@0.23.0
  - @labre/affine-model@0.23.0
  - @labre/affine-block-surface@0.23.0
  - @labre/affine-shared@0.23.0
  - @labre/affine-gfx-cynefin-estuarine@0.23.0
  - @labre/affine-gfx-template@0.23.0
  - @labre/affine-gfx-wardley@0.23.0
  - @labre/affine-gfx-edgy@0.23.0
  - @labre/affine-widget-edgeless-toolbar@0.23.0
  - @labre/affine-block-attachment@0.23.0
  - @labre/affine-block-bookmark@0.23.0
  - @labre/affine-block-callout@0.23.0
  - @labre/affine-block-code@0.23.0
  - @labre/affine-block-data-view@0.23.0
  - @labre/affine-block-database@0.23.0
  - @labre/affine-block-divider@0.23.0
  - @labre/affine-block-edgeless-text@0.23.0
  - @labre/affine-block-embed@0.23.0
  - @labre/affine-block-embed-doc@0.23.0
  - @labre/affine-block-frame@0.23.0
  - @labre/affine-block-image@0.23.0
  - @labre/affine-block-latex@0.23.0
  - @labre/affine-block-list@0.23.0
  - @labre/affine-block-note@0.23.0
  - @labre/affine-block-paragraph@0.23.0
  - @labre/affine-block-root@0.23.0
  - @labre/affine-block-surface-ref@0.23.0
  - @labre/affine-block-table@0.23.0
  - @labre/affine-components@0.23.0
  - @labre/affine-fragment-adapter-panel@0.23.0
  - @labre/affine-fragment-doc-title@0.23.0
  - @labre/affine-fragment-frame-panel@0.23.0
  - @labre/affine-fragment-outline@0.23.0
  - @labre/affine-gfx-brush@0.23.0
  - @labre/affine-gfx-connector@0.23.0
  - @labre/affine-gfx-group@0.23.0
  - @labre/affine-gfx-link@0.23.0
  - @labre/affine-gfx-mindmap@0.23.0
  - @labre/affine-gfx-note@0.23.0
  - @labre/affine-gfx-pointer@0.23.0
  - @labre/affine-gfx-shape@0.23.0
  - @labre/affine-gfx-text@0.23.0
  - @labre/affine-inline-comment@0.23.0
  - @labre/affine-inline-footnote@0.23.0
  - @labre/affine-inline-latex@0.23.0
  - @labre/affine-inline-link@0.23.0
  - @labre/affine-inline-mention@0.23.0
  - @labre/affine-inline-preset@0.23.0
  - @labre/affine-inline-reference@0.23.0
  - @labre/affine-rich-text@0.23.0
  - @labre/affine-widget-drag-handle@0.23.0
  - @labre/affine-widget-edgeless-auto-connect@0.23.0
  - @labre/affine-widget-edgeless-dragging-area@0.23.0
  - @labre/affine-widget-edgeless-selected-rect@0.23.0
  - @labre/affine-widget-edgeless-zoom-toolbar@0.23.0
  - @labre/affine-widget-frame-title@0.23.0
  - @labre/affine-widget-keyboard-toolbar@0.23.0
  - @labre/affine-widget-linked-doc@0.23.0
  - @labre/affine-widget-note-slicer@0.23.0
  - @labre/affine-widget-page-dragging-area@0.23.0
  - @labre/affine-widget-remote-selection@0.23.0
  - @labre/affine-widget-scroll-anchoring@0.23.0
  - @labre/affine-widget-toolbar@0.23.0
  - @labre/affine-widget-viewport-overlay@0.23.0
  - @labre/data-view@0.23.0
  - @labre/affine-foundation@0.23.0
  - @labre/affine-widget-slash-menu@0.23.0
  - @labre/affine-ext-loader@0.23.0
  - @labre/affine-gfx-turbo-renderer@0.23.0
  - @labre/global@0.23.0
  - @labre/std@0.23.0
  - @labre/store@0.23.0
  - @labre/sync@0.23.0
