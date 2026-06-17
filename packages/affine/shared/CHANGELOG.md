# @labre/affine-shared

## 0.23.1

### Patch Changes

- 1beb60e: feat(edgeless): injectable `LinkedDocCreationProvider`

  Adds a DI seam (mirrors `DocModeProvider`) so a host app can control how the
  edgeless "Create linked doc" action creates its new doc — e.g. to route creation
  through a persistence layer instead of an ephemeral in-workspace doc.
  `createLinkedDocFromEdgelessElements` resolves it via `std.getOptional` and falls
  back to the previous behaviour when no provider is registered.

  - @labre/affine-model@0.23.1
  - @labre/global@0.23.1
  - @labre/std@0.23.1
  - @labre/store@0.23.1

## 0.23.0

### Patch Changes

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

- Updated dependencies [9014c87]
- Updated dependencies [c775151]
  - @labre/affine-model@0.23.0
  - @labre/global@0.23.0
  - @labre/std@0.23.0
  - @labre/store@0.23.0
