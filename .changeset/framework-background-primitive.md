---
'@labre/affine-block-surface': minor
'@labre/affine-gfx-wardley': minor
'@labre/affine-model': minor
---

feat(edgeless): a declared framework background, and Wardley rebuilt on it (PF2)

Every framework that needed a background — Wardley, Cynefin, Estuarine, the
BPMN pool — got one by writing a renderer: two hundred lines of `ctx.fillText`,
its own hit-testing for editable labels, its own resize gate, its own copy of
the same four hit-test methods on the model. Four dialects of the same idea,
and the framework that happened to be written last inherited none of the
niceties the first one had.

There is now ONE background, configured by DECLARATION.

- **The primitive** (`FrameworkBackgroundDef` in `@labre/affine-block-surface`)
  describes a background as data: its **geometry** (reference size, whether the
  proportion is locked, whether the handles are offered, the plot margin), its
  **frame of reference** (named axes, orientation, arrowheads, graduations),
  its **named zones**, and its **chrome** (card, colour washes, grid, legend,
  free annotations, and a palette so a colour is named once and referenced by
  name). Not one line of it is a function, a class or a closure — same
  philosophy as the validation rules and the role defs, for the same reason: a
  declaration is comparable, serialisable, reviewable by someone who does not
  read TypeScript, and can one day be shipped by a host.
- **The default is deliberately dull.** A declaration that says nothing but its
  size paints a plain white rectangle: no axis, no zone, no decoration. A new
  framework gets a usable background before it has decided what it looks like.
- **Labels are vocabulary, not prose.** Each one names an i18n key resolved
  through the house seam (`TranslationProvider`), and optionally a model prop
  holding the user's own wording, which always wins. A key nothing resolves and
  nothing defaults shows the raw key, exactly as everywhere else in the library.
- **One walk, two uses.** The declaration's texts are enumerated once and drive
  both the painting and the double-click hit-testing, so a label can no longer
  be drawn in one place and clicked in another.
- **The model half** (`FrameworkBackgroundElementModel` in
  `@labre/affine-model`) carries what every background shares: a rotated
  rectangle you drop elements onto, selectable, movable and part of undo/redo,
  but a passive canvas connectors must not snap to.

**Wardley is the first instance, and the Wardley-specific implementation is
gone** — renderer, label layout and resize gate alike. Two implementations
coexisting would have meant Wardley quietly keeping behaviours no other
framework could have.

Nothing about the DOCUMENT changed. The persisted element type is still
`wardley` and its twenty-two props are untouched — `variant`, `banded`, the ten
editable label texts, the six visibility toggles. A map authored before this
change opens with the same geometry, the same zones and the same words, and its
snapshot round-trips byte-identical; that is asserted end to end against the
real assembly points, with every expected coordinate written as a literal
rather than recomputed from the declaration under test.

The four gradient variants are still the same curves. They are now TABULATED
ONCE, at module load, into `[offset, alpha]` stop tables the declaration ships:
nothing is evaluated at paint time, and a wash is data like everything else.

Wardley's role, reference size and locked 16:9 proportion now come from the
declaration too, so the toolbox, the templates and the validation rules all
read the same source. `wardley:map` is still stamped at creation and
`wardley.component-outside-map` still frames against it, unchanged.

Only Wardley is migrated. Cynefin, Estuarine and the BPMN pool keep their own
renderers for now: the declaration expresses the BPMN pool as it stands, but
Cynefin and Estuarine are built on hand-traced bezier and arc paths, which the
vocabulary deliberately does not yet cover. Migrating them means adding a
path-data layer to the declaration, and that is a slice of its own.
