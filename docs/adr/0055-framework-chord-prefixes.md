# ADR 0055 — Framework chord prefixes

- Status: **accepted** (2026-11-20)
- Deciders: the product owner's request ("extend the `w` + key combinations
  to the other frameworks: DDD `d`, UML `u`, BPMN `b`, Cynefin `y`, EDGY `g`,
  Event Storming `t`"); the collision rule below is the lead's. The
  second-key table is a proposal the product owner validates or amends, one
  field per command.
- **Red zones**: none touched. No schema, no stored prop, no command id, no
  `labelKey`: only `defaultKeys` move from empty to a chord. Not
  `packages/framework/std` either: the dispatcher already does everything this
  needs.
- Related: ADR 0008 (command registry; `FrameworkDescriptor.chordPrefix`,
  `RESERVED_EDGELESS_KEYS`, "allocated, not ad hoc"), ADR 0009 (a flag gates
  tooling), labre#538 (`w a` / `w e` re-assigned after user feedback).

## Context

Since PF3 a keyboard binding is one facet of a `CommandDescriptor`
(`defaultKeys`), and every command is bindable from a host's Settings ›
Shortcuts because `toShortcutDescriptor` is total. Wardley alone shipped
default chords: `w` then a letter (`w c` a component, `w b` the map), on the
artefacts a user places, with tools past the eighth and the rarely used
entries keyless by intent. Its prefix was spelled once in
`frameworks.ts` (`chordPrefix: 'w'`, read by nothing but a test) and again,
inline, in the Wardley package's own command builder.

### How a chord runs

- `resolveKeymap` turns `['w', 'c']` into the binding `'w c'` of the edgeless
  scope's keymap; that keymap is installed by
  `ShortcutKeymapExtension('edgeless')`, registered only in the edgeless view
  branch. Page mode has no edgeless keymap: no chord exists there.
- `bindKeymap` (`framework/std/src/event/keymap.ts`): the first keystroke ARMS
  every sequence starting with it, unless the same keymap binds that key
  alone ("a single binding on the prefix wins"). Arming registers an
  interceptor that runs before every other keyDown handler, for
  `CHORD_TIMEOUT_MS` = 1200 ms. The next keystroke completes a chord, or is
  SWALLOWED when it matches none (`w h` does not reach the hand tool); a lone
  modifier press does not disarm.
- Nothing arms while the event target is editable (contenteditable, input,
  textarea), and a keystroke reaching an editable mid-chord disarms and is
  given back. The command handler also refuses while a canvas element is in
  text edit (`isEditingOnCanvas`). A focused toolbar button is not editable:
  the chord runs there, as Wardley's always has.
- The dispatcher listens on `document` and runs only while the editor is
  active; it runs the most recently registered keymap first.

### Shortcuts already taken

| Where                                             | Keys                                                                                                                                                                                |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `edgeless-keyboard.ts` (`RESERVED_EDGELESS_KEYS`) | `v` select, `t` text, `c` connector, `h` hand, `n` note, `p` pen, `Shift-p` highlighter, `e` eraser, `k` note slicer, `f` frame, `-` slicer, `@` link, `Shift-s` shape / menu cycle |
| Toolbar buttons, their own `bindHotKey`           | `m` mind map, `s` shape                                                                                                                                                             |
| Edgeless modifier combos                          | `Mod-g`, `Shift-Mod-g`, `Mod-a`, `Mod--`, `Mod-=`, `Alt-0/1/2`, `Control-d`, arrows, `Backspace`, `Delete`, `Escape`, `Enter`, `Tab`                                                |
| Command registry (core)                           | `Mod-z`, `Shift-Mod-z`, `Control-y` (not mac), `Mod-Alt-l` (global); `Mod-d`, `Mod-y`, `Mod-Shift-f` (edgeless)                                                                     |
| Command registry (Wardley)                        | `w b`, `w c`, `w m`, `w a`, `w p`, `w l`, `w e`, `w i`                                                                                                                              |
| Host defaults (labre)                             | none beyond the library's: the host's canvas list is a read-only mirror of the rows above                                                                                           |

`w` alone is bound to nothing. Of the requested prefixes, `d`, `u`, `b`, `y`
and `g` are bound to nothing alone; `t` is the Text tool.

## Decision

### 1. The collision rule

