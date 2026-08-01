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

Practical consequence for callers: a junk key passed to `addElement` /
`updateElement` is now persisted instead of being swallowed. Keys are filtered
by a short deny-list first — `id` and `type` (element identity) and
`__proto__` / `constructor` / `prototype` (prototype pollution) are never
copied. A dead `controllers: []` prop was removed from the connector tool's
`addElement` call for the same reason.

No schema change, no version bump, no migration: documents written before and
after this release remain mutually loadable.
