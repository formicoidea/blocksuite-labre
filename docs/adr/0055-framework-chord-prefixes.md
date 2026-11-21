# ADR 0055 — Framework chord prefixes

- Status: **accepted** (2026-11-20)
- Deciders: the product owner's request ("extend the `w` + key combinations
  to the other frameworks: DDD `d`, UML `u`, BPMN `b`, Cynefin `y`, EDGY `g`,
  Event Storming `t`") and his choice of `o` for Event Storming once `t` was
  found taken, and his choice of `l` for the Templates panel (§ 7); the collision rule, the hand-on rule and the read-only rule
  below are the lead's. The second-key table is a proposal the product owner
  validates or amends, one field per command.
- **Red zones**: none touched. No schema, no stored prop, no command id, no
  `labelKey`: `defaultKeys` move from empty to a chord, and the framework
  toolbox commands' serializable `availability` moves from `'always'` to
  `'editable'`. `packages/framework/std` changes in two places, each behind a
  guard test written on the previous behaviour first: what an armed prefix
  does with a key that cannot continue it, and a prefix not arming when none
  of its chords can run.
- Related: ADR 0008 (command registry; `FrameworkDescriptor.chordPrefix`,
  `RESERVED_EDGELESS_KEYS`, "allocated, not ad hoc"), ADR 0009 (a flag gates
  tooling), ADR 0050 / 0051 (the read-only viewer is the editor on a read-only
  store), labre#538 (`w a` / `w e` re-assigned after user feedback).

## Context

Since PF3 a keyboard binding is one facet of a `CommandDescriptor`
(`defaultKeys`), and every command is bindable from a host's Settings ›
Shortcuts because `toShortcutDescriptor` is total. Wardley alone shipped
default chords: `w` then a letter (`w c` a component, `w b` the map), on the
artefacts a user places, with tools past the eighth and the rarely used
entries keyless by intent. Its prefix was spelled once in `frameworks.ts`
(`chordPrefix: 'w'`, read by nothing but a test) and again, inline, in the
Wardley package's own command builder.

### How a chord runs

- `resolveKeymap` turns `['w', 'c']` into the binding `'w c'` of the edgeless
  scope's keymap; that keymap is installed by
  `ShortcutKeymapExtension('edgeless')`, registered only in the edgeless view
  branch. Page mode has no edgeless keymap: no chord exists there.
- `bindKeymap` (`framework/std/src/event/keymap.ts`): the first keystroke ARMS
  every sequence starting with it, unless the same keymap binds that key
  alone ("a single binding on the prefix wins"). Arming registers an
  interceptor for `CHORD_TIMEOUT_MS` = 1200 ms. A lone modifier press does not
  disarm.
- The interceptor is a GLOBAL keyDown handler registered at arm time, so it
  runs before every other global handler (the dispatcher runs the most
  recently added first) but AFTER the handlers bound to a block, which the
  dispatcher puts ahead of the global ones (`events.concat(globalEvents)`,
  `dispatcher.ts`). Consequence: a block-level handler on a single letter (a
  database view, the presentation bar) wins over a chord's second key, and a
  block-level handler that consumes a prefix letter keeps it from arming.
- Nothing arms while the event target is editable (contenteditable, input,
  textarea), and a keystroke reaching an editable mid-chord disarms and is
  given back. A focused toolbar button is not editable: the chord runs there,
  as Wardley's always has.
- The dispatcher listens on `document` and runs only while the editor is
  active.

### Shortcuts already taken

| Where                                             | Keys                                                                                                                                                                                |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `edgeless-keyboard.ts` (`RESERVED_EDGELESS_KEYS`) | `v` select, `t` text, `c` connector, `h` hand, `n` note, `p` pen, `Shift-p` highlighter, `e` eraser, `k` note slicer, `f` frame, `-` slicer, `@` link, `Shift-s` shape / menu cycle |
| Toolbar buttons, their own `bindHotKey`           | `m` mind map, `s` shape                                                                                                                                                             |
| Raw `keydown` listeners                           | `b` (with `Delete`, `Backspace`, `Escape`): Bézier smoothing of the hovered vertex, only while a polygon's vertices are edited (`gfx/shape/src/element-view.ts`)                    |
| Edgeless, any printable key                       | with a single mind-map node selected, a printable key starts editing that node with the key typed (`_bindToggleHand`, a global handler registered after the shortcut keymap)        |
| Edgeless modifier combos                          | `Mod-g`, `Shift-Mod-g`, `Mod-a`, `Mod--`, `Mod-=`, `Alt-0/1/2`, `Control-d`, arrows, `Backspace`, `Delete`, `Escape`, `Enter`, `Tab`, `Space` (held: hand)                          |
| Command registry (core)                           | `Mod-z`, `Shift-Mod-z`, `Control-y` (not mac), `Mod-Alt-l` (global); `Mod-d`, `Mod-y`, `Mod-Shift-f`, `l` Templates panel (edgeless, § 7)                                           |
| Command registry (Wardley)                        | `w b`, `w c`, `w m`, `w a`, `w p`, `w l`, `w e`, `w i`                                                                                                                              |
| Host defaults (labre)                             | none on the canvas beyond the library's: the host's canvas list is a read-only mirror of the rows above                                                                             |

