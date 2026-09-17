---
'@labre/affine-gfx-edgy': minor
'@labre/affine-gfx-c4': minor
'@labre/affine-gfx-uml': minor
---

EDGY, C4 and UML derive their automatic legend from their own commands instead of a table beside them: each entry of the toolbox subscribes the row its artefact draws, and the shared engine scans the board, orders the rows, groups them under the section keys already shipped and draws the box. The rows, the swatches and the wording are unchanged — a UML row still draws the real class, actor or hollow diamond, an EDGY row still shows its facet's fill, a C4 row still reads its role's name — and the one `FrameworkLegendCreated` event keeps its historical values (`uml` still reports `module: 'uml toolbox'`). Two readings move with the command order they now follow: C4 lists Component before Database and its Relations section before Frames, and UML lists its elements in the order the sub-menu offers them. The Legend button of the two EDGY frames leaves the always-on toolbar for the flag-gated one, beside Validation: generating a legend is tooling, while the legend it wrote is content and keeps being painted with the flag off.
