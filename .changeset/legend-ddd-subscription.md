---
'@labre/affine-gfx-ddd-context-map': minor
'@labre/affine-gfx-ddd-core-domain': minor
'@labre/affine-gfx-ddd-event-storming': minor
---

The three DDD frameworks subscribe their legend instead of tabulating it: Context Map, Event Storming and the Core Domain Chart no longer keep a hand-written table beside their commands — each command that draws an artefact declares the row it puts in the board's legend, and the shared engine derives the box from the framework's own commands, in their order, filtered by what is actually drawn. Same rows, same labels, same sub-titles, same i18n keys.

One visible change: the Legend button moves from the always-on contextual toolbar to each framework's flag-gated row, beside Validation. Turning the framework off now takes the button away, while every legend already drawn keeps being painted.
