# @labre/affine-gfx-bpmn

## 0.23.1

### Patch Changes

- Updated dependencies [1beb60e]
  - @labre/affine-shared@0.23.1
  - @labre/affine-block-surface@0.23.1
  - @labre/affine-components@0.23.1
  - @labre/affine-gfx-connector@0.23.1
  - @labre/affine-gfx-group@0.23.1
  - @labre/affine-gfx-pointer@0.23.1
  - @labre/affine-gfx-shape@0.23.1
  - @labre/affine-gfx-template@0.23.1
  - @labre/affine-widget-edgeless-toolbar@0.23.1
  - @labre/affine-ext-loader@0.23.1
  - @labre/affine-model@0.23.1
  - @labre/global@0.23.1
  - @labre/std@0.23.1
  - @labre/store@0.23.1

## 0.23.0

### Minor Changes

- 9014c87: Add a BPMN process framework (v1, lean) to the edgeless editor. A new
  `@labre/affine-gfx-bpmn` package adds a senior-toolbar BPMN button whose menu
  drops the core BPMN basics onto the canvas:

  - start event (thin green ring), end event (thick red ring), task (rounded
    rectangle with editable label) and exclusive gateway (diamond with an X) -
    all native shapes (editable stroke / fill / text, native resize);
  - a sequence-flow item that arms the native connector tool pre-styled solid
    with a filled triangle head;
  - a pool background container (rounded-rect frame + editable vertical name
    band), with a resize-lock toggle in its element toolbar.

  Visual style is "hybrid": spec-accurate shapes and line weights with accent
  colour only on the event rings. Wired behind a `bpmn` block flag (ships dark
  until the host enables it). Out of scope for v1: intermediate / parallel /
  inclusive gateways, message & association flows, pool lanes, sub-process, data
  objects and task-type icons.

- d2f435f: Turn the edgeless template panel into a per-framework catalog of worked-example
  diagrams and prefab components. Each framework package contributes its own
  category (Wardley, EDGY, Cynefin, Estuarine, BPMN) via a new
  `extendTemplateCategory` helper, and a generic "Other" category (SWOT, Kanban,
  Business Model Canvas, Fishbone, Gantt) ships from the template package. Every
  template is composed only from existing shapes — the framework's own prefab
  shapes first, general BlockSuite shapes second — so dragging a card inserts real,
  editable elements.

  The templates senior-toolbar button now renders last (new optional `order` on
  `SeniorTool`), and the playground's placeholder cat stickers are removed.

### Patch Changes

- Updated dependencies [9014c87]
- Updated dependencies [c775151]
- Updated dependencies [d2f435f]
  - @labre/affine-model@0.23.0
  - @labre/affine-block-surface@0.23.0
  - @labre/affine-shared@0.23.0
  - @labre/affine-gfx-template@0.23.0
  - @labre/affine-widget-edgeless-toolbar@0.23.0
  - @labre/affine-components@0.23.0
  - @labre/affine-gfx-connector@0.23.0
  - @labre/affine-gfx-group@0.23.0
  - @labre/affine-gfx-pointer@0.23.0
  - @labre/affine-gfx-shape@0.23.0
  - @labre/affine-ext-loader@0.23.0
  - @labre/global@0.23.0
  - @labre/std@0.23.0
  - @labre/store@0.23.0
