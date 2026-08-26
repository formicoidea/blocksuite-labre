# @labre/std

## 0.32.0

### Minor Changes

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
    land on `ValidationManager.checkup# @labre/std
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

- fad4c08: feat(edgeless): no rule is a wall — validation exceptions (PF8)

  A rule that cannot be waived is a wall, and a whiteboard with walls stops being
  a thinking tool. Every violation now carries its own way out, on the message
  that reports it.

  - **One click, on the bubble.** Each rule named in the violation bubble carries
    an "Ignore this validation rule" action. No detour through a settings panel,
    and no waiting: the gesture applies immediately.
  - **The exception is written on the element.** It lands in the document as
    `{ ruleId, author?, at }`, on the elements the rule actually indicts — so it
    says nothing about the next component, and nothing about the next rule. It
    rides along on a copy, a duplicate, a "turn into linked doc" and an export,
    and it dies with the element it belongs to.
  - **The finding changes state, it does not vanish.** An excused violation is
    still reported: it drops out of the flash and the bracket and its badge goes
    grey, but it keeps its line in the bubble, now reading "exception" and
    carrying a **Revoke** that puts it straight back. A board can never hide an
    arbitration it was told to make.
  - **One map, once you have said it twice.** After the same rule has been waived
    somewhere else on the board, the bubble offers "Ignore this rule on the whole
    map". Accepting writes the exception on the framework's own background
    element — and on THAT one only. A violation of `element-in-background` now
    records the background it is attributed to: since no background contained the
    element (that is what the violation says), it is the NEAREST one, by
    edge-to-edge gap, with exact ties broken by the smaller id so the answer never
    depends on the order the surface was walked in. A board carrying three maps
    therefore holds three independent arbitrations: waiving a rule on one says
    nothing about the map beside it, and deleting a map takes exactly its own
    arbitration with it. Map scope is just as visible and just as revocable as a
    local one.
  - **Arbitrations survive the framework cycle.** Switching a framework off stops
    evaluation and cleans nothing; switching it back on brings the violations
    back, minus the ones an exception covers. Nothing is ever garbage-collected
    behind the user's back.
  - **And it can always be undone.** `validationExceptions` is the first prop
    whose normal life includes being REMOVED — undoing a waiver deletes the key —
    and a Y.Map delete reports only `oldValues`. Both re-evaluation guards now
    read it, so an undo brings the live violation straight back instead of
    freezing the board on a stale verdict behind a dead Revoke button.

  Two new telemetry events, `ValidationExceptionGranted` and
  `ValidationExceptionRevoked`, carry the rule id, the framework, the scope and
  how many elements one gesture touched — never board content. A rule waived on
  every board is a rule that is wrong, and this is the only place that says so.

  **Persistence.** One new optional `@field()` on the base element model,
  `validationExceptions`. Declared on the BASE class, exactly like `role` before
  it, because an element re-created from props only reaches the Y.Map through
  declared accessors and a per-subclass declaration would be silently dropped on
  copy. Its default is `undefined` and is never written, so an element that never
  got an exception stays byte-identical to one created before the field existed:
  no block schema change, no version bump, no migration, and documents written
  before and after remain mutually loadable. Revoking the last exception removes
  the KEY rather than assigning `undefined`, which the `@field()` setter would
  have written into the Y.Map — so an element whose exceptions were all revoked
  is byte-identical again too, in the document and not merely through the getter.
  `GfxPrimitiveElementModel.clearField` is the counterpart `@field()` was missing.
  It removes DECLARED, non-structural fields only: an undeclared key (an
  annotation preserved verbatim for a newer client) and the fields nothing can
  cope without (`index`, `seed`, `xywh`) are refused with a warning, so a new
  delete path into the document cannot undo what the unknown-props deny-list
  protects.

  A conformant board pays nothing: exceptions are only looked up for a rule that
  actually raised something. On the 500-element reference map, where half the
  population is in violation, the 16 ms budget still has roughly seventy times the
  headroom it needs.

- 7b66d8d: feat(edgeless): one framework, several levels of requirement (PF9)
  A rule used to bite at exactly one strength, decided once by whoever wrote it,
  for everybody. That is the wrong shape for a tool where a rough sketch and a
  deliverable diagram live on the same canvas: the level of requirement is not a
  property of the rule, it is a property of the WORK.
  A framework now ships **profiles** — declarative, versioned data, like its
  rules, its roles and its background. A profile says, for each rule of its
  framework, how hard that rule bites, or that it does not apply at all.
  Wardley ships two:
  - **Sketch** (the default): the pilot rule drops to `audit`. The finding is
    still reported to `violations# @labre/std
    , so a host panel and a conformance report see
    it — the canvas simply says nothing. Nobody thinking out loud gets
    interrupted.
  - **Strict**: the pilot rule bites at `warning`, and the canvas affordance
    (PF7) appears as before. Still never blocking — strict is a level of
    attention, not a wall.
  **The choice is per ROOT INSTANCE, not per document** (PF9.1). Two maps on one
  board hold two independent levels: a sketch can sit next to a deliverable
  without either dictating the other's requirements. The engine reads the profile
  off the background a finding was measured against — an id it already recorded.
  ### What is persisted
  One optional flat string, `validationProfile`, declared as a `@field()` on the
  element base class — the same place and the same reasoning as `role` (PF1) and
  `validationExceptions` (PF8): an element re-created from props only reaches the
  Y.Map through declared accessors, so anything declared per subclass is silently
  dropped on copy. Duplicating a strict map gives a strict map; an export carries
  it; a peer sees it; undo undoes it.
  The default writes NOTHING. `undefined` resolves to the framework's default
  profile, and choosing the default back again removes the key rather than
  writing it — so a map that never left the default is byte-identical to one
  created before profiles existed, and one that tried strict and came back leaves
  no trace. Optional field, no schema version bump, no migration, no backfill.
  ### Cost
  A rule that is `'off'` under every profile in play is not evaluated at all: the
  engine skips it before touching a single element. It is a skipped rule, not a
  filter over findings. The default counts as in play unconditionally, so the
  short-circuit only fires when the answer cannot change — a missed skip costs a
  linear pass, a wrong skip costs a rule that silently stops firing.
  Bench, 500-element reference map: 0.141 ms unchanged, 0.275 ms with profiles in
  force, 0.032 ms with every rule off, against a 16 ms frame budget. Flag off
  still costs one empty-map check.
  ### Where the choice lives
  Select a map and a small chip above its top-left corner names the level in
  force and offers the others. It is **not** on the violation bubble, on purpose:
  on the permissive default nothing is ever drawn, so a bubble-only selector
  would make the strict profile reachable only through a violation the permissive
  profile has already silenced — a one-way door. Selection is the one gesture
  that is always available. Profile names are i18n keys resolved through the host
  catalogue, with the framework's own wording as the fallback.
  The chip is derived from the REGISTERED rules (`backgroundRole`), so it is
  gated by the framework flag for free: flag off, no rule, no profile offered,
  and the id already written on a map simply goes unread until the flag comes
  back.
  ### What it does not touch
  Exceptions (PF8). Raising the level does not resurrect a decision the user made,
  and lowering it does not quietly delete one — the two are orthogonal, and the
  engine reads exceptions last, independently of the profile.
  A new typed telemetry event, `ValidationProfileChanged`, carries the framework
  and the profile ids and nothing else. A choice that changes nothing is not a
  decision and is not reported.
  ### Behaviour change
  A Wardley map now opens on the permissive default, so an off-map component no
  longer draws a bracket or a badge until its map is put on **Strict**. That is
  the point — the sketch wins — but it does mean the PF7/PF8 canvas affordance is
  opt-in per map from here on.
