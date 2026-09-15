---
'@labre/affine-model': patch
'@labre/affine-gfx-connector': patch
'@labre/affine-gfx-text': patch
'@labre/affine-gfx-uml': patch
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
  inner text. A text that carries a framework ROLE is a compartment and survives
  being emptied.
- **Morphing a classifier re-lays its compartments.** `«interface»` is a LINE
  (§9.5.4), so a class called `Ligne` becomes a two-line heading — and nothing
  re-fitted the box for it. The keyword is also written once now, never stacked
  on one that is already there.
- **A double-click aimed at an arrowhead opens that end's label.** The 24-unit
  grab of `docs/adr/0018` was unreachable: a connector answered for its line
  only, so the gesture reached no view and the editor's add-text-here handler
  dropped a stray text block at the arrowhead instead.
