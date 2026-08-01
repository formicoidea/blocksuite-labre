# Spike US-1.8 — adding an optional `role` field to surface elements

**Status:** complete — verdict below
**Scope:** PF1.8 / US-1.8. Red zone (`packages/framework/store`,
`packages/affine/model`, Yjs document format). Analysis and tests only; no
production code was changed by this spike.
**Date:** 2026-08-01

## Question under study

The programme wants an optional semantic `role` field (e.g.
`wardley:component`) on surface elements — the gfx _primitive_ elements
(shape, connector, brush, text, group, mindmap), whose props live in one
`Y.Map` per element inside `SurfaceBlockModel.props.elements`:

```ts
// packages/framework/std/src/gfx/model/surface/surface-model.ts:32-34
export type SurfaceBlockProps = {
  elements: Boxed<Y.Map<Y.Map<unknown>>>;
};
```

Four questions had to be answered before the epic can be planned.

### Scope: primitive elements only

Everything below concerns **gfx primitive elements only** — the ones stored as
entries of that `elements` Y.Map. A surface also owns real _block_ children
(`affine:frame`, `affine:image`, `affine:bookmark`, `affine:attachment`,
`affine:embed-*`, `affine:edgeless-text` — see
`packages/affine/blocks/surface/src/surface-model.ts:23-31`). Those are ordinary
blocks with a zod-validated prop schema and an entirely different
serialization path; **carrying `role` on them is out of scope for this spike and
would need its own analysis.** If the product intent is "any object on the
canvas can have a semantic role", that gap must be sized separately.

### Name collision to settle before implementing

`role` is already taken twice in adjacent namespaces:

- `BlockModel.role` (`packages/framework/store/src/model/block/block-model.ts:112-114`)
  returns the block's _structural_ role (`root` / `hub` / `content`);
- surface's own schema declares `role: 'hub'`
  (`packages/affine/blocks/surface/src/surface-model.ts:22`).

Neither is persisted per element, so there is **no data collision** — the
proposed field lives in the element Y.Map, the homonyms live in block schema
metadata. But the ambiguity is real for anyone reading `model.role` in a mixed
gfx context. Recommend either naming the field `semanticRole` /
`frameworkRole`, or accepting `role` with an explicit note in the accessor's
doc comment. This is a naming decision for the epic, not a blocker.

## TL;DR

| #   | Question                                                                                               | Verdict                                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Backward compatibility — can `role` be added without a schema version bump or an open-time conversion? | **GO** — no conversion needed                                                                                                                                                                                                                                   |
| 2   | Forward compatibility — does an _older_ client preserve an unknown `role`?                             | **GO with a caveat** — every _edit_ path preserves it; every _element-creation-from-props_ path (duplicate, paste, "turn into linked doc") silently drops it. "Turn into linked doc" is **destructive**: it drops the role in the copy _and_ deletes the source |
| 3   | Cross-document copy/paste                                                                              | **NO-GO as-is** — the edgeless clipboard path drops `role` in an older client; the doc-snapshot path preserves it. Verdict established by code reading (see "What these tests do and do not prove")                                                             |
| 4   | Versioning strategy                                                                                    | **No versioning mechanism required** — and none exists to be used. Mitigate at the epic level with a rollout ordering constraint, not with a migration                                                                                                          |

**Overall verdict for "optional field, no versioning": GO.** The field can ship
as a plain `@field()` accessor on `GfxPrimitiveElementModel` with no schema
version bump and no document conversion. The residual risk is entirely about
_mixed-version fleets_ and is described at the end.

---

## Q1 — Backward compatibility (old documents opened by a new client)

**Verdict: GO. An optional field costs nothing at open time.**

### Reading is fallback-based, not presence-based

The `@field()` decorator's getter reads the Y.Map and falls back to the
declared default when the key is absent:

```ts
// packages/framework/std/src/gfx/model/surface/decorators/field.ts:52-58
get(this: GfxPrimitiveElementModel) {
  return (
    (this.yMap.doc ? this.yMap.get(prop as string) : null) ??
    this._preserved.get(prop as string) ??
    fallback
  );
},
```