- 8d33c60: W3 measures the words, not the box they were written in

  The overlap rule was reporting things nobody can see. Two captures from the
  acceptance, same cause: a Wardley label is created 120 to 200 units wide
  whatever it says, so a name of three letters leaves most of its box blank —
  and the rule was measuring the box. A dependency crossing that empty margin
  raised label/link; two labels whose words were thirty units apart raised
  label/label.

  **A role can now say it is TEXT** (`RoleKind` gains a third value next to
  `node` and `edge`, hence the `minor` on `@labre/std`). `no-overlap` measures a
  `text` role by the ink its words occupy inside its box, placed where the
  alignment puts it — and hands a ROTATED text its whole box back, because
  narrowing one is how a miss gets built rather than a warning too many.

  The engine still measures nothing on a canvas: a `measureText` per label per
  pass would cost, and would make the same map validate differently depending on
  which fonts a host happens to have loaded. The width is declared, per character
  and by CLASS — thin `i l I j` and punctuation, narrow `f t r`, wide `m w M W`,
  capitals, full-width scripts, and the rest. One mean advance was the first
  answer and it read `utility` half as wide again as it is drawn, which put a
  ghost 20 units past the last letter and a false positive on every link crossing
  it. Against the real renderer at Inter 18, over a 28-name bench, the table now
  lands between 11 % narrow and dead on — **never wide, on any of them**. The
  test prints every line and fails outside ±15 %.

  **A rule can now say how deep a collision has to be.** `minPenetration`, in
  model units: how far the two geometries reach INTO each other, which for a
  link crossing a name is how far under the edge of it the line actually goes.
  Wardley's W3 declares 4 — a link grazing the top of a name and two names
  sharing a hair of ink are silent, a link through the middle of a name (13
  units deep) and a name written across a node are not.

  Nothing else moved: the same overlaps are reported, on the same pairs, with
  the same severity and the same exceptions. Documents are untouched — no
  schema, no stored value, no migration.

