# @labre/affine-gfx-edgy

## 0.34.1

### Patch Changes

- 6120f7a: fix(edgeless): a framework background is picked by its border, not its whole area

  Framework backgrounds and boards hit-tested their entire rectangle, so they
  competed with their own content for every click. A board created after the
  shapes it covers sits above them in the paint order and swallowed 100% of the
  clicks on those shapes; one sitting below filled every gap the content left —
  the interior of an unfilled shape, the space beside a small node — which is
  where the "one time in two" came from. Eleven element types were affected: the
  BPMN pool, both C4 frames, the event-storming board, the core domain chart, the
  Wardley background and the context-map board (subclasses of the
  framework-background primitive), plus the EDGY board, the EDGY facets diagram,
  Cynefin and Estuarine (standalone implementations of the same geometry).

  A background is now selected by a band along its border, ten screen pixels wide
  and adjusted for the zoom like every shape's stroke, with two carve-outs:

  - a **BPMN pool** keeps its title bands clickable — the participant strip on the
    left and the lane strip beside it — which is the bpmn.io convention and the
    only part of a pool that is the pool rather than the process drawn on it;
  - **editable label zones** (Wardley axis titles, EDGY facet names, C4 board and
    boundary names) still receive the double-click that renames them, and a BPMN
    pool's lane separators still receive the drag that moves them. Pointer events
    now reach a view through the VIEW's `includesPoint` rather than the model's —
    it delegates to the model by default, so nothing else changes — which is what
    lets a framework declare its own gesture zones beside the code that draws
    them.

  The lasso (`containsBound` / `intersectsBound`) is untouched, and a selected
  background is still dragged from anywhere inside it: the drag path asks about
  the element's visible extent (`ignoreTransparent: false`), which the interior
  still answers, exactly as an unfilled shape does.

- cb49bb1: fix(edgeless): the edgy venn stops hosting the spotlight — board logic lives on
  the edgy board

  The EDGY "Enterprise Design Facets" Venn (`edgy`) was registered as a
  spotlight host alongside the EDGY board (`edgyBoard`), so any element laid
  inside its circles got the hover spotlight: hovering one faded everything else
  on the diagram. That is board logic on a drawing. The Venn frames a notation;
  it does not host a dependency reading.

  `SpotlightHostExtension('edgy')` is gone and the "Enable / disable hover
  spotlight" toggle has left the Venn's contextual toolbar. The board keeps both,
  unchanged. The Venn keeps its appearance toggles — labels, pictos, crop,
  resize — plus its legend, which moves from `d.legend` to `c.legend` now that
  the row is one shorter.

  `spotlightEnabled` STAYS on `EdgyFacetsElementModel`: documents written before
  this change carry the property and must stay loadable. It is simply inert —
  nothing reads it on a Venn any more.

  The host lookup `SpotlightManager` runs on every pointermove is now the
  exported pure `findSpotlightHost(target, elements, hostTypes)`, so the rule a
  Venn grants nothing and a board grants is pinned by a unit test rather than by
  a DI registration read by eye.

  Refs #195

- Updated dependencies [6120f7a]
- Updated dependencies [cb49bb1]
  - @labre/affine-model@0.34.1
  - @labre/std@0.34.1
  - @labre/affine-block-surface@0.34.1
  - @labre/affine-components@0.34.1
  - @labre/affine-gfx-connector@0.34.1
  - @labre/affine-gfx-ddd-shared@0.34.1
  - @labre/affine-gfx-group@0.34.1
  - @labre/affine-gfx-pointer@0.34.1
  - @labre/affine-gfx-shape@0.34.1
  - @labre/affine-gfx-template@0.34.1
  - @labre/affine-shared@0.34.1
  - @labre/affine-widget-edgeless-toolbar@0.34.1
  - @labre/affine-ext-loader@0.34.1
  - @labre/global@0.34.1
  - @labre/store@0.34.1

## 0.34.0

### Minor Changes

