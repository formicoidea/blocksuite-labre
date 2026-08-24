---
'@labre/affine-block-surface': minor
'@labre/affine-block-root': minor
'@labre/affine-gfx-wardley': minor
'@labre/affine-shared': minor
'@labre/affine': minor
---

Clicking a component now asks the tool **what it reads of it**, and offers the
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
