---
'@labre/affine-widget-edgeless-toolbar': patch
'@labre/affine-gfx-wardley': patch
'@labre/affine-gfx-edgy': patch
'@labre/affine-gfx-cynefin-estuarine': patch
'@labre/affine-gfx-bpmn': patch
'@labre/affine-gfx-ddd-event-storming': patch
'@labre/affine-gfx-ddd-core-domain': patch
'@labre/affine-gfx-ddd-context-map': patch
---

Senior buttons name themselves in the user's language

The edgeless toolbar's senior-tool tooltips were the last piece of chrome that
could only say "Wardley map" or "Event Storming" — a raw English string carried
on the tool itself, invisible to the host catalogue. A senior tool can now
declare `labelKey` alongside its `name`, and the toolbar resolves it through
the same `TranslationProvider` seam every other library wording already uses.

The seven frameworks declare the key their descriptor already publishes
(`com.labre.framework.<id>`), so a host that built its catalogue from
`getTranslationKeyManifest()` translates the buttons with no new key to add.
`name` stays required and stays the fallback: it is what a standalone
playground shows, and it is all the core tools (note, shape, template…) have —
they own no framework identity, so they declare no key.
