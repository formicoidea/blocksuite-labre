---
'@labre/affine-gfx-bpmn': patch
'@labre/affine': patch
---

feat(edgeless): the BPMN descriptive profile gets its toolbox

The previous release taught the pack to DRAW the descriptive conformance
subclass of BPMN 2.0 — seventeen artefacts, twenty-five roles, every glyph the
notation asks for. It shipped no way to reach them: the palette still offered the
four basics, and the other thirteen existed only for a document that already
contained one. This release is the other half. **Fifteen commands** join the
eight that were there, and the BPMN toolbox goes from 8 entries to **23**.

Thirteen of them create an artefact: the **message** and **timer** starts, the
**message** and **terminate** ends, the **user** and **service** tasks, the
**sub-process** and the **call activity**, the **parallel gateway**, the **data
object**, the **data store**, the **text annotation** and the **group**. Two arm
a tool:

- the **message flow** — dashed, an open circle where the message leaves and an
  open arrowhead where it lands, which is exactly how BPMN tells it from the
  sequence flow. Its role (`bpmn:message-flow`) was declared last release and
  stamped by nothing; this tool is what finally writes it, so the arrow is born
  saying "sends a message to" rather than acquiring the sentence afterwards;
- the **association** — dashed, and with no head at either end. That absence is
  the point: an association names no relation, so there is no direction for
  either end to be wrong about, and an arrowhead would be the picture claiming
  one the vocabulary explicitly refuses.

One simplification, noted in the code: the spec draws the association DOTTED and
this editor has no dotted stroke (and no stroke thinner than the message flow's —
a connector's width is a closed enum), so the two share a line and the endpoints
carry the whole distinction. A message flow always shows its circle and its head;
an association never shows either.

**The catalogue now has sections.** All twenty-three entries used to be filed
under one heading called "flow", which is what a framework declares when it has
six things and no reason to sort them. They are now grouped as **events**,
**activities**, **gateways**, **flows**, **data**, **annotations** and
**swimlanes** — a framework naming its own sections, with a host's catalogue free
to translate every header.

**And BPMN is the first framework to outgrow its own sub-menu.** Twenty-three
entries against fourteen slots is exactly the case the senior menu was built for
last month: the popover now opens on the seven commands this user actually
reaches for, plus a permanent "More artefacts…" that opens the full catalogue
beside the board. Nothing is unreachable — every one of the twenty-three is in
the catalogue, in the command palette, bindable from Settings › Shortcuts and
available to the agent.

A new template card, **Message exchange**, ships with it: two participants
stacked, a sequence flow inside the first and a message flow crossing to the
second. It exists because that is the piece of BPMN people get wrong first — a
sequence flow may never leave its pool, and the thing that does leave is a
different statement drawn with a different line.