- 881d3f5: feat(blocks): every framework bundle publishes a data-only ./commands-manifest subpath, and bundle .d.ts stop leaking \_pkgs internals

  ## `./commands-manifest` (#181)

  A host settings pane that lists the framework commands — id, label, chord,
  scope, owner — had one published route to them: the bundle's MAIN entry. A
  `CommandDescriptor` carries its `run`, so that entry pulls the framework's whole
  action graph behind it: the import/export machinery (Wardley's `import.js` alone
  is 47 KB), the surface, gfx, model and shared deep paths of core. Nothing can be
  tree-shaken away, because every descriptor genuinely references its handler. The
  pane's chunk was carrying eight action graphs to draw about a hundred static
  rows.

  Each framework bundle now also publishes `./commands-manifest`, modelled on the
  existing `./descriptor`: the same commands projected to the six fields a
  shortcuts panel needs — `id`, `owner`, `labelKey`, `labelFallback`, `scope`,
  `defaultKeys` — with no `run`, no `params`, and type-only imports, so the module
  references nothing at all. It is a few hundred bytes per framework instead of
  megabytes.

  The projection is `toShortcutManifestEntry`, new in `@labre/std` beside the two
  projections that were already there. `scripts/build-bundles.mjs` refuses to
  build a framework whose manifest module reaches for a runtime import, and a unit
  test pins every manifest row-for-row against the commands it projects, so the
  second copy cannot drift from the first.

  ## `labelFallback` survives the projection (#181)

  `getShortcutManifest`'s row type kept `labelKey` but dropped `labelFallback`,
  which left a host with no translation catalogue rendering raw i18n keys — and
  forced every host to re-project from the main entry to recover a wording the
  library already knew. `ShortcutManifestEntry` now carries it, and it is declared
  once, in `@labre/std`, so core's rows and a framework bundle's rows are the same
  type: a host concatenates them. `owner` also narrows from `string` to
  `CommandOwner`, and the never-populated `when?: string` is gone.

  ## `_pkgs/*` in the emitted declarations (#60)

  The published `.d.ts` named internal core subpaths — `_pkgs/global/utils`,
  `_pkgs/global/di`, `_pkgs/affine-widget-edgeless-toolbar` — that core's
  `exports` map did not carry. tsc synthesises them when emitting a dependent
  bundle's declarations, by reverse-mapping the tsconfig `paths` entry onto the
  file a type physically lives in. Only `skipLibCheck: true` hid it; a consumer
  that type-checks the bundle declarations got unresolved-module errors.

  `scripts/compile-bundles.mjs` now scans the finished emit for those references
  and publishes exactly the subpaths it finds, then re-checks every reference
  against the map it wrote. Rewriting the specifiers to a public shim was the
  alternative and was not taken: a rewrite only has a target when a public shim
  happens to re-export that exact module, and nothing guarantees one exists for
  every internal declaration tsc may name. Publishing the subpath always has a
  target, and deriving the list from the emit keeps the exposure to what the
  declarations genuinely need.

### Patch Changes

