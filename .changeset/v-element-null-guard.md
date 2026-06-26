---
'@labre/std': patch
---

Fix a `TypeError: Cannot read properties of null (reading 'firstElementChild')`
in the inline editor. `VElement.getUpdateComplete` assumed the inner
`[data-v-element]` span (and its child) were always present; when awaited while
the element is mounting/unmounting, `querySelector` returns `null` and it threw.
Now guarded — it resolves instead of crashing when the inner DOM isn't ready yet.
