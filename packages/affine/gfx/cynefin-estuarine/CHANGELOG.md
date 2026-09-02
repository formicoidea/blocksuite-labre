# @labre/affine-gfx-cynefin-estuarine

## 0.35.0

### Patch Changes

- Updated dependencies [ea5d249]
- Updated dependencies [e9cd7e1]
- Updated dependencies [de3560d]
- Updated dependencies [7f09608]
- Updated dependencies [ad21e60]
- Updated dependencies [cf0d8a1]
  - @labre/affine-block-surface@0.35.0
  - @labre/affine-shared@0.35.0
  - @labre/std@0.35.0
  - @labre/affine-model@0.35.0
  - @labre/affine-widget-edgeless-toolbar@0.35.0
  - @labre/affine-gfx-pointer@0.35.0
  - @labre/affine-gfx-template@0.35.0
  - @labre/affine-ext-loader@0.35.0
  - @labre/global@0.35.0
  - @labre/store@0.35.0

## 0.34.2

### Patch Changes

- @labre/affine-block-surface@0.34.2
- @labre/affine-ext-loader@0.34.2
- @labre/affine-gfx-pointer@0.34.2
- @labre/affine-gfx-template@0.34.2
- @labre/affine-model@0.34.2
- @labre/affine-shared@0.34.2
- @labre/affine-widget-edgeless-toolbar@0.34.2
- @labre/global@0.34.2
- @labre/std@0.34.2
- @labre/store@0.34.2

## 0.34.1

### Patch Changes

- Updated dependencies [6120f7a]
- Updated dependencies [cb49bb1]
  - @labre/affine-model@0.34.1
  - @labre/std@0.34.1
  - @labre/affine-block-surface@0.34.1
  - @labre/affine-gfx-pointer@0.34.1
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
  - @labre/affine-widget-edgeless-toolbar@0.34.0
  - @labre/affine-gfx-pointer@0.34.0
  - @labre/affine-gfx-template@0.34.0
  - @labre/affine-model@0.34.0
  - @labre/affine-ext-loader@0.34.0
  - @labre/global@0.34.0
  - @labre/store@0.34.0

## 0.33.0

### Minor Changes

- 2dc39cf: An Estuarine map offers a quality checklist, and its reference lines are drawn as ghosts

  The three reference curves (Liminal, Volatile, Counter-factual) are no longer
  solid: a shown curve is now a discreet dashed ghost, so the tool's suggestion
  stops looking like the answer and the line the group actually negotiates reads
  as the statement. Flipping a curve back on plays a short reveal animation —
  dashes marching along the path under a brighter stroke that fades into the
  ghost — so a line coming back at low opacity is still seen arriving. Users who
  have asked their system for reduced motion get the ghost with no animation.

  Existing maps change appearance: curves drawn solid yesterday are ghosts today.
  Nothing in the document changed, and the toggles mean exactly what they meant.

  Selecting an Estuarine map also offers Map quality: four expectations to tick —
  the counter-factual line negotiated by the group, the volatile zone delimited,
  a Monitor / Research / Request strategy above the line, and every hexagon
  typed. Estuarine ships no validation rule and, deliberately, no severity
  profile: a dial over an empty rule set would be a control that decides nothing.
  Maps and hexagons created from the toolbox or from a template now carry a
  semantic role; anything drawn before today stays neutral and unjudged. Cynefin
  contributes nothing here and is out of the validation perimeter for good.

### Patch Changes

- 753872b: An Estuarine map's axes follow the size it is given

  Stretching an Estuarine background used to leave the drawing at its authored
  proportions, centred, with short axes floating in empty margins: the map was
  fitted uniformly and letterboxed. It now follows the element in both
  directions — the time axis runs the full real width, the energy axis the full
  real height, arrowheads land at the real ends, and the three reference curves
  cover the whole plane, because a negotiated boundary belongs to the plane and
  not to a picture.

  What is NOT stretched: stroke widths, arrowhead triangles and every word
  (axis letters, curve legends) keep one isotropic scale, so a map pulled
  sideways gets no fat lines, no elongated arrowheads and no squashed type.

  A map left at its authored 690 × 801 ratio — including one simply scaled up or
  down — paints exactly what it painted before. Nothing in the document changed.

  Cynefin is untouched on purpose: its background is a figurative drawing, and
  the uniform fit is the right answer there.

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
- Updated dependencies [932bf35]
- Updated dependencies [5737a56]
- Updated dependencies [168617d]
- Updated dependencies [932bf35]
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
  - @labre/affine-shared@0.33.0
  - @labre/affine-model@0.33.0
  - @labre/std@0.33.0
  - @labre/affine-widget-edgeless-toolbar@0.33.0
  - @labre/affine-gfx-pointer@0.33.0
  - @labre/affine-gfx-template@0.33.0
  - @labre/affine-ext-loader@0.33.0
  - @labre/global@0.33.0
  - @labre/store@0.33.0