- 8b00f7d: fix(blocks): core toasts, board tooltips, catalogue headers and seed texts cross the translation seam

  A host that wires `TranslationExtension` now gets a catalogue that covers the
  editor, instead of one that covers everything except the parts a user actually
  reads first. Six families of hard-coded English are gone (refs #182, #183);
  every one of them is a `com.labre.*` key with the previous literal as its
  English fallback, so an editor with no `TranslationProvider` registered reads
  exactly what it read before.

  - **Toasts** — "Copied to clipboard", "Linked doc created", "Note removed from
    Page Mode", "Frame inserted into Page.", "No link found".
  - **Board toolbars** — the resize toggle every framework board carries, and the
    two legend wordings, declared once in `@labre/affine-shared` rather than
    eight times.
  - **Editor chrome** — the toolbar verbs (Copy, Duplicate, Delete, Lock, Link,
    More, Bring to Front, Send to Back, Create linked doc, Draw connector), the
    view switcher (Switch / Inline / Card / Embed view) and the linked-doc card's
    four "nothing to show" sentences. `ToolbarAction` gained `labelWording` /
    `tooltipWording`: a declared `[key, English]` pair the toolbar resolves when
    it builds the row, which keeps a call site one line and keeps the row's width
    planning honest about what it is about to say.
  - **Catalogue headers** — every framework now contributes its own
    `com.labre.catalogue.category.*` keys. Core's registry names no framework
    category once `build:bundles` has stripped it, so a bundled host was drawing
    translated entries under English headers.
  - **BPMN import remarks** — the three whose wording is a fixed sentence carry a
    key (`InterchangeNote.messageKey`). The ones that name an element, an id or a
    count of lanes do not: the seam has no interpolation.
  - **Seed texts** — the caption a placed BPMN or EDGY artefact is given, and a
    C4 board's name, are resolved AT PLACEMENT. What lands in the document is
    content the author owns from that moment on and is never re-translated.

  `getTranslationKeyManifest()` gains all of it, including a new `'seed'` source
  for the words a framework writes onto the canvas.

  Three surfaces are deliberately left English, and each one is a refusal rather
  than an oversight. The **C4 component tier seeds** (`NODE_LABEL`,
  `C4_TYPE_PLACEHOLDER`, `DESCRIPTION_PLACEHOLDER`) are read back as SENTINELS by
  the morph and by the mermaid exporter, which is a pure function of the board
  and has no `std` to re-resolve them with — translating them would change what
  an export writes. The **code block's "⋮"** is a `MenuItemGroup` rendered over a
  generic context that carries no `std`. The **slash menu** and the **mobile
  keyboard toolbar** item names are their own vocabularies, untouched apart from
  the toasts they raise.

- Updated dependencies [881d3f5]
- Updated dependencies [6c1bdfb]
- Updated dependencies [8b00f7d]
- Updated dependencies [5f76ab3]
- Updated dependencies [f09d68c]
  - @labre/std@0.34.0
  - @labre/affine-shared@0.34.0
  - @labre/affine-block-surface@0.34.0
  - @labre/affine-components@0.34.0
  - @labre/affine-widget-edgeless-toolbar@0.34.0
  - @labre/affine-gfx-connector@0.34.0
  - @labre/affine-gfx-ddd-shared@0.34.0
  - @labre/affine-gfx-group@0.34.0
  - @labre/affine-gfx-pointer@0.34.0
  - @labre/affine-gfx-shape@0.34.0
  - @labre/affine-gfx-template@0.34.0
  - @labre/affine-model@0.34.0
  - @labre/affine-ext-loader@0.34.0
  - @labre/global@0.34.0
  - @labre/store@0.34.0

## 0.33.0

### Minor Changes

- 6fd58e5: feat(edgeless): the two EDGY backgrounds generate the legend of what is drawn on them

  Select the **facets diagram** or the **EDGY board** and its toolbar now offers
  the same legend button the three DDD backgrounds were given: it reads what is
  actually inside the background's perimeter and drops a legend of exactly that,
  bottom-left, as a real editable group of elements. A board with a Purpose, a
  Content and two relations on it gets a three-row legend; add a Journey and press
  again.

  What it lists, grouped the way EDGY reads:

  - **Identity**, **Architecture** and **Experience** — one row per official
    element of the facet present, in the pastel its zone is drawn with;
  - **Intersections** — Organisation, Product and Brand together, each in its own
    colour, because they are the three lenses between the facets and not facets of
    their own;
  - **Base elements** — People, Outcome, Object and Activity, listed only when one
    is on the board BARE. A Content is an Object in the vocabulary, but a board
    carrying a Content has not necessarily got a bare Object on it, and the legend
    does not claim one;
  - **Relations** — one row, whatever the verb. A link says "expresses" or
    "traverses" on the link itself, where the reader is already looking; twenty-two
    legend rows would restate the metamodel instead of documenting the drawing.

  Every row is DERIVED from the metamodel: which elements exist, which zone each
  belongs to, what colour that zone is painted. The element table now names its
  zone instead of repeating a colour literal, so the swatch in the legend is by
  construction the fill on the diagram, and a thirteenth element would get its
  legend row the same way it gets its role — with no edit. Detection is by
  **semantic role**, like every other reader of a board, so a re-coloured element
  stays in its row and a rectangle somebody drew to think with stays out.

  The twelve official elements and the four base kinds also gained the English
  wording their roles were missing, which is what the legend prints when the host
  ships no catalogue.

  Registered always-on, next to the resize and spotlight toggles: a legend is
  elements written into the document, not tooling a flag may take away.

- 21aa9d8: An EDGY relation drawn by hand names itself

  The EDGY toolbox gains a **Relation** entry. Pick it, drag from one element to
  another, and the link is typed: it carries the verb the metamodel gives that
  pair — as a role the validation reads, and as the visible label the template
  already puts on its own 24 links. "Process **realises** Capability", "Journey
  **traverses** Channel", written by the tool, not by the user.

  Until now those 24 typed relations could only be born of the "EDGY dynamic"
  template. A practitioner drawing their own board had a plain connector: no verb,
  no role, nothing the metamodel check could read. The vocabulary was there and
  there was no way to speak it by hand.

  **One entry, not twenty-two.** The metamodel's 24 relations run between 24
  distinct ordered pairs of elements, so the verb is entirely determined by which
  two elements the link ends up attached to — there is exactly one thing a link
  from a Journey to a Channel can say. Offering a list of twenty-two verbs would
  be asking a question the method already answers.

  Three things it deliberately does not do:

  - **it never turns a link round.** Draw a Channel → Journey link and it is named
    `traverses` all the same and left pointing the way it was drawn. The
    metamodel check then reports the sentence as one EDGY does not declare, and
    "Reverse direction" is one click away on the link's toolbar. Silently flipping
    a deliberate gesture would be the tool overruling the user; leaving the link
    anonymous would hide the mistake.
  - **it never says anything about a pair the metamodel does not know**, and never
    about a link with an end on a People node, a base Object, a plain sticky or
    another framework's element. Outside the alphabet is outside the conversation.
  - **it never rewrites a verb already there.** A relation is named once, on the
    way from the generic link to the verb, and never back. Move an end while the
    link is still anonymous and it is named again from the new pair; move an end
    after it has a verb and the verb stays — it is the user's statement by then.

  Nothing is backfilled and nothing else changes: links drawn before this release
  keep exactly what they carry, and a plain connector stays a plain connector.

- 9f91a96: EDGY boards are now checked against the metamodel

  The EDGY artefacts carry a semantic role at last: the four base elements say
  which kind they are, the twelve official elements of the metamodel say which
  element they are, the facets diagram and the blank board say they are a frame,
  and each of the 24 canonical relations carries a role named after its verb —
  "expresses", "traverses", "is part of". The verb still travels with the link as
  a visible label; the role is what the tool reads.

  On top of that vocabulary, two checks appear on a selected EDGY background,
  under the Validation dropdown the Wardley map already had:

  - **a relation the metamodel does not declare** is reported, read as one
    sentence — source, verb, target. "A journey traverses a channel" is EDGY; the
    same link drawn the other way round is not, and the finding names all three
    elements so either fix is one gesture away.
  - **two artefacts on top of each other** are reported, because on a facets
    diagram where an element sits is what says which facet it belongs to.

  Both come with the Sketch / Strict profile choice — Sketch is the default and
  says nothing on the canvas — and with a four-item work-quality checklist for
  the things no algorithm can decide: intersection elements linked to both parent
  facets, elements wearing their facet's colour, relations that read correctly,
  all three facets explored.

  Nothing is backfilled. A board drawn before this release carries no role on
  anything, so it is never evaluated and never says a word; only the EDGY dynamic
  template and the elements created from the EDGY palette are stamped. The
  illustrative templates (customer journey, service blueprint, organisation
  chart) stay deliberately neutral drawings.

### Patch Changes

- 1dbd735: Framework flows keep their style to themselves

  Arming a typed flow tool — a BPMN sequence flow, message flow or association, a
  Wardley link or change arrow, an EDGY relation, a Context Map pattern, an Event
  Storming flow, a Core Domain movement, a C4 relationship — used to write the
  flow's look into the shared "last used connector style". The next plain
  connector then came out dressed as that flow (dash, colour, arrowheads) while
  carrying none of its meaning; BPMN 2.0 (p.40) explicitly forbids other
  connectors adopting a flow's line style.

  The framework look now rides on the tool activation itself
  (`ConnectorToolOptions.style`) and is applied to the drawn edge at creation
  only. The last-props store is never touched by a framework activation, so the
  plain connector tool keeps drawing with the user's own last style — which
  still persists exactly as before when set from the plain tool itself.

- 2ec39c0: validation rules carry their provenance — standard, recommendation or Labre convention — and the violation bubble says so

  A rule now declares where its authority comes from, as data rather than as prose
  buried in its message: `standard` with the page of the specification it reads,
  `recommendation` for a SHOULD or an industry linter's rule, `labre-convention`
  for a house style of this editor and nothing else. The violation bubble shows it
  as one discreet line under the finding, with the rule's own citation printed
  verbatim — so a convention can never reach an architect dressed as a norm
  violation, which is what an external review of the BPMN integration asked for.

  The field is purely descriptive: no evaluator reads it, and a rule that declares
  one raises exactly the findings it raised before.

  All twenty-two BPMN rules declare it — twelve `standard`, each with its page,
  eight `recommendation` naming a linter or the sentence the standard merely
  permits, and two conventions that say so out loud. The self-loop check left
  `bpmn.sequence-flow-endpoints` and became `bpmn.sequence-flow-self-loop`: the
  endpoints matrix is BPMN 2.0.2 p.95 and the no-self-loop habit is ours, so one
  rule could not have declared either honestly. Same wording, same severity, same
  i18n keys, one new rule id in the profiles.

  That new id is the one thing this change does not carry over: user exceptions
  are persisted per rule id, so an exception granted on a self-looping flow under
  `bpmn.sequence-flow-endpoints` no longer matches and the finding returns. No
  migration ships, because BPMN landed days ago and these packages are
  unpublished, so the set of affected documents is empty — but the same rename
  after publication would need a migration or an alias, and should not lean on
  this precedent.

  The other five frameworks' rules are annotated too — mostly `recommendation`
  naming the method, with the readability nudges declared as the Labre
  conventions they always were.

- 7ec4478: Senior button components resolve their own label through the translation seam

  The toolbar's navigation tooltips learned to translate a senior tool's
  `labelKey`, but the seven framework senior-button components still carried
  their label as a hard-coded English string. Each button now resolves the same
  `com.labre.framework.<id>` key through `translateKey`, with the previous
  English wording as fallback — so a host catalogue that already translates the
  toolbar translates the buttons too, and a standalone playground reads exactly
  as before.

- a9eb4f6: Senior buttons name themselves in the user's language

  The edgeless toolbar's senior-tool tooltips were the last piece of chrome that
  could only say "Wardley map" or "Event Storming" — a raw English string carried
  on the tool itself, invisible to the host catalogue. A senior tool can now
  declare `labelKey` alongside its `name`, and the toolbar resolves it through
  the same `TranslationProvider` seam every other library wording already uses.

  The seven frameworks declare the key their descriptor already publishes
  (`com.labre.framework.<id>`), so a host that built its catalogue from
  `getTranslationKeyManifest()` translates the buttons with no new key to add.
  `name` stays required and stays the fallback: it is what a standalone
  playground shows, and it is all the core tools (note, shape, template…) have —
  they own no framework identity, so they declare no key.

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
- Updated dependencies [cbd9471]
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
- Updated dependencies [7ec4478]
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
  - @labre/affine-gfx-ddd-shared@0.33.0
  - @labre/affine-gfx-connector@0.33.0
  - @labre/affine-widget-edgeless-toolbar@0.33.0
  - @labre/affine-gfx-group@0.33.0
  - @labre/affine-gfx-pointer@0.33.0
  - @labre/affine-gfx-shape@0.33.0
  - @labre/affine-gfx-template@0.33.0
  - @labre/affine-ext-loader@0.33.0
  - @labre/global@0.33.0
  - @labre/store@0.33.0

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

### Patch Changes

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
- Updated dependencies [aa08529]
- Updated dependencies [6417a2f]
- Updated dependencies [d797f9a]
- Updated dependencies [9fde974]
- Updated dependencies [d360f72]
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
- Updated dependencies [72b334c]
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
- Updated dependencies [c7612da]
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
  - @labre/affine-components@0.32.0
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
  - @labre/affine-components@0.31.0
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
- @labre/affine-components@0.30.2
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
- @labre/affine-components@0.30.1
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

### Patch Changes

- Updated dependencies [9d0fe0c]
- Updated dependencies [ecba791]
- Updated dependencies [8de86f4]
  - @labre/std@0.30.0
  - @labre/affine-model@0.30.0
  - @labre/affine-gfx-shape@0.30.0
  - @labre/affine-block-surface@0.30.0
  - @labre/affine-components@0.30.0
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
- @labre/affine-components@0.29.1
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
  - @labre/affine-components@0.29.0
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
  - @labre/affine-components@0.28.0
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
  - @labre/affine-components@0.27.0
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
- Updated dependencies [6795191]
  - @labre/affine-model@0.26.0
  - @labre/affine-components@0.26.0
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
- Updated dependencies [6795191]
  - @labre/affine-model@0.25.0
  - @labre/affine-components@0.25.0
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

- Updated dependencies [bc31490]
  - @labre/affine-gfx-template@0.24.0
  - @labre/affine-block-surface@0.24.0
  - @labre/affine-components@0.24.0
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
  - @labre/affine-components@0.23.3
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
  - @labre/affine-components@0.23.2
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
  - @labre/affine-components@0.23.1
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
  - @labre/affine-components@0.23.0
  - @labre/affine-gfx-connector@0.23.0
  - @labre/affine-gfx-group@0.23.0
  - @labre/affine-gfx-pointer@0.23.0
  - @labre/affine-gfx-shape@0.23.0
  - @labre/affine-ext-loader@0.23.0
  - @labre/global@0.23.0
  - @labre/std@0.23.0
  - @labre/store@0.23.0
