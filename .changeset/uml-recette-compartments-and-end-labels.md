---
'@labre/affine-model': minor
'@labre/affine-block-surface': patch
'@labre/affine-gfx-connector': patch
'@labre/affine-gfx-text': patch
'@labre/affine-gfx-uml': patch
'@labre/affine-widget-edgeless-toolbar': patch
---

fix(edgeless): uml compartments, empty tiers and connector end labels

Four things the PO's manual recette of the UML framework found:

- **A classifier now grows to the height it is actually PAINTED at.** A tier
  wraps its words at the compartment's width, and the box was sized from the
  author's newlines alone — so one long attribute line was drawn through the
  separator under it and the node never grew for it. The line count is now the
  renderer's own wrap.
- **A compartment emptied to its placeholder stays.** A canvas text with no
  words was deleted on commit, which took a classifier's whole name compartment
  out of its group and left the next double-click opening the shape's invisible
  inner text. A text that carries a framework ROLE **and a fixed width** is a
  compartment tier and survives being emptied; a roled label sized to its own
  words — a Wardley component's name, a BPMN task's — still goes.
- **Morphing a classifier re-lays its compartments.** `«interface»` is a LINE
  (§9.5.4), so a class called `Ligne` becomes a two-line heading — and nothing
  re-fitted the box for it. The keyword is also written once now, never stacked
  on one that is already there.
- **A double-click aimed at an arrowhead opens that end's label.** The 24-unit
  grab of `docs/adr/0018` was unreachable: a connector answered for its line
  only, so the gesture reached no view and the editor's add-text-here handler
  dropped a stray text block at the arrowhead instead. Only a connector a
  framework typed claims the discs — a plain arrow keeps its hairline — and each
  disc stops at the box of the element the end is bound to, a note or a frame as
  much as a shape.
- **A board moved over a peer board no longer hides its own content.** Clearing
  the board it overlaps raised it just above the topmost background it covered,
  which for a UML diagram frame was the subject drawn inside it.
- **A framework's toolbox re-ranks when it is reopened.** The popover was cached
  on the way out and handed straight back on the way in, so a command that had
  just earned its seat — an import, say — only appeared after a reload.
