---
'@labre/affine-shared': patch
'@labre/affine-block-root': patch
---

fix(edgeless): a read-only mount no longer overwrites the saved session viewport

`edgeless-root-block._initViewport` saves the current viewport on unmount, under
a key shared by every mount of the same doc (`blocksuite:<docId>:edgelessViewport`).
A host embedding the same doc read-only — a mini map, a frame preview in a
conversation bubble — therefore taught the full editor to reopen framed like the
preview, and, now that such previews can pan, framed arbitrarily.

The save goes through a new `EditPropsStore.saveViewport`, which skips the write
when `store.readonly` is true: a read-only mount is a preview, not an editing
session, and has no business writing the shared session state. Readonly is read
at save time, so a session that turns read-only before unmounting stops writing
too. Deliberate hand-offs that still go through `setStorage('viewport', …)`
(surface-ref, frame panel) are unchanged.
