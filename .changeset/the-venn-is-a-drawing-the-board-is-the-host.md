---
'@labre/affine-gfx-edgy': patch
'@labre/affine-block-surface': patch
'@labre/affine-model': patch
---

fix(edgeless): the edgy venn stops hosting the spotlight — board logic lives on
the edgy board

The EDGY "Enterprise Design Facets" Venn (`edgy`) was registered as a
spotlight host alongside the EDGY board (`edgyBoard`), so any element laid
inside its circles got the hover spotlight: hovering one faded everything else
on the diagram. That is board logic on a drawing. The Venn frames a notation;
it does not host a dependency reading.

`SpotlightHostExtension('edgy')` is gone and the "Enable / disable hover
spotlight" toggle has left the Venn's contextual toolbar. The board keeps both,
unchanged. The Venn keeps its appearance toggles — labels, pictos, crop,
resize — plus its legend, which moves from `d.legend` to `c.legend` now that
the row is one shorter.

`spotlightEnabled` STAYS on `EdgyFacetsElementModel`: documents written before
this change carry the property and must stay loadable. It is simply inert —
nothing reads it on a Venn any more.

The host lookup `SpotlightManager` runs on every pointermove is now the
exported pure `findSpotlightHost(target, elements, hostTypes)`, so the rule a
Venn grants nothing and a board grants is pinned by a unit test rather than by
a DI registration read by eye.

Refs #195
