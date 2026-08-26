# @labre/affine-block-surface

## 0.32.0

### Minor Changes

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

- 86e7562: fix(edgeless): the info panels take their place — and their width — from the senior bar

  PO recette of 02/08/2026, second pass, points 2 and 3. The panels that tell you
  about the canvas now share one place and one measure: **anchored to the editor,
  above the senior button bar, at exactly its width** (ADR 0011).

  **"Read this component" stops guessing its width.** The 480px it shipped with
  lined up with nothing on screen. Its left and right edges are now the toolbar
  bar's own, measured off the bar's rect rather than computed from the toolbar's
  layout constants — the bar is `fit-content` over a tool count that changes with
  the editor's width, so any arithmetic would be a copy that drifts. A resize or a
  zoom re-measures, and so does the toolbar's own re-layout, which lands a frame
  later than the resize does.

  **Map quality adopts the same pattern.** It leaves the popover that hung off the
  map's top-right corner at 320px, flipping sides and ends to stay on screen, for
  the same anchored panel in the same layer above every toolbar. Only the
  presentation moved: the entry in the background's contextual menu is still the
  trigger, the panel is still about one root instance, and nothing it renders
  changed.

  **One component, not two copies.** `EditorAnchoredPanel` owns the geometry, the
  layer, the dialog semantics, the pointer-swallowing, click-away and Escape, and
  the re-measure wiring; a panel subclasses it, says when it is open and how it
  closes, and renders its body. A read-only board renders no toolbar, so a panel
  with no bar to measure falls back to a centred, comfortable measure — the only
  place a width floor applies, because where the bar IS measured the match is
  exact.

  ADR 0011 records the decision: canvas metadata is shown in a panel anchored to
  the editor, above the senior button bar, at its width — today the reading and
  Map quality, tomorrow any surface that talks about the canvas rather than about
  a selection.

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
    land on `ValidationManager.checkup# @labre/affine-block-surface
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

- 1c37478: fix(edgeless): revoke an exception from the element, not from a grey dot
  PO acceptance on PF8: the way back out of a waived validation rule moves to the
  contextual toolbar of the element that carries it, and the grey badge that used
  to hold it disappears.
  **The grey badge is gone.** PF8 kept a muted dot on the canvas for every excused
  finding, so it could be clicked to revoke. That put a permanent marker on the
  board for something the user had explicitly decided to stop caring about — the
  affordance argued with the decision it was reporting. An excused finding now
  draws nothing at all: no bracket, no badge. The amber badge of a LIVE violation
  is untouched (PF7), and the engine still reports the excused finding on
  `violations# @labre/affine-block-surface
, so a host panel and an export still see it. Nothing is hidden;
the canvas just stops shouting about a settled question.
**"Revoke exception" lives on the element.** Selecting the thing is the path
everybody already knows, so the way back sits where everything else you can do
to an element sits. Which element gets the entry follows exactly the rule the
canvas mark already followed: the outermost enclosing canvas group — i.e. the
whole component built by the senior menu — or the element itself when it is not
grouped. Dissolve the group and the entry moves down to the element, with
nothing to invalidate. A framework background answers for the map-wide
arbitration written on it, so the same entry there takes back the map scope.
The entry appears only when the selected element actually answers for an
exception, and only when a registered rule can still be arbitrated on — so a
board with the framework switched off never shows it, while the exceptions
themselves stay in the document, untouched (PF8.6). Its label goes through the
`TranslationProvider`seam like the rest of the validation chrome.
Registered on`custom:affine:surface:\*`, the free wildcard slot merged into
  every canvas element's toolbar: one registration covers a group, a bare
  framework element and a background alike, and no framework's own toolbar config
  is touched.
  The detail bubble is unchanged: it still lists an excused finding with its state
  and a Revoke, for the case where it shares an anchor with a live one.
