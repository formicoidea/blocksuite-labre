---
'@labre/affine-block-surface': patch
'@labre/affine-gfx-bpmn': patch
'@labre/affine-gfx-wardley': patch
'@labre/affine': minor
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

"Best effort: recognises shapes and text, no round-trip." That sentence is the
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
replaced with a flat neutral, transparency it flattened, and the constructs the
sanitizer removed before the reader saw them — `<use>` and `<foreignObject>`,
which is why a drawing built out of symbol instances can arrive nearly empty and
now says so instead of leaving you to guess. Three hundred `<use>` instances are
one remark, not three hundred.

Parts of a file marked `display:none` or `visibility:hidden` are **not**
imported, and the report says so: they draw nothing where the file came from,
and SVG's initial fill is black — so importing an exporter's off-canvas
scaffolding "faithfully" would put a large black slab over your board.

The drawing also arrives at the **size the file displays it at**. An SVG whose
`viewBox` is 1000 units wide and whose `width` is 200 is a drawing at one-fifth
scale, and the import applies that factor to positions, sizes, stroke widths and
font sizes alike.

One thing worth knowing before you reach for it: a **mermaid** diagram paints
almost entirely through a CSS `<style>` sheet, which this reader does not apply
— so a mermaid SVG arrives in the initial colours, mostly black, with a remark
saying why.

A blank drawing imports as nothing plus a remark rather than an error. A file
that is not well-formed XML is refused, by name.

Both frameworks read through **one** parser, so they cannot drift into
recognising different pictures — and which framework's vocabulary a picture is a
picture _of_ stays your call, never an inference from the filename.

### For hosts

`@labre/affine` is a **minor** because the library gains two commands and a new
public function, not because anything was removed. `parseSvgSketch`,
`SVG_SKETCH_FORMAT_ID`, `SVG_SKETCH_EXTENSION` and `SVG_SKETCH_MIME` are
exported from `@labre/affine-block-surface`, and each framework exports its own
capability (`BPMN_SVG_IMPORT`, `WARDLEY_SVG_IMPORT`) — so a host can build its
own drop zone on `importInterchangeFile` without going near a picker.

One thing to know if you render the command palette flat: `bpmn.importSvg` and
`wardley.importSvg` **share the label "Import SVG sketch"**, because they do the
same thing to the same file and only the framework offering it differs.
Disambiguate on `owner` — the ids are distinct, and so is every other field.
