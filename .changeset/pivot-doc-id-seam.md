---
'@labre/std': minor
'@labre/affine-shared': minor
'@labre/affine-block-root': minor
'@labre/affine': minor
---

Surface elements can now be an **occurrence of a pivot record**: a new optional
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

Also in `@labre/std`: `AnyCommandDescriptor`, the command registry's element
type with its parameter contract erased. The registry is heterogeneous now that
a command takes parameters, and `CommandDescriptor<void>` could not express
that. Registry-facing signatures (`CommandExtension`, `runCommand`,
`getRegisteredCommands`, the two projections…) use the alias; existing
`CommandDescriptor[]` declarations are unaffected.
