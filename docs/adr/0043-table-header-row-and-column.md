# ADR 0043 — The simple table marks a header row and a header column

- Status: **accepted** (2026-10-26)
- Deciders: Mathieu Jolly
- **Red zone**: stored format (`packages/affine/model`, block `affine:table`).
  Approved by the maintainer before the code.
- Related ADRs: [0009](0009-reversed-flag-contract.md) (a flag never gates
  content), [0031](0031-canvas-layers-hide-and-grid.md) (`hiddenForEveryone`,
  the "true or absent, never false" precedent),
  [0037](0037-image-crop-is-a-view.md) (an optional key an older client
  ignores).

## Context

The simple table (`affine:table`, `isFlatData: true`) stores `rows`,
`columns` (each with an optional `width` and `backgroundColor`), `cells` and
`comments`. It has no notion of a header: every cell renders the same, the
HTML export puts every row in a `<tbody>` of `<td>`, and the importers fold a
header into an ordinary row — a GFM table, which always has a header row,
loses it on the way in.

Architects build comparison grids and RACI matrices where the first row (and
often the first column) names what the others hold. They need that row to
read as a header, on screen and in what the editor exports.

## Decision

### Two optional flags on `affine:table`

```ts
interface TableBlockProps {
  // …unchanged
  headerRow?: true; // the first row is a header
  headerColumn?: true; // the first column is a header
}
```

- Both default to `undefined` in the schema, so the sync controller never
  writes them into a document that opens (a default other than `undefined`
  would be written into every table on first load). A table CREATED from now
  on carries both keys with an `undefined` value, because the store's creation
  path writes every prop of a flat block (`store/src/model/store/crud.ts`,
  already the case for `comments`); `undefined` is not `false`, reads as off
  and vanishes from every JSON snapshot.
- **`true` or absent, never `false`**, as `hiddenForEveryone` (ADR 0031): the
  toggle writes `true` to turn it on and deletes the key to turn it off. A
  reader treats anything but `true` as off.
- **Positional**: the header is whatever row or column is first in display
  order. Moving a row to the top makes it the header; no row id is stored, so
  there is nothing to keep in sync when rows are reordered, duplicated or
  deleted.
- One gesture is one undo step: the setter calls `captureSync()` before its
  transaction and writes nothing when the value does not change. Every setter
  checks `store.readonly` first.

### Rendering

Cells stay `<td>` (the selection and rectangle helpers query `td`); a header
cell carries `data-header` and a class that sets `font-weight: 600` and the
`table.headerBackground.default` theme token. An explicit row or column
background still wins over the header tint.

### Adapters

- **Markdown import** sets `headerRow: true`: GFM has no table without a
  header row, so the first row of an imported table always was one.
- **Markdown export** is unchanged: it already writes the first row as the
  GFM header, whatever the flag says (GFM cannot express a table without one).
- **HTML import** sets `headerRow: true` when the source table has a
  `<thead>`.
- **HTML export** writes the first row as `<thead><tr><th>` when `headerRow`
  is set, and the first cell of each row as `<th>` when `headerColumn` is set.
- The clipboard carries both keys through the snapshot like any other prop.

## Consequences

- Every existing document loads unchanged: no key is added on open, no
  migration, schema version unchanged.
- An older client (0.58 and before) ignores the two keys: it paints the table
  without a header and keeps the keys when it edits other props.
- Hosts see one behaviour change: a Markdown table imported or pasted now
  shows a bold, tinted first row. No seam, no flag, no new translation the
  host must supply (the two menu labels ship English fallbacks:
  `com.labre.table.header-row`, `com.labre.table.header-column`).
- A header that is not the first row (a header in the middle of a table) is
  not expressible; that would be a per-row field and another ADR.
