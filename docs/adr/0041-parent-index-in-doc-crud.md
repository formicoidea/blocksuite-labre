# ADR 0041 — A store opens in linear time: parent index, one blocks assignment

- Status: **accepted** (2026-10-26)
- Deciders: Mathieu Jolly (maintainer approval of the red-zone change, #507)
- **Red zone**: `packages/framework/store`. Nothing persisted changes: no
  Yjs key, no schema, no model, no update is written that was not written
  before. Every document reads and writes exactly what it did before.
- Related: issue #507, PR #508 (the default query skips the ancestor walk).

## Context

#507 reported `store.load()` taking 11 s on a 4000-block document. Two
independent costs made opening a store O(n²):

1. `DocCRUD.root` scanned every block and `DocCRUD.getParent` walked the
   tree from the root on every call, so both were O(n), and a load path that
   asks for the parent of every block was O(n²). #508 fixed the common case:
   a query that cannot hide any block (the default) no longer climbs the
   ancestors of each loaded block. A query with a `viewType: 'hidden'` entry
   still did, in `setAncestorsToDisplayIfHidden` (`model/store/query.ts`).
2. `Store._onBlockAdded` assigned `_blocks.value = { ...previous, [id]: block }`
   for every block, copying the whole record each time. V8 copies an object
   with integer-like keys on a fast path, so every bench that used the test
   fixture's auto-increment ids saw it as cheap; real documents have string
   ids, and there the copies are quadratic under any query.

Opening a store on 2000 / 4000 blocks with string ids, best of 3:

| state                  | 2000 default | 2000 hidden | 4000 default | 4000 hidden |
| ---------------------- | ------------ | ----------- | ------------ | ----------- |
| before (0.58.0)        | 1.26 s       | 7.5 s       | 4.2 s        | 34 s        |
| parent index only      | 640 ms       | 630 ms      | 3.2 s        | 3.7 s       |
| index + one assignment | 56 ms        | 42 ms       | 83 ms        | 54 ms       |

## Decision

1. `DocCRUD` keeps a lazy in-memory index `{ root, parentOf }`, built in one
   pre-order walk from the root on the first read after a structural change.
   `root` and `getParent` read it; nothing in it is written to Yjs.
2. The index gives the former answers: the last root-role block in map
   order; the first parent met in a pre-order walk from it; no parent for the
   root nor for an orphan. A block listed under two parents keeps the first
   one, and its subtree is walked once, which also ends a cycle where the
   former DFS overflowed the stack.
3. **Invalidation contract.** The index is dropped:
   - in a `beforeObserverCalls` listener on the `Y.Doc`, when the
     transaction changed the blocks map, a `sys:children` array, or the
     `sys:children`, `sys:flavour` or `sys:id` key of a block. Every
     transaction reaches that event before any observer runs, whether it is
     local, remote (`Y.applyUpdate`) or an undo/redo, so observers and
     everything after them read a fresh index;
   - by each mutator of `DocCRUD` (`addBlock`, `deleteBlock`, `moveBlocks`,
     `updateBlockChildren`), before its first write to the tree (a throw
     half-way leaves no stale index) and after its last (a read between two
     writes cannot cache a half-written tree). Reads the mutator needs happen
     before its first write.
4. Any new code that writes `sys:children` or the blocks map inside a
   transaction, outside these mutators, must drop the index the same way.
   Today none does (`sys:children` is written only in `crud.ts`).
5. `DocCRUD.dispose()` removes the listener; `Store.dispose()` calls it.
   A disposed `DocCRUD` still answers, rebuilding on every read (the pre-#507
   cost), because it no longer hears remote changes.
6. **The init path assigns the blocks record once.** The constructor's loop
   over existing blocks, and a Yjs transaction that adds or removes more than
   one block (a remote load, a paste, a subtree deletion), run as a batch:
   the record is copied once into a draft, each block is added to or removed
   from the draft, and `_blocks` is assigned once at the end (not at all if
   nothing changed). A transaction of a single block keeps the per-block
   assignment. Within a batch:
   - `blockUpdated`, `rootAdded`, `rootDeleted` and `model.created` still
     fire per block, in the same order;
   - the store's own reads (`getBlock`, `getBlock$`, `hasBlock`, `getParent`,
     `blockSize`, `getBlocksByFlavour`, `getAllModels`) answer from the
     draft, so a block is visible from its own `add` on, as before;
   - a direct read of `store.blocks` (the signal) sees the batch at its end,
     and its subscribers are notified once instead of once per block.

## Consequences

- Opening any store is linear in the number of blocks, whatever its query;
  `root` and `getParent` are constant time between structural changes. A
  text edit does not touch the index.
- A structural change costs one O(n) rebuild at the next read, instead of
  one O(n) walk per read. A burst of interleaved writes and reads inside one
  transaction (write, read, write, read) rebuilds each time, which is no
  worse than before.
- Effects that read `store.blocks.value` (`std/utils/gfx.ts`, the frame
  manager's `frames`) run once after a multi-block transaction instead of
  after each block, and so after that transaction's `blockUpdated`
  emissions rather than between them. The four library readers of
  `store.blocks` read it once at setup or inside an effect; none relies on
  the intermediate state.
- What stays loadable: everything. The stored tree is the source of truth
  and the index is derived from it; a document with a duplicated child or a
  cycle in `sys:children`, which the former code answered or overflowed on,
  now answers deterministically.
- The guard is `packages/framework/store/src/__tests__/parent-index.unit.spec.ts`:
  random local, undone and remote edits checked against the former DFS; a
  300 ms budget on opening 2000 string-id blocks under the default and the
  hidden query, each failing if either fix is reverted; one `store.blocks`
  notification for a 52-block remote transaction, each block readable from
  its own `add`.
- Follow-up, not done: update the index incrementally from the transaction's
  changes instead of invalidating and rebuilding. Worth it only if a profile
  shows the rebuild on a hot path (a drag that reparents per frame on a large
  document); the trigger is a rebuild above a frame budget.
