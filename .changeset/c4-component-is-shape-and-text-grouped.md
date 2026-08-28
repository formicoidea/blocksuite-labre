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

**So a C4 element is now four elements that behave as one.** The shape, whose
inner text is the NAME; a canvas text carrying the type line — `[Person]`,
`[Container: Java and Spring MVC]`; a canvas text carrying the description; and
a group joining the three. One click selects the whole component and moves,
copies or deletes it as one thing. A double-click descends into whichever tier
is under the pointer and opens the ordinary in-place editor on it — the same
gesture, the same editor and the same toolbar as any other words on the canvas.
There is no form left anywhere in the pack.

**All three tiers exist from the moment you draw one**, carrying the official
stencil's own prompts: the kind's name in the box, `[Container: technology]`
under it and `description` under that. You meet three lines of stencil and
overwrite what you have something to say about, rather than a bare box and two
invisible slots somebody has to tell you about. A prompt is not a value: an
element whose tiers are untouched exports as `Container(alias, "Container")`,
not as one built with a technology called "technology".

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
same diagram: the technology comes out of the type line the author typed and the
description out of the text under it, resolved through the group and the role
each text carries. Which text belongs to which box is answered by the GROUP, and
which of a component's texts is the type line by its ROLE — never by the order
the elements happen to sit in, so reordering, copying or regrouping cannot swap
one architect's technology onto another's box.

Three behaviours worth knowing, all of them pinned:

- an **ungrouped** element — one whose group was released, or whose texts were
  deleted — exports with no technology and no description. It is still a C4
  element, the role being on the shape; it has simply stopped saying more than
  its name, and nothing is invented for it;
- a **relationship dropped on the component** rather than exactly on its shape —
  on the group, or on one of the two lines of words — is written against the
  shape all the same. All four parts accept a connector and all four look like
  the same box on the canvas, so without this every such arrow would have
  vanished from the exported file with no sign that it had;
- a group holding **two** C4 elements speaks for neither. That is a lasso drawn
  round two boxes, and an arrow landing on it points at nothing in particular.

The node renderer no longer paints any text at all: the glyphs — the person, the
cylinder, the phone, the browser window — are untouched, and the words above
them are real elements.
