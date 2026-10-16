---
'@labre/affine-block-surface': minor
'@labre/affine-shared': minor
'@labre/affine-components': patch
'@labre/data-view': patch
'@labre/affine-gfx-bpmn': minor
'@labre/affine-gfx-c4': minor
'@labre/affine-gfx-cynefin-estuarine': minor
'@labre/affine-gfx-ddd-context-map': minor
'@labre/affine-gfx-ddd-core-domain': minor
'@labre/affine-gfx-ddd-event-storming': minor
'@labre/affine-gfx-edgy': minor
'@labre/affine-gfx-shape': patch
'@labre/affine-gfx-uml': minor
'@labre/affine-gfx-wardley': minor
'@labre/affine-widget-edgeless-auto-connect': patch
'@labre/affine-widget-edgeless-selected-rect': patch
'@labre/affine-widget-keyboard-toolbar': patch
'@labre/affine-widget-linked-doc': patch
---

Dark canvas for the notations (ADR 0039). With `data-theme="dark"` the framework boards are no longer white cards: the paper and the inks drawn on it resolve at paint time through `NOTATION_NEUTRALS_DARK` and each framework's `NotationDarkPaletteExtension`, while the hues of every standard (EDGY's facets, the C4 ladder) stay as drawn. Nothing stored changes, a colour typed by hand is painted as stored, and the SVG export always paints light. New exports: `NOTATION_NEUTRALS_DARK` (`@labre/affine-shared/consts`), `NotationTint`, `notationColor`, `NotationDarkPaletteExtension` and `CanvasRenderer.withColorScheme` / `getInkColorValue` (`@labre/affine-block-surface`). The chrome's last hard-coded light colours (data-view drag bars, colour picker caption, menu input focus ring, scrollbar thumb, `@` menu mask, auto-connect navigator, auto-complete arrows, keyboard toolbar pressed state) now go through theme tokens.