- 985a92f: fix(edgeless): the contextual toolbar is one line, and gives way instead of wrapping

  PO arbitration of 02/08/2026. The contextual toolbar of a selected element used
  to WRAP when it ran out of width — which, on the map the PO was looking at, put
  the "⋮" alone on a second line. A toolbar whose height depends on the selection
  is a toolbar that moves under the cursor. It now stays one line at every width,
  and spends its least important entries instead.

  **The row measures itself.** Every render is measured once, whole; when it
  overflows the cap the editor gives it, the widget re-renders it with the entries
  that have to give way. Widen the editor and they come back — the collapse is a
  view state and nothing about it is written to the document.

  **Two ways to give way, in that order.** An entry that declares an `icon` AND a
  `label` drops its label first and keeps it as its tooltip: a row of icons is
  still a row of things you can click. Only then does an entry leave the row for
  the "⋮" menu that is already there, where it keeps its FULL label and its
  behaviour. Every entry that can shrink shrinks before any entry moves.

  **Nothing in the widget names a framework.** Which entry gives way is decided
  entirely by the entries' own config: a new `priority?: number` on every toolbar
  action (higher stays on the row longer, `0` by default), plus whether the entry
  has an icon and a label to trade. Say nothing and you keep exactly the order the
  toolbar has today, minus the wrap — an entry rendered later gives way first. An
  entry that brings its own template (`content`) or its own sub-actions is opaque
  to the widget and keeps its place: the two qualification dropdowns keep their
  text, because a dropdown nested inside a dropdown is worse than a dropdown that
  stayed.

  For our own tranches: **Read this component** gains an eye icon, so a tight row
  turns it into an icon with a tooltip rather than pushing it into the menu; and
  **Revoke exception** — rare, wordy, with no icon to fall back to — declares
  `priority: -1` so it is the first entry to move, despite sorting early.

  The measuring and re-rendering live in the widget; the arithmetic that decides
  which entries are spent is a pure function in `@labre/affine-shared`, pinned by
  its own unit suite.

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
    signal, `ValidationManager.violations# @labre/affine-block-surface
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
    still reported to `violations# @labre/affine-block-surface
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
- 30061cb: feat(edgeless): tell me what is wrong, and keep telling me (PF7)
  The validation affordance stopped at "something here is off": a mute amber
  bracket, drawn for as long as the violation held. It answered neither of the
  two questions a user actually has — _what_ is wrong, and _is it still wrong an
  hour later_. This slice answers both, on two clocks.
  - **The moment it happens.** A violation that APPEARS flashes its bracket at
    full strength for three seconds, then fades out over half a second. That is
    when the user still remembers the gesture that caused it and can undo it in
    one move.
  - **For as long as it holds.** Once — and only once — the bracket has finished
    fading, a small amber badge takes its place, just outside the anchor's
    top-right corner. The two are never on screen together. A board left
    overnight still shows what it breaks, without a canvas full of brackets.
  - **On demand.** Clicking either marker opens a bubble naming the rules broken
    on that anchor: label, severity, and remediation hint when the rule carries
    one. It closes on a click elsewhere, on Escape, or on pan/zoom, and flips
    above or to the left of its marker rather than run off the viewport. Clicking
    a marker does not select the shape underneath — the pointer pair is stopped
    there, so neither selection nor a drag starts.
    Both markers are sized in MODEL units and scale with the board, like the
    elements they annotate. Screen-constant annotations are right for a transient
    snap guide and wrong here: on a hundred-component map, zoomed out, they grow
    relative to the content until the marks are all you can see. Zoomed out far
    enough these shrink with everything else — deliberately. The exception is the
    click target, which keeps a 44 px screen floor as invisible padding around the
    model-sized visual, so a badge three pixels wide is still reachable by thumb
    (the pattern `edgeless-auto-complete` already uses on this canvas). The bubble
    stays in screen pixels: prose rendered at quarter size is not smaller prose,
    it is unreadable prose.
    The bubble consumes normalised violation OBJECTS and nothing else: no rule
    logic reached the UI, and no rule wording is hard-coded in the library. Rule
    labels are i18n keys resolved through a new, optional host seam
    (`TranslationExtension` / `TranslationProvider` in `@labre/affine-shared`,
    mirroring `TelemetryExtension`). With no catalogue registered the raw key is
    shown rather than a sentence the library invented for somebody else's rule;
    only the bubble's own chrome — the severity chip — carries an English default.
    Anchoring is unchanged and shared with the bracket: one badge per outermost
    enclosing group. The bubble lists one line per RULE broken on that anchor, not
    one per element — two components of a group both drawn off the map are two
    violations on the signal, but repeating the same sentence twice would say
    nothing extra.
    `audit` violations are now excluded from the canvas affordance, as their
    severity has always said they should be: collected for reporting, invisible to
    the drawing user. They still reach `violations# @labre/affine-block-surface
untouched, for a host panel.
Escape is taken only within the editor host, never on `document`: with a bubble
    open it dismisses the bubble instead of clearing the canvas selection, and a
    library has no business making that call for the whole page.
    Nothing here touches evaluation, the violation object or the 16 ms budget, and
    nothing is written to the document — the "first seen" timestamps that drive the
    flash are session state, rebuilt on every reload, so a document records which
    rules it breaks and never when you happened to look. No clock runs without a
    violation: the fade's animation frames stop by themselves once every mark has
    settled, the single timer that wakes the badge for the handover is armed only
    while a bracket is still up, and the element-tracking subscription only exists
    while something is flagged.
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

### Patch Changes

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

- 89b90e9: The surface canvas fits its block again inside a scaled host

  An embedded edgeless doc is drawn by a host that scales the whole editor, and
  the viewport reports its size through `getBoundingClientRect()` — a size that
  already carries that outer scale. The canvas was sized from those numbers and
  then scaled a second time by the container, so at any host scale other than 1
  it spilled past the block it belongs to: everything painted on the canvas —
  the Wardley, EDGY, DDD and Cynefin frameworks included — sat outside the
  block's own frame.

  The canvas now carries the inverse of that scale, so all drawing stays in the
  surface's own coordinate space. An unscaled editor is unaffected.

- f7f23b2: A validation badge stays on the element it accuses inside a scaled editor

  The PF7 marks — the amber badge, the band that makes a bracket clickable, and
  the detail bubble they open — are drawn over the canvas, but were placed in
  real screen pixels while the container they live in is the one an embedding
  host scales. In a synced edgeless doc opened inside another document the
  container applied its scale a second time and the badge accused a blank patch
  of paper several elements away, with the bubble flipping at the wrong edge.

  They now state their placement the way the element under them does. In a
  standalone editor, where the host applies no scale, nothing moves.

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

- 184c412: fix(edgeless): the bubble reads, the link is marked where it is, and the panel says who is speaking

  Three things the PO sent back from the 02/08 recette. None of them changes what
  is evaluated, when, or what is written to the document — all three are about a
  surface that was telling the truth in a way nobody could read.

  **The detail bubble could not be read.** It opened UNDERNEATH the element
  toolbar, and the wheel over it panned the board instead of scrolling it — which
  closed it, on `viewportUpdated`, at exactly the length where reading mattered.
  Both halves had one cause and one fix each:

  - while a bubble is open, the widget HOST is raised above the popover level (a
    z-index of its own makes the host a stacking context, so the bubble can never
    climb out of it on its own) and drops straight back to the badge's level when
    it closes;
  - while a bubble is open, the CANVAS does not take the wheel. One capture-phase
    listener on the editor host stops the event before any bubble-phase handler
    sees it — the edgeless wheel handler included, which used to `preventDefault`
    the scroll on its way past. Nothing is cancelled, so the browser still
    scrolls the bubble; nothing is registered on `document`, so the page outside
    the editor keeps its wheel; nothing happens at all while no bubble is open.
    The board is frozen wherever the pointer is, and one click anywhere gives it
    back — the PO's call, and the only one that survives a bubble the user is
    halfway through.

  **A link was badged on a corner of its bounding box.** For a diagonal
  connector that corner is a point on empty paper, a long way from the trait
  being accused. Anchors now carry a `kind`: a `node` keeps its top-right corner,
  an `edge` is marked in the MIDDLE of the link — the midpoint of the drawn path
  by arc length (so an elbowed connector is marked halfway along what the eye
  follows, not at its bend), falling back to the intersection of the bounding
  rectangle's diagonals for an edge the layout has not routed. An anchor is an
  edge because its ROLE says so (`kind: 'edge'`) or because its GEOMETRY does (it
  exposes a path), so a generalist connector carrying no role is marked correctly
  too. The point is computed once, in `resolveViolationAnchors`, where it can be
  asserted as a coordinate.

  **The Map quality panel appeared to contradict itself**: "Nothing to report"
  over a map wearing amber badges, with no title and no legend. Three different
  things live on that surface and the panel never said which was speaking. It
  does now, without moving a single boundary between them:

  - the checklist is introduced as "To be checked by you" — the tool does not
    judge a nudge, and ticking is still assuming;
  - the check-up names the rule FAMILIES it walked ("Check-up (tones,
    nomenclature):"), so its verdict is about something rather than about
    everything;
  - a read-only context line counts the real-time findings on THIS map, narrowed
    on `backgroundId` exactly as a check-up is, so the badges on the canvas are
    accounted for in the panel instead of being silently denied by it.

  Every one of those strings is an i18n key with a library fallback, like the
  rest of the panel; rule wording still comes from the framework and the host
  catalogue still wins over both. The panel's rows now share one fixed gutter for
  the checkboxes, so the lines that have no box no longer hang a checkbox-width
  to the left of the ones that do.

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
- Updated dependencies [8ded589]
- Updated dependencies [9e23b5b]
- Updated dependencies [a3aa598]
- Updated dependencies [90a9168]
- Updated dependencies [6417a2f]
- Updated dependencies [d797f9a]
- Updated dependencies [9fde974]
- Updated dependencies [d360f72]
- Updated dependencies [50ab9ae]
- Updated dependencies [751ac44]
- Updated dependencies [54488cd]
- Updated dependencies [9453013]
- Updated dependencies [b746d6b]
- Updated dependencies [5ac0c68]
- Updated dependencies [1fa46c1]
- Updated dependencies [0473dcb]
- Updated dependencies [5b6e9bb]
- Updated dependencies [492bac6]
- Updated dependencies [72b334c]
- Updated dependencies [30580db]
- Updated dependencies [08e9b24]
- Updated dependencies [5076cb8]
- Updated dependencies [3c5c97e]
- Updated dependencies [7c10406]
- Updated dependencies [02797b5]
- Updated dependencies [413fe7b]
- Updated dependencies [724ed1c]
- Updated dependencies [c7612da]
- Updated dependencies [0ddfd47]
- Updated dependencies [3639562]
- Updated dependencies [5d16745]
- Updated dependencies [48e90f4]
- Updated dependencies [5edd916]
- Updated dependencies [5a16359]
- Updated dependencies [025d6f5]
- Updated dependencies [b1ed4ef]
- Updated dependencies [985a92f]
- Updated dependencies [b889326]
- Updated dependencies [1efc6d5]
- Updated dependencies [4162e4a]
- Updated dependencies [fad4c08]
- Updated dependencies [7b66d8d]
- Updated dependencies [4bb44ef]
- Updated dependencies [30061cb]
- Updated dependencies [77b0100]
- Updated dependencies [8d33c60]
- Updated dependencies [7a3458a]
  - @labre/std@0.32.0
  - @labre/affine-shared@0.32.0
  - @labre/store@0.32.0
  - @labre/affine-components@0.32.0
  - @labre/affine-model@0.32.0
  - @labre/global@0.32.0
  - @labre/affine-rich-text@0.32.0
  - @labre/affine-ext-loader@0.32.0

## 0.31.0

### Patch Changes

- Updated dependencies [6a663b6]
  - @labre/store@0.31.0
  - @labre/affine-components@0.31.0
  - @labre/affine-ext-loader@0.31.0
  - @labre/affine-model@0.31.0
  - @labre/affine-rich-text@0.31.0
  - @labre/affine-shared@0.31.0
  - @labre/std@0.31.0
  - @labre/global@0.31.0

## 0.30.2

### Patch Changes

- @labre/affine-components@0.30.2
- @labre/affine-ext-loader@0.30.2
- @labre/affine-model@0.30.2
- @labre/affine-rich-text@0.30.2
- @labre/affine-shared@0.30.2
- @labre/global@0.30.2
- @labre/std@0.30.2
- @labre/store@0.30.2

## 0.30.1

### Patch Changes

- @labre/affine-components@0.30.1
- @labre/affine-ext-loader@0.30.1
- @labre/affine-model@0.30.1
- @labre/affine-rich-text@0.30.1
- @labre/affine-shared@0.30.1
- @labre/global@0.30.1
- @labre/std@0.30.1
- @labre/store@0.30.1

## 0.30.0

### Patch Changes

- Updated dependencies [9d0fe0c]
- Updated dependencies [ecba791]
- Updated dependencies [8de86f4]
  - @labre/std@0.30.0
  - @labre/affine-model@0.30.0
  - @labre/affine-components@0.30.0
  - @labre/affine-rich-text@0.30.0
  - @labre/affine-shared@0.30.0
  - @labre/affine-ext-loader@0.30.0
  - @labre/global@0.30.0
  - @labre/store@0.30.0

## 0.29.1

### Patch Changes

- @labre/affine-components@0.29.1
- @labre/affine-ext-loader@0.29.1
- @labre/affine-model@0.29.1
- @labre/affine-rich-text@0.29.1
- @labre/affine-shared@0.29.1
- @labre/global@0.29.1
- @labre/std@0.29.1
- @labre/store@0.29.1

## 0.29.0

### Patch Changes

- Updated dependencies [7375b9a]
- Updated dependencies [9330750]
  - @labre/affine-shared@0.29.0
  - @labre/std@0.29.0
  - @labre/affine-components@0.29.0
  - @labre/affine-rich-text@0.29.0
  - @labre/affine-model@0.29.0
  - @labre/affine-ext-loader@0.29.0
  - @labre/global@0.29.0
  - @labre/store@0.29.0

## 0.28.0

### Patch Changes

- Updated dependencies [65cc055]
  - @labre/std@0.28.0
  - @labre/affine-components@0.28.0
  - @labre/affine-model@0.28.0
  - @labre/affine-rich-text@0.28.0
  - @labre/affine-shared@0.28.0
  - @labre/affine-ext-loader@0.28.0
  - @labre/global@0.28.0
  - @labre/store@0.28.0

## 0.27.0

### Patch Changes

- Updated dependencies [91f6397]
  - @labre/std@0.27.0
  - @labre/affine-components@0.27.0
  - @labre/affine-model@0.27.0
  - @labre/affine-rich-text@0.27.0
  - @labre/affine-shared@0.27.0
  - @labre/affine-ext-loader@0.27.0
  - @labre/global@0.27.0
  - @labre/store@0.27.0

## 0.26.0

### Patch Changes

- Updated dependencies [8960a6c]
- Updated dependencies [6795191]
  - @labre/affine-model@0.26.0
  - @labre/affine-components@0.26.0
  - @labre/affine-rich-text@0.26.0
  - @labre/affine-shared@0.26.0
  - @labre/affine-ext-loader@0.26.0
  - @labre/global@0.26.0
  - @labre/std@0.26.0
  - @labre/store@0.26.0

## 0.25.0

### Patch Changes

- Updated dependencies [8960a6c]
- Updated dependencies [6795191]
  - @labre/affine-model@0.25.0
  - @labre/affine-components@0.25.0
  - @labre/affine-rich-text@0.25.0
  - @labre/affine-shared@0.25.0
  - @labre/affine-ext-loader@0.25.0
  - @labre/global@0.25.0
  - @labre/std@0.25.0
  - @labre/store@0.25.0

## 0.24.0

### Patch Changes

- @labre/affine-components@0.24.0
- @labre/affine-ext-loader@0.24.0
- @labre/affine-model@0.24.0
- @labre/affine-rich-text@0.24.0
- @labre/affine-shared@0.24.0
- @labre/global@0.24.0
- @labre/std@0.24.0
- @labre/store@0.24.0

## 0.23.3

### Patch Changes

- Updated dependencies
  - @labre/affine-shared@0.23.3
  - @labre/affine-components@0.23.3
  - @labre/affine-rich-text@0.23.3
  - @labre/affine-ext-loader@0.23.3
  - @labre/affine-model@0.23.3
  - @labre/global@0.23.3
  - @labre/std@0.23.3
  - @labre/store@0.23.3

## 0.23.2

### Patch Changes

- Updated dependencies [ee682da]
  - @labre/affine-shared@0.23.2
  - @labre/affine-components@0.23.2
  - @labre/affine-rich-text@0.23.2
  - @labre/affine-ext-loader@0.23.2
  - @labre/affine-model@0.23.2
  - @labre/global@0.23.2
  - @labre/std@0.23.2
  - @labre/store@0.23.2

## 0.23.1

### Patch Changes

- Updated dependencies [1beb60e]
  - @labre/affine-shared@0.23.1
  - @labre/affine-components@0.23.1
  - @labre/affine-rich-text@0.23.1
  - @labre/affine-ext-loader@0.23.1
  - @labre/affine-model@0.23.1
  - @labre/global@0.23.1
  - @labre/std@0.23.1
  - @labre/store@0.23.1

## 0.23.0

### Patch Changes

- 9014c87: Add a BPMN process framework (v1, lean) to the edgeless editor. A new
  `@labre/affine-gfx-bpmn` package adds a senior-toolbar BPMN button whose menu
  drops the core BPMN basics onto the canvas:

  - start event (thin green ring), end event (thick red ring), task (rounded
    rectangle with editable label) and exclusive gateway (diamond with an X) -
    all native shapes (editable stroke / fill / text, native resize);
  - a sequence-flow item that arms the native connector tool pre-styled solid
    with a filled triangle head;
  - a pool background container (rounded-rect frame + editable vertical name
    band), with a resize-lock toggle in its element toolbar.

  Visual style is "hybrid": spec-accurate shapes and line weights with accent
  colour only on the event rings. Wired behind a `bpmn` block flag (ships dark
  until the host enables it). Out of scope for v1: intermediate / parallel /
  inclusive gateways, message & association flows, pool lanes, sub-process, data
  objects and task-type icons.

- Updated dependencies [9014c87]
- Updated dependencies [c775151]
  - @labre/affine-model@0.23.0
  - @labre/affine-shared@0.23.0
  - @labre/affine-components@0.23.0
  - @labre/affine-rich-text@0.23.0
  - @labre/affine-ext-loader@0.23.0
  - @labre/global@0.23.0
  - @labre/std@0.23.0
  - @labre/store@0.23.0
