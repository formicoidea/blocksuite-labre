---
'@labre/affine-block-surface': patch
'@labre/affine-gfx-c4': patch
'@labre/affine-shared': patch
'@labre/affine-widget-toolbar': patch
'@labre/affine': patch
---

feat(edgeless): a C4 element changes into a nearby kind from its own toolbar

Discovering, halfway through a container diagram, that the box should have been
the **cylinder** used to cost a delete, a re-draw, a re-connect and three tiers
of retyped words. Select a C4 element now and its contextual toolbar carries a
**Change type** dropdown: turn a container into a database, a mobile app or a
web app; turn a person or a software system into its external, grey twin. The
component stays the same component — same box, same name, same description,
same relationships, same ids — and one ctrl+z puts it back.

What an element may become is **declared data**: three families — the two
people, the two software systems, and the four containers (the plain box, the
cylinder, the phone and the browser window). Every member of a family lays its
words out identically, which is what makes the swap free of any re-layout: the
three tiers stay exactly where they were. Nothing crosses between the families,
and the **component** is deliberately in none of them — a component is a part of
a container, not another drawing of one, and offering that swap would invite a
diagram that mixes two levels of the model. Boundaries and boards are frames and
are never offered it either.

What changes is the shape's kind, its role and its full appearance, taken from
the very table the palette draws from — so a morphed database and one drawn
fresh from the sub-menu are the same element. That matters visibly here: a
container paints its body natively and a cylinder, a phone and a browser window
hand it to the renderer, so a two-field patch would have left a rectangle
painted behind the cylinder. The grey of an external element moves with it for
the same reason.

The component's own words follow the shape too, under one timid rule: **only
what the notation itself wrote is rewritten, never what you typed.** An
untouched container morphed to a database is renamed "Database" and captioned
`[Container: technology]`, because a cylinder captioned "Container" is a picture
contradicting itself. A container you called "Customer database", built with
React, keeps both — the name verbatim, and the technology carried across into
the new caption.

Under the hood, the generic morph module now supports **composite** artefacts: a
C4 element is a native group holding the shape and its three lines of words, so
a spec may say which element inside the selection the kind is actually written
on, and what else the artefact owes the change — both inside one undo step.
BPMN's own declaration is untouched. Registering it also lifted an invisible
ceiling: a toolbar flavour used to hold at most two modules, and both of the
group's slots were already taken (native group operations, and Wardley's
qualification dropdown, which is on the group for the very same reason). A
module may now name its owner, so several frameworks can contribute to one
element's row, and a morph's toolbar entry is scoped by the framework that
declared it so two of them on one row can never be merged into one dropdown.
The whole view layer is mounted in a test that fails on the collision that used
to be silent until the editor refused to open.
