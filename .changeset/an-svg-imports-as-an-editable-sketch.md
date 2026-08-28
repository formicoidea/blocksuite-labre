---
'@labre/affine-block-surface': patch
'@labre/affine-gfx-bpmn': patch
'@labre/affine-gfx-wardley': patch
'@labre/affine': patch
---

feat(edgeless): an SVG file imports as an editable sketch

**Somebody sent you a picture of a process, not a `.bpmn`.** Open the artefact
catalogue, pick **Import SVG sketch**, and the drawing arrives on the canvas as
elements you can move, recolour and rewrite: rectangles, ellipses, polygons,
brush strokes — and every `<text>` in the file as a **free-text element you can
double-click and edit**, which is the whole point. A label that arrived as a
picture of a word would be a label nobody could correct.

The entry is under **Interchange** in the catalogue sidepanel (one click away
via _More artefacts…_), on both the BPMN and the Wardley frameworks, and it is
also in the command palette and available to an agent. It is deliberately **not**
in the senior sub-menu: that row carries a framework's native-format import —
**Import BPMN XML** today — and this is the fallback for everything else.

### It says what it is before it opens the file

"Best effort: recognizes shapes and text, no round-trip." That sentence is the
contract (`docs/adr/0012`, P2), and it is on the button rather than in a report
afterwards. What lands is a **sketch you then promote**: nothing here decides
that a rounded rectangle in your picture was a task, or that a circle was a
Wardley component. An SVG carries a rendering, not a model, so there is nothing
to preserve and nothing is written into the document beyond the drawing itself —
no hidden payload, and no round-trip implied.

### And it never drops anything quietly

The import report names every construct it could not read, **once per kind**: a
`scale` or `rotate` transform it ignored (the shape is imported, at its
untransformed position), curves it approximated by their endpoints, gradients it
replaced with a flat neutral, and the constructs the sanitizer removed before
the reader saw them — `<use>` and `<foreignObject>`, which is why a drawing built
out of symbol instances can arrive nearly empty and now says so instead of
leaving you to guess. Three hundred `<use>` instances are one remark, not three
hundred.

A blank drawing imports as nothing plus a remark rather than an error. A file
that is not well-formed XML is refused, by name.

Both frameworks read through **one** parser, so they cannot drift into
recognising different pictures — and which framework's vocabulary a picture is a
picture _of_ stays your call, never an inference from the filename.
