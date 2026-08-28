---
'@labre/affine-block-surface': patch
'@labre/affine-gfx-c4': patch
'@labre/affine-model': patch
'@labre/affine-shared': patch
---

a c4 board declares its level, and the view polices it

C4's levels are not only zooms of an element — they are DIAGRAM TYPES, and each
one is defined by what appears on it. Until now the canvas had no way to say
which of them a sheet was: the board's title is free text, so a board called
"Payments" said nothing about whether it showed the system's context, its
containers or its components. Every level rule had to guess the level from what
happened to be drawn, and the level skip that is easiest to draw — a system
boundary full of components with no container boundary anywhere — was invisible
to the whole pack, as `c4.component-level-skip` documented at length.

A C4 board now carries an optional **level**, set from a small dropdown on the
selected board: Free sketch (the default), Context, Container or Component. It
is a declared fact sitting beside the title, not a rename — the author keeps
whatever words they wrote — and choosing Free sketch clears it again, so a board
that never states one is byte-identical to every C4 board drawn before today.

Two rules read it, citing C4's diagram types:

- **a context diagram** draws systems as boxes, with the people and neighbouring
  systems around them. Containers, components and boundaries have no place on
  one;
- **a container diagram** draws one system's containers inside its system
  boundary. Components and container boundaries belong on the next sheet down.

Persons, systems, the containers themselves and the system boundary stay legal
throughout: C4 draws its neighbours at every level, and the rules refuse only
what the notation actually refuses. The component level declares nothing at all,
because a component diagram legitimately shows all of it. Both rules are remarks
on Sketch and warnings once the board is set to Review checklist, which now
promotes eleven of the sixteen rules — and a board that declares no level is
silent under both, so no diagram already drawn gains a finding.

Under it, the engine gains a generic **`view-admissibility`** family: a rule
names the prop a frame writes its level in, plus the roles each level value does
not admit. Nothing in it knows C4 — the prop name and the levels are the rule's
own data — so any framework whose views come in kinds can ask the same question.
It is the first family whose subject is the sheet rather than an artefact, it
walks the surface once, and a frame that declares no level costs it nothing.
