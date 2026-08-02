---
'@labre/std': minor
'@labre/affine-shared': minor
'@labre/affine-block-root': minor
'@labre/affine-block-surface': minor
'@labre/affine-gfx-wardley': minor
'@labre/affine-foundation': minor
'@labre/affine-all': minor
---

feat(edgeless): an element can say what KIND of thing it is (MF3)

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
