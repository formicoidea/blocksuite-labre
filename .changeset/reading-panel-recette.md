---
'@labre/affine-block-surface': minor
'@labre/affine': minor
---

The reversed reading comes back from the PO recette of 02/08/2026 with a place
of its own and a sentence it was missing.

**It is no longer hidden behind the toolbars.** The proposal shipped as a bubble
floating beside the element, and it rendered BEHIND the contextual toolbar: the
widget host sat at `z-index: 2`, while `editor-toolbar` takes
`--affine-z-index-popover`, which the theme sets to `1000`. It is now anchored
to the EDITOR — bottom-centre, at a comfortable 480px measure instead of the
300px of a bubble — in a layer above every toolbar, the senior menu and its
sub-menu included. The panel is what the user is reading; the toolbars can wait
underneath it.

The layer is `calc(var(--affine-z-index-popover, 1000) + 10)`, set on the HOST
rather than on the panel, because every widget host is a sibling in
`.widgets-container` and `affine-toolbar-widget` declares no stacking context of
its own — that sibling level is where the contest is actually decided. The
fallback is not decoration: it is the host's theme stylesheet that defines the
variable, never this library. What still paints above it, correctly, is what
mounts outside the contained widgets layer: `popMenu` context menus and the
toolbar drag preview.

The host stays ZERO-SIZED, and that is not a style choice either:
`.widgets-container > * { pointer-events: auto }` is an outer-tree rule on a
shadowless component and beats `:host { pointer-events: none }` outright, so a
host with a real box would swallow canvas clicks across the whole bottom of the
board. The panel carries the box; the host only carries the anchor.

A pan or a zoom no longer closes the panel. It closed because it hung off an
element that the gesture moved out from under it; anchored to the editor,
following what the reading is talking about while the reading is on screen is
simply the obvious thing to want. A resize still re-renders it, because its box
is clamped to the editor's.

**A new section: value flow.** For each typed edge touching the component, one
sentence saying which way the VALUE runs — up, from the supplier to the
consumer: _"Value flows up from Kettle to Brewing tea"_. It is the opposite
direction from the dependency arrow, which is the whole reason it deserves its
own words: ADR 0010 § 2 fixes `source` as the consumer and `target` as what it
needs, so a map read from the bottom up is a map read against its arrows. The
section is derived from the relations already read — no second traversal, no
second convention to keep in step with ADR 0010 — and an element with no typed
link gets no section at all rather than an empty heading.

Two i18n slots (`com.labre.reading.value-flow` and its `.to` suffix) so a host
catalogue can put the halves where its own grammar wants them; the English
fallback is what a silent host gets.

`ElementReading` gains a `name` field — what the subject is CALLED, its own text
or its label sibling's — because both ends of a flow sentence must be said by
name, and every renderer re-deriving it was one renderer too many.
