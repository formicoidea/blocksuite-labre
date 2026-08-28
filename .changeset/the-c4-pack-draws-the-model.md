---
'@labre/affine-gfx-c4': patch
'@labre/affine-block-surface': patch
'@labre/affine-model': patch
'@labre/affine': patch
---

feat(edgeless): the C4 pack draws people, systems, containers and boundaries

C4 is the notation an architect reaches for when somebody asks "what IS this
system" — four levels, drawn one zoom at a time: the people and systems around
it, the containers it is made of, the components inside one of those. Until now
it was drawn here with rectangles and explained in a meeting. The pack now ships
its model, its vocabulary and its rendering.

**Nine artefacts.** A **person** and an **external person**, drawn as the
stencil draws them — a head over a rounded body block; a **software system** and
an **external system**; a **container**, and the three flavours C4 gives a
picture of their own: a **database** (a cylinder), a **mobile app** (a phone
bezel down its leading edge) and a **web app** (a browser chrome band with its
three dots); and a **component**.

They are drawn in C4's own colour code, which is not decoration but the
notation: the four levels run from the near-navy of a person through the blue of
a system and the lighter blue of a container to the pale wash of a component,
and anything outside the scope of the diagram is grey. That colour is what tells
a container from a component when both are rounded rectangles with words in
them — and it is why the pack has nine artefacts but only five element roles.

**Two frames.** The **C4 board** is a plain titled white card: no axes, no
zones, because a C4 diagram is a graph and a system drawn top left says nothing
more than one drawn bottom right. Its title is what names the level being drawn,
and a double-click on it renames it in place.

The **boundary** is the dashed rectangle drawn round a group of elements to say
"all of this is one system". It is the first background in the library that is
deliberately TRANSPARENT: every other one is a card you put things on, and this
one is drawn OVER a diagram that is already there — an opaque card would hide
the very thing it is pointing at. Its name sits in the bottom-left corner, where
C4 puts it, and renames the same way. A boundary can say which level it encloses
(a system boundary or a container boundary); the field is optional, and a
boundary that says nothing reads as the outer one.

**Eight roles** join the vocabulary: `c4:person`, `c4:system`, `c4:container`,
`c4:database`, `c4:component`, the two frames, and one edge —
`c4:relationship`, because C4 has exactly one kind of line and its label is
where the author says which kind of using it is. The four LEVELS are deliberately
flat: a container is _part of_ a system, not _a kind of_ system, so filing them
in a chain would make every rule about systems fall on every container. The one
specialisation declared is the one C4 itself draws — a database is a container,
so everything written about containers already reaches it.

**Nothing already drawn changes.** The three element types are new; no existing
model is touched, no field is renamed, and the one optional field in the pack
writes nothing when it is not used — so there is no schema version bump and no
migration.

The framework-background primitive gains one thing along the way: a background
may now declare its card's border DASHED. That is what the boundary is, and it
belongs in the declaration a reviewer can read rather than in a renderer only
one framework would ever have. Every existing declaration is unchanged and
paints the solid line it always painted.

The palette entries, shortcuts, templates and the senior toolbar button follow
in the next release; this one is the model, the vocabulary and the rendering.