So an element written before `role` existed simply reads `undefined` (or the
declared fallback). Nothing throws, nothing needs rewriting.

This is not theoretical: `externalLink` and `linkedDocId` were added to
`GfxPrimitiveElementModel` the same way
(`packages/framework/std/src/gfx/model/surface/element-model.ts:369-373`), and
their backward compatibility is already asserted in
`packages/framework/std/src/__tests__/gfx/surface.unit.spec.ts:91-108`.

### Loading a document never rewrites element maps

On load, every element model is built from the _existing_ Y.Map with
`skipFieldInit: true`:

```ts
// packages/framework/std/src/gfx/model/surface/surface-model.ts:347-361
elementsYMap.forEach((val, key) => {
  const model = this._createElementFromYMap(
    val.get('type') as string,
    val.get('id') as string,
    val,
    { onChange: ..., skipFieldInit: true }
  );
  ...
});
```

`skipField` short-circuits the field initialiser before it can touch the map
(`decorators/field.ts:31-37`). Therefore opening an old document writes **zero**
bytes into the element maps: no default `role` is stamped in, and no
lazy-migration is triggered.

### The block schema version is irrelevant here

`affine:surface` is declared at `version: 5`
(`packages/affine/blocks/surface/src/surface-model.ts:15-21`). That number is
**write-only**:

- it is stamped onto the block at creation
  (`packages/framework/store/src/model/store/crud.ts:78,85`);
- it is dropped when a snapshot is converted back into a model —
  `_convertSnapshotToDraftModel` builds the leaf without it
  (`packages/framework/store/src/transformer/transformer.ts:446-461`), and
  `BlockSnapshot.version` is optional in both the type and the zod schema
  (`packages/framework/store/src/transformer/type.ts:10,19`);
- it is only ever surfaced as a read-only map (`Schema.versions`,
  `packages/framework/store/src/schema/schema.ts:106-112`).

**There is no migration runner anywhere in `packages/framework/store`.** A
repo-wide search for `migrat|onUpgrade|upgradeBlock` in that package returns
nothing, and `BlockSchema`'s zod shape has no `migrate`/`onUpgrade` hook. Bumping
`version: 5` to `6` would therefore have no runtime effect whatsoever — it would
only change the tag written on newly created blocks. **Do not bump it.**

Note also that the surface block's `version` covers the _block_, not the
elements. Element props have no version of their own; the element type registry
is keyed by `type` string only (`surface-model.ts:56-62`).

---

## Q2 — Forward compatibility (older client opens a document containing `role`)

**This is risk #1, and the answer is split.** Whether the unknown key survives
depends on whether the code path _mutates the existing Y.Map_ or _builds a new
element from a props object_.

### Paths that PRESERVE the unknown key

All of them mutate the element's own Y.Map key by key. There is no
"rewrite the whole map" anywhere in the element model.

**Field writes (move, resize, restyle, `updateElement`).** The `@field()` setter
writes exactly one key:

```ts
// packages/framework/std/src/gfx/model/surface/decorators/field.ts:71-78
if (this.yMap.doc) {
  this.surface.store.transact(() => {
    this.yMap.set(prop as string, val);
  });
} else {
  this.yMap.set(prop as string, val);
  this._preserved.set(prop as string, val);
}
```

`SurfaceBlockModel.updateElement` is just a loop of such assignments inside one
transaction (`surface-model.ts:686-695`), so a bulk update is still N single-key
writes.

**Drag / interactive resize (`stash` → mutate → `pop`).** `stash` shadows the
accessor with an own property backed by `_stashed`
(`element-model.ts:294-337`); `pop` writes back that one key only:

```ts
// packages/framework/std/src/gfx/model/surface/element-model.ts:279-282
if (getFieldPropsSet(this).has(prop as string)) {
  if (!isEqual(value, this.yMap.get(prop as string))) {
    this.yMap.set(prop as string, value);
  }
}
```

