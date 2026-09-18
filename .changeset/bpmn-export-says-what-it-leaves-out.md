---
'@labre/affine-gfx-bpmn': patch
'@labre/affine-block-surface': patch
---

The `.bpmn` export now says what it left in the pool

Exporting a pool as BPMN 2.0 XML writes only the artefacts that carry a BPMN
role. That is deliberate and unchanged — a legend swatch is a real node with a
real kind and no role, and writing it would put a ghost `<task>` into the file —
but until now it happened in silence, and a free shape, a caption or a process
drawn before roles existed (2026-08-26) simply vanished from the download with
nothing said.

It is now said twice. The export report gains one line —
"_N element(s) inside the pool are not BPMN elements and were left out of the
.bpmn file. Export SVG to get everything drawn in the pool._" — counted once for
the whole board and absent when nothing was left behind. And the Export BPMN XML
command's description says the same thing before the click, so the choice
between the two files is made in front of the download rather than after it.

Nothing about the file changes: the same board still produces the same bytes.
A neutral connector is still silent, because a connector with no role states
nothing and there was nothing to lose. Neither is a generated legend: a legend
is drawn inside the board it documents and is made of role-less glyphs on
purpose, so the group the legend gesture draws now carries a role of its own
(`core:legend` — no framework declares it, so no rule and no legend row reads
it) and the count skips that group and everything under it. A legend drawn
before this ships carries no such group and is still counted.

**One English fallback changed**: `com.labre.commands.bpmn.exportXml.description`
now ends with "Only BPMN artefacts are written; export SVG to get everything
drawn in the pool." A host that translated it should revisit its own wording.
One key is new, `com.labre.bpmn.export.warning.left-out`.