A chord prefix never breaks, slows down or re-assigns an existing shortcut.
The dispatcher cannot hold a single-key tool and a chord on the same letter:
the tool's `t` lives in `edgeless-keyboard.ts`'s keymap and the chord in the
edgeless-scope keymap, so the "single binding wins" check never sees both,
and either the chord swallows `t` or `t` switches to the Text tool AND arms a
chord that swallows the next letter. So a requested prefix that is already a
single-key shortcut is not shipped: the framework stays keyless and the
product owner chooses another letter.

### 2. The prefixes

| Framework            | Prefix          | Status                                                  |
| -------------------- | --------------- | ------------------------------------------------------- |
| `wardley`            | `w`             | unchanged, every existing chord byte-for-byte           |
| `bpmn`               | `b`             | shipped                                                 |
| `uml`                | `u`             | shipped                                                 |
| `cynefin-estuarine`  | `y`             | shipped                                                 |
| `edgy`               | `g`             | shipped                                                 |
| `ddd-core-domain`    | `d`             | shipped, shared with the Context Map                    |
| `ddd-context-map`    | `d`             | shipped, shared with the Core Domain Chart              |
| `ddd-event-storming` | (`t` requested) | **stopped**: `t` is the Text tool, see § Event Storming |
| `c4`                 | none            | not requested, keyless                                  |

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
- a second key is not one lowercase letter or digit (a capital is a Shift
  stroke, which the chord matcher reads as `Shift-C`, never `C`);
- a prefix is a single-key shortcut: `RESERVED_EDGELESS_KEYS`, the toolbar
  buttons' `m` and `s` (mirrored against their sources in the same file), or
  any registered command's one-keystroke default;
- a chord collides with any other registered command's default;
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

| Framework         | Command id                               | Label                            | Chord | Mnemonic                |
| ----------------- | ---------------------------------------- | -------------------------------- | ----- | ----------------------- |
| bpmn              | `bpmn.addPool`                           | Pool                             | `b p` | Pool (the board)        |
| bpmn              | `bpmn.addStartEvent`                     | Start event                      | `b s` | Start                   |
| bpmn              | `bpmn.addEndEvent`                       | End event                        | `b e` | End                     |
| bpmn              | `bpmn.addTask`                           | Task                             | `b t` | Task                    |
| bpmn              | `bpmn.addUserTask`                       | User task                        | `b u` | User                    |
| bpmn              | `bpmn.addServiceTask`                    | Service task                     | `b v` | serVice                 |
| bpmn              | `bpmn.addSubProcess`                     | Sub-process                      | `b o` | sub-prOcess             |
| bpmn              | `bpmn.addCallActivity`                   | Call activity                    | `b c` | Call                    |
| bpmn              | `bpmn.addExclusiveGateway`               | Exclusive gateway                | `b x` | XOR, its X marker       |
| bpmn              | `bpmn.addParallelGateway`                | Parallel gateway                 | `b a` | AND gateway             |
| bpmn              | `bpmn.addDataObject`                     | Data object                      | `b d` | Data                    |
| bpmn              | `bpmn.addTextAnnotation`                 | Text annotation                  | `b n` | aNnotation              |
| uml               | `uml.addDiagram`                         | UML diagram                      | `u d` | Diagram (the board)     |
| uml               | `uml.addClass`                           | Class                            | `u c` | Class                   |
| uml               | `uml.addInterface`                       | Interface                        | `u i` | Interface               |
| uml               | `uml.addEnumeration`                     | Enumeration                      | `u e` | Enumeration             |
| uml               | `uml.addPackage`                         | Package                          | `u p` | Package                 |
| uml               | `uml.addActor`                           | Actor                            | `u a` | Actor                   |
| uml               | `uml.addUseCase`                         | Use case                         | `u o` | its ellipse, `o`        |
| uml               | `uml.addSubject`                         | Subject                          | `u s` | Subject                 |
| cynefin-estuarine | `cynefin-estuarine.addCynefin`           | Cynefin framework                | `y c` | Cynefin                 |
| cynefin-estuarine | `cynefin-estuarine.addEstuarineMap`      | Estuarine map                    | `y e` | Estuarine               |
| cynefin-estuarine | `cynefin-estuarine.addConstraintHexagon` | Hexagon node                     | `y h` | Hexagon                 |
| edgy              | `edgy.addBoard`                          | EDGY board (hover spotlight)     | `g b` | Board                   |
| edgy              | `edgy.addPeople`                         | People                           | `g p` | People                  |
| edgy              | `edgy.addOutcome`                        | Outcome                          | `g o` | Outcome                 |
| edgy              | `edgy.addObject`                         | Object                           | `g j` | obJect (`o` is Outcome) |
| edgy              | `edgy.addActivity`                       | Activity                         | `g a` | Activity                |
| ddd-core-domain   | `ddd-core-domain.addChart`               | Core Domain Chart                | `d c` | Chart (the board)       |
| ddd-core-domain   | `ddd-core-domain.addBigBet`              | Big-bet sub-domain               | `d g` | biG bet                 |
| ddd-core-domain   | `ddd-core-domain.addPlatform`            | Platform sub-domain              | `d p` | Platform                |
| ddd-core-domain   | `ddd-core-domain.addOutsourced`          | Outsourced / purchased           | `d o` | Outsourced              |
| ddd-core-domain   | `ddd-core-domain.addBcCurrent`           | Bounded context                  | `d n` | Now (current position)  |
| ddd-core-domain   | `ddd-core-domain.addBcFuture`            | Future position                  | `d f` | Future                  |
| ddd-context-map   | `ddd-context-map.addBoard`               | Context Map board                | `d m` | Map (the board)         |
| ddd-context-map   | `ddd-context-map.addBoundedContext`      | Bounded Context                  | `d b` | Bounded                 |
| ddd-context-map   | `ddd-context-map.addCloud`               | Cloud / System (Big Ball of Mud) | `d s` | System                  |

