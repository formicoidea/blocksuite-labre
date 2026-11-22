# ADR 0056 — A surface element is written whole, or not at all

- Status: **accepted** (2026-11-22)
- Deciders: the write side of issue #669 (§1, "Suggested fix") and the known
  limits ADR 0053 left open, closed by the library session of 2026-11-22. The
  choice to ACCEPT a store `Text` rather than refuse it is the lead's,
  argued below; the product owner may reverse it.
- **Red zones**: none touched. `packages/framework/store` and `sync` are not
  modified (the store's `native2Y` is called, not changed); no schema, no
  stored key, no default, no enum value. Red-zone-adjacent: the surface's
  write path and its elements-map observer (`packages/framework/std`,
  `SurfaceBlockModel`, `GfxPrimitiveElementModel.serialize`). Also touched:
  the connector router and its watcher (`packages/affine/gfx/connector`).
  `packages/affine/model` is NOT touched.
- Related: #669, ADR 0053 (the load guard, amended 2026-11-22 to point here),
  #681 (elements stored without `id`), the unknown-props spike (PR #73,
  `_assignElementProp`).

## Context

`surface.addElement` builds the element in a detached `Y.Map` and attaches it
in `store.transact`. Yjs checks a detached map's values only at attach time,
key by key, in insertion order. A value it refuses (`Unexpected content type`)
throws half-way through the keys; `Store.transact` catches and logs the error
(`framework/store/src/model/store/store.ts:414-428`), and `addElement` returns
an id. Reproduced (Chromium, the guard spec of this ADR):

- `{ type: 'text', text: new Text('Label') }`, a store `Text` (what a block's
  text is) instead of a `Y.Text`: nothing converted it, the `text` key came
  first (its field default is written by the constructor, before `type` and
  `id`), so the stored map held `index` and `seed` only — no `type`, no `id`,
  no `xywh`. Every reader then skips it as `unreadable` (ADR 0053).
- The same store `Text` as a shape's or a connector's label (no default): the
  keys before it survived, the label and every key after it were lost,
  silently.
- Any class instance (a `Bound` for `xywh`, a null-prototype object): the same.
- A `Y.Text` already in a document: Yjs takes it and RE-PARENTS it
  (`AbstractType._integrate` overwrites `doc` and `_item`): two documents point
  at the same content, a corruption no error reports.

Who writes this way: callers outside the editor (the host, its workspace
connector in beta with Labre V2, labre-mcp, importers). The editor writes
`Y.Text`.

ADR 0053 also left three limits, each a path a document written outside the
editor reaches:

- (a) a peer that SETS a new map under a key that already has one: the
  elements-map observer handled `add` and `delete` only, so the old model
  stayed bound to a map that had left the document, and a skipped element
  replaced by a readable one stayed skipped until reload;