- 7a3458a: feat(edgeless): semantic roles on surface elements, opened by Wardley (PF1)

  Surface elements gain an optional semantic role — the identity validation
  rules will be written against, never the shape type. A role id is namespaced
  by its framework (`<framework>:<role>`, e.g. `wardley:component`).

  - `@labre/std`: new optional `role` field on the base element model
    (`GfxPrimitiveElementModel`), plus the declarative role vocabulary
    (`RoleDef` / `RoleDefs` / `roleIsA`). Declared on the BASE class so the key
    survives paste, duplicate and template insertion — an element re-created
    from props only reaches the Y.Map through declared field accessors.
  - `@labre/affine-gfx-wardley`: declares the 8 Wardley roles — the 7 node kinds
    plus the `wardley:dependency` edge — and stamps them at the creation sites.
    The hierarchy is declarative data: `wardley:market` and `wardley:ecosystem`
    specialise `wardley:component`, so a rule written on the parent applies to
    them. The anchor (user / need) is a role of its own.
  - `@labre/affine-gfx-connector`: the connector tool accepts an optional `role`
    so a framework toolbox can activate it for a typed edge. The plain connector
    tool is unaffected.

  Backward compatible, no schema version bump and no migration: the `affine:surface`
  version stays at 5, existing documents load unchanged and read as neutral
  (no role). Generalist artefacts (square, triangle, free text, inertia bar,
  background) stay neutral — no `role` key is written for them. An `undefined`
  field default is no longer written into the Y.Map at creation, so a newly
  created element that does not use an optional field is byte-identical to one
  authored before that field existed.

  The built-in Wardley templates (map presets and toolbox presets alike) are
  typed too, so a map started from a preset validates exactly like a hand-drawn
  one. Legend glyphs stay deliberately neutral: a legend documents the map, it is
  not part of it, and typing its glyphs would add phantom artefacts to any rule.

  Known gaps, left for the milestone that consumes roles — both need a
  framework-level "default edge role" that does not exist yet:

  - **Quick-connect** (the draw-connector arrow on the element toolbar) produces
    a neutral edge: it activates the connector tool without a role.
  - **Auto-complete** is asymmetric, which is the more misleading of the two: the
    auto-completed NODE is a serialize/re-create copy of its source, so it does
    inherit `wardley:component`, while the connector that joins them is created
    directly and stays neutral. The result is two correctly typed components with
    an untyped edge between them — a shape a dependency rule would read as "no
    dependency declared" rather than as a missing annotation.

  RELEASE ORDER CONSTRAINT — read before shipping anything that depends on roles.

  A client that does NOT declare the `role` field silently DROPS it when it
  re-creates an element (paste, duplicate, template insertion): only declared
  field accessors reach the Y.Map. The declaration must therefore always be
  deployed before roles start circulating.

  1. This release is the DECLARATION, and it is inert: nothing in the library
     reads `role`. All `@labre/*` packages are versioned in lockstep, so no
     client can get the Wardley writer without the base field — but a client
     still running an EARLIER version would strip roles from anything it pastes.
     Roll this version out everywhere first.
  2. Only then may role-writing features be enabled beyond Wardley, and only
     after that may role-READING features ship (validation rules, role-aware
     toolbars, host-side reporting — tranche 3).

