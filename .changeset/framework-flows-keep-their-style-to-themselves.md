---
'@labre/affine-gfx-connector': patch
'@labre/affine-gfx-bpmn': patch
'@labre/affine-gfx-wardley': patch
'@labre/affine-gfx-edgy': patch
'@labre/affine-gfx-ddd-context-map': patch
'@labre/affine-gfx-ddd-event-storming': patch
'@labre/affine-gfx-ddd-core-domain': patch
---

Framework flows keep their style to themselves

Arming a typed flow tool — a BPMN sequence flow, a Wardley link or change
arrow, an EDGY relation, a Context Map pattern, an Event Storming flow, a Core
Domain movement — used to write the flow's look into the shared "last used
connector style". The next plain connector then came out dressed as that flow
(dash, colour, arrowheads) while carrying none of its meaning; BPMN 2.0 (p.40)
explicitly forbids other connectors adopting a flow's line style.

The framework look now rides on the tool activation itself
(`ConnectorToolOptions.style`) and is applied to the drawn edge at creation
only. The last-props store is never touched by a framework activation, so the
plain connector tool keeps drawing with the user's own last style — which
still persists exactly as before when set from the plain tool itself.