- (b) copy, paste and duplicate of elements with no stored `id` (#681):
  `serialize()` returned the stored map, so the clipboard saw `id: undefined`;
  copying N elements pasted one, a group was not pasted, a copied connector
  stayed attached to the original ends;
- (c) a connector stored without `mode`: the router threw
  `unknown connector mode`, synchronously when the connector watcher mounted
  and otherwise in its microtask, which left `pendingFlag` up so no connector
  of the surface was routed again for the session.

## Decision

1. **A store `Text` is accepted, converted by the store's own rule.**
   `_propsToY` hands it to `native2Y` (`@labre/store`): its `Y.Text` while it
   is in no document, a clone once it is. Accepting is the least surprising
   behaviour: every block prop takes a store `Text`, the type a caller holds is
   that one, and the store already has the conversion, so nothing is invented.
   Refusing would break a caller that "worked" (an id came back) for a value
   the library knows how to store. It applies to `updateElement` too, which
   shares `_propsToY`.
2. **Every declared field value is checked before anything is written.**
   After `_propsToY`, each value bound for a `@field()` is checked with the
   rule Yjs applies at attach time (`typeMapSet`, yjs 13.6: `null`, the
   JSON-like constructors, `Uint8Array`, a sub-document, a Yjs type), plus one
   refusal Yjs does not make: a Yjs type already in a document (it would be
   moved, not copied). A refused value makes `addElement` THROW, naming the
   keys, before the model is registered and before the transaction: no stored
   map, no model, no `elementAdded`, no Yjs update. The caller knows.
   `createDetachedElement` shares the path and throws the same way.
   Top level only, like Yjs: what a plain object holds is encoded as JSON and
   cannot make the attach throw.
3. **`type` and `id` are written first.** They are set on the detached map
   before the model is constructed, so they precede the field defaults in the
   stored map: a reader finds them first.
4. **An unknown key keeps its rule** (dropped with a warning when it cannot be
   encoded, PR #73), with one refusal added: a Yjs type already in a document
   is not encodable there either.
5. **A replaced map is a removal then an addition** (limit a). On an `update`
   of the elements map, the old model (if any) is unmounted and announced
   through `elementRemoved` FIRST, then the new value is read exactly like an
   added one (built and mounted, or skipped and reported) and announced
   through `elementAdded`. The damage record of the key follows the new value.
6. **The serialized id is the key** (limit b). `serialize()` sets `id` to the
   model's id, which is the element's key (ADR 0053 §1). Copy, paste and
   duplicate map every reference by it, so they work on #681 documents.
   Nothing is written: the stored `id` stays absent or as it was.
7. **An unknown connector mode is routed as Straight** (limit c). Absent, or a
   newer client's (the enum is append-only): every other reader — the
   renderer, the bound in `updatePath`, the handles — already draws anything
   but `Curve` as a polyline, so the straight path is the one they agree with.
   Nothing is written. And the watcher's microtask clears its pending list and
   its flag in a `finally`, so one routing that throws, for whatever reason,
   no longer stops every later one.

## What stays loadable

Everything: nothing persisted changes. The check refuses values that never
reached a document whole; the conversion stores a `Y.Text`, exactly what the
editor stores; the observer, `serialize()` and the router only READ. A
document written before this change opens identically, and one written after
it opens on a 4.1.0 client.

## Consequences

- **A host that passed an unstorable value now gets an exception** where it
  got an id and a broken element. That is the point of the change, and why it
  ships as a patch: no well-formed call changes behaviour. A host that passed a
  store `Text` now gets the label it meant.
- The check is per declared field. A non-`@field` setter a class declares (the
  group's derived `xywh`) is class code and is not checked; field defaults the
  constructor writes are class code too.
- `updateElement` converts a store `Text` but does not check values: it writes
  into a map that is already attached, so a refused value throws at the first
  bad key (inside `transact`, which swallows it) and the element keeps its
  `type` and `id`. Not half-written, but a partial update the caller does not
  hear about. `ponytail:` not fixed here; the upgrade is the same check before
  the `transact` of `updateElement`, once `@convert` fields (whose stored value
  is the converted one) are accounted for.
- A replaced element emits `elementRemoved` then `elementAdded` with the same
  id; a subscriber that counts deletions (telemetry) sees one, on the peer
  whose transaction is local. A peer replacing a map is not an editor gesture.
- A connector of an unknown mode drawn straight is a degraded reading, not the
  author's: a newer client still sees its own mode, and the stored value is
  never rewritten. The alternative — a read fallback
  `@field(DEFAULT_CONNECTOR_MODE)` on the model — was not taken: it touches
  `packages/affine/model` (red zone) and still leaves a newer client's mode
  unknown to the router. For the ABSENT case it would draw the model's default
  (Curve) instead of a straight line; the product owner may prefer it, in a
  change of its own.
- **Still open, from ADR 0053**: a local `addElement` whose MOUNT throws (a bug
  in a registered type, not a value) leaves the written map and returns an id
  `getElementById` does not know; the `@observe` metadata quirk; a late
  completion of a skipped map; no placeholder.
