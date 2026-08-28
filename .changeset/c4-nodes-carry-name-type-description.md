---
'@labre/affine-gfx-c4': patch
'@labre/affine-model': patch
'@labre/affine': patch
---

feat(edgeless): c4 nodes carry their name, type and description, and every node edits its text

Three things the PO's recette asked for, on the C4 pack.

**Every node now edits its text.** A person, a database, a mobile app and a web
browser are drawn by their glyph rather than by a native rectangle, so the shape
underneath them is created unfilled — and an unfilled shape is hit only near its
border and on the few characters of its own label. The body you could plainly
see was not a target: double-clicking it opened nothing, and dragging or
selecting from the middle missed too. A C4 element is a BOX and its whole area
belongs to it, so it now says so, whatever its fill. Nothing is stored and
nothing is migrated: a diagram drawn last week behaves the same way the moment
it is opened.

**Nodes carry three tiers, as the notation does.** The name is the shape's own
inner text, edited in place on a double-click. Under it the type line —
`[Person]`, `[Software System]`, `[Container: Java]` — whose bracketed word says
what the element is and can therefore never disagree with the picture; and under
that the author's description. How those two are edited changed again before
release, in the very next entry: they are canvas text you write on directly, not
a popover, and the model carries no field for either.

The type wording follows the official stencil, including the one entry that
looks like a mistake: a **database says `[Container: technology]`**, not
`[Database: …]`. A database is a container and the cylinder is a picture of one,
not a fourth level. The mermaid export still writes `ContainerDb` — a different
question in a different grammar. An external element says the same word as the
kind it is external to; what "external" changes is the colour.

**The mermaid export carries them.** `Person(alias, "name", "description")`,
`Container(alias, "name", "technology", "description")`, and — the case worth
knowing — `ContainerDb(alias, "name", "", "description")` when there is a
description and no technology: those arguments are positional, and a sentence
written in the technology's slot would be read as the technology. An author's own
technology now wins over the default a phone or a browser window carries. A
technology typed on a person is drawn on the canvas and does not survive the
export, because mermaid's `Person` has no slot for one.

**The glyphs are redrawn against the reference stencil**, path by path, from the
PO's own model file rather than from memory. The person is a circular head about
half the box wide, its top flush with the element, fused into a strongly rounded
body — one silhouette, not a disc parked over a block. The phone and the browser
window are no longer a band painted over a coloured box: their outer rectangle
is the darker colour — the bezel, the frame — with a lighter screen inset in it,
a home button and a speaker slot on the one, three dots and an address bar on
the other. The four boxed levels lose their rounded corners, because the stencil
draws them square. Every border is the stencil's own darker shade of its fill
rather than one darkened by eye, which is what makes the two devices read at all.

**Sizes change.** Seven of the nine kinds now share one footprint — 212 × 148,
the stencil's single repeated box at ×2 — so a row of elements lines up without
anybody arranging them. The two people are 212 × 244, and that is the stencil's
own exception rather than a preference: its person path puts the head clear
above a body that is itself the standard height, and its sheet shifts the person
down the page to make room. Squeezing that into the shared box would turn the
head into a flat ellipse, which is the one thing about a C4 person everybody
recognises. **Existing nodes keep the size they were drawn at** — this is a
creation-time default, like every other value here.

Boundaries and relationships pick up the stencil's own line work too: both are
drawn in one neutral grey at the stencil's weights and dashes, and a boundary's
corners are square. A boundary now writes its level under its name —
`[Software System]` or `[Container]` — derived from the variant, so a boundary
drawn before this change gets its line as well. That line is vocabulary rather
than the author's words: it goes through the host's catalogue like every other
piece of framework wording, and the in-place editor still opens on the name and
only the name.

One limit, stated rather than worked around: the relationship's label is drawn
by the connector primitive, which has no white background pill of the kind the
stencil puts behind "Uses [technology]". The line, its dash, its weight, its
grey and its filled arrowhead all match; the label sits on the diagram.