### Patch Changes

- 832c793: A canvas block sits where a scaled host draws it

  Inside an embedded edgeless doc the host scales the whole editor, and the
  blocks that are not painted on the canvas — notes, images, every component
  built on `GfxBlockComponent` — were placed with a transform stated in the
  unscaled space. The container then scaled it again, so at any host scale other
  than 1 those blocks drifted away from their own element and from the canvas
  elements they belong next to: selection, toolbars and handles followed the
  element, the visible block did not.

  The placement now divides by the host's own scale, so block and canvas agree
  again at every scale. An unscaled editor is unaffected.

- 0bfc872: Copying between documents keeps the blocks instead of falling back to plain text

  The clipboard carries its structured payload — the block snapshot, the surface
  slice, the database slice — inside the `text/html` flavour, hidden in a
  `data-blocksuite-snapshot` attribute. That wrapper was only written when an
  adapter had produced HTML, or when the clipboard was otherwise completely
  empty. A copy that produced plain text and no HTML therefore shipped the plain
  text alone and dropped its own payload on the floor: pasting it into another
  document rebuilt whatever the plain-text fallback could guess, losing the
  blocks, the canvas elements and every property they carried — including the
  Labre ones, the semantic role of a surface element and its element docId.
  Copying cells out of a database table was the reachable case.

  The wrapper is now written whenever there is a payload to preserve, whatever
  the adapters produced. When no adapter produced HTML the copied plain text is
  escaped into the wrapper, so pasting into an outside application still shows
  the text rather than an empty box; a copy that carries no payload at all — the
  "copy code" button of an embedded HTML block — still puts plain text on the
  clipboard and nothing else. The snapshot attribute is also quoted the way the
  HTML serializer would quote it.

- 9e23b5b: A group measures its children once per change, not once per look

  The bound of a group is the union of the bounds of everything it contains, and
  it was recomputed from scratch on every single read of `xywh` — while the
  renderer, the hit test, the selection rect and the toolbar anchor read it many
  times per frame. A board with large groups spent most of a pan or a drag
  re-adding the same rectangles together.

  The union is now computed once per change instead: the surface refreshes the
  group when a child moves, is rotated, hidden, added or removed, and merely
  marks it stale for the props only some elements fold into their own bound (the
  vertices of a polygon, the label of a connector), so the next read still sees
  the right rectangle. On a group of 200 elements, 500 reads between two moves
  went from ~230 ms to ~5 ms.

  The toolbar likewise measures the selection once when it changes, instead of on
  every frame of a pan.

- d797f9a: Pen and highlighter strokes paint in the DOM, and every canvas element stacks where its layer says

  The DOM renderer knew how to paint shapes and connectors but not brush or
  highlighter strokes, so a board rendered through it lost every pen mark. Both
  strokes now have a DOM renderer of their own, drawing the same path the canvas
  renderer draws.

  Stacking was decided twice and disagreed. Each element renderer set its own
  `z-index` while a canvas layer only ever reserved a single CSS index, however
  many elements it held — so a shape and the note stacked just above it could
  claim the same value and overlap the wrong way round. A canvas layer now
  reserves one index per element, exactly like a block layer, and the `z-index`
  is written once, by the DOM renderer, for every element it paints.

- 1fa46c1: A connector label editor no longer freezes the canvas after a click and a move

  `click`, `doubleClick` and `tripleClick` are not real DOM events: the dispatcher
  synthesizes all three from a single native `pointerup`. When a handler consumed
  one of them, the dispatcher called `stopPropagation()` on that shared native
  event, and the `pointerup` never reached the listeners bound higher up on
  `document` — the drag controller, the pan tool, the connector handles, the
  auto-complete teardown. Those listeners are what end a gesture, so the gesture
  stayed open.

  The visible symptom: open an empty connector label editor, click and move.
  The label editors (connector, group title, frame title, edgeless text, shape
  text) all swallow clicks while open by returning `true`, so the pointer gesture
  was never closed and the label broke.

  Consuming a synthetic click still stops the dispatcher's own handler chain, so
  the "swallow the click" behaviour those editors rely on is unchanged; only the
  side effect on the underlying native event is gone. Native events (`pointerDown`,
  `keyDown`, drag events, …) still stop propagation as before.

