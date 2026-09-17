---
'@labre/affine-gfx-uml': patch
---

A UML file whose ids are `__proto__`, `constructor` or `toString` — valid in XMI, in draw.io and in PlantUML — is read as ids and nothing more: the readers no longer write through to `Object.prototype`, and every shape still comes out with a box.