**Undo / redo.** The undo manager is a plain `Y.UndoManager` scoped to the whole
`yBlocks` map (`packages/framework/store/src/extension/history/history-extension.ts:22-24`).
It reverts the exact Yjs items the local client produced. Since an old client
never produces an item touching `role`, undo and redo cannot remove it. Undoing a
_deletion_ of the whole element restores its Y.Map contents, `role` included.

**Snapshot serialization.** `serialize()` is a whole-map dump with no allow-list:

```ts
// packages/framework/std/src/gfx/model/surface/element-model.ts:288-292
serialize() {
  const result = this.yMap.toJSON();
  result.xywh = this.xywh;
  return result as SerializedElement;
}
```

and the corresponding `SerializedElement` type is deliberately open
(`element-model.ts:57-64`, `Record<string, unknown> & {...}`).

**Doc-level snapshot round-trip.** `SurfaceBlockTransformer` is key-agnostic in
both directions:

```ts
// packages/affine/blocks/surface/src/surface-transformer.ts:15-22
private _elementToJSON(element: Y.Map<unknown>) {
  const value: Record<string, unknown> = {};
  element.forEach((_value, _key) => { value[_key] = this._toJSON(_value); });
  return value;
}

// packages/affine/blocks/surface/src/surface-transformer.ts:57-64
elementFromJSON(element: Record<string, unknown>) {
  const yMap = new Y.Map();
  Object.entries(element).forEach(([key, value]) => {
    yMap.set(key, this._fromJSON(value));
  });
  return yMap;
}
```

`toSnapshot` iterates every entry of every element (`surface-transformer.ts:102-108`).

### Paths that LOSE the unknown key

There is **one** loss mechanism — bulk-assigning a props object onto the element
model instance — but it is implemented at **two distinct call sites** in
`SurfaceBlockModel`. Any fix must cover both.

**Site 1 — `_createElementFromProps`** (element creation: paste, duplicate,
clone, cross-doc write):

```ts
// packages/framework/std/src/gfx/model/surface/surface-model.ts:147,169-174
const { type, id, ...rest } = props;
...
Object.keys(rest).forEach(key => {
  if (props[key] !== undefined) {
    // @ts-expect-error ignore
    elementModel.model[key] = props[key];
  }
});
```

**Site 2 — `updateElement`** (bulk update of an existing element):

```ts
// packages/framework/std/src/gfx/model/surface/surface-model.ts:686-695
this.store.transact(() => {
  props = this._propsToY(
    elementModel.type,
    props as Record<string, unknown>
  ) as T;
  Object.entries(props).forEach(([key, value]) => {
    // @ts-expect-error ignore
    elementModel[key] = value;
  });
});
```

Site 2 does not _destroy_ an existing `role` — it writes key by key and leaves
untouched keys alone (that is why every edit path above is safe). What it loses
is an _incoming_ `role` that the running client does not declare: the caller
believes it wrote the field, and nothing did. It is a write-drop, not an
overwrite.

There is no explicit allow-list here — every key of the incoming props object is
assigned. **But the assignment only reaches the Y.Map if the class declares that
key as an `@field()` accessor.** For an undeclared key, `elementModel.model[key] = …`
creates an ordinary own property on the JavaScript object; `field.ts:71-78`
never runs, and the value is never written to Yjs. The `@field()` accessor set is
therefore a _de facto_ allow-list, applied silently.

The behaviour is deceptive in the worst way: the pasted element looks correct in
the running session (the plain JS property is readable in memory) and loses the
role on the next reload, or immediately for every other peer.

The affected user actions:

| Action                                 | Site | Severity               | Entry point                                                                           |
| -------------------------------------- | ---- | ---------------------- | ------------------------------------------------------------------------------------- |
| Paste (canvas clipboard)               | 1    | non-destructive        | `packages/affine/blocks/root/src/edgeless/clipboard/canvas.ts:97` → `crud.addElement` |
| Duplicate (toolbar / keyboard)         | 1    | non-destructive        | `packages/affine/blocks/root/src/edgeless/utils/clipboard-utils.ts:29-50`             |
| Alt+drag clone                         | 1    | non-destructive        | `packages/affine/blocks/root/src/edgeless/interact-extensions/clone-ext.ts:11-23`     |
| **Turn into linked doc**               | 1    | **DESTRUCTIVE (move)** | `packages/affine/blocks/root/src/edgeless/configs/toolbar/render-linked-doc.ts:94-95` |
| `updateElement` with an undeclared key | 2    | write-drop             | `surface-model.ts:691-694`                                                            |

