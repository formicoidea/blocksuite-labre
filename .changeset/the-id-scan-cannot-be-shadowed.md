---
'@labre/affine-gfx-bpmn': patch
---

fix(blocks): a carried root's id cannot be shadowed by an id inside another attribute's value

The export's duplicate-id guard reads a carried fragment's root id off the
opening tag by hand. The scan for the end of the tag was quote-aware, but the
id extraction was not: a foreign attribute whose VALUE contains a raw
` id='X'` — a condition string, an XPath — was scanned as the fragment's id.
Alongside a legitimate `id="X"` fragment, the innocent one was dropped from
the export with a warning naming an id it does not have.

The id is now extracted in the same quote-aware pass that finds the tag end,
so `id=` inside a quoted value is never mistaken for the attribute. The
loss-table row for duplicated ids also stops over-claiming: the export names
the duplicates where the two disagree, and writes an exact duplicate once in
silence, by design.
