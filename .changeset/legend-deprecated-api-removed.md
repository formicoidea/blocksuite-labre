---
'@labre/affine-block-surface': patch
'@labre/affine-gfx-ddd-shared': patch
'@labre/affine-gfx-edgy': patch
---

The table-shaped legend API is removed, now that every framework subscribes its rows to the catalogue (ADR 0026). Gone from `@labre/affine-block-surface`: `AutoLegendSpec`, `AutoLegendSectionSpec`, `AutoLegendEntry`, `autoLegendSections`, `createAutoLegend` and `roleLabel`. Gone from `@labre/affine-gfx-ddd-shared`: the whole `shared/legend-auto.ts` re-export module (those six plus `rolesInBound`), the deprecated `addLegend` / `measureLegend` / `LegendLayout` / `LegendRow` / `LegendSection` re-exports in `shared/prefabs.ts`, and `dddLegendIcon`. All of them had moved to `@labre/affine-block-surface` and were kept only so the frameworks could migrate one at a time; import `createBoardLegend`, `legendFromCommands`, `rolesInBound`, `addLegend`, `measureLegend` and `legendIcon` from there. `LABEL_COLOR`, `LABEL_FONT` and `LABEL_FONT_SIZE` are now declared once, by the surface block, and re-exported by `@labre/affine-gfx-ddd-shared` under the same names. EDGY no longer depends on the DDD bundle at all.
