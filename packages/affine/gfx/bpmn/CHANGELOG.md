# @labre/affine-gfx-bpmn

## 0.30.0

### Patch Changes

- ecba791: Per-framework text-fit defaults. Event Storming stickies and Context Map
  bubbles now carry their label as the shape's own text (contained /
  overflow fit) instead of a separate grouped text element — double-click
  edits in place and the box never deforms; previously created prefabs keep
  their old structure and keep working. Estuarine hexi constraints default
  to contained; BPMN nodes and the Wardley inertia bar default to overflow.
- Updated dependencies [9d0fe0c]
- Updated dependencies [ecba791]
- Updated dependencies [8de86f4]
  - @labre/std@0.30.0
  - @labre/affine-model@0.30.0
  - @labre/affine-gfx-shape@0.30.0
  - @labre/affine-block-surface@0.30.0
  - @labre/affine-components@0.30.0
  - @labre/affine-gfx-connector@0.30.0
  - @labre/affine-gfx-group@0.30.0
  - @labre/affine-gfx-pointer@0.30.0
  - @labre/affine-gfx-template@0.30.0
  - @labre/affine-shared@0.30.0
  - @labre/affine-widget-edgeless-toolbar@0.30.0
  - @labre/affine-ext-loader@0.30.0
  - @labre/global@0.30.0
  - @labre/store@0.30.0

## 0.29.1

### Patch Changes

- @labre/affine-block-surface@0.29.1
- @labre/affine-components@0.29.1
- @labre/affine-ext-loader@0.29.1
- @labre/affine-gfx-connector@0.29.1
- @labre/affine-gfx-group@0.29.1
- @labre/affine-gfx-pointer@0.29.1
- @labre/affine-gfx-shape@0.29.1
- @labre/affine-gfx-template@0.29.1
- @labre/affine-model@0.29.1
- @labre/affine-shared@0.29.1
- @labre/affine-widget-edgeless-toolbar@0.29.1
- @labre/global@0.29.1
- @labre/std@0.29.1
- @labre/store@0.29.1

## 0.29.0

### Patch Changes

- Updated dependencies [7375b9a]
- Updated dependencies [9330750]
  - @labre/affine-shared@0.29.0
  - @labre/std@0.29.0
  - @labre/affine-block-surface@0.29.0
  - @labre/affine-components@0.29.0
  - @labre/affine-gfx-connector@0.29.0
  - @labre/affine-gfx-group@0.29.0
  - @labre/affine-gfx-pointer@0.29.0
  - @labre/affine-gfx-shape@0.29.0
  - @labre/affine-gfx-template@0.29.0
  - @labre/affine-widget-edgeless-toolbar@0.29.0
  - @labre/affine-model@0.29.0
  - @labre/affine-ext-loader@0.29.0
  - @labre/global@0.29.0
  - @labre/store@0.29.0

## 0.28.0

### Patch Changes

- Updated dependencies [65cc055]
  - @labre/std@0.28.0
  - @labre/affine-block-surface@0.28.0
  - @labre/affine-components@0.28.0
  - @labre/affine-gfx-connector@0.28.0
  - @labre/affine-gfx-group@0.28.0
  - @labre/affine-gfx-pointer@0.28.0
  - @labre/affine-gfx-shape@0.28.0
  - @labre/affine-gfx-template@0.28.0
  - @labre/affine-model@0.28.0
  - @labre/affine-shared@0.28.0
  - @labre/affine-widget-edgeless-toolbar@0.28.0
  - @labre/affine-ext-loader@0.28.0
  - @labre/global@0.28.0
  - @labre/store@0.28.0

## 0.27.0

### Patch Changes

- Updated dependencies [91f6397]
  - @labre/std@0.27.0
  - @labre/affine-block-surface@0.27.0
  - @labre/affine-components@0.27.0
  - @labre/affine-gfx-connector@0.27.0
  - @labre/affine-gfx-group@0.27.0
  - @labre/affine-gfx-pointer@0.27.0
  - @labre/affine-gfx-shape@0.27.0
  - @labre/affine-gfx-template@0.27.0
  - @labre/affine-model@0.27.0
  - @labre/affine-shared@0.27.0
  - @labre/affine-widget-edgeless-toolbar@0.27.0
  - @labre/affine-ext-loader@0.27.0
  - @labre/global@0.27.0
  - @labre/store@0.27.0

## 0.26.0

### Patch Changes

- 6795191: fix(edgeless): keep mobile canvas toolbars within the viewport

  On narrow (mobile) viewports two canvas toolbars overflowed off-screen,
  hiding actions:

  - The selected-element contextual toolbar grew to `max-content` with no
    upper bound. It is now capped to the available viewport width (floating-ui
    `size` middleware) and wraps to a second row instead of overflowing. (A
    scroll container was avoided on purpose: the "More" dropdown is a descendant
    of the toolbar, so `overflow` would clip it and make it unclickable.)
  - The senior framework slide-menu was sized to `max-width: calc(100vw - 16px)`
    but right-aligned to a center-ish toolbar button, so a near-full-width menu
    hung off the LEFT edge on mobile. It is now centered on the main toolbar and
    capped to 95% of the toolbar's width (the existing slide-menu scroll handles
    any remaining overflow), via a shared `clampSeniorMenuToToolbar` helper that
    replaces the duplicated inline positioning in all six framework senior
    buttons (Wardley, BPMN, Cynefin, EDGY, Mind Map, DDD). Desktop is unaffected
    since those menus are narrower than the cap.

