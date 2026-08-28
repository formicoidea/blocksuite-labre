---
'@labre/affine-gfx-c4': patch
'@labre/affine-model': patch
'@labre/affine': patch
---

feat(edgeless): a c4 component is the shape and its own text, grouped

The PO's recette rejected the mechanism the last change shipped, and it was
right to: an element's technology and its description were typed into a
"Details" popover on the toolbar and painted back onto the box by the renderer.
Two lines of the notation that an architect could read and never write on. On a
whiteboard you write on the picture.

**So a C4 element is now five elements that behave as one.** The shape, which
carries no text at all; a canvas text holding the NAME; one holding the type
line — `[Person]`, `[Container: Java and Spring MVC]`; one holding the
description; and a group joining the four. One click selects the whole component
and moves, copies or deletes it as one thing. A double-click opens the ordinary
in-place editor on whichever line is under the pointer — the same gesture, the
same editor and the same toolbar as any other words on the canvas, for all three
of them. There is no form left anywhere in the pack, and no second kind of text.

Double-clicking the BODY of the shape edits the name, which is what everybody's
hand does anyway: the gesture is routed to the name's own editor rather than
opening the shape's, so an element can never grow an invisible second name under
its real one.

**All three tiers exist from the moment you draw one**, carrying the official
stencil's own prompts: the kind's label as the name, `[Container: technology]`
under it and `description` under that. You meet three lines of stencil and
overwrite what you have something to say about, rather than a bare box and three
invisible slots somebody has to tell you about. A prompt is not a value: an
element whose tiers are untouched exports as `Container(alias, "Container")`,
not as one built with a technology called "technology". The NAME is the
exception and goes out verbatim — an unnamed container really is a container,
and saying so beats printing `?`.

**Elements are taller, because the words now need the room.** A default box goes
from 212.6 × 148.8 to **212.6 × 172.8**, and a person from 212.6 × 244.4 to
**212.6 × 268.3**. The width is untouched — every glyph is proportioned off it,
a person's head included. The height is no longer the stencil's textRect but the
sum of what the box actually holds: a margin, two lines for the name, a small
gap, the type line, a wider gap, two lines for the description, the same margin
again. Two lines for the name is what drove the growth: "Internet Banking
System" does not fit on one at this size, and it should not have to. Change a
tier's size or a gap and the footprint follows, so a box can never disagree with
its own contents. **Existing elements keep the size they were drawn at.**

**The type line stays half the notation's.** Which of the four levels a box is,
is the diagram's business — it comes from the element's kind, which is what the
picture paints — so the bracketed word is rewritten from the kind whenever you
finish editing the line, and only the TECHNOLOGY is kept. Type `Java` into a
container's type line and it becomes `[Container: Java]`; type
`[Person: Java]` and it still becomes `[Container: Java]`; clear it and it
becomes `[Container]`. The rewrite happens when the editor closes, never while
you are typing, and it is one undo away.

The reading is deliberately forgiving, because you are typing on a picture and
not filling in a field: a line left as `Container: Java`, as `Java`, or split
over two lines all state the same technology. A colon that is not the notation's
is left alone — an author whose technology is `https://internal/docs` gets to
keep it.

**The two removed model fields.** `technology` and `description` are gone from
the C4 node's schema: they were added in the previous change, never released,
and are now written on the canvas instead. Nothing in any document is migrated
or lost — a node that never stated one wrote no key for it, which is exactly why
they could be added without a schema bump and why they can be removed the same
way.

**The mermaid export says exactly what it said before**, byte for byte on the
same diagram: the name, the technology and the description all come out of the
words the author typed, resolved through the group and the role each text
carries. Which text belongs to which box is answered by the GROUP, and which of
a component's texts is the name by its ROLE — never by the order the elements
happen to sit in, so reordering, copying or regrouping cannot swap one
architect's technology onto another's box.

Four behaviours worth knowing, all of them pinned:

- an element drawn **before this change** keeps its name in the shape's own
  text, which is where the previous iteration put it, and the export reads it
  from there. Nothing is migrated or rewritten, and double-clicking such an
  element still opens the editor its name is actually in;

- an **ungrouped** element — one whose group was released, or whose texts were
  deleted — exports with no name, no technology and no description. It is still
  a C4 element, the role being on the shape, and nothing is invented for it;
- a **relationship dropped on the component** rather than exactly on its shape —
  on the group, or on one of the two lines of words — is written against the
  shape all the same. All four parts accept a connector and all four look like
  the same box on the canvas, so without this every such arrow would have
  vanished from the exported file with no sign that it had;
- a group holding **two** C4 elements speaks for neither. That is a lasso drawn
  round two boxes, and an arrow landing on it points at nothing in particular.

The node renderer no longer paints any text at all: the glyphs — the person, the
cylinder, the phone, the browser window — are untouched, and every word on a
component is a real element.