**"Turn into linked doc" is the severe one, and it is a move, not a copy.**
`createLinkedDocFromEdgelessElements` writes each primitive element into the new
doc with `surface.addElement(props)`
(`render-linked-doc.ts:94-95`, loop at `:75-98`) — losing `role` via site 1 —
and the caller then deletes the originals in the source doc:

```ts
// packages/affine/blocks/root/src/edgeless/configs/toolbar/more.ts:328-336
const linkedDoc = createLinkedDocFromEdgelessElements(
  ctx.host,
  clonedModels,
  title
);

ctx.store.transact(() => {
  deleteElements(edgeless, clonedModels);
});
```

So in a single user gesture, on an older client, the role is dropped in the
destination **and** the only copy that still had it is destroyed. There is no
surviving original to recover from — only undo, and only within the session.

The shared tail is
`packages/affine/blocks/surface/src/extensions/crud-extension.ts:92-112`, which
spreads the props and hands them to `SurfaceBlockModel.addElement`
(`surface-model.ts:503-543`).

> Side note discovered on the way: `crud-extension.ts:101-102` merges the
> "last used style" props _underneath_ the pasted props via
> `applyLastProps` (`packages/affine/shared/src/services/edit-props-store.ts:156-168`).
> This does not affect `role`, but it means pasted elements are not a pure
> function of the clipboard payload.

### Key asymmetry to keep in mind

For every path **except "turn into linked doc"**, the original element is not at
risk: an older client editing an element that carries `role` keeps it, and what
it loses is only the _copy_ it makes. The failure mode there is not "the field
disappears" but "the field silently fails to propagate to derived elements",
which is harder to spot but recoverable — the annotated original is still in the
document.

**"Turn into linked doc" breaks that asymmetry** and is therefore the worst
case: it is a move, so the lossy copy is followed by deletion of the annotated
source. Treat it as a distinct, higher-severity risk in the epic — it is the one
path where a single click on an older client permanently destroys role data with
no surviving copy.

---

## Q3 — Cross-document copy/paste

**Verdict: NO-GO as-is for the edgeless clipboard; GO for the doc snapshot path.**
The answer depends on which of the two mechanisms is used.

### Edgeless canvas clipboard (Ctrl+C / Ctrl+V between two open docs) — LOSES

Copy is wholesale. `prepareClipboardData` maps each element through
`serializeElement`, which for a primitive element is just `element.serialize()`:

```ts
// packages/affine/blocks/root/src/edgeless/utils/clone-utils.ts:51-67
export function serializeElement(element, elements, job) {
  if (element instanceof GfxBlockElementModel) { ... }
  else if (element instanceof ConnectorElementModel) { return serializeConnector(element, elements); }
  else { return element.serialize(); }
}
```

The payload is JSON-stringified under the `blocksuite/surface` MIME key
(`packages/affine/blocks/root/src/edgeless/clipboard/clipboard.ts:79`), so
`role` **does** leave the source document intact.

Paste is where it dies. `createElementsFromClipboardDataCommand`
(`packages/affine/blocks/root/src/edgeless/clipboard/command.ts:131`) calls
`createCanvasElement`, which does per-type id remapping for `group`, `mindmap`
and `connector` and then passes the whole blob through:

```ts
// packages/affine/blocks/root/src/edgeless/clipboard/canvas.ts:93-100
clipboardData.lockedBySelf = false;
const crud = std.get(EdgelessCRUDIdentifier);
const id = crud.addElement(
  clipboardData.type as CanvasElementType,
  clipboardData
);
```

