---
'@labre/affine-gfx-ddd': minor
'@labre/affine': minor
---

feat(edgeless): add Domain-Driven Design framework tools

Three independently flag-gated edgeless senior buttons — Event Storming
(Brandolini colour-coded stickies), Core Domain Chart (a new drawn background
element + sub-domain dots, movement arrows and a Notation legend) and Context
Map (bounded-context bubbles + the nine relationship patterns) — plus
dedicated Templates-panel sections: one per senior button (Event Storming,
Core Domain Chart, Context Map) and a standalone Aggregate Design Canvas.

All three sub-menus compose the same shared prefab builders (sticky, dot,
bubble, connector, group) over native shape/connector/text/group elements, so
only the Core Domain Chart background adds a new element model. Flags:
`ddd-event-storming`, `ddd-core-domain`, `ddd-context-map`, `ddd-templates`.

A senior-button flag gates only its toolbar button: Core Domain Chart
rendering (element view, painter, interaction and contextual toolbar) is
always registered, so disabling `ddd-core-domain` no longer un-paints existing
charts, and Templates-panel insertion still renders them.
