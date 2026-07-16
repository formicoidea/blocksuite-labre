# @labre/affine-model

## 0.29.1

### Patch Changes

- @labre/global@0.29.1
- @labre/std@0.29.1
- @labre/store@0.29.1

## 0.29.0

### Patch Changes

- Updated dependencies [9330750]
  - @labre/std@0.29.0
  - @labre/global@0.29.0
  - @labre/store@0.29.0

## 0.28.0

### Patch Changes

- Updated dependencies [65cc055]
  - @labre/std@0.28.0
  - @labre/global@0.28.0
  - @labre/store@0.28.0

## 0.27.0

### Patch Changes

- Updated dependencies [91f6397]
  - @labre/std@0.27.0
  - @labre/global@0.27.0
  - @labre/store@0.27.0

## 0.26.0

### Minor Changes

- 8960a6c: feat(database): pluggable DataSource for affine:database (injection seam)

  The inline database block (`affine:database`) always built its own
  `DatabaseBlockDataSource`, so a host app could not back it with an external
  source. This adds a minimal, backward-compatible injection seam:

  - New optional model prop `externalSourceId?: string` (schema version 3 → 4;
    no runtime migration — optional prop with a default).
  - New `DatabaseDataSourceProvider` identifier (exported from
    `@labre/affine-block-database`). When a host registers it **and** the block
    carries an `externalSourceId`, the block renders via the injected source.

  With no provider registered and no `externalSourceId`, behavior is identical to
  before. Persistence stays entirely host-side.

### Patch Changes

- @labre/global@0.26.0
- @labre/std@0.26.0
- @labre/store@0.26.0

## 0.25.0

### Minor Changes

- 8960a6c: feat(database): pluggable DataSource for affine:database (injection seam)

  The inline database block (`affine:database`) always built its own
  `DatabaseBlockDataSource`, so a host app could not back it with an external
  source. This adds a minimal, backward-compatible injection seam:

  - New optional model prop `externalSourceId?: string` (schema version 3 → 4;
    no runtime migration — optional prop with a default).
  - New `DatabaseDataSourceProvider` identifier (exported from
    `@labre/affine-block-database`). When a host registers it **and** the block
    carries an `externalSourceId`, the block renders via the injected source.

  With no provider registered and no `externalSourceId`, behavior is identical to
  before. Persistence stays entirely host-side.

### Patch Changes

- @labre/global@0.25.0
- @labre/std@0.25.0
- @labre/store@0.25.0

## 0.24.0

### Patch Changes

- @labre/global@0.24.0
- @labre/std@0.24.0
- @labre/store@0.24.0

## 0.23.3

### Patch Changes

- @labre/global@0.23.3
- @labre/std@0.23.3
- @labre/store@0.23.3

## 0.23.2

### Patch Changes

- @labre/global@0.23.2
- @labre/std@0.23.2
- @labre/store@0.23.2

## 0.23.1

### Patch Changes

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

### Patch Changes

- c775151: Update the Estuarine map background to the latest artwork (reference space
  690×801): darker magenta axes (#941253) with larger arrowheads, the Volatile
  boundary redrawn as an explicit curve (instead of a half-circle arc), refreshed
  Liminal / Counter-factual curves, and letter-spaced legends with their own
  colours (green LIMINAL, red VOLATILE, dark COUNTER FACTUAL, red italic e / t
  axis letters). The per-curve and axis-label toggles are unchanged.
  - @labre/global@0.23.0
  - @labre/std@0.23.0
  - @labre/store@0.23.0
