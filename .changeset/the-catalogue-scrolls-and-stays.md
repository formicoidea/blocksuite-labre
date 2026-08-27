---
'@labre/affine-widget-edgeless-toolbar': patch
'@labre/affine-shared': patch
---

The catalogue scrolls under the wheel, stays open while furnishing, and can be switched off

Three PO-recette corrections (27/08/2026). A wheel over the sidepanel now
scrolls the artefact list instead of panning the board behind it — the same
capture-phase fix the violation bubble earned in PR #103, scoped to the
panel's own box so the canvas beside it keeps panning. Inserting an artefact
no longer closes the panel: furnishing a diagram is several artefacts in a
row, and the exits (close button, Escape, click-away) are all still one
gesture. And `ArtefactCatalogueExtension(null)` is now the documented
cold-assembly switch-off: the provider answers nothing, the "More artefacts"
button is not rendered, the library panel never opens.