- 5b6e9bb: feat(edgeless): EDGY dynamic template, blank EDGY board and dependency spotlight

  - New "EDGY dynamic" template (template panel + EDGY senior menu): the facets
    background (without writings) with the 12 EDGY elements as prefab nodes,
    linked by the 24 canonical relations of the metamodel, each carrying its
    verb as a native connector label.
  - New blank "EDGY board" background element for free-form EDGY modelling.
  - New modular spotlight-on-hover: backgrounds registered as spotlight hosts
    (`SpotlightHostExtension`) grant the elements laid inside their bounds a
    dependency highlight — hovering a node fades everything but the node, its
    connectors and their endpoints. Enabled for the EDGY facets diagram and the
    EDGY board; other frameworks (e.g. Wardley) can opt in with one line.
  - The facets element gains optional backward-compatible `showPictos`,
    `cropToCircles` and `spotlightEnabled` flags; the board gains
    `spotlightEnabled`. Both background toolbars expose a spotlight toggle.
  - The classic "Enterprise Design facets" diagram (senior menu + template
    panel) is now cropped to the circles plus a facet-label allowance — no
    more dead margins around the Venn. Existing documents keep the previous
    letterboxed rendering (`cropToCircles` defaults to false).
  - Fix: canvas view events (click/dblclick) now route to the TOPMOST view
    under the pointer (paint order), so elements laid on a background stay
    editable — previously the background could swallow the double-click.
  - EDGY template gallery: Customer journey, Service blueprint and
    Organisation chart connectors are now ATTACHED to their elements (they
    follow moves, endpoints clip to edges); the blueprint's diagonal arrows
    no longer render as orthogonal zigzags.

- 492bac6: The editor stops listening once the selection leaves it

  The event dispatcher only stood down when focus visibly moved away — a
  `focusout` naming another focusable element, or a `blur` on the host. Selecting
  text in an ordinary element outside the editor does neither: nothing takes
  focus, so no `relatedTarget` is reported and no blur fires. The editor stayed
  active over a selection that was no longer its own, and kept claiming
  keystrokes meant for whatever the reader had just highlighted — Backspace and
  undo included.

  The dispatcher now also watches `selectionchange`: when either end of the
  document selection sits outside the host, it deactivates. Clicking, hovering or
  focusing back into the editor reactivates it exactly as before.

- 30580db: Typing in Firefox no longer breaks the text it lands in

  Firefox reports selection boundaries inside `contenteditable` differently from
  Chrome — sometimes on a non-text node, sometimes on one of the comment markers
  Lit leaves between rendered fragments. The inline editor used `Range.comparePoint`
  against those boundaries to decide whether an input belonged to it, so in Firefox
  a keystroke could be judged "outside" and let through to the browser. The native
  edit then removed a Lit marker node, and the next render of that paragraph threw
  `ChildPart has no parentNode` — the block stopped updating for the rest of the
  session.

  The editor now decides ownership with plain DOM containment, always takes over
  the edit rather than letting the browser mutate its DOM, and falls back to the
  event's own target range (or a clamped selection, or a re-render) when the
  selection cannot be resolved. A selection that genuinely reaches into a
  neighbouring paragraph is still left to the range binding, and an unresolvable
  target range no longer swallows the keystroke.

- 413fe7b: Drag and drop runs on Pragmatic drag-and-drop v2

  `@atlaskit/pragmatic-drag-and-drop` moves to v2, its hitbox companion to v2 and
  its auto-scroll companion to v3. The three majors only drop the legacy
  TypeScript 4 type declarations, which we never consumed — the runtime API is
  unchanged, so dragging blocks, table rows and columns, and the edge detection
  that decides where a drop lands, all behave exactly as before.

  The bump also brings in the fixes released since 1.x: custom native drag
  previews now render in the browser's top layer instead of relying on a maximal
  `z-index`, and previews inside Safari's top layer no longer pick up stray user
  agent styles.

