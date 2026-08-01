---
'@labre/affine-block-surface': minor
'@labre/affine-gfx-wardley': minor
---

fix(edgeless): the validation profile belongs in the map's toolbar

PF9 shipped the profile selector as a chip pinned to the instance's top-left
corner. Recette found it twice wrong: the contextual toolbar of the selected
map lands on those same pixels and buried it outright, and at a low zoom what
did show through was unreadable.

The toolbar that hid it is the toolbar that should have carried it. Selecting a
Wardley map now gives its contextual toolbar a **Validation** dropdown naming
the level of requirement in force, offering the others with a tick on the
current one. A per-instance setting sits with the instance's other per-instance
settings — the axes, the labels, the legend — instead of floating over the
canvas competing with them for the same corner.

The chip is gone, and with it the ~355 lines it took to keep a canvas
affordance alive: its own click-away, Escape, pan/zoom tracking, viewport
clamping and late element resolution are all things a toolbar entry gets for
free.

Nothing about the DATA changed. `validationProfile` is still one optional flat
string on the background element, the default still writes nothing and choosing
it back still clears the key, exceptions are still untouched by a change of
level, and `ValidationManager.setProfile` is still the only write path — the
toolbar adds a `captureSync` in front of it so one click is one undo.

### Where it lives

`validationToolbarConfig` is generic and lives with the engine, in
`@labre/affine-block-surface`. It names no framework, no element type and no
role: the entry stands up when the selected element is one the engine
recognises as a framework's root instance (through the registered rules'
`backgroundRole`) whose framework declares more than one profile. A second
framework shipping profiles gets the same dropdown by registering the very same
object on its own flavour.

It is registered by Wardley's **flag-gated** view extension, beside its rules
and its profiles — deciding how hard to check a document is tooling, so the
flag removes the module entirely rather than merely emptying it. That is a
deliberate split from `wardleyToolbarExtension`, which stays always-on because
a stored map must keep its axes and its labels whatever the flag says
(`docs/adr/0009`). The two modules coexist on one element through the `custom:`
flavour slot, the pattern `gfx/mindmap` already uses on
`custom:affine:surface:shape`.

The dropdown renders sections and ships with one, so PF7.11's map quality is
one more block in the same menu rather than another button competing for
toolbar width.

### Also

`wardley-validation-profiles.spec.ts` now drives the real element toolbar. That
needed telling the editor it is in edgeless mode: `setupEditor('edgeless')`
mounts the edgeless root but the default `DocModeService.getEditorMode()`
answers `null`, which the toolbar reads as page mode and skips every surface
selection. The override is local to that suite.
