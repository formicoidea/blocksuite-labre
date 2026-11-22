---
'@labre/std': patch
'@labre/affine-gfx-connector': patch
---

`surface.addElement` no longer saves a half-written canvas element (#669, write side, ADR 0056). Up to 4.1.0, a value Yjs cannot store — a store `Text` (`@labre/store`) given as a text or a label, a class instance, a Yjs type already in a document — made the write fail half-way inside `store.transact`, which only logged it: `addElement` returned an id, and the document kept an element with some of its keys (for a `text` element, no `type`, `id` nor `xywh`, so every reader skipped it), or a shape or connector silently lost its label and the props after it.

- A store `Text` is now accepted and stored as a `Y.Text`, by the store's own rule: its `Y.Text` while it is in no document, a copy once it is (`updateElement` converts it too).
- Any other value a declared field cannot store makes `addElement` (and `createDetachedElement`) **throw**, naming the keys, before anything is written: no stored element, no model, no event. A host, an importer or an agent that passed such a value now hears about it instead of getting a broken element. Well-formed calls are unchanged.
- `type` and `id` are now the first keys of a new element's stored map.

Three limits ADR 0053 left open are closed. A peer that replaces the map stored under an existing element key is now read as the removal of the old element then the addition of the new one (`elementRemoved` first, then `elementAdded`, same id), so the canvas no longer keeps a model bound to a map that left the document, and a skipped element replaced by a readable one appears without a reload. `serialize()` now returns the element's key as its `id`, so copy, paste and duplicate work in documents whose elements were stored without `id` (#681): copying several elements pasted only one, a group was not pasted, a copied connector stayed attached to the original. A connector stored without `mode`, or with a mode this version does not know, is routed as a straight line instead of throwing, and one connector whose routing throws no longer stops every other connector of the canvas from being routed for the rest of the session. Nothing persisted changes.