- 724ed1c: Surface elements no longer lose props the running element class does not
  declare. `SurfaceBlockModel._createElementFromProps` (paste, duplicate,
  alt-drag clone, "turn into linked doc") and `SurfaceBlockModel.updateElement`
  used to copy incoming props by assigning them onto the model instance, so only
  a key backed by an `@field()` accessor ever reached the Y.Map — any other key
  became a plain JavaScript property, readable in the running tab, invisible to
  every peer, and gone on reload. Both sites now forward unrecognised keys
  verbatim into the element's Y.Map.

  **This changes the semantics of every paste, duplicate, clone, "turn into
  linked doc" and programmatic bulk update: the behaviour becomes "preserve what
  we do not understand", which is already the Yjs contract everywhere else in
  the element plumbing** — every single-key field write, stash/pop, undo/redo
  and the surface snapshot transformer preserved unknown keys already; these two
  bulk-assign sites were the exception.

  Why it matters: in a mixed-version fleet, a client running an older version of
  the library could copy an element annotated by a newer one and silently strip
  the annotation. Boards drifted into a half-annotated state with no user action
  that looked like it deleted anything, and "turn into linked doc" — which
  deletes the source right after the copy — destroyed the data outright.

  **The protection is not retroactive.** A fleet is only safe once every client
  runs a version from this release on; a client pinned before it keeps stripping
  on every copy. The rollout ordering constraint still applies — ship a field's
  declaration before the features that write it. What changes is that the floor
  no longer has to include the field itself: any release from here on preserves
  fields it has never heard of.

  Keys are routed explicitly. A key the element class declared (`@field()`,
  `@local()`, or a plain accessor with a setter) goes through its accessor as
  before; anything else is unknown data and goes to the Y.Map. The routing
  deliberately does not use `key in element`, which also matches methods
  (`serialize`, `isLocked`), getter-only derived props (`x`, `y`, `w`, `h`,
  `group`, `elementBound`…) and internal fields — assigning to those corrupted
  the model or threw inside `store.transact`, which swallowed the error and
  dropped every remaining prop of the same bulk update.

  Values are validated before being written. `Y.Map.set` accepts values it cannot
  later encode — a cyclic object is stored happily and only `encodeStateAsUpdate`
  fails, breaking persistence and sync for good with nothing in the app noticing.
  An unknown prop is therefore admitted only if it is a Yjs type, a binary blob,
  a primitive, or plain acyclic JSON; anything else (function, class instance,
  cycle) is dropped with a warning, exactly as before this change. `undefined`
  never creates a key on the unknown branch, so spreading an absent option cannot
  mint a phantom key; declared fields still accept `undefined` to clear them.

  Practical consequences for callers: a junk key passed to `addElement` /
  `updateElement` is now persisted instead of being swallowed — a dead
  `controllers: []` prop was removed from the connector tool's `addElement` call
  for that reason. And because copies are now faithful, a stale key already
  present in an old document (that same `controllers`) is propagated to copies
  instead of being cleaned by them: removing a prop from the code no longer
  removes it from documents that already carry it.

  No schema change, no version bump, no migration: documents written before and
  after this release remain mutually loadable.

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

- 48e90f4: Shortcuts read the physical key only when a modifier is held

  When a keystroke did not match any binding, the keymap fell back to the
  physical key position (`keyCode`) — the way a French or Russian layout still
  reaches `Ctrl-Z` on a key that does not print `z`. That fallback was reached
  under the wrong conditions.

  It fired on any non-ASCII character even with no modifier at all, so typing
  Cyrillic `х` in a paragraph triggered whatever was bound to `[`, the physical
  key underneath. And it never fired for a plain `Ctrl` combination, so on a
  Russian layout `Ctrl` shortcuts on letter keys simply did nothing.

  The fallback now requires a modifier and ignores characters that the modifier
  itself produced (Alt on a Polish or Mac layout prints `ś`, `œ`, … — those are
  input, not shortcuts). Alt+digit keeps its fallback, so the edgeless zoom
  shortcuts `Alt-0`/`Alt-1`/`Alt-2` are unaffected. Chord shortcuts (`w` then a
  letter) never used this path and are unchanged.

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

