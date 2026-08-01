---
'@labre/std': patch
'@labre/affine-gfx-connector': patch
---

Surface elements no longer lose props the running element class does not
declare. `SurfaceBlockModel._createElementFromProps` (paste, duplicate,
alt-drag clone, "turn into linked doc") and `SurfaceBlockModel.updateElement`
used to copy incoming props by assigning them onto the model instance, so only
a key backed by an `@field()` accessor ever reached the Y.Map — any other key
became a plain JavaScript property, readable in the running tab, invisible to
every peer, and gone on reload. Both sites now forward unrecognised keys
verbatim into the element's Y.Map.

**This changes the semantics of every paste, duplicate, clone, "turn into
linked doc" and programmatic bulk update: the behaviour becomes "preserve what
we do not understand", which is already the Yjs contract everywhere else in
the element plumbing** — every single-key field write, stash/pop, undo/redo
and the surface snapshot transformer preserved unknown keys already; these two
bulk-assign sites were the exception.

Why it matters: in a mixed-version fleet, a client running an older version of
the library could copy an element annotated by a newer one and silently strip
the annotation. Boards drifted into a half-annotated state with no user action
that looked like it deleted anything, and "turn into linked doc" — which
deletes the source right after the copy — destroyed the data outright.

**The protection is not retroactive.** A fleet is only safe once every client
runs a version from this release on; a client pinned before it keeps stripping
on every copy. The rollout ordering constraint still applies — ship a field's
declaration before the features that write it. What changes is that the floor
no longer has to include the field itself: any release from here on preserves
fields it has never heard of.

Keys are routed explicitly. A key the element class declared (`@field()`,
`@local()`, or a plain accessor with a setter) goes through its accessor as
before; anything else is unknown data and goes to the Y.Map. The routing
deliberately does not use `key in element`, which also matches methods
(`serialize`, `isLocked`), getter-only derived props (`x`, `y`, `w`, `h`,
`group`, `elementBound`…) and internal fields — assigning to those corrupted
the model or threw inside `store.transact`, which swallowed the error and
dropped every remaining prop of the same bulk update.

Values are validated before being written. `Y.Map.set` accepts values it cannot
later encode — a cyclic object is stored happily and only `encodeStateAsUpdate`
fails, breaking persistence and sync for good with nothing in the app noticing.
An unknown prop is therefore admitted only if it is a Yjs type, a binary blob,
a primitive, or plain acyclic JSON; anything else (function, class instance,
cycle) is dropped with a warning, exactly as before this change. `undefined`
never creates a key on the unknown branch, so spreading an absent option cannot
mint a phantom key; declared fields still accept `undefined` to clear them.

Practical consequences for callers: a junk key passed to `addElement` /
`updateElement` is now persisted instead of being swallowed — a dead
`controllers: []` prop was removed from the connector tool's `addElement` call
for that reason. And because copies are now faithful, a stale key already
present in an old document (that same `controllers`) is propagated to copies
instead of being cleaned by them: removing a prop from the code no longer
removes it from documents that already carry it.

No schema change, no version bump, no migration: documents written before and
after this release remain mutually loadable.