`w` alone is bound to nothing. Of the requested prefixes, `d`, `u`, `y` and
`g` are bound to nothing alone; `b` only inside a polygon's vertex edit; `t` is
the Text tool. `o`, chosen for Event Storming, is bound to nothing alone.
`chord-prefixes.unit.spec.ts` reads these off the sources rather than a list
typed by hand: it walks every `src` of `packages/affine` and
`packages/framework` (tests excluded) for the top-level keys of every
`bindHotKey({ … })` literal (the edgeless keyboard's tools, the toolbar
buttons' `m` and `s`; a site passing a variable must be one of the four known
forwarders), and for every raw `keydown` listener, each listed with the letters
it takes and why it cannot meet a chord (71 files today: one letter, the
polygon's `b`, in vertex edit only; the others named keys, a modifier, or their
own focused element). A new binding or listener fails until it is read.

## Decision

### 1. The collision rule

A chord prefix never breaks, slows down or re-assigns an existing shortcut.
The dispatcher cannot hold a single-key tool and a chord on the same letter:
the tool's `t` lives in `edgeless-keyboard.ts`'s keymap and the chord in the
edgeless-scope keymap, so the "single binding wins" check never sees both,
and either the chord swallows `t` or `t` switches to the Text tool AND arms a
chord that swallows the next letter. So a requested prefix that is already a
single-key shortcut is not shipped: the product owner chooses another letter
(Event Storming: `t` refused, `o` chosen).

### 2. The prefixes

| Framework            | Prefix | Status                                          |
| -------------------- | ------ | ----------------------------------------------- |
| `wardley`            | `w`    | unchanged, every existing chord byte-for-byte   |
| `bpmn`               | `b`    | shipped                                         |
| `uml`                | `u`    | shipped                                         |
| `cynefin-estuarine`  | `y`    | shipped                                         |
| `edgy`               | `g`    | shipped                                         |
| `ddd-core-domain`    | `d`    | shipped, shared with the Context Map            |
| `ddd-context-map`    | `d`    | shipped, shared with the Core Domain Chart      |
| `ddd-event-storming` | `o`    | shipped; `t` was requested and is the Text tool |
| `c4`                 | none   | not requested, keyless                          |

"DDD: `d`" covers the two DDD boards that ship commands; their second keys
are unique across both, so `d` reads as "DDD" on either board.

### 3. Declared once per framework, held by a test

A framework package declares `const <NAME>_CHORD_PREFIX` beside its command
specs, gives each spec an optional `key`, and builds `defaultKeys` with the
shared `frameworkChord(prefix, key)` (`@labre/affine-shared/utils`): data,
and one helper, never a per-framework dispatcher. The layering forbids the
package from importing `frameworks.ts`, so `FrameworkDescriptor.chordPrefix`
spells the prefix again for hosts, and
`affine/all/src/__tests__/shortcuts/chord-prefixes.unit.spec.ts` holds the
two together. It fails when:

- a framework ships chords without a prefix, or a chord does not start with
  its framework's prefix, or differs between platforms;
- a prefix is allocated with no chord behind it;
- two frameworks share a prefix that `SHARED_PREFIXES` does not declare;
- two commands of one prefix, across every framework sharing it, use the
  same second key;
- a second key is not one lowercase letter (a capital is a Shift stroke,
  which the chord matcher reads as `Shift-C`, never `C`; a digit needs Shift
  on AZERTY);
- a prefix is a single-key shortcut: any bare key of a `bindHotKey({ … })`
  read off the sources (`RESERVED_EDGELESS_KEYS`, the toolbar buttons' `m` and
  `s`), a letter a raw `keydown` listener takes outside an edit mode, or any
  registered command's one-keystroke default (`l`, § 7);