## 0.32.0

### Minor Changes

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
- Updated dependencies [9e23b5b]
- Updated dependencies [a3aa598]
- Updated dependencies [6417a2f]
- Updated dependencies [d797f9a]
- Updated dependencies [9fde974]
- Updated dependencies [50ab9ae]
- Updated dependencies [89b90e9]
- Updated dependencies [f7f23b2]
- Updated dependencies [751ac44]
- Updated dependencies [54488cd]
- Updated dependencies [9453013]
- Updated dependencies [b746d6b]
- Updated dependencies [5ac0c68]
- Updated dependencies [630633b]
- Updated dependencies [1fa46c1]
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
  - @labre/affine-block-surface@0.32.0
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
  - @labre/affine-gfx-pointer@0.31.0
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
- @labre/affine-gfx-pointer@0.30.2
- @labre/affine-gfx-template@0.30.2
- @labre/affine-model@0.30.2
- @labre/affine-shared@0.30.2
- @labre/affine-widget-edgeless-toolbar@0.30.2
- @labre/global@0.30.2
- @labre/std@0.30.2
- @labre/store@0.30.2

## 0.30.1

### Patch Changes

- 09f1d82: Estuarine hexi cards: pointy-top orientation (the two-vertex symmetry
  axis is now vertical — a 90° rotation) and default size doubled to
  120×120. The hexi constants are shared between the toolbar menu and the
  templates.
  - @labre/affine-block-surface@0.30.1
  - @labre/affine-ext-loader@0.30.1
  - @labre/affine-gfx-pointer@0.30.1
  - @labre/affine-gfx-template@0.30.1
  - @labre/affine-model@0.30.1
  - @labre/affine-shared@0.30.1
  - @labre/affine-widget-edgeless-toolbar@0.30.1
  - @labre/global@0.30.1
  - @labre/std@0.30.1
  - @labre/store@0.30.1

## 0.30.0

### Patch Changes

- ecba791: Per-framework text-fit defaults. Event Storming stickies and Context Map
  bubbles now carry their label as the shape's own text (contained /
  overflow fit) instead of a separate grouped text element — double-click
  edits in place and the box never deforms; previously created prefabs keep
  their old structure and keep working. Estuarine hexi constraints default
  to contained; BPMN nodes and the Wardley inertia bar default to overflow.
- Updated dependencies [9d0fe0c]
- Updated dependencies [ecba791]
- Updated dependencies [8de86f4]
  - @labre/std@0.30.0
  - @labre/affine-model@0.30.0
  - @labre/affine-block-surface@0.30.0
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
- @labre/affine-gfx-pointer@0.29.1
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
  - @labre/affine-gfx-pointer@0.29.0
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
  - @labre/affine-gfx-pointer@0.28.0
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
  - @labre/affine-gfx-pointer@0.27.0
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
  - @labre/affine-gfx-pointer@0.26.0
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
  - @labre/affine-gfx-pointer@0.25.0
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
  - @labre/affine-ext-loader@0.24.0
  - @labre/affine-gfx-pointer@0.24.0
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
  - @labre/affine-gfx-pointer@0.23.3
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
  - @labre/affine-gfx-pointer@0.23.2
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
  - @labre/affine-gfx-pointer@0.23.1
  - @labre/affine-gfx-template@0.23.1
  - @labre/affine-widget-edgeless-toolbar@0.23.1
  - @labre/affine-ext-loader@0.23.1
  - @labre/affine-model@0.23.1
  - @labre/global@0.23.1
  - @labre/std@0.23.1
  - @labre/store@0.23.1

## 0.23.0

### Minor Changes

- c775151: Update the Cynefin background to the latest Liminal Cynefin artwork: add the
  teal "iterate" liminal curve, the Probe/Sense/Respond decision text for each
  domain, the teal annotation labels (strategy by design, radical innovation,
  good/best practice, exaptation sub-labels) and the central Aporia (A) /
  Confusion (C) markers.

  The toolbar exposes independent toggles: "Show / hide titles" (domain names +
  the A/C marker glyphs and names), "Show / hide explanatory text" (subheadings,
  decisions, annotations, notes) and "Show / hide liminal line" (the teal curve).

- c775151: Update the Estuarine map background to the latest artwork (reference space
  690×801): darker magenta axes (#941253) with larger arrowheads, the Volatile
  boundary redrawn as an explicit curve (instead of a half-circle arc), refreshed
  Liminal / Counter-factual curves, and letter-spaced legends with their own
  colours (green LIMINAL, red VOLATILE, dark COUNTER FACTUAL, red italic e / t
  axis letters). The per-curve and axis-label toggles are unchanged.
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
  - @labre/affine-gfx-pointer@0.23.0
  - @labre/affine-ext-loader@0.23.0
  - @labre/global@0.23.0
  - @labre/std@0.23.0
  - @labre/store@0.23.0
