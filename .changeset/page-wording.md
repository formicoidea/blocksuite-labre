---
'@labre/affine': patch
'@labre/affine-block-attachment': patch
'@labre/affine-block-embed': patch
'@labre/affine-block-embed-doc': patch
'@labre/affine-block-frame': patch
'@labre/affine-block-note': patch
'@labre/affine-block-root': patch
'@labre/affine-block-surface': patch
'@labre/affine-block-surface-ref': patch
'@labre/affine-components': patch
'@labre/affine-fragment-doc-title': patch
'@labre/affine-gfx-bpmn': patch
'@labre/affine-gfx-group': patch
'@labre/affine-gfx-note': patch
'@labre/affine-gfx-uml': patch
'@labre/affine-gfx-wardley': patch
'@labre/affine-shared': patch
'@labre/affine-widget-edgeless-auto-connect': patch
'@labre/affine-widget-edgeless-selected-rect': patch
'@labre/affine-widget-linked-doc': patch
'@labre/affine-widget-slash-menu': patch
---

The English fallbacks call the Labre page a page: every `com.labre.*` wording that said "doc" or "document" for the page being edited now says "page" ("Copy page link", "Linked page created", "Insert into Page", "Switch to page mode…", the note display modes, the linked-page embeds and slash items, the import descriptions…). No key, command id or stored value changed; a host that ships its own English catalogue should take the new values (75 keys; `getTranslationKeyManifest()` returns the new values). "Document" stays where it names an imported file (a BPMN, XMI or PlantUML source, a file being imported) and in "Google Docs". The slash items "New Doc" and "Linked Doc" are now named "New Page" and "Linked Page", which is also the `control` their `SelectSlashMenuItem` telemetry reports.
