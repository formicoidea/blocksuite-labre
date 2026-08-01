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
  its **named zones**, and its **chrome** (card, colour washes, and a palette so
  a colour is named once and referenced by name). Not one line of it is a
  function, a class or a closure — same philosophy as the validation rules and
  the role defs, for the same reason: a declaration is comparable,
  serialisable, reviewable by someone who does not read TypeScript, and can one
  day be shipped by a host.
- **The vocabulary is only as wide as its callers.** Every optional field has a
  named consumer cited in its doc comment — the BPMN pool's free aspect ratio
  and `600` name weight, Estuarine's double-headed energy axis and its Georgia
  italic axis letters. Anything nobody had asked for yet is simply absent: a
  drawn grid, a drawn legend box, tick stubs, per-tick labels, free-floating
  annotations and vertical washes were all written and then cut. They are
  cheap to add back the day a framework needs one, and dead weight until then.
- **The default is deliberately dull.** A declaration that says nothing but its
  size paints a plain white rectangle: no axis, no zone, no decoration. A new
  framework gets a usable background before it has decided what it looks like.
- **Labels are vocabulary, not prose.** Each one names an i18n key resolved
  through the house seam (`TranslationProvider`), and optionally a model prop
  holding the user's own wording, which always wins. A key nothing resolves and
  nothing defaults shows the raw key, exactly as everywhere else in the library.
  For that key to be REACHABLE, Wardley's ten label fields now default to
  `undefined` instead of to English: an `undefined` default is written nowhere,
  so a map nobody has renamed carries no label text and falls through to the
  vocabulary. Without a catalogue it reads exactly as it always did — the same
  words in the same places — and the first in-place edit writes the prop and
  wins from then on. The in-place editor opens on the words CURRENTLY DRAWN
  rather than on the raw prop, so a never-renamed label does not offer an empty
  box for a name the user can plainly see.
- **A broken declaration fails loudly.** A `@name` with no palette entry, or a
  wash colour that cannot carry an alpha, used to produce `transparent` or
  `rgba(NaN,NaN,NaN,…)` — painting nothing and explaining nothing. Both now warn
  once and paint magenta.
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

No document is invalidated. The persisted element type is still `wardley` and
every one of its props keeps its name and its meaning — `variant`, `banded`,
the ten editable label texts, the six visibility toggles. A map authored before
this change opens with the same geometry, the same zones and the same words,
and its snapshot round-trips byte-identical; that is asserted end to end
against the real assembly points, with every expected coordinate written as a
literal rather than recomputed from the declaration under test.

What a map created from now on WRITES is smaller by ten keys: the label texts
are only persisted once the user actually types one. Reading is unaffected in
both directions — an old map keeps its ten, a new one falls through to the
vocabulary — and that is precisely the mechanism optional fields exist for.

The four gradient variants are still the same curves. They are now TABULATED
ONCE, at module load, into `[offset, alpha]` stop tables the declaration ships:
nothing is evaluated at paint time, and a wash is data like everything else.

Wardley's role, element type, reference size, locked 16:9 proportion and
resize default now come from the declaration, at the toolbox AND at the
templates. One pre-existing drift is left alone and now documented: the
templates lay their nodes out in a plot of their own (`x 70 → 1540`), inset
further than the plot the declaration actually draws (`x 40 → 1570`). Aligning
them would move every node of every canned map, which is a visual change to
shipped content and not this slice's business.

`wardley:map` is still stamped at creation and `wardley.component-outside-map`
still frames against it, unchanged.

Only Wardley is migrated. Cynefin, Estuarine and the BPMN pool keep their own
renderers for now: the declaration expresses the BPMN pool as it stands, but
Cynefin and Estuarine are built on hand-traced bezier and arc paths, which the
vocabulary deliberately does not yet cover. Migrating them means adding a
path-data layer to the declaration, and that is a slice of its own.
