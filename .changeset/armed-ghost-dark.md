---
'@labre/affine': patch
---

On a dark canvas, the ghost an armed notation tool leaves under the pointer
(a Wardley component, a BPMN task, a C4 container, a UML class, an EDGY, Cynefin
or DDD element) is now painted with the notation dark palette, like the element
it places, instead of its stored light colours. The ghost goes through the new
`CanvasRenderer.renderDetached(elements, ctx, matrix, rc, bound)`, which paints
elements that are not on the surface the way the render loop paints stored ones.
Nothing is written to the document.
