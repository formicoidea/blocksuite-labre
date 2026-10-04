# ADR 0030 — Canvas text carries one decoration field; inline text gains overline

- Status: **accepted** (2026-10-04)
- Deciders: Mathieu Jolly
- Milestone: product decision "underline and overline on canvas text"
  (2026-10), first consumer the UML object name
- Related ADRs: [0009](0009-reversed-flag-contract.md) (a decoration is
  content: nothing here is gated),
  [0012](0012-framework-interchange-and-foreign-preservation.md) (unknown data
  is preserved; the PR #73 precedent), [0016](0016-hollow-endpoint-styles.md)
  (the precedent for an append-only vocabulary an older client degrades on),
  [0020](0020-connector-end-labels.md) (the end labels reuse `labelStyle`),
  [0023](0023-every-displayed-string-through-a-key.md) (every new wording is a
  key), [0025](0025-board-svg-export.md) (the canvas renderer is the SVG
  renderer).
- **Red zone.** One new optional stored prop on three existing surface
  elements (`text`, `shape`, and the connector's `labelStyle` object) in
  `packages/affine/model`, and one new attribute key inside `Y.Text` deltas.
  No change to `packages/framework/store` (see §5). Needs the maintainer's
  explicit approval before code.

## Context

The product decision is taken: canvas text gets **underline** and **overline**,
inline rich text gains **overline** (it already has underline), and the UML
object's name is **created underlined**, so the approximate rule the UML
renderer strokes today disappears.

What the code does today, verified:

- **The canvas text style has no decoration.** `TextStyleProps` is
  `color / fontFamily / fontSize / fontStyle / fontWeight / textAlign`
  (`packages/affine/model/src/consts/text.ts:20-27`). The text element declares
  exactly those as `@field()`s
  (`packages/affine/model/src/elements/text/text.ts:63-88`), the shape too
  (`packages/affine/model/src/elements/shape/shape.ts:158-177`, `229-230`), and
  the connector stores all six as ONE object, `labelStyle`
  (`packages/affine/model/src/elements/connector/connector.ts:670-678`), which
  the two end labels share (ADR 0020).
- **The three canvas renderers ignore delta attributes.** Each wraps the
  `Y.Text` into lines and paints every run's `delta.insert` with `fillText`,
  reading nothing from `delta.attributes`:
  text (`packages/affine/gfx/text/src/element-renderer/index.ts:56-86`), shape
  (`packages/affine/gfx/shape/src/element-renderer/shape/index.ts:145-173`),
  connector label (`packages/affine/gfx/connector/src/element-renderer/index.ts:310-382`).
  The shape and connector loops do not even advance `x` between two runs of a
  line (`shape/index.ts:160-165`, `connector/…/index.ts:355-379`); only the text
  renderer accumulates `beforeTextWidth` (`text/…/index.ts:57`, `80`). A line
  made of two differently formatted runs would paint its runs on top of each
  other in two of the three renderers.
- **The canvas editors cannot format runs.** All five canvas-side editors pass
  `.enableFormat=${false}` — text (`packages/affine/gfx/text/src/edgeless-text-editor.ts:524`),
  shape (`packages/affine/gfx/shape/src/text/edgeless-shape-text-editor.ts:555`),
  connector label (`packages/affine/gfx/connector/src/text/edgeless-connector-label-editor.ts:580`),
  group title and frame title — and `rich-text` then replaces its attribute
  schema with `z.object({})` (`packages/affine/rich-text/src/rich-text.ts:163-165`).
- **Bold and italic on the canvas are element-level, through one toolbar
  factory.** `createTextActions` (`packages/affine/gfx/text/src/toolbar/actions.ts:135-153`)
  is spread by the text, shape, connector and edgeless-text toolbars
  (`gfx/text/src/toolbar/config.ts:14`, `gfx/shape/src/toolbar/config.ts:395`,
  `gfx/connector/src/toolbar/config.ts:566`,
  `blocks/edgeless-text/src/edgeless-toolbar/config.ts:30`). Its `c.font-style`
  entry writes `{ fontWeight, fontStyle }` on the whole element through the
  per-type `update` callback (`actions.ts:300-326`); the connector's callback
  merges into `labelStyle` (`{ ...model.labelStyle, ...props }`,
  `gfx/connector/src/toolbar/config.ts:566-580`).
- **Inline underline already exists, and not in the store's red zone alone.**
  `underline` is declared in `baseTextAttributes`
  (`packages/framework/store/src/reactive/text/attributes.ts:6`) AND as an
  inline spec (`packages/affine/inlines/preset/src/inline-spec.ts:37-50`),
  toggled by `Mod-u` (`packages/affine/inlines/preset/src/command/config.ts:79-87`)
  and painted as CSS `text-decoration` (`packages/affine/shared/src/styles/text.ts:9-16`, `36`).
  The editor's schema is the INTERSECTION of `baseTextAttributes` and every
  registered spec's schema (`packages/framework/std/src/inline/extensions/inline-manager.ts:58-63`),
  and `color` / `background` live only in their specs
  (`inline-spec.ts:79-110`), never in the store.
- **The UML object underline is a rule under the name BOX.** For
  `kind === 'object'` the glyph strokes a line at the bottom of the name tier's
  box, as wide as the box (`packages/affine/gfx/uml/src/node/node-renderer.ts:216-226`).
  The name tier is a plain `text` element with role `uml:name`, created by
  `umlTextProps` with `hasMaxWidth: true` (`packages/affine/gfx/uml/src/presets.ts:325-342`),
  so the box is the compartment's width: the rule runs edge to edge under a
  short name rather than under the words.

## Decision

### 1. One optional element-level field, not per-run attributes

`TextStyleProps` gains one optional key:

```ts
/**
 * A CSS `text-decoration-line` token list. Stored, append-only VOCABULARY:
 * readers split on whitespace and act on the tokens they know.
 */
export enum TextDecoration {
  None = 'none',
  Underline = 'underline',
  Overline = 'overline',
  UnderlineOverline = 'underline overline',
}

export type TextStyleProps = {
  // …the six existing keys, unchanged
  textDecoration?: TextDecoration;
};
```

Stored where the other five style keys already are:

| element                     | where                                                           | default                                        |
| --------------------------- | --------------------------------------------------------------- | ---------------------------------------------- |
| `text`                      | `@field() accessor textDecoration: TextDecoration \| undefined` | `undefined` — never written (`field.ts:39-47`) |
| `shape` (its text)          | same accessor on `ShapeElementModel`                            | `undefined`                                    |
| connector, all three labels | the `textDecoration` key inside `labelStyle`                    | absent from the object                         |

`affine:edgeless-text` does **not** get the field: it is a block whose
paragraphs are rich text, so it receives overline through the inline schema
(§5), and its toolbar hides the toggle the way it already hides `d.font-size`
(`when: type !== 'edgeless-text'`, `actions.ts:364-365`).

**Why not per-run delta attributes** — the alternative, weighed and rejected:

- **Renderer cost.** It means rewriting three text layout loops, two of which
  cannot paint two runs on one line today (Context). Per-run decoration drags
  per-run positioning in with it.
- **It is a different product.** Honouring one attribute per run on the canvas
  means `enableFormat` on five editors, i.e. per-run bold, italic, colour and
  links on canvas text — a format bar on every sticky label. Nobody asked for
  that, and the canvas style model is element-level end to end (the toolbar
  factory, the last-used-style store, the morph presets).
- **Old clients do worse with it.** A 0.43 canvas editor runs with an empty
  attribute schema, so every insert is normalised to no attributes
  (`packages/framework/std/src/inline/services/text.ts:78-88`,
  `services/attribute.ts:64-77`): a word typed into a decorated run by an old
  client comes out undecorated. An element-level field is a key the old client
  never touches.
- **UML wants the whole name.** §9.8.4 underlines the instance specification's
  name, all of it; an element-level decoration is the notation's own unit.

The price, stated: one word cannot be underlined on its own on the canvas.
Rich text (notes, `affine:edgeless-text`) is where per-run formatting lives.

### 2. `'none'` is a value, and `undefined` means "never decided"

`undefined` (no key) and `'none'` paint the same for a `text`, a `shape` and a
connector label. They differ in one reader only — the UML legacy rule (§4) —
and that is the reason `'none'` exists: turning the decoration off writes
`'none'`, it does not clear the key.

### 3. The renderers draw the line from measured text, with `fillRect`

One helper in `@labre/affine-gfx-text`'s `element-renderer/utils.ts`, beside
`getLineWidth` and `getFontMetrics` (`utils.ts:139-192`), used by all three
renderers:

```ts
paintTextDecoration(ctx, {
  decoration, // the stored value, parsed into tokens
  lineText, // the string this line painted
  font, // the same font string the line was painted with
  x, // the x passed to fillText, with ctx.textAlign as set
  baselineY, // the ALPHABETIC baseline of that line
  fontFamily,
  fontSize,
  fontWeight,
  color, // the fill already resolved for the text
});
```

- **Width is measured, never the box.** `getLineWidth(lineText, font)` — the
  same measurement the wrap uses — and offset by `ctx.textAlign` (`center`
  draws from `x - w/2`, `right` from `x - w`). A centred name in a 280-unit
  compartment gets a line under its words, not across the compartment.
- **Height comes from the font.** Underline at `baselineY + max(1, fontSize *
0.08)`, overline at `baselineY - getFontMetrics(...).fontBoundingBoxAscent`,
  thickness `max(1, fontSize / 16)`. Canvas `TextMetrics` exposes no underline
  position, so the offsets are ratios of the size the renderer already reads,
  pinned by a unit test rather than tuned by eye.
- **Each caller passes the alphabetic baseline.** The three renderers set three
  different `textBaseline`s (`ideographic`, `text/…/index.ts:54`; `alphabetic`,
  `shape/index.ts:143`; `middle`, `connector/…/index.ts:347`); converting is the
  caller's job, from the metrics the shape renderer already reads
  (`shape/index.ts:122`, `136`).
- **`fillRect`, not `stroke`.** A rectangle ignores the `lineDash`, `lineCap`
  and `lineWidth` a shape renderer may have left on the context, and svgcanvas
  writes it as one `<rect>`: the SVG export (ADR 0025) carries the decoration
  with no change to the export, because the export IS this renderer.
- **RTL lines** are measured the same way; the `dir` dance the renderers do
  before `fillText` is reused, not duplicated.

The DOM twins show the same decoration as CSS `text-decoration-line`, from the
same stored string: the three canvas editors' overlay `styleMap`
(`edgeless-text-editor.ts:505-518`, `edgeless-shape-text-editor.ts:497`,
`edgeless-connector-label-editor.ts:564`), and
the connector DOM renderer's label `<div>`
(`packages/affine/gfx/connector/src/element-renderer/connector-dom/index.ts:303-330`).
The stored token list being CSS syntax is what makes those four sites a
one-line assignment.

### 4. UML: created underlined; the old rule survives only for old objects, at paint time

- **Creation.** `umlTextProps` gains `decoration?: TextDecoration` and the
  object kind's name tier is created with `textDecoration: 'underline'`. Every
  creation site that goes through the preset gets it for free — the toolbox
  (`packages/affine/gfx/uml/src/actions.ts:89-102`), the importers
  (`gfx/uml/src/import.ts`) and templates — which is
  CLAUDE.md's "one preset per artefact, read by creation and by morph".
- **Morph.** class → object writes `'underline'` on the name tier; object →
  class writes `'none'`. A morph is a local gesture and writes once.
- **The legacy rule becomes a paint-time fallback, not a migration.** The
  object glyph keeps stroking its rule (`node-renderer.ts:216-226`) **only
  when the name tier's `textDecoration` is `undefined`** — i.e. an object
  created before this ADR, or by an older client. As soon as the field holds
  any value (including `'none'`), the text renderer owns the decoration and the
  glyph draws no rule. `umlNodeCompartments` already reads the name tier
  (`node-renderer.ts:648-693`), so the check costs one property read on an
  element it has in hand.
- **Why no migration.** Writing `'underline'` on every existing object name at
  load would be a write on open, on every peer, including read-only ones — a
  cascade with no local gesture behind it, which the hard invariants forbid —
  and it would make documents differ byte-wise for nothing they display. The
  fallback costs one branch and keeps old objects looking exactly as they did.
- **Ceiling.** An old object keeps the approximate box-wide rule until its
  author touches the decoration toggle once. `ponytail:` comment at the
  fallback, naming that ceiling and the upgrade (a deliberate "normalise
  decorations" command, if ever asked).

### 5. Inline overline: an affine-level spec, no store change

- `overline?: true | null` joins `AffineTextStyleAttributes`
  (`packages/affine/shared/src/types/index.ts:39-47`).
- `OverlineInlineSpecExtension` joins `inline-spec.ts`, written exactly like
  `UnderlineInlineSpecExtension` (`inline-spec.ts:37-50`).
- `affineTextStyles` appends `overline` to the `text-decoration` it already
  composes (`shared/src/styles/text.ts:9-16`).
- `toggleOverline` beside `toggleUnderline` (`inline-preset/src/command/text-style.ts:71`),
  a format-bar entry beside underline's (`command/config.ts:79-87`), a new key
  `com.labre.text-format.overline` beside `com.labre.text-format.underline`
  (`packages/affine/shared/src/services/translation-service/chrome.ts:391`).
- **No default chord.** `Mod-u` is underline's; no chord is free of conflict on
  every platform and browser for overline, and the shortcuts pane lets a host
  bind one (`KeymapOverrideExtension`).
- HTML adapters read and write `text-decoration: overline` beside the
  underline matchers (`adapters/html/html-inline.ts:107-108`,
  `adapters/html/inline-delta.ts:60-67`). Markdown has no overline: the
  markdown export drops it, like any attribute markdown cannot say.

`baseTextAttributes` in `packages/framework/store` is **not** touched. The
editor schema is the intersection of the base and of every spec
(`inline-manager.ts:58-63`), and `color` / `background` already prove an
affine-level attribute needs nothing from the store. Underline sits in both
places for upstream reasons; overline does not have to copy that.

### 6. Toolbar and last-used style

- `createTextActions` gains one entry, two toggles (U̲, O̅), writing
  `{ textDecoration }` through the same per-type `update` the font style uses,
  so the connector writes it into `labelStyle` with no new branch.
- **Not a remembered style in v1.** `TextSchema` / `ShapeSchema` in
  `packages/affine/shared/src/utils/zod-schema.ts:144`, `150-165` are not
  extended: a
  decoration is emphasis on one label, not a house style, and remembering it
  would underline every next text after one emphatic one. Open point 3.

## What stays loadable

- **Old documents in a new client.** No key, so `undefined`, so no decoration
  — except a UML object name, which keeps its legacy rule (§4). Nothing is
  rewritten on open.
- **New documents in a 0.43 client.** A `text` / `shape` carrying
  `textDecoration` is an element with one undeclared key: it paints without
  the line, and the key survives copy, duplicate and turn-into-linked-doc
  through `_assignElementProp`
  (`packages/framework/std/src/gfx/model/surface/surface-model.ts:474-503`,
  PR #73). A connector's decoration lives inside `labelStyle`; the 0.43 toolbar
  restyles by spreading the stored object (`gfx/connector/src/toolbar/config.ts:566-580`),
  so changing the font in an old client keeps the decoration. A UML object
  created by a new client paints its rule in the 0.43 client (its glyph draws
  it unconditionally) and its name without the text decoration: one line,
  as before.
- **Overline in rich text, in a 0.43 client.** The run renders without the
  overline (the old schema normalises the key away for display,
  `services/render.ts:110`), the attribute stays in the `Y.Text`, and
  formatting the run with something else keeps it (`yText.format` sets only
  the keys it is given, `services/text.ts:36-50`). What is lost is narrower:
  characters an old client TYPES inside an overlined run are inserted with the
  attributes its own schema normalised (`services/text.ts:78-88`), so they come
  out plain. Degraded, never destroyed.
- **A token an older reader does not know** (a future `line-through`) is
  skipped token by token, never the whole value: `'underline line-through'`
  still paints its underline in this build. That is why readers parse tokens
  and do not `switch` on the string.

## Consequences

- **Four DOM sites and three canvas sites must agree.** The overlay editors
  and the connector DOM label read the field as CSS; the three renderers call
  `paintTextDecoration`. A unit spec asserts every site reads the field, the
  way `endpoint-style.unit.spec.ts` holds ADR 0016's two lists.
- **`TextDecoration` is append-only** and its docblock says so at the
  declaration, like `PointStyle` (ADR 0016) and `FontFamily`
  (`consts/text.ts:44-60`).
- **Two new keys** (`com.labre.text-format.overline`, the canvas toggle's
  label) and the host's catalogue owes their French; delivered as information,
  never by editing the host.
- **UML exporters are unaffected.** PlantUML and XMI write the object as an
  instance specification whatever the decoration; the underline is notation,
  not model.
- **Telemetry: none.** A style toggle is not a framework action and ADR 0003
  has no style events; adding one is out of scope.

## Alternatives rejected

- **Per-run delta attributes on canvas** — §1.
- **Two booleans, `underline?` and `overline?`** — two stored keys and two
  `clearField` paths for one concept, and the DOM sites would rebuild the CSS
  string the token list already is. Rejected on footprint.
- **An enum read by `switch`** — the next decoration would need the
  combinatorial members AND a newer reader to paint any of them. The token
  rule degrades one token at a time.
- **Keep the UML glyph rule for every object, add nothing for UML** — the rule
  measures the box, not the words, and is invisible to the text toolbar: an
  author could neither remove nor restyle it. The product decision removes it.
- **Migrate existing UML names to `'underline'` on load** — §4: a write on
  open, on every peer.
- **Declare `overline` in `baseTextAttributes`** — a red-zone edit in
  `packages/framework/store` for an attribute the affine layer can own, as
  `color` already does.

## Open points for the maintainer

1. Is the visual weight right — underline at `0.08 em` under the baseline,
   thickness `size / 16` — or should it follow a `DESIGN.md` token?
2. Does a `shape`'s decoration apply in `TextFitMode.Contained` at the shrunk
   size (it will, since the helper reads the effective size the renderer
   paints with, `shape/index.ts:109`), and is that the wanted reading?
3. Should the decoration join the last-used text style (`zod-schema.ts`), like
   `fontWeight` does?
4. Should overline get a default chord, and which?

Resolved at acceptance: the weight stays as written (no `DESIGN.md` token yet); the decoration follows the size the renderer paints with; it does not join the last-used text style; overline gets no default chord.
