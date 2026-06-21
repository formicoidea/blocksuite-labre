# @labre/affine-gfx-ddd

## 0.24.0

### Minor Changes

- bc31490: feat(edgeless): add Domain-Driven Design framework tools

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

### Patch Changes

- Updated dependencies [bc31490]
  - @labre/affine-gfx-template@0.24.0
  - @labre/affine-block-surface@0.24.0
  - @labre/affine-ext-loader@0.24.0
  - @labre/affine-gfx-group@0.24.0
  - @labre/affine-gfx-pointer@0.24.0
  - @labre/affine-model@0.24.0
  - @labre/affine-shared@0.24.0
  - @labre/affine-widget-edgeless-toolbar@0.24.0
  - @labre/global@0.24.0
  - @labre/std@0.24.0
  - @labre/store@0.24.0
