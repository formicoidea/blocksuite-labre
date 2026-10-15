---
'@labre/data-view': minor
'@labre/affine-components': patch
'@labre/affine-gfx-wardley': patch
'@labre/affine-gfx-bpmn': patch
'@labre/affine-gfx-c4': patch
'@labre/affine-gfx-cynefin-estuarine': patch
'@labre/affine-gfx-ddd-context-map': patch
'@labre/affine-gfx-ddd-core-domain': patch
'@labre/affine-gfx-ddd-event-storming': patch
'@labre/affine-gfx-edgy': patch
---

The database colour grid (a select option's colour, a conditional colour rule's, the kanban group header's) now pages like the canvas colour picker: the ten chip colours stay on the first page, then one page per framework whose tooling is on, its colours softened into chip colours that read in light and dark (ADR 0036 amendment of 2026-10-14, "framework pages"). A framework switched off offers no page; a colour picked from it keeps painting.

- A softened colour is stored as one string, `color-mix(in srgb, #rrggbb NN%, var(--affine-v2-layer-background-primary))`: 30% of the framework colour, or, for a colour that is already pastel, the share that keeps its light look exactly. Every swatch carries primary text above WCAG AA in both themes (8.8:1 light, 5.4:1 dark at worst). A host theme must keep the `--affine-v2-layer-background-primary` name defined in both schemes (the Labre theme's `--affine-*` aliases do).
- A conditional colour rule now paints such a value too, through a strict check of that exact shape (`isSoftenedChipColor`); any other unknown value is still refused. Picking a first-page colour writes exactly what it wrote before.
- New exports from `@labre/data-view`: `softenedChipColor`, `isSoftenedChipColor`, `SOFTENED_BACKGROUND_TOKEN`, `SOFTENED_SHARE`, `PASTEL_MAX_SHARE`, `softenedFrameworkPalettes`, `selectOptionColorPages`, `DataViewColorCarousel` (`<dv-color-carousel>`, registered by `coreEffects`); `selectOptionColorGrid` and `TagSelectOptions` take an optional `std`. From `@labre/affine-components/color-picker`: `contributedFrameworkPalettes(std)`.
- Every framework palette (`FrameworkPaletteExtension`) now registers in the page scope as well as the edgeless one, still from the flag-gated view extension.
