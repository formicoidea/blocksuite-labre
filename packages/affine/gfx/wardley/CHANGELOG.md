# @labre/affine-gfx-wardley

## 0.32.0

### Minor Changes

- 5076cb8: feat(edgeless): a declared framework background, and Wardley rebuilt on it (PF2)

  Every framework that needed a background — Wardley, Cynefin, Estuarine, the
  BPMN pool — got one by writing a renderer: two hundred lines of `ctx.fillText`,
  its own hit-testing for editable labels, its own resize gate, its own copy of
  the same four hit-test methods on the model. Four dialects of the same idea,
  and the framework that happened to be written last inherited none of the
  niceties the first one had.

  There is now ONE background, configured by DECLARATION.

  - **The primitive** (`FrameworkBackgroundDef` in `@labre/affine-block-surface`)
    describes a background as data: its **geometry** (reference size, whether the
    proportion is locked, whether the handles are offered, the plot margin), its
    **frame of reference** (named axes, orientation, arrowheads, graduations),
    its **named zones**, and its **chrome** (card, colour washes, and a palette so
    a colour is named once and referenced by name). Not one line of it is a
    function, a class or a closure — same philosophy as the validation rules and
    the role defs, for the same reason: a declaration is comparable,
    serialisable, reviewable by someone who does not read TypeScript, and can one
    day be shipped by a host.
  - **The vocabulary is only as wide as its callers.** Every optional field has a
    named consumer cited in its doc comment — the BPMN pool's free aspect ratio
    and `600` name weight, Estuarine's double-headed energy axis and its Georgia
    italic axis letters. Anything nobody had asked for yet is simply absent: a
    drawn grid, a drawn legend box, tick stubs, per-tick labels, free-floating
    annotations and vertical washes were all written and then cut. They are
    cheap to add back the day a framework needs one, and dead weight until then.
  - **The default is deliberately dull.** A declaration that says nothing but its
    size paints a plain white rectangle: no axis, no zone, no decoration. A new
    framework gets a usable background before it has decided what it looks like.
  - **Labels are vocabulary, not prose.** Each one names an i18n key resolved
    through the house seam (`TranslationProvider`), and optionally a model prop
    holding the user's own wording, which always wins. A key nothing resolves and
    nothing defaults shows the raw key, exactly as everywhere else in the library.
    For that key to be REACHABLE, Wardley's ten label fields now default to
    `undefined` instead of to English: an `undefined` default is written nowhere,
    so a map nobody has renamed carries no label text and falls through to the
    vocabulary. Without a catalogue it reads exactly as it always did — the same
    words in the same places — and the first in-place edit writes the prop and
    wins from then on. The in-place editor opens on the words CURRENTLY DRAWN
    rather than on the raw prop, so a never-renamed label does not offer an empty
    box for a name the user can plainly see.
  - **A broken declaration fails loudly.** A `@name` with no palette entry, or a
    wash colour that cannot carry an alpha, used to produce `transparent` or
    `rgba(NaN,NaN,NaN,…)` — painting nothing and explaining nothing. Both now warn
    once and paint magenta.
  - **One walk, two uses.** The declaration's texts are enumerated once and drive
    both the painting and the double-click hit-testing, so a label can no longer
    be drawn in one place and clicked in another.
  - **The model half** (`FrameworkBackgroundElementModel` in
    `@labre/affine-model`) carries what every background shares: a rotated
    rectangle you drop elements onto, selectable, movable and part of undo/redo,
    but a passive canvas connectors must not snap to.

  **Wardley is the first instance, and the Wardley-specific implementation is
  gone** — renderer, label layout and resize gate alike. Two implementations
  coexisting would have meant Wardley quietly keeping behaviours no other
  framework could have.

  No document is invalidated. The persisted element type is still `wardley` and
  every one of its props keeps its name and its meaning — `variant`, `banded`,
  the ten editable label texts, the six visibility toggles. A map authored before
  this change opens with the same geometry, the same zones and the same words,
  and its snapshot round-trips byte-identical; that is asserted end to end
  against the real assembly points, with every expected coordinate written as a
  literal rather than recomputed from the declaration under test.

  What a map created from now on WRITES is smaller by ten keys: the label texts
  are only persisted once the user actually types one. Reading is unaffected in
  both directions — an old map keeps its ten, a new one falls through to the
  vocabulary — and that is precisely the mechanism optional fields exist for.

  The four gradient variants are still the same curves. They are now TABULATED
  ONCE, at module load, into `[offset, alpha]` stop tables the declaration ships:
  nothing is evaluated at paint time, and a wash is data like everything else.

  Wardley's role, element type, reference size, locked 16:9 proportion and
  resize default now come from the declaration, at the toolbox AND at the
  templates. One pre-existing drift is left alone and now documented: the
  templates lay their nodes out in a plot of their own (`x 70 → 1540`), inset
  further than the plot the declaration actually draws (`x 40 → 1570`). Aligning
  them would move every node of every canned map, which is a visual change to
  shipped content and not this slice's business.

  `wardley:map` is still stamped at creation and `wardley.component-outside-map`
  still frames against it, unchanged.

  Two things the next slice owes. The per-variant creation defaults
  (`BACKGROUND_VARIANT_DEFAULTS`, duplicated in the templates) still write English
  prose into the document for the two value-chain variants, so a map created as
  `opportunity` or `benefit` lands with "Opportunity" / "Benefit" / "Investment"
  already persisted as if the user had typed them: only `classic` and
  `evolution-gradient` are fully localisable today. The fix is to make the variant
  part of the declaration — one axis and end-label set per variant, each naming
  its own key — rather than a bag of prop overrides applied at creation, which
  changes what a variant IS and does not belong here. Both copies carry a TODO.

  Only Wardley is migrated. Cynefin, Estuarine and the BPMN pool keep their own
  renderers for now: the declaration expresses the BPMN pool as it stands, but
  Cynefin and Estuarine are built on hand-traced bezier and arc paths, which the
  vocabulary deliberately does not yet cover. Migrating them means adding a
  path-data layer to the declaration, and that is a slice of its own.

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
    land on `ValidationManager.checkup# @labre/affine-gfx-wardley
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

- 3ac3587: feat(edgeless): minimal validation engine and its first Wardley rule (PF5/PF7)
  Frameworks can now declare validation rules, and elements that break one get a
  discreet mark on the canvas. Wave 1 — the path end to end, one rule wide.
  - `@labre/affine-block-surface`: the engine. Rules are declarative, versioned
    DATA owned by their framework (`{ id, framework, family, severity, appliesTo,
messageKey, version }`); the engine only knows how to evaluate a FAMILY. One
    family ships: `element-in-background`. Results are violation OBJECTS
    (`{ ruleId, elementIds, severity, messageKey, suggestion? }`) on a reactive
    signal, `ValidationManager.violations# @labre/affine-gfx-wardley
    — the seam a host conformance panel
    will read. The engine holds no prose: every human-readable string is an i18n
    key resolved by the host.
  - `@labre/affine-gfx-wardley`: the pilot rule. A `wardley:component` — or any
    role specialising it, so `market` and `ecosystem` come free — drawn outside
    the map is flagged `component-outside-map`. A `warning`, never blocking: the
    sketch always wins. A map-less canvas raises nothing. The map background now
    carries a role of its own, `wardley:map`, so both sides of a rule are roles
    and the engine never reads a shape type. Existing backgrounds are not
    backfilled: authored without the role, they frame nothing and raise nothing —
    an older document stays a sketch.
  - Affordance (PF7, minimal): elements in violation get amber corner brackets
    drawn by a canvas overlay. No element model is touched, nothing is written to
    the document, no undo entry is created. No conformance panel yet.
    Proportionality is enforced by construction: an element with no role is never
    evaluated, and a framework's rules only ever match its own roles.
    Gating follows the reversed flag contract (`docs/adr/0009`) with no new
    machinery: rules are registered by the FLAG-GATED `WardleyViewExtension`, so
    turning the `wardley` flag off removes them with the rest of the tooling.
    Already-drawn maps keep rendering, they simply stop being checked, and a board
    with every framework disabled does zero validation work.
    Like every flag in this library, that gate is an assembly-time gate, not a
    runtime switch: flipping a flag mid-session neither starts nor stops
    validation, and marks already on screen stay there until the editor is
    reassembled.
    Performance is asserted, not hoped for: a bench in the normal unit suite builds
    a 500-element reference map — backed by real `Y.Map`s, so field reads and
    `xywh` deserialization cost what they cost in production — and fails the build
    if a full evaluation exceeds one 60 fps frame (16 ms). It currently runs in
    ~0.15 ms, and ~0.0002 ms with the flag off.