Keyless by intent: BPMN's three flows, its trigger variants, data store and
group; UML's tools and its sixty-one non-senior entries; EDGY's facets and
dynamic templates and its relation tool; the Core Domain Chart's three
team-topology markers and its movement tool; the Context Map's nine
relationship tools; every import, export and lane action.

To amend a key: change the `key` of the spec (for the Core Domain Chart's
dots, the `SUBDOMAIN_KEYS` entry), the row of the framework's
`commands-manifest.ts` and the rows of `keymap-golden.ts`; the parity tests
name each place that disagrees.

### Event Storming

Not shipped. `t` is the Text tool (`edgeless-keyboard.ts`, `RESERVED_EDGELESS_KEYS`,
and the host's own read-only shortcut list). Free letters a prefix can take:
`a`, `i`, `j`, `l`, `o`, `q`, `r`, `x`, `z` (a Shift-letter cannot be a
prefix: the chord matcher reads the stroke as `Shift-T`). Three candidates
for the product owner:

- `o` — the orange stickies: a domain event, the heart of the workshop, is
  the orange one;
- `r` — sto**r**ming;
- `x` — e**x**ploration, the Big Picture's first phase.

Once a letter is chosen, the proposed second keys are: `b` board, `e` domain
event, `c` command, `a` aggregate, `u` actor (user), `i` constraint
(invariant), `p` policy, `r` read model, `s` external system, `h` hotspot;
the flow tool stays keyless.

## Consequences

- Every projection shows the new chords without per-framework code:
  `getShortcutManifest()` and each bundle's `./commands-manifest` carry the
  new `defaultKeys` (a host's Settings › Shortcuts renders them as "b then
  p"); `getCommandManifest()` carries them to the catalogue and the palette;
  the in-editor keymap binds them through `CommandExtension`. The senior
  sub-menu, the artefact catalogue and the palette inside this library show
  no key today, for Wardley either: nothing to change there.
- A flag removes its framework's chords: `CommandExtension` registers from the
  framework's flag-gated view extension, so `{ bpmn: false }` leaves `b`
  unbound (`framework-chords.spec.ts`, and `gating.unit.spec.ts` for every
  framework). With both DDD boards off, `d` is free again.
- A prefix letter alone now arms: pressing `b` then, within 1.2 s, a letter
  that is no BPMN chord swallows that letter, exactly as `w` does today.
  Before, `b` did nothing and the next letter reached its tool.
- Persisted overrides: ids and `labelKey`s are unchanged, so an override on
  any of these ids keeps winning over the new default. A user whose override
  already put ANOTHER command on one of the new chords (say `d c`) now has two
  descriptors on one combo: `resolveKeymap` binds the first registered and
  reports the conflict through `ShortcutConflictReporter` (or a console warning).
  Registration order is core first, then the frameworks in view-extension
  order, so which one wins is not the user's choice; the host's pane should
  show the conflict. An override binding a prefix letter ALONE (`['d']`) is
  bound in the same keymap and, by "a single binding on the prefix wins",
  disables every `d` chord for that user.
- No displayed string is added; the French catalogue needs nothing.
- `RESERVED_EDGELESS_KEYS` still lists `edgeless-keyboard.ts` only; the
  toolbar's `m` and `s` are mirrored by the chord spec rather than added to it,
  because the constant's own mirror test reads that one file.