- 4162e4a: Ungrouping leaves the elements where they were in the pile

  Ungrouping re-numbered every child with a fresh top-of-the-stack index, so a
  group taken apart in the middle of a board jumped in front of everything drawn
  above it. The children now inherit the slot the group itself occupied, and keep
  their order within it; a board written by an older version, where that slot
  cannot be expressed, falls back to the previous behaviour rather than refusing
  the gesture.

  Grouping and ungrouping also run as a single transaction each, so one undo
  takes the whole gesture back, and the selection helper that answers "which of
  these elements are the outermost ones" now walks each element up to the root
  instead of comparing every pair.

- 4bb44ef: fix(std): a fractional display scale is not an outer transform

  On displays with a fractional `devicePixelRatio` (Windows 175% → dpr 1.75),
  the editor shell's CSS width is fractional (e.g. 1009.1428833). The viewport's
  `viewScale` heuristic — meant to detect a CSS scale applied by an outer
  container in nested-editor scenarios — compared that fractional
  `getBoundingClientRect().width` against the integer-rounded `offsetWidth` and
  concluded the editor was scaled by 1.0001416. Every client→model coordinate
  conversion was then divided by that phantom factor: a 100px drag landed at
  99.98584112288302 model units, off by 0.014px per 100px everywhere pointer
  input is converted.

  `viewScale` now treats a sub-pixel difference (≤ 0.5px, the exact bound of
  `offsetWidth`'s integer rounding when no transform is applied) as scale 1.
  Genuine container transforms still register: they shift the rect width by far
  more than the rounding noise.

  Surfaced by the `element drag moving` / `block drag moving` integration tests
  failing reproducibly on a 175% Windows display — the assertions are unchanged
  and now pass exactly, because the geometry is exact again.

- Updated dependencies [a2b7c44]
- Updated dependencies [54488cd]
- Updated dependencies [5ac0c68]
- Updated dependencies [5edd916]
- Updated dependencies [025d6f5]
  - @labre/store@0.32.0
  - @labre/global@0.32.0

## 0.31.0

### Patch Changes

- Updated dependencies [6a663b6]
  - @labre/store@0.31.0
  - @labre/global@0.31.0

## 0.30.2

### Patch Changes

- @labre/global@0.30.2
- @labre/store@0.30.2

## 0.30.1

### Patch Changes

- @labre/global@0.30.1
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

- 9d0fe0c: A chord prefix now fully scopes the next keystroke to its namespace: an
  unknown continuation (e.g. `w` then `e` when no wardley shortcut binds `e`)
  is swallowed instead of falling through to the generic single-key tool
  bindings. The prefix timeout and typing-in-editable behaviors are unchanged.
  - @labre/global@0.30.0
  - @labre/store@0.30.0

## 0.29.1

### Patch Changes

- @labre/global@0.29.1
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

- @labre/global@0.29.0
- @labre/store@0.29.0

## 0.28.0

### Patch Changes

- 65cc055: Fix a `TypeError: Cannot read properties of null (reading 'firstElementChild')`
  in the inline editor. `VElement.getUpdateComplete` assumed the inner
  `[data-v-element]` span (and its child) were always present; when awaited while
  the element is mounting/unmounting, `querySelector` returns `null` and it threw.
  Now guarded — it resolves instead of crashing when the inner DOM isn't ready yet.
  - @labre/global@0.28.0
  - @labre/store@0.28.0

## 0.27.0

### Minor Changes

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

- @labre/global@0.27.0
- @labre/store@0.27.0

## 0.26.0

### Patch Changes

- @labre/global@0.26.0
- @labre/store@0.26.0

## 0.24.0

### Patch Changes

- @labre/global@0.24.0
- @labre/store@0.24.0

## 0.23.3

### Patch Changes

- @labre/global@0.23.3
- @labre/store@0.23.3

## 0.23.2

### Patch Changes

- @labre/global@0.23.2
- @labre/store@0.23.2

## 0.23.1

### Patch Changes

- @labre/global@0.23.1
- @labre/store@0.23.1

## 0.23.0

### Patch Changes

- @labre/global@0.23.0
- @labre/store@0.23.0
