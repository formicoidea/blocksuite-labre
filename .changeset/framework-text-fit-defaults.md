---
'@labre/affine-gfx-ddd-shared': minor
'@labre/affine-gfx-ddd-context-map': patch
'@labre/affine-gfx-cynefin-estuarine': patch
'@labre/affine-gfx-bpmn': patch
'@labre/affine-gfx-wardley': patch
---

Per-framework text-fit defaults. Event Storming stickies and Context Map
bubbles now carry their label as the shape's own text (contained /
overflow fit) instead of a separate grouped text element — double-click
edits in place and the box never deforms; previously created prefabs keep
their old structure and keep working. Estuarine hexi constraints default
to contained; BPMN nodes and the Wardley inertia bar default to overflow.
