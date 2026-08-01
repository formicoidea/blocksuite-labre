# US-1.8 follow-up — preserving unknown surface element props

**Status:** implemented
**Scope:** red zone (`packages/framework/std` gfx element plumbing). Follow-up
to the spike recorded in [`us-1-8-role-field-compat.md`](./us-1-8-role-field-compat.md).
**Date:** 2026-08-01

## What the spike found

Q2/Q3 of the spike established that every _edit_ path on a gfx primitive
element preserves a prop the running element class does not declare (field
writes, stash/pop, undo/redo, `serialize()`, the surface snapshot
transformer) — but that two _bulk assignment_ sites in `SurfaceBlockModel`
silently dropped it:

- `_createElementFromProps` — paste, duplicate, alt-drag clone and
  "turn into linked doc";
- `updateElement` — a bulk update carrying a key the class does not declare.

Both sites copy incoming props by assigning them onto the element model
instance. Only a key backed by an `@field()` accessor reaches the Y.Map; an
unrecognised key became an ordinary JavaScript own property — readable in the
running tab, invisible to every peer, gone on reload. The `@field()` accessor
set was a _de facto_ allow-list, applied silently.

"Turn into linked doc" is the destructive case: it writes the lossy copy into
the new doc and then deletes the source, so nothing survives to recover from.

## What changed

Both sites now go through one helper,
`SurfaceBlockModel._assignElementProp`
(`packages/framework/std/src/gfx/model/surface/surface-model.ts`), which routes
each key **explicitly**, in three steps:

1. an unsafe key (`UNSAFE_ELEMENT_PROP_KEYS`, below) is dropped;
2. a key the element class **declared** (`isDeclaredElementProp`, below) goes
   through its accessor, exactly as before;
3. anything else is unknown data and is written verbatim into the element's
   Y.Map — provided the value is encodable.

Both call sites already run the whole props object through `_propsToY` first,
which is key-agnostic, so the native→Y conversion (`Y.Text` / `Y.Map` wrapper
payloads) applies to unknown keys too.

### Step 2 — what counts as "declared"

Deciding this with `key in element` is wrong, and was the main defect of the
first version of this change. `in` walks the whole prototype chain and matches
far more than declared props:

- **methods** — `serialize`, `isLocked`, `stash`, `pop`, `includesPoint`… A
  payload carrying `{ serialize: 'pwned' }` assigned a string over the method,
  and the next `element.serialize()` threw `is not a function`.
- **getter-only derived props** — `x`, `y`, `w`, `h`, `group`, `groups`,
  `connectable`, `isConnected`, `elementBound`, `externalBound`,
  `responseBound`, `deserializedXYWH`. All twelve throw
  `TypeError: … has only a getter` on assignment. Through `addElement` the
  throw escaped and **no element was created at all** (a whole paste failed);
  through `updateElement` it was **swallowed by `store.transact`**, so the
  props _after_ it in the same bulk update were silently dropped — the exact
  failure mode this change exists to remove, reproduced inside the fix.
- **internal instance fields** — `_local`, `_preserved`… `{ _local: 'junk' }`
  passed silently, then reading `deserializedXYWH` threw
  `this._local.set is not a function`.

`isDeclaredElementProp` answers the narrower question instead, from three
sources and no more:

- the `@field()` set (`getFieldPropsSet`) and the `@local()` set
  (`getLocalPropsSet`, added here to mirror it) — the authoritative tables the
  decorators maintain per prototype;
- a plain accessor **that has a setter**, found by walking the prototype chain
  and stopping at the first prototype that owns the key. The only such prop
  today is `xywh` on `GfxGroupLikeElementModel`: it is derived from the
  children and its setter is a deliberate no-op, but `serialize()` always emits
  it, so treating it as unknown would persist a stale derived value into every
  duplicated group or mindmap. A method (data descriptor, no setter) and a
  getter-only accessor both answer `false` at that same step.

A key that fails all three is data. It goes to the Y.Map, where it shadows
nothing: methods and derived getters live on the prototype and are read from
there.

### Step 3 — the value must be encodable

`Y.Map.set` accepts values it cannot later encode. A cyclic plain object is
stored happily; `serialize()` and `Y.encodeStateVector` keep working, and only
`Y.encodeStateAsUpdate` — persistence and sync — blows the stack. Nothing in
the app notices, and no user action removes the key: the document is
irreversibly unsyncable. Since `addElement` / `updateElement` are public API
consumed by the host, the doc's "values stay flat JSON" claim (spike Q3, first
caveat) is now **enforced** rather than assumed.

`isEncodableElementValue` admits a Yjs type (what `_propsToY` builds from the
wrapper payloads), a `Uint8Array`, a primitive, `null`/`undefined`, or a plain
object / array of those — acyclic, and within a depth limit of 32. Anything
else (function, symbol, bigint, class instance, cycle) is rejected: the key is
dropped with a `console.warn`, which is exactly the pre-existing behaviour for
that one prop, and the document stays sound.