- Updated dependencies [8960a6c]
- Updated dependencies [6795191]
  - @labre/affine-model@0.26.0
  - @labre/affine-components@0.26.0
  - @labre/affine-block-surface@0.26.0
  - @labre/affine-gfx-connector@0.26.0
  - @labre/affine-gfx-group@0.26.0
  - @labre/affine-gfx-pointer@0.26.0
  - @labre/affine-gfx-shape@0.26.0
  - @labre/affine-gfx-template@0.26.0
  - @labre/affine-shared@0.26.0
  - @labre/affine-widget-edgeless-toolbar@0.26.0
  - @labre/affine-ext-loader@0.26.0
  - @labre/global@0.26.0
  - @labre/std@0.26.0
  - @labre/store@0.26.0

## 0.25.0

### Patch Changes

- 6795191: fix(edgeless): keep mobile canvas toolbars within the viewport

  On narrow (mobile) viewports two canvas toolbars overflowed off-screen,
  hiding actions:

  - The selected-element contextual toolbar grew to `max-content` with no
    upper bound. It is now capped to the available viewport width (floating-ui
    `size` middleware) and wraps to a second row instead of overflowing. (A
    scroll container was avoided on purpose: the "More" dropdown is a descendant
    of the toolbar, so `overflow` would clip it and make it unclickable.)
  - The senior framework slide-menu was sized to `max-width: calc(100vw - 16px)`
    but right-aligned to a center-ish toolbar button, so a near-full-width menu
    hung off the LEFT edge on mobile. It is now centered on the main toolbar and
    capped to 95% of the toolbar's width (the existing slide-menu scroll handles
    any remaining overflow), via a shared `clampSeniorMenuToToolbar` helper that
    replaces the duplicated inline positioning in all six framework senior
    buttons (Wardley, BPMN, Cynefin, EDGY, Mind Map, DDD). Desktop is unaffected
    since those menus are narrower than the cap.

- Updated dependencies [8960a6c]
- Updated dependencies [6795191]
  - @labre/affine-model@0.25.0
  - @labre/affine-components@0.25.0
  - @labre/affine-block-surface@0.25.0
  - @labre/affine-gfx-connector@0.25.0
  - @labre/affine-gfx-group@0.25.0
  - @labre/affine-gfx-pointer@0.25.0
  - @labre/affine-gfx-shape@0.25.0
  - @labre/affine-gfx-template@0.25.0
  - @labre/affine-shared@0.25.0
  - @labre/affine-widget-edgeless-toolbar@0.25.0
  - @labre/affine-ext-loader@0.25.0
  - @labre/global@0.25.0
  - @labre/std@0.25.0
  - @labre/store@0.25.0

## 0.24.0

### Patch Changes

- Updated dependencies [bc31490]
  - @labre/affine-gfx-template@0.24.0
  - @labre/affine-block-surface@0.24.0
  - @labre/affine-components@0.24.0
  - @labre/affine-ext-loader@0.24.0
  - @labre/affine-gfx-connector@0.24.0
  - @labre/affine-gfx-group@0.24.0
  - @labre/affine-gfx-pointer@0.24.0
  - @labre/affine-gfx-shape@0.24.0
  - @labre/affine-model@0.24.0
  - @labre/affine-shared@0.24.0
  - @labre/affine-widget-edgeless-toolbar@0.24.0
  - @labre/global@0.24.0
  - @labre/std@0.24.0
  - @labre/store@0.24.0

## 0.23.3

### Patch Changes

- Updated dependencies
  - @labre/affine-shared@0.23.3
  - @labre/affine-block-surface@0.23.3
  - @labre/affine-components@0.23.3
  - @labre/affine-gfx-connector@0.23.3
  - @labre/affine-gfx-group@0.23.3
  - @labre/affine-gfx-pointer@0.23.3
  - @labre/affine-gfx-shape@0.23.3
  - @labre/affine-gfx-template@0.23.3
  - @labre/affine-widget-edgeless-toolbar@0.23.3
  - @labre/affine-ext-loader@0.23.3
  - @labre/affine-model@0.23.3
  - @labre/global@0.23.3
  - @labre/std@0.23.3
  - @labre/store@0.23.3

## 0.23.2

### Patch Changes

- Updated dependencies [ee682da]
  - @labre/affine-shared@0.23.2
  - @labre/affine-block-surface@0.23.2
  - @labre/affine-components@0.23.2
  - @labre/affine-gfx-connector@0.23.2
  - @labre/affine-gfx-group@0.23.2
  - @labre/affine-gfx-pointer@0.23.2
  - @labre/affine-gfx-shape@0.23.2
  - @labre/affine-gfx-template@0.23.2
  - @labre/affine-widget-edgeless-toolbar@0.23.2
  - @labre/affine-ext-loader@0.23.2
  - @labre/affine-model@0.23.2
  - @labre/global@0.23.2
  - @labre/std@0.23.2
  - @labre/store@0.23.2

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