No allow-list in the clipboard layer — but this lands in
`_createElementFromProps`, so the `@field()` filter of Q2 applies. In a client
that declares `role`, paste round-trips it. In an older client, it is dropped.

### Doc snapshot path (template insertion, drag-handle cross-doc drop, import/export) — PRESERVES

`SurfaceBlockTransformer` never consults the element classes (Q2 above), so
unknown keys survive even in a client that does not declare them. Two caveats
found while reading it, unrelated to `role` but worth recording:

1. `_toJSON` is applied one level deep only. A nested `Y.Text` inside a `Y.Map`
   value degrades to a plain string via `value.toJSON()`
   (`surface-transformer.ts:48-52`), and `_fromJSON` does not rebuild the
   nesting (`surface-transformer.ts:24-40`). **Keep `role` a flat string.**
2. `fromSnapshot` hard-overwrites `snapshotRet.props = { elements }`
   (`surface-transformer.ts:84-86`), so any surface prop other than `elements`
   is dropped on import. Irrelevant for an element-level field.
3. An element whose `type` is not registered throws at model construction
   (`surface-model.ts:197-199`), not at transform time. The Y data survives; the
   model layer refuses it. This is the failure mode for _new element types_, not
   for a new field on an existing type.

---

## Q4 — Versioning strategy

**Verdict: no versioning mechanism is required, and none is available.**

The three conditions that would force a conversion are all absent:

1. _Reading an old document must not fail_ — satisfied by the getter fallback
   (Q1).
2. _Opening an old document must not rewrite it_ — satisfied by
   `skipFieldInit: true` on load (Q1).
3. _A newer document must remain loadable by an older client_ — satisfied: an
   unknown key in the element Y.Map is inert; nothing iterates the map expecting
   a closed key set.

Adding `role` is therefore an **additive, non-breaking, non-versioned** change.
Concretely:

- **Do not bump** `affine:surface` `version: 5`. It has no migration semantics
  (Q1) and bumping it would only desynchronise the tag between old and new
  blocks for no benefit.
- **Do not** write a migration. There is no runner to register it with, and no
  document needs converting.
- **Declare** `role` as `@field()` with `undefined` default on
  `GfxPrimitiveElementModel`, exactly like `externalLink` / `linkedDocId`
  (`element-model.ts:369-373`). Declaring it on the base class rather than
  per-element-type is what makes duplicate/paste preserve it for _every_
  primitive type at once.
- **Keep the value a flat string** (see Q3 caveat 1). If the role ever needs
  structure, encode it as a namespaced string (`wardley:component`), not a
  nested object.

### What replaces versioning: a rollout ordering constraint

The real mitigation is not in the document format, it is in the release plan.
Because the loss is confined to props-object assignment in an _older_ client
(sites 1 and 2 of Q2):

1. Ship the `@field()` declaration for `role` **first**, in a release that does
   nothing else with it (the field is inert but declared). This is the
   "reader/writer tolerance" release.
2. Only once that release is the floor across the fleet, ship the features that
   actually _write_ `role`.

For the SaaS (`labreapp`) this is straightforward — clients are served from one
deployment. For the published `@blocksuite/*`-scope packages consumed by third
parties, the ordering constraint must be documented in the changeset.

---

## Residual risk

**A `role` lost by an older client is undetectable at the moment it happens and
manifests late.**

- The loss is silent: no exception, no console warning, no telemetry event. The
  `// @ts-expect-error ignore` at `surface-model.ts:171` is the only marker.
- The loss is invisible in-session: the pasted element carries `role` as a plain
  JS own property, so anything reading `element.role` in that tab sees the right
  value. It vanishes on reload, and never existed for any other peer.
- The loss is usually partial and therefore hard to reason about: the original
  keeps its role, the copy does not. A board can drift into a state where half
  the elements are annotated and half are not, with no user action that looks
  like it deleted anything.
- **For "turn into linked doc" the loss is total and destructive**: the source is
  deleted right after the lossy copy (`more.ts:328-336`), so there is nothing
  left to recover from outside the undo stack.