An `undefined` value is never written on the unknown branch either, so
spreading an absent option (`{ ...opts }` with `opts.foo === undefined`) cannot
mint a phantom Y.Map key — a real key, propagated to every peer forever, that
`serialize()` cannot even show because `toJSON()` drops undefined. Declared
fields keep accepting `undefined`, which is how an optional field such as
`linkedDocId` is cleared.

### Exclusions

A short deny-list (`UNSAFE_ELEMENT_PROP_KEYS`) is applied before both branches:

| Key                                     | Why                                                                                                                                                                                                                                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`, `type`                            | The element identity. `_createElementFromProps` writes both explicitly and destructures them out of `rest`, but `updateElement` did not: `updateElement(id, other.serialize())` would otherwise stamp a stale identity into the document. Both are prototype getters, so the old code threw a `TypeError` instead. |
| `__proto__`, `constructor`, `prototype` | Prototype pollution. `__proto__` is an accessor **with a setter** on `Object.prototype`, so the descriptor walk would otherwise admit it; `constructor` is a data property, and `prototype` is not on an instance at all, so both would be forwarded to the Y.Map. All three are dropped outright.                 |

Deliberately **not** excluded: `index` and `seed`. Both are declared
`@field()` on `GfxPrimitiveElementModel`, so they already take the accessor
branch and their behaviour is unchanged.

## What this changes for users

The semantics of every paste, duplicate, alt-drag clone, "turn into linked
doc" and programmatic bulk update become **"preserve what we do not
understand"** — which is the Yjs contract everywhere else in this codebase,
including the surface snapshot transformer and every single-key field write.

Concretely, a client running an older version of the library can now copy an
element annotated by a newer one without silently stripping the annotation.
The board no longer drifts into a half-annotated state, and "turn into linked
doc" no longer destroys data.

**This is not retroactive protection.** A fleet is only safe once every client
runs a version that has this fix; a client pinned before it keeps stripping on
every copy. The spike's mitigation stands unchanged: ship the field declaration
first, and only make the features that write it the floor once that release is
everywhere. What this change buys is that the floor no longer has to include
the field itself — any release from here on preserves fields it has never heard
of.

The cost is that a caller passing a junk key to `addElement` / `updateElement`
now persists it. Every real call site was audited; the only offender was a dead
`controllers: []` in `packages/affine/gfx/connector/src/connector-tool.ts`,
removed in the same change. `applyLastProps`
(`packages/affine/shared/src/services/edit-props-store.ts`) is unaffected: the
props it merges underneath are zod-stripped at `recordLastProps` time, so it
cannot contribute an unknown key. Templates are unaffected too — the template
service writes through `SurfaceBlockTransformer.elementFromJSON`, which never
went through these two sites.

One consequence of preservation worth naming: an element whose Y.Map already
carries a stale `controllers` key (an old document, written before that prop
was removed) used to be **cleaned** by a copy and is now **propagated** to
every copy. That is the contract working as intended — the copy is faithful,
and the value is an inert `[]` — but it means removing a prop from the code no
longer removes it from documents that already have it.

## No schema change

No block schema version bump, no migration, no new field. This only changes
which keys a bulk assignment forwards. Documents written before and after are
mutually loadable, exactly as Q1/Q4 of the spike concluded.

## Tests

`packages/framework/std/src/__tests__/gfx/element-unknown-props.unit.spec.ts` —
the three `LOSS:` tests the spike left behind are now preservation tests, plus
coverage of "turn into linked doc" (the destructive path), `updateElement`, a
`serialize` → `addElement` → `serialize` round trip identical apart from the
id, a declared `@local()` prop staying out of the document, prototype-polluting
keys and a forged `id`/`type` never reaching the Y.Map, and — for the routing
and encodability guards — a data key named after a method, one named after an
internal field, all twelve getter-only derived props, a bulk update no longer
losing the props that follow a getter-only key, cyclic values through both
entry points, functions, class instances, nested plain JSON, `undefined`, and
clearing a declared field with `undefined`.

The probe key is `x-labre-unknown-probe`, deliberately a name no element class
will ever declare. The first version of this spec used `role`; when
`@field() role` shipped on the base element model, every one of those tests
started passing through the _declared_ branch and the unknown-key coverage
vanished without a single failure.

`packages/integration-test/src/__tests__/edgeless/unknown-element-props.spec.ts`
drives the real clipboard (`duplicate()` →
`createElementsFromClipboardDataCommand` → `createCanvasElement` →
`crud.addElement`): an undeclared prop survives a mod+d duplicate, a duplicated
plain shape gains no stray key, and a duplicated **group** does not persist its
derived `xywh`.
