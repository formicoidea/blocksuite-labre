---
'@labre/affine-block-surface': minor
---

fix(edgeless): the info panels take their place — and their width — from the senior bar

PO recette of 02/08/2026, second pass, points 2 and 3. The panels that tell you
about the canvas now share one place and one measure: **anchored to the editor,
above the senior button bar, at exactly its width** (ADR 0011).

**"Read this component" stops guessing its width.** The 480px it shipped with
lined up with nothing on screen. Its left and right edges are now the toolbar
bar's own, measured off the bar's rect rather than computed from the toolbar's
layout constants — the bar is `fit-content` over a tool count that changes with
the editor's width, so any arithmetic would be a copy that drifts. A resize or a
zoom re-measures, and so does the toolbar's own re-layout, which lands a frame
later than the resize does.

**Map quality adopts the same pattern.** It leaves the popover that hung off the
map's top-right corner at 320px, flipping sides and ends to stay on screen, for
the same anchored panel in the same layer above every toolbar. Only the
presentation moved: the entry in the background's contextual menu is still the
trigger, the panel is still about one root instance, and nothing it renders
changed.

**One component, not two copies.** `EditorAnchoredPanel` owns the geometry, the
layer, the dialog semantics, the pointer-swallowing, click-away and Escape, and
the re-measure wiring; a panel subclasses it, says when it is open and how it
closes, and renders its body. A read-only board renders no toolbar, so a panel
with no bar to measure falls back to a centred, comfortable measure — the only
place a width floor applies, because where the bar IS measured the match is
exact.

ADR 0011 records the decision: canvas metadata is shown in a panel anchored to
the editor, above the senior button bar, at its width — today the reading and
Map quality, tomorrow any surface that talks about the canvas rather than about
a selection.