- a `bindHotKey` site passes something else than a literal, or a raw
  `keydown` listener appears anywhere in the library, without being listed;
- the bare letters taken on the canvas change (pinned: `c e f h k l m n p s t
v`);
- a chord collides with any other registered command's default;
- a framework artefact or tool does not declare `availability: 'editable'`;
- the allocation table itself changes.

It replaces the two chord tests of `registry.unit.spec.ts`, which assumed
unique prefixes.

### 4. Which commands get a key

Wardley's policy, as its docblocks state it: the artefacts a user PLACES — the
nodes and the board — with a mnemonic second key from the English label,
unique within the prefix. Tools (flows, relations, connectors), templates and
rarely used entries stay keyless by intent, bindable from Settings ›
Shortcuts. A framework never ships more than `SENIOR_MENU_CAP` default chords
(`registry.unit.spec.ts`).

| Framework          | Command id                               | Label                            | Chord | Mnemonic                |
| ------------------ | ---------------------------------------- | -------------------------------- | ----- | ----------------------- |
| bpmn               | `bpmn.addPool`                           | Pool                             | `b p` | Pool (the board)        |
| bpmn               | `bpmn.addStartEvent`                     | Start event                      | `b s` | Start                   |
| bpmn               | `bpmn.addEndEvent`                       | End event                        | `b e` | End                     |
| bpmn               | `bpmn.addTask`                           | Task                             | `b t` | Task                    |
| bpmn               | `bpmn.addUserTask`                       | User task                        | `b u` | User                    |
| bpmn               | `bpmn.addServiceTask`                    | Service task                     | `b v` | serVice                 |
| bpmn               | `bpmn.addSubProcess`                     | Sub-process                      | `b o` | sub-prOcess             |
| bpmn               | `bpmn.addCallActivity`                   | Call activity                    | `b c` | Call                    |
| bpmn               | `bpmn.addExclusiveGateway`               | Exclusive gateway                | `b x` | XOR, its X marker       |
| bpmn               | `bpmn.addParallelGateway`                | Parallel gateway                 | `b a` | AND gateway             |
| bpmn               | `bpmn.addDataObject`                     | Data object                      | `b d` | Data                    |
| bpmn               | `bpmn.addTextAnnotation`                 | Text annotation                  | `b n` | aNnotation              |
| uml                | `uml.addDiagram`                         | UML diagram                      | `u d` | Diagram (the board)     |
| uml                | `uml.addClass`                           | Class                            | `u c` | Class                   |
| uml                | `uml.addInterface`                       | Interface                        | `u i` | Interface               |
| uml                | `uml.addEnumeration`                     | Enumeration                      | `u e` | Enumeration             |
| uml                | `uml.addPackage`                         | Package                          | `u p` | Package                 |
| uml                | `uml.addActor`                           | Actor                            | `u a` | Actor                   |
| uml                | `uml.addUseCase`                         | Use case                         | `u o` | its ellipse, `o`        |
| uml                | `uml.addSubject`                         | Subject                          | `u s` | Subject                 |
| cynefin-estuarine  | `cynefin-estuarine.addCynefin`           | Cynefin framework                | `y c` | Cynefin                 |
| cynefin-estuarine  | `cynefin-estuarine.addEstuarineMap`      | Estuarine map                    | `y e` | Estuarine               |
| cynefin-estuarine  | `cynefin-estuarine.addConstraintHexagon` | Hexagon node                     | `y h` | Hexagon                 |
| edgy               | `edgy.addBoard`                          | EDGY board (hover spotlight)     | `g b` | Board                   |
| edgy               | `edgy.addPeople`                         | People                           | `g p` | People                  |
| edgy               | `edgy.addOutcome`                        | Outcome                          | `g o` | Outcome                 |
| edgy               | `edgy.addObject`                         | Object                           | `g j` | obJect (`o` is Outcome) |
| edgy               | `edgy.addActivity`                       | Activity                         | `g a` | Activity                |
| ddd-core-domain    | `ddd-core-domain.addChart`               | Core Domain Chart                | `d c` | Chart (the board)       |
| ddd-core-domain    | `ddd-core-domain.addBigBet`              | Big-bet sub-domain               | `d g` | biG bet                 |
| ddd-core-domain    | `ddd-core-domain.addPlatform`            | Platform sub-domain              | `d p` | Platform                |
| ddd-core-domain    | `ddd-core-domain.addOutsourced`          | Outsourced / purchased           | `d o` | Outsourced              |
| ddd-core-domain    | `ddd-core-domain.addBcCurrent`           | Bounded context                  | `d n` | Now (current position)  |
| ddd-core-domain    | `ddd-core-domain.addBcFuture`            | Future position                  | `d f` | Future                  |
| ddd-context-map    | `ddd-context-map.addBoard`               | Context Map board                | `d m` | Map (the board)         |
| ddd-context-map    | `ddd-context-map.addBoundedContext`      | Bounded Context                  | `d b` | Bounded                 |
| ddd-context-map    | `ddd-context-map.addCloud`               | Cloud / System (Big Ball of Mud) | `d s` | System                  |
| ddd-event-storming | `ddd-event-storming.addBoard`            | Event Storming board             | `o b` | Board                   |
| ddd-event-storming | `ddd-event-storming.addDomainEvent`      | Domain event                     | `o e` | Event                   |
| ddd-event-storming | `ddd-event-storming.addCommand`          | Command                          | `o c` | Command                 |
| ddd-event-storming | `ddd-event-storming.addAggregate`        | Aggregate                        | `o a` | Aggregate               |
| ddd-event-storming | `ddd-event-storming.addActor`            | Actor                            | `o u` | User                    |
| ddd-event-storming | `ddd-event-storming.addConstraint`       | Constraint                       | `o i` | Invariant               |
| ddd-event-storming | `ddd-event-storming.addPolicy`           | Policy                           | `o p` | Policy                  |
| ddd-event-storming | `ddd-event-storming.addReadModel`        | Read model                       | `o r` | Read model              |
| ddd-event-storming | `ddd-event-storming.addSystem`           | External system                  | `o s` | System                  |
| ddd-event-storming | `ddd-event-storming.addHotspot`          | Hotspot                          | `o h` | Hotspot                 |