- The consequence surfaces at analysis time, potentially weeks later, when a
  framework view (Wardley, EDGY, Cynefin) or an export silently under-reports.

Mitigations to consider at epic level (out of scope for this spike):

- A cheap integrity check: a diagnostic that counts elements whose `type`
  suggests a framework element but whose `role` is missing.
- Telemetry on `role` write/read ratios, so drift is visible in aggregate.
- Long term, the sturdier fix is to make the element model forward unrecognised
  keys straight into the Y.Map instead of assigning them onto the instance.
  **It must cover both call sites** — `_createElementFromProps`
  (`surface-model.ts:169-174`) _and_ `updateElement`
  (`surface-model.ts:686-695`); patching only the first would leave programmatic
  bulk updates silently dropping unknown keys. That is a **red-zone change to
  `packages/framework/std` element plumbing** and must be its own reviewed story
  — it would change the semantics of every paste and every bulk update in the
  product.

---

## Proof tests

Two executable specs were added. Both pass on `worktree-agent-a7573e4ac0c7dcbe3`.

### `packages/framework/std/src/__tests__/gfx/element-unknown-props.unit.spec.ts`

`TestShapeElement` (`packages/framework/std/src/__tests__/test-gfx-element.ts:11-40`)
declares no `role` accessor, so it plays the part of an older client. 9 tests:

| Test                                                                             | Result                    |
| -------------------------------------------------------------------------------- | ------------------------- |
| an old client can read an unknown key it does not declare                        | pass — preserved          |
| writing a declared field (move/resize) does not clobber the unknown key          | pass — preserved          |
| stash/pop (drag & resize interaction) does not clobber the unknown key           | pass — preserved          |
| undo/redo of an old-client edit does not clobber the unknown key                 | pass — preserved          |
| undoing the deletion of the element restores the unknown key                     | pass — preserved          |
| `serialize()` emits the unknown key                                              | pass — preserved          |
| **LOSS: re-creating an element from its serialized props drops the unknown key** | pass — **loss confirmed** |
| **LOSS: cross-document copy/paste drops the unknown key**                        | pass — **loss confirmed** |
| **LOSS: `updateElement` with an undeclared key does not persist it**             | pass — **loss confirmed** |

The three `LOSS:` tests assert the _current, undesirable_ behaviour on purpose.
They are the executable record of the Q2/Q3 caveat. If a future change makes
`_createElementFromProps` or `updateElement` forward unknown keys, these three
tests will fail — that failure is the signal to update this document, not to
weaken the tests.

**What these tests do and do not prove.** They exercise the `SurfaceBlockModel`
layer directly. The cross-document test drives the _serialize → JSON →
`addElement`_ sequence between two real `TestWorkspace` documents, which is the
mechanism the edgeless clipboard uses — but it does **not** drive the real
clipboard: no `ClipboardEvent`, no `blocksuite/surface` MIME payload, no
`createElementsFromClipboardDataCommand`, and no per-type id remapping. The Q3
verdict therefore rests on **code reading** of
`clipboard/canvas.ts` → `crud-extension.ts` → `surface-model.ts`, with the unit
test proving the terminal step where the loss occurs. An integration spec
driving the actual paste command would close that last gap; it is worth adding
when the epic starts, and it is not needed to trust the verdict.

### `packages/affine/blocks/surface/src/__tests__/surface-transformer-unknown-props.unit.spec.ts`

3 tests, all pass, all asserting preservation:

- `toSnapshot` emits every element key, including unknown ones;
- a full JSON round-trip (`toSnapshot` → `JSON.stringify`/`parse` →
  `fromSnapshot`) preserves the unknown key;
- `elementFromJSON` writes back every key without an allow-list.

### Running them

```sh
cd packages/framework/std && yarn vitest run element-unknown-props
cd packages/affine/blocks/surface && yarn vitest run surface-transformer-unknown-props
```

Both are `*.unit.spec.ts` under `src/__tests__`, so they are already picked up
by the root vitest workspace (`vitest.workspace.ts`) and by CI.