- 7b940cf: fix(edgeless): the validation profile belongs in the map's toolbar

  PF9 shipped the profile selector as a chip pinned to the instance's top-left
  corner. Recette found it twice wrong: the contextual toolbar of the selected
  map lands on those same pixels and buried it outright, and at a low zoom what
  did show through was unreadable.

  The toolbar that hid it is the toolbar that should have carried it. Selecting a
  Wardley map now gives its contextual toolbar a **Validation** dropdown naming
  the level of requirement in force, offering the others with a tick on the
  current one. A per-instance setting sits with the instance's other per-instance
  settings — the axes, the labels, the legend — instead of floating over the
  canvas competing with them for the same corner.

  The chip is gone, and with it the ~355 lines it took to keep a canvas
  affordance alive: its own click-away, Escape, pan/zoom tracking, viewport
  clamping and late element resolution are all things a toolbar entry gets for
  free.

  Nothing about the DATA changed. `validationProfile` is still one optional flat
  string on the background element, the default still writes nothing and choosing
  it back still clears the key, exceptions are still untouched by a change of
  level, and `ValidationManager.setProfile` is still the only write path — the
  toolbar adds a `captureSync` in front of it so one click is one undo.

  ### Where it lives

  `validationToolbarConfig` is generic and lives with the engine, in
  `@labre/affine-block-surface`. It names no framework, no element type and no
  role: the entry stands up when the selected element is one the engine
  recognises as a framework's root instance (through the registered rules'
  `backgroundRole`) whose framework declares more than one profile. A second
  framework shipping profiles gets the same dropdown by registering the very same
  object on its own flavour.

  It is registered by Wardley's **flag-gated** view extension, beside its rules
  and its profiles — deciding how hard to check a document is tooling, so the
  flag removes the module entirely rather than merely emptying it. That is a
  deliberate split from `wardleyToolbarExtension`, which stays always-on because
  a stored map must keep its axes and its labels whatever the flag says
  (`docs/adr/0009`). The two modules coexist on one element through the `custom:`
  flavour slot, the pattern `gfx/mindmap` already uses on
  `custom:affine:surface:shape`.

  The dropdown renders sections and ships with one, so PF7.11's map quality is
  one more block in the same menu rather than another button competing for
  toolbar width.

  ### Also

  `wardley-validation-profiles.spec.ts` now drives the real element toolbar. That
  needed telling the editor it is in edgeless mode: `setupEditor('edgeless')`
  mounts the edgeless root but the default `DocModeService.getEditorMode()`
  answers `null`, which the toolbar reads as page mode and skips every surface
  selection. The override is local to that suite.

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
    still reported to `violations# @labre/affine-gfx-wardley
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
- 061729e: Three generic rule families, and the first three real Wardley rules

  The validation engine gained the three families a business framework actually
  needs, and Wardley gained the first rules that were asked for rather than
  invented to prove the machinery.

  **The declaration now answers questions.** A framework background (PF2) already
  described its axes and zones so they could be painted; it now exposes them as
  evaluation FACTS — which way each axis runs, where one zone ends and the next
  begins, in model coordinates for a given instance. Pure data in, pure data out:
  a rule reads the frame of reference without the engine owning a registry of
  backgrounds or importing a renderer.

  **Three families, all declarative.** `orientation-against-axis` confronts a
  directional element with the declared sense of an axis, `attachment` requires an
  element to be posed on a carrier and optionally at a zone transition, and
  `no-overlap` is the first family that is not element-local: it evaluates PAIRS
  of declared roles, with each side's geometry following its role's own kind, so
  an edge is measured along its path and not by the bounding box of its diagonal.
  `no-overlap` supports an incremental pass — a drag re-tests only the couples
  involving something that moved, reaches the same verdict as a full one, and is
  bounded by it: past the crossover, or when a frame is touched at all, it simply
  sweeps.

  **Three Wardley rules.** A change arrow may not point against evolution; an
  inertia bar belongs on a dependency, at a phase transition; nodes and labels
  must not sit on top of each other. Each ships an i18n key and the framework's
  own wording as a fallback, so a host with no catalogue reads a sentence instead
  of a dotted key — and the library still never invents the wording of somebody
  else's rule.

  **New role values, no schema change.** Reversing a PF1 decision: the change
  arrow, the inertia bar and the artefact labels are no longer neutral, because an
  element with no role is never evaluated and these three rules are about exactly
  those artefacts. Toolbox and templates write the same values. Documents drawn
  before today carry none of them, so they raise nothing — no backfill, no
  retro-violation. The market glyph's inner dots went the other way and became
  neutral, for the same reason its triangle wiring always was: they are part of a
  composite, not artefacts anybody placed.

  **The pilot rule is gone.** `wardley.component-outside-map` existed to prove the
  engine end to end; parking a node in the margin while you think is normal work.
  Every test that exercised the affordance, the exceptions, the profiles and the
  budget through it now exercises them through the real rules, in the same commit.

  The bench grew a reference map carrying arrows, bars, labels and links, and a
  worst-case drag. Both stay far inside one frame. It also records the budget's
  horizon so the next slice inherits a figure and not a conclusion: growth is
  quadratic in the pair-wise participants, the 16 ms wall sits at roughly **2000
  elements** today, and a test fails the day a SECOND pair-wise rule lands — which
  is the honest trigger for a spatial index, along with the first board past that
  wall. (An earlier draft of this slice quoted 1300 and 2500 in two places: both
  were measured with the map generator inside the timer, which dilutes a quadratic
  engine with a linear build. 2000 is the corrected, single figure.)

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

- c2735aa: W2 only speaks while the dashed columns are on the map

  An inertia bar is judged against the phase divider it straddles. Hide the
  dividers — the "Columns (dividers)" toggle of the Wardley toolbar — and the
  verdict was still being handed down against a line that is no longer on the
  canvas: a warning whose only suggestion ("slide the bar until it sits astride
  the dashed line") pointed at nothing the user could see. W2 is now ACTIVE only
  while the columns are displayed.

  **Scoped, not weakened.** Nothing about the rule's geometry changed. Switch the
  columns back on and every finding comes back, on the same bars, in the same
  places, with the same wording — and the four other visibility toggles of a
  Wardley map (axes, phase labels, corner labels, visibility labels) leave W2
  exactly where it was. The other three rules are untouched with the columns
  hidden: a toggle that switched the whole check-up off would be a toggle nobody
  would dare use.

  **The condition is data, and the engine still names no framework.** The dividers
  are drawn from `axes[].ticks.visibleProp`, and that is the field the rule now
  reads: the transition bands are resolved against the INSTANCE being measured, so
  a frame whose graduations are hidden yields no band and asks nothing of the
  symbols on it — the same silence a frame that declares no transition at all
  already produced. A framework that offers no such toggle is bit-for-bit
  unaffected, and the reading pass, which describes what a map MEANS rather than
  what it draws, still sees every declared frontier.

  **The toggle re-judges live.** The props worth re-evaluating for are no longer a
  constant: the manager derives them from the declarations it was handed, so a
  framework's own visibility prop wakes the engine exactly like a move does.
  Hiding the columns clears the marks on the spot instead of leaving them up until
  some unrelated drag happened to wake it.

  No document changes: `showColumnDividers` already existed and already defaulted
  to shown, so every map ever drawn is judged today exactly as it was yesterday.

- 346b5d9: fix(edgeless): W2 measures the punctuated equilibrium zone, and says which half failed

  Recette PO of 01/08/2026: two inertia bars dropped squarely on the "Product"
  and "Commodity" dividers, both flagged, both told they were "not on a
  dependency at a phase transition". Reproduced and measured: the bars were
  **0.00 units** off the transition — the boundary half was satisfied to the
  unit — and 410 and 846 units from the nearest dependency, against a 24-unit
  tolerance. The verdict was right; the sentence hid the only thing the user
  could act on.

  - **The zone of punctuated equilibrium is declared data.** A framework
    background now carries `transitionBandWidth`, a ratio of the plot, and
    `backgroundTransitionBands()` exposes each transition as a named band
    (`custom-built|product`) in model coordinates. Wardley declares `0.1` — ±5%
    of the plot either side of each divider, ±76 model units on the 1600-wide
    reference map against the 40 absolute units it replaces. The old absolute
    slack was 5.5% of the plot on an 800-wide map and 1.3% on a 3200-wide one:
    the same gesture judged four times as harshly for having resized the map.
    Being a ratio, the band now survives resizing.
  - **W2 speaks twice.** `com.labre.wardley.validation.inertia-off-carrier` ("not
    drawn on a dependency") and
    `com.labre.wardley.validation.inertia-off-equilibrium-zone` ("sits mid-phase,
    outside the zone of punctuated equilibrium"), each with its own suggestion.
    Still one rule, one badge on one bar; the finding names the half that failed,
    and the carrier wins when both do — a symbol attached to nothing has to find
    something to be about before where it sits can mean anything.
    `com.labre.wardley.validation.inertia-off-transition` and its suggestion key
    are gone; a host shipping a catalogue replaces them with the two above.
  - `AttachmentDef.boundaryTolerance` is replaced by the frame's declared band.
    A rule asking for a boundary against a background that declares none warns
    once and drops the requirement rather than indicting every subject.
  - `backgroundTransitionBands()` guards the declared width: `<= 0` warns and
    drops the requirement (no silently inverted band), and a width wider than the
    gap between two transitions warns and is narrowed to that gap (no silently
    overlapping bands).
  - **`Violation.boundaryId`** names the frontier a finding is about
    (`custom-built|product`) — the nearest band the subject missed, so "outside
    the equilibrium zone" also says which zone. Absent when the carrier is what
    failed.

- 77b0100: fix(edgeless): an inertia bar is judged on the divider it straddles, and Map quality is the checklist

  Second pass of the PO recette of 02/08/2026, on two points of substance.

  ## W2 changes meaning — read this before updating a catalogue

  The rule was built on a misreading, and the PO settled it with two captures and
  one sentence:

  > "The horizontal position of an inertia bar is only valid if it is astride two
  > evolution phases, that is, superimposed on a dashed vertical axis."

  - **Old rule** — the bar had to sit ON A DEPENDENCY _and_ at a phase transition,
    and the finding named the carrier half first ("This inertia bar is not drawn on
    a dependency."). A bar alone on a divider was flagged.
  - **New rule** — the bar has to STRADDLE a phase transition, and nothing else. A
    bar alone on a divider is valid (the PO's second capture); a bar between two
    dividers is not (the third), with or without a dependency under it.

  What that means in practice:

  - The carrier condition is gone, with the second message that existed only to
    tell the two halves apart. Both
    `com.labre.wardley.validation.inertia-off-carrier` and
    `com.labre.wardley.validation.inertia-off-equilibrium-zone` (and their
    suggestion keys) are retired; the rule now speaks one sentence, under
    `com.labre.wardley.validation.inertia-off-transition` — "This inertia bar sits
    inside a phase, not astride a phase transition." A host shipping a catalogue
    replaces the two keys with this one. `Violation.boundaryId` still names the
    frontier the bar missed.
  - **"Astride", as geometry:** the bar's own EXTENT along the evolution axis must
    intersect the transition BAND — the divider widened by the frame's declared
    `transitionBandWidth`. One interval overlap, saying both halves of
    "superimposed on the axis": a bar wide enough to cover the divider is accepted
    whatever the band says, and a bar too thin to cover anything (the toolbox draws
    it eight units wide) is accepted inside the band the map itself declares. It is
    measured on the ink, never on the centre, and the band stays a ratio of the
    plot so a resized map gets the same verdict.
  - `AttachmentDef.carrierRole` and `tolerance` are now OPTIONAL: the family still
    supports "posed on a carrier" for a rule that wants it, W2 simply no longer
    declares one. `AttachmentDef.offBoundary` is only read by a rule that declares
    both.
  - The Kodak template is unaffected: its bar is computed at the crossing of the
    `capture → storage` dependency with the Commodity divider, so it is centred on
    that divider and stays green.

  ## Map quality is the checklist, and only the checklist

  The panel carried three different kinds of statement — the nudges, a "Run
  check-up" button with its remarks and the families it walked, and a count of the
  real-time warnings on the map. All three were true, and reading them together
  was work. The PO's decision is to keep the one the panel is for:

  - the **check-up section** and the **real-time warning count** are gone from the
    panel and from the contextual toolbar's entry;
  - Wardley no longer declares **Q5** (`wardley.tone-off-convention`) or **Q6**
    (`wardley.phase-nomenclature`); `WARDLEY_CHECKUP_RULES` is gone and
    `gfx/wardley`'s `quality.ts` is now `nudges.ts`, exporting `WARDLEY_NUDGES`;
  - `ValidationManager.hasMapQuality()` now answers on the checklist alone, so a
    framework declaring only on-demand rules is not offered an empty panel;
  - the `MapQualityCheckupRun` telemetry event is removed, having lost its only
    emitter.

  **Nothing was removed from the engine.** The on-demand moment (PF5.14) —
  `moment: 'on-demand'`, `runCheckup`, `checkupRulesFor`, `evaluateCheckup` — and
  the `tone-convention` and `majority-fact` families are still there and still
  tested, including the zero-cost guarantee at the bench. The next framework that
  wants a check-up declares one; Wardley stopped exposing one.

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

- Updated dependencies [832c793]
- Updated dependencies [c5c07b9]
- Updated dependencies [a2b7c44]
- Updated dependencies [ff5f060]
- Updated dependencies [1b59f3c]
- Updated dependencies [41ab595]
- Updated dependencies [0bfc872]
- Updated dependencies [9e23b5b]
- Updated dependencies [a3aa598]
- Updated dependencies [aa08529]
- Updated dependencies [6417a2f]
- Updated dependencies [d797f9a]
- Updated dependencies [9fde974]
- Updated dependencies [50ab9ae]
- Updated dependencies [89b90e9]
- Updated dependencies [463989f]
- Updated dependencies [f7f23b2]
- Updated dependencies [751ac44]
- Updated dependencies [54488cd]
- Updated dependencies [9453013]
- Updated dependencies [b746d6b]
- Updated dependencies [b93b43c]
- Updated dependencies [5ac0c68]
- Updated dependencies [630633b]
- Updated dependencies [1fa46c1]
- Updated dependencies [be100e3]
- Updated dependencies [ff3a5f7]
- Updated dependencies [0473dcb]
- Updated dependencies [5b6e9bb]
- Updated dependencies [86e7562]
- Updated dependencies [492bac6]
- Updated dependencies [30580db]
- Updated dependencies [08e9b24]
- Updated dependencies [5076cb8]
- Updated dependencies [3c5c97e]
- Updated dependencies [19edf48]
- Updated dependencies [69cdc3d]
- Updated dependencies [7c10406]
- Updated dependencies [02797b5]
- Updated dependencies [413fe7b]
- Updated dependencies [724ed1c]
- Updated dependencies [3e1665b]
- Updated dependencies [0ddfd47]
- Updated dependencies [3639562]
- Updated dependencies [5d16745]
- Updated dependencies [1c37478]
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
  - @labre/affine-gfx-template@0.32.0
  - @labre/affine-model@0.32.0
  - @labre/affine-gfx-shape@0.32.0
  - @labre/affine-gfx-connector@0.32.0
  - @labre/affine-block-surface@0.32.0
  - @labre/affine-gfx-group@0.32.0
  - @labre/global@0.32.0
  - @labre/affine-gfx-pointer@0.32.0
  - @labre/affine-widget-edgeless-toolbar@0.32.0
  - @labre/affine-ext-loader@0.32.0

## 0.31.0

### Patch Changes

- Updated dependencies [6a663b6]
  - @labre/store@0.31.0
  - @labre/affine-block-surface@0.31.0
  - @labre/affine-ext-loader@0.31.0
  - @labre/affine-gfx-connector@0.31.0
  - @labre/affine-gfx-group@0.31.0
  - @labre/affine-gfx-pointer@0.31.0
  - @labre/affine-gfx-shape@0.31.0
  - @labre/affine-gfx-template@0.31.0
  - @labre/affine-model@0.31.0
  - @labre/affine-shared@0.31.0
  - @labre/std@0.31.0
  - @labre/affine-widget-edgeless-toolbar@0.31.0
  - @labre/global@0.31.0

## 0.30.2

### Patch Changes

- @labre/affine-block-surface@0.30.2
- @labre/affine-ext-loader@0.30.2
- @labre/affine-gfx-connector@0.30.2
- @labre/affine-gfx-group@0.30.2
- @labre/affine-gfx-pointer@0.30.2
- @labre/affine-gfx-shape@0.30.2
- @labre/affine-gfx-template@0.30.2
- @labre/affine-model@0.30.2
- @labre/affine-shared@0.30.2
- @labre/affine-widget-edgeless-toolbar@0.30.2
- @labre/global@0.30.2
- @labre/std@0.30.2
- @labre/store@0.30.2

## 0.30.1

### Patch Changes

- @labre/affine-block-surface@0.30.1
- @labre/affine-ext-loader@0.30.1
- @labre/affine-gfx-connector@0.30.1
- @labre/affine-gfx-group@0.30.1
- @labre/affine-gfx-pointer@0.30.1
- @labre/affine-gfx-shape@0.30.1
- @labre/affine-gfx-template@0.30.1
- @labre/affine-model@0.30.1
- @labre/affine-shared@0.30.1
- @labre/affine-widget-edgeless-toolbar@0.30.1
- @labre/global@0.30.1
- @labre/std@0.30.1
- @labre/store@0.30.1

## 0.30.0

### Minor Changes

- 8deda2d: Wardley canvas keyboard chords: press `w`, then `c` (component), `l` (link
  tool), `a` (evolution arrow), `i` (inertia), `p` (pipeline), `m` (method) or
  `b` (classic background). Edgeless-only, disabled with the `wardley` block
  flag, host-rebindable via the shortcut manifest (`getShortcutManifest` now
  lists the `wardley` group). The wardley menu actions were extracted into
  standalone functions shared by the toolbar and the shortcuts.

### Patch Changes

- ecba791: Per-framework text-fit defaults. Event Storming stickies and Context Map
  bubbles now carry their label as the shape's own text (contained /
  overflow fit) instead of a separate grouped text element — double-click
  edits in place and the box never deforms; previously created prefabs keep
  their old structure and keep working. Estuarine hexi constraints default
  to contained; BPMN nodes and the Wardley inertia bar default to overflow.
- d295c58: Remove the spurious horizontal asymptote line drawn over the Wardley "benefit /
  investment" background, so only the intended green/red gradient is shown.
- Updated dependencies [9d0fe0c]
- Updated dependencies [ecba791]
- Updated dependencies [8de86f4]
  - @labre/std@0.30.0
  - @labre/affine-model@0.30.0
  - @labre/affine-gfx-shape@0.30.0
  - @labre/affine-block-surface@0.30.0
  - @labre/affine-gfx-connector@0.30.0
  - @labre/affine-gfx-group@0.30.0
  - @labre/affine-gfx-pointer@0.30.0
  - @labre/affine-gfx-template@0.30.0
  - @labre/affine-shared@0.30.0
  - @labre/affine-widget-edgeless-toolbar@0.30.0
  - @labre/affine-ext-loader@0.30.0
  - @labre/global@0.30.0
  - @labre/store@0.30.0

## 0.29.1

### Patch Changes

- @labre/affine-block-surface@0.29.1
- @labre/affine-ext-loader@0.29.1
- @labre/affine-gfx-connector@0.29.1
- @labre/affine-gfx-group@0.29.1
- @labre/affine-gfx-pointer@0.29.1
- @labre/affine-gfx-shape@0.29.1
- @labre/affine-gfx-template@0.29.1
- @labre/affine-model@0.29.1
- @labre/affine-shared@0.29.1
- @labre/affine-widget-edgeless-toolbar@0.29.1
- @labre/global@0.29.1
- @labre/std@0.29.1
- @labre/store@0.29.1

## 0.29.0

### Patch Changes

- Updated dependencies [7375b9a]
- Updated dependencies [9330750]
  - @labre/affine-shared@0.29.0
  - @labre/std@0.29.0
  - @labre/affine-block-surface@0.29.0
  - @labre/affine-gfx-connector@0.29.0
  - @labre/affine-gfx-group@0.29.0
  - @labre/affine-gfx-pointer@0.29.0
  - @labre/affine-gfx-shape@0.29.0
  - @labre/affine-gfx-template@0.29.0
  - @labre/affine-widget-edgeless-toolbar@0.29.0
  - @labre/affine-model@0.29.0
  - @labre/affine-ext-loader@0.29.0
  - @labre/global@0.29.0
  - @labre/store@0.29.0

## 0.28.0

### Patch Changes

- Updated dependencies [65cc055]
  - @labre/std@0.28.0
  - @labre/affine-block-surface@0.28.0
  - @labre/affine-gfx-connector@0.28.0
  - @labre/affine-gfx-group@0.28.0
  - @labre/affine-gfx-pointer@0.28.0
  - @labre/affine-gfx-shape@0.28.0
  - @labre/affine-gfx-template@0.28.0
  - @labre/affine-model@0.28.0
  - @labre/affine-shared@0.28.0
  - @labre/affine-widget-edgeless-toolbar@0.28.0
  - @labre/affine-ext-loader@0.28.0
  - @labre/global@0.28.0
  - @labre/store@0.28.0

## 0.27.0

### Patch Changes

- Updated dependencies [91f6397]
  - @labre/std@0.27.0
  - @labre/affine-block-surface@0.27.0
  - @labre/affine-gfx-connector@0.27.0
  - @labre/affine-gfx-group@0.27.0
  - @labre/affine-gfx-pointer@0.27.0
  - @labre/affine-gfx-shape@0.27.0
  - @labre/affine-gfx-template@0.27.0
  - @labre/affine-model@0.27.0
  - @labre/affine-shared@0.27.0
  - @labre/affine-widget-edgeless-toolbar@0.27.0
  - @labre/affine-ext-loader@0.27.0
  - @labre/global@0.27.0
  - @labre/store@0.27.0

## 0.26.0

### Patch Changes

- 6795191: fix(edgeless): keep mobile canvas toolbars within the viewport

  On narrow (mobile) viewports two canvas toolbars overflowed off-screen,
  hiding actions:

  - The selected-element contextual toolbar grew to `max-content` with no
    upper bound. It is now capped to the available viewport width (floating-ui
    `size` middleware) and wraps to a second row instead of overflowing. (A
    scroll container was avoided on purpose: the "More" dropdown is a descendant
    of the toolbar, so `overflow` would clip it and make it unclickable.)
  - The senior framework slide-menu was sized to `max-width: calc(100vw - 16px)`
    but right-aligned to a center-ish toolbar button, so a near-full-width menu
    hung off the LEFT edge on mobile. It is now centered on the main toolbar and
    capped to 95% of the toolbar's width (the existing slide-menu scroll handles
    any remaining overflow), via a shared `clampSeniorMenuToToolbar` helper that
    replaces the duplicated inline positioning in all six framework senior
    buttons (Wardley, BPMN, Cynefin, EDGY, Mind Map, DDD). Desktop is unaffected
    since those menus are narrower than the cap.

- Updated dependencies [8960a6c]
  - @labre/affine-model@0.26.0
  - @labre/affine-block-surface@0.26.0
  - @labre/affine-gfx-connector@0.26.0
  - @labre/affine-gfx-group@0.26.0
  - @labre/affine-gfx-pointer@0.26.0
  - @labre/affine-gfx-shape@0.26.0
  - @labre/affine-gfx-template@0.26.0
  - @labre/affine-shared@0.26.0
  - @labre/affine-widget-edgeless-toolbar@0.26.0
  - @labre/affine-ext-loader@0.26.0
  - @labre/global@0.26.0
  - @labre/std@0.26.0
  - @labre/store@0.26.0

## 0.25.0

### Patch Changes

- 6795191: fix(edgeless): keep mobile canvas toolbars within the viewport

  On narrow (mobile) viewports two canvas toolbars overflowed off-screen,
  hiding actions:

  - The selected-element contextual toolbar grew to `max-content` with no
    upper bound. It is now capped to the available viewport width (floating-ui
    `size` middleware) and wraps to a second row instead of overflowing. (A
    scroll container was avoided on purpose: the "More" dropdown is a descendant
    of the toolbar, so `overflow` would clip it and make it unclickable.)
  - The senior framework slide-menu was sized to `max-width: calc(100vw - 16px)`
    but right-aligned to a center-ish toolbar button, so a near-full-width menu
    hung off the LEFT edge on mobile. It is now centered on the main toolbar and
    capped to 95% of the toolbar's width (the existing slide-menu scroll handles
    any remaining overflow), via a shared `clampSeniorMenuToToolbar` helper that
    replaces the duplicated inline positioning in all six framework senior
    buttons (Wardley, BPMN, Cynefin, EDGY, Mind Map, DDD). Desktop is unaffected
    since those menus are narrower than the cap.

- Updated dependencies [8960a6c]
  - @labre/affine-model@0.25.0
  - @labre/affine-block-surface@0.25.0
  - @labre/affine-gfx-connector@0.25.0
  - @labre/affine-gfx-group@0.25.0
  - @labre/affine-gfx-pointer@0.25.0
  - @labre/affine-gfx-shape@0.25.0
  - @labre/affine-gfx-template@0.25.0
  - @labre/affine-shared@0.25.0
  - @labre/affine-widget-edgeless-toolbar@0.25.0
  - @labre/affine-ext-loader@0.25.0
  - @labre/global@0.25.0
  - @labre/std@0.25.0
  - @labre/store@0.25.0

## 0.24.0

### Patch Changes

- bc31490: fix(edgeless): keep senior-button sub-menus anchored to their button

  Two senior-button sub-menus positioned themselves against the whole toolbar
  instead of their own button, so they drifted once senior buttons can be hidden
  at runtime:

  - **Wardley map** right-aligned to the rightmost senior-tool slot (via a layout
    scan), which moves when buttons are toggled off.
  - **Others** (the mindmap basket) had no `position: relative` on its host, so
    the popup's clip wrapper anchored to the toolbar and left-aligned there.

  Both now right-align to their own button edge like every framework senior button
  (Cynefin, EDGY, BPMN, DDD), which stays correct whatever buttons are hidden.

- Updated dependencies [bc31490]
  - @labre/affine-gfx-template@0.24.0
  - @labre/affine-block-surface@0.24.0
  - @labre/affine-ext-loader@0.24.0
  - @labre/affine-gfx-connector@0.24.0
  - @labre/affine-gfx-group@0.24.0
  - @labre/affine-gfx-pointer@0.24.0
  - @labre/affine-gfx-shape@0.24.0
  - @labre/affine-model@0.24.0
  - @labre/affine-shared@0.24.0
  - @labre/affine-widget-edgeless-toolbar@0.24.0
  - @labre/global@0.24.0
  - @labre/std@0.24.0
  - @labre/store@0.24.0

## 0.23.3

### Patch Changes

- Updated dependencies
  - @labre/affine-shared@0.23.3
  - @labre/affine-block-surface@0.23.3
  - @labre/affine-gfx-connector@0.23.3
  - @labre/affine-gfx-group@0.23.3
  - @labre/affine-gfx-pointer@0.23.3
  - @labre/affine-gfx-shape@0.23.3
  - @labre/affine-gfx-template@0.23.3
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
  - @labre/affine-block-surface@0.23.2
  - @labre/affine-gfx-connector@0.23.2
  - @labre/affine-gfx-group@0.23.2
  - @labre/affine-gfx-pointer@0.23.2
  - @labre/affine-gfx-shape@0.23.2
  - @labre/affine-gfx-template@0.23.2
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
  - @labre/affine-block-surface@0.23.1
  - @labre/affine-gfx-connector@0.23.1
  - @labre/affine-gfx-group@0.23.1
  - @labre/affine-gfx-pointer@0.23.1
  - @labre/affine-gfx-shape@0.23.1
  - @labre/affine-gfx-template@0.23.1
  - @labre/affine-widget-edgeless-toolbar@0.23.1
  - @labre/affine-ext-loader@0.23.1
  - @labre/affine-model@0.23.1
  - @labre/global@0.23.1
  - @labre/std@0.23.1
  - @labre/store@0.23.1

## 0.23.0

### Minor Changes

- d2f435f: Turn the edgeless template panel into a per-framework catalog of worked-example
  diagrams and prefab components. Each framework package contributes its own
  category (Wardley, EDGY, Cynefin, Estuarine, BPMN) via a new
  `extendTemplateCategory` helper, and a generic "Other" category (SWOT, Kanban,
  Business Model Canvas, Fishbone, Gantt) ships from the template package. Every
  template is composed only from existing shapes — the framework's own prefab
  shapes first, general BlockSuite shapes second — so dragging a card inserts real,
  editable elements.

  The templates senior-toolbar button now renders last (new optional `order` on
  `SeniorTool`), and the playground's placeholder cat stickers are removed.

### Patch Changes

- Updated dependencies [9014c87]
- Updated dependencies [c775151]
- Updated dependencies [d2f435f]
  - @labre/affine-model@0.23.0
  - @labre/affine-block-surface@0.23.0
  - @labre/affine-shared@0.23.0
  - @labre/affine-gfx-template@0.23.0
  - @labre/affine-widget-edgeless-toolbar@0.23.0
  - @labre/affine-gfx-connector@0.23.0
  - @labre/affine-gfx-group@0.23.0
  - @labre/affine-gfx-pointer@0.23.0
  - @labre/affine-gfx-shape@0.23.0
  - @labre/affine-ext-loader@0.23.0
  - @labre/global@0.23.0
  - @labre/std@0.23.0
  - @labre/store@0.23.0