Keyless by intent: BPMN's three flows, its trigger variants, data store and
group; UML's tools and its sixty-one non-senior entries; EDGY's facets and
dynamic templates and its relation tool; the Core Domain Chart's three
team-topology markers and its movement tool; the Context Map's nine
relationship tools; Event Storming's flow tool; every import, export and lane
action.

To amend a key: change the `key` of the spec (for the Core Domain Chart's
dots, the `SUBDOMAIN_KEYS` entry; for Event Storming's stickies,
`STICKY_KEYS`), the row of the framework's `commands-manifest.ts` and the rows
of `keymap-golden.ts`; the parity tests name each place that disagrees.

### 5. After a prefix, the canvas keeps its own keys (applies to `w` too)

A keystroke that completes no armed chord and CANNOT be a printable
continuation — pressed with Ctrl, Meta or Alt, a named key (Delete,
Backspace, Escape, Enter, Tab, the arrows, Home / End, the page and function
keys), or Space — disarms the prefix and is handed on to its normal handler.
An unmatched printable character is still swallowed, as before ("no such
shortcut in this namespace": `w h` does not reach the hand tool). Printable
means every single character, so the canvas's own printable shortcuts stay
swallowed within 1.2 s after a prefix as well: `Shift-p` (highlighter),
`Shift-s` (shape cycle, or back in an open senior menu), `-` (note slicer) and
`@` (link) on QWERTY, the digits and the punctuation. Only named keys, Space
and modified keys are handed on.

| After `w` (or any prefix), within 1.2 s | Before (ADR 0008)         | After                           |
| --------------------------------------- | ------------------------- | ------------------------------- |
| Delete / Backspace                      | swallowed, selection kept | deletes the selection           |
| An arrow                                | swallowed, nothing moves  | moves the selection             |
| Escape                                  | swallowed, selection kept | clears the selection            |
| Ctrl+Z / Ctrl+D                         | swallowed                 | undoes / duplicates             |
| Space held                              | swallowed                 | pans                            |
| An unmatched letter                     | swallowed                 | swallowed (unchanged)           |
| A second key                            | places the artefact       | places the artefact (unchanged) |

This is a deliberate improvement of Wardley's existing behaviour, pinned by
`keymap-chord.unit.spec.ts` (written on the old behaviour first, then
changed) and by `framework-chords.spec.ts` at the real keyboard; the Wardley
specs and the golden keymap are unchanged by it.

What remains INHERENT to a prefix, and is the product owner's to accept: a
prefix letter then, within 1.2 s, a tool letter becomes an artefact when that
letter is also a second key, and is swallowed otherwise. Tool letters: `v`
select, `t` text, `c` connector, `h` hand, `n` note, `p` pen, `e` eraser, `k`
note slicer, `f` frame, `m` mind map, `s` shape, and `l` the Templates
panel (§ 7).

| Prefix | Tool letter → artefact instead of the tool                                                                                               | Tool letter swallowed   |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `w`    | `c` component, `p` pipeline, `m` method, `e` evolution arrow (a connector tool, not the eraser), `l` link tool (not the Templates panel) | `v t h n k f s`         |
| `b`    | `v` service task, `t` task, `c` call activity, `n` text annotation, `p` pool, `e` end event, `s` start event                             | `h k f m l`             |
| `u`    | `c` class, `e` enumeration, `p` package, `s` subject                                                                                     | `v t h n k f m l`       |
| `g`    | `p` People                                                                                                                               | `v t c h n e k f m s l` |
| `y`    | `c` Cynefin framework, `e` Estuarine map, `h` hexagon                                                                                    | `v t n p k f m s l`     |
| `d`    | `c` chart, `n` bounded context (now), `p` platform, `f` future position, `m` Context Map board, `s` system                               | `v t h e k l`           |
| `o`    | `c` command, `e` domain event, `p` policy, `s` external system, `h` hotspot                                                              | `v t n k f m l`         |

The table assumes every framework on. The shared `d` follows its flags: with
the Core Domain Chart off, `d c`, `d g`, `d p`, `d o`, `d n`, `d f` are
swallowed and `d m`, `d b`, `d s` still place; with the Context Map off, the
reverse; with both off, `d` arms nothing and every letter after it does what
it does alone. Any other prefix with its framework off arms nothing.

A key held after it completed a chord no longer auto-repeats into its own
binding (`b` then `p` held placed the pool, then the repeats picked the Pen
tool): the repeats of that key are swallowed until it is released or another
key is pressed, and a held prefix neither re-arms in a loop nor arms again
after its timeout (`keymap-chord.unit.spec.ts`, `framework-chords.spec.ts`).
Applies to `w` too.

Known limit: with Caps Lock on, the letter arrives as `B`, a Shift-less
capital no prefix matches: no prefix arms (as for `w` before), and the letter
does what a capital does on the canvas.

Before this ADR the six new prefix letters did nothing, and the tool letter
that followed them switched the tool.

### 6. No chord where none can run: read-only, presentation, edit modes

One gate decides whether a keyboard binding may run, `canRunFromKeyboard`
(`command-registry.ts`), and it reads only declared data: not while a canvas
element is in edit mode (a text, a polygon's vertices), the descriptor's
`availability`, then its `when`. `toShortcutDescriptor` exposes the same gate
to the keymap as `ChordBinding.canRun`, and `bindKeymap` arms a prefix only
when at least one of its chords can run. So:

- every framework artefact and tool declares `availability: 'editable'` (it
  writes; `'always'` let `w c` throw "Cannot add element in readonly mode"
  from the keyboard, before this ADR on the base too, and the catalogue offer
  it on a board nothing can be written to). In a read-only document a chord
  throws nothing and places nothing, and the prefix letter does not arm at
  all: `b` then `h` still switches to the hand tool, which the read-only
  canvas allows;
- while the canvas is PRESENTED, `'editable'` is unavailable too: a tool
  declares `BaseTool.presents` (the frame navigator, `PresentTool`, does) and
  `isCommandAvailable` reads it, naming no tool. So during a presentation no
  prefix arms and no chord writes; each letter does what it does without this
  ADR (`b` nothing, `p` the Pen tool, which ends the presentation). This is a
  deliberate change for `w` as well: on the base, `w c` during a
  presentation wrote a component into the document and left the
  presentation. It also withdraws every other `'editable'` command (the
  imports, the frame reorder) while presenting;
- while a polygon's vertices are edited (selection `editing: true`), no
  prefix arms: the polygon's own `b` keeps the key, and `b` with no vertex
  hovered swallows nothing.

### 7. `l` opens the Templates panel

Product owner's decision of 2026-11-20: the Templates panel of the canvas
toolbar is reached from the keyboard by ONE key, not a chord. `t` was his
first wish and is the Text tool; `m` is already the mind map's (the toolbar
button's own hotkey, untouched); among the free letters he chose `l`.

- It is one command of the registry, `canvas.templates.toggle` (owner
  `core`, scope `edgeless`, `defaultKeys` `l`), registered by the template
  view extension and listed by `getCommands` under the `template` flag: a
  host overrides or disables it like any other, Settings › Shortcuts lists it,
  and `runCommand` measures it. Its label is the button's own key,
  `com.labre.template.senior-tool.name` ("Template"): no new wording.
- Not the button's own `bindHotKey` (as `m` and `s` are): the senior row is
  paged, and the Templates button, the last senior tool, is often not in the
  DOM. The command pages it in through the row's public keyboard walk
  (`walkHighlight` / `clearHighlight`, present on the base and kept by the
  toolbar's keyboard model of ADR 0054), then calls the button's
  `togglePanel({ focusSearch: true })`: the panel opens exactly as a click
  opens it, with the caret in its search field. A click does not move the
  focus.
- `l` again, the focus outside the field, closes it, as a second click does.
  In the field `l` is a letter: the panel keeps every keystroke (the tool
  letters, the chord prefixes, Delete, the arrows, Ctrl+Z) except Escape,
  which closes it and gives the focus back to the editor host, so the arrows,
  Delete and Space reach the canvas at once.
- The gate is the one of § 6: not while a canvas element is in edit mode (a
  note, a text, a cell, a polygon's vertices: `l` types or does what it did),
  `availability: 'editable'` (a read-only board draws no toolbar and inserts
  no template: the key does nothing), and a `when` that refuses the
  presentation, whose toolbar replaces the row.
- `l` is the second key of one chord, Wardley's `w l` (link tool): within
  1.2 s after `w` the chord wins; after any other prefix `l` is swallowed
  (§ 5). `Shift+L`, `Alt+L` and `Mod+L` stay unbound on the canvas
  (`Mod-Shift-l` keeps its own binding). `l` enters the registry of taken
  bare letters, pinned by `chord-prefixes.unit.spec.ts`, so no prefix can
  take it.
- Known limit, out of scope: the template CARDS are not reachable from the
  keyboard (no arrow grid, no Enter to insert). From the search field, Tab
  leaves the panel for the next focusable element of the page (the panel has
  no other focusable element), by reading; not verified at the keyboard.

## Consequences

- Every projection shows the new chords without per-framework code:
  `getShortcutManifest()` and each bundle's `./commands-manifest` carry the
  new `defaultKeys` (a host's Settings › Shortcuts renders them as "b then
  p"); `getCommandManifest()` carries them, and the new `availability`, to the
  catalogue and the palette; the in-editor keymap binds them through
  `CommandExtension`. The senior sub-menu, the artefact catalogue and the
  palette inside this library show no key today, for Wardley either.
- `availability: 'editable'` on every framework artefact and tool: a surface
  that honours `isCommandAvailable` (the in-library catalogue, a host's
  palette reading the manifest) withdraws them from a read-only document, as
  the imports already were.
- A flag removes its framework's chords: `CommandExtension` registers from the
  framework's flag-gated view extension, so `{ bpmn: false }` leaves `b`
  unbound and arming nothing (`framework-chords.spec.ts`, and
  `gating.unit.spec.ts` for every framework). With both DDD boards off, `d` is
  free again.
- Persisted overrides: ids and `labelKey`s are unchanged, so an override on
  any of these ids keeps winning over the new default. A user whose override
  already put ANOTHER command on one of the new chords (say `d c`) now has two
  descriptors on one combo: `resolveKeymap` binds the first registered and
  reports the conflict through `ShortcutConflictReporter`, or a console
  warning when the host registers none. Registration order is core first, then
  the frameworks in view-extension order, so which one wins is not the user's
  choice. An override binding a prefix letter ALONE (`['d']`) in the edgeless
  scope disables every `d` chord for that user ("a single binding on the
  prefix wins"); one binding a GLOBAL command on a bare prefix letter is
  masked in edgeless, where the edgeless keymap runs first and arms.
- `FrameworkDescriptor.chordPrefix` is read nowhere but the parity tests: kept
  on purpose, as ADR 0008's single identity of a framework that a host can
  read, and held equal to each package's constant by the spec.
- With a single mind-map node selected, a printable key starts editing that
  node with the key typed; that handler runs before the shortcut keymap, so no
  prefix arms there: typing "bo" writes "bo" into the node (verified at the
  keyboard by the second review).

- No displayed string is added; the French catalogue needs nothing.
- `RESERVED_EDGELESS_KEYS` still lists `edgeless-keyboard.ts` only; the
  toolbar's `m` and `s` and the raw `keydown` listeners are read off the
  sources by the chord spec rather than added to it, because the constant's own mirror test
  reads that one file.
