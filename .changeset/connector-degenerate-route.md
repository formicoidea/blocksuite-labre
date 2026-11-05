---
'@labre/affine': patch
---

An orthogonal connector no longer throws "Failed to get line intersections for
getNextPoint" (nor a `TypeError` in the router) when one of its ends cannot be
routed: an element with a flat or `[0,0,0,0]` bound, a NaN coordinate, or a stored
position outside `[0, 1]`. Such a connector is drawn as a direct elbow, or not at
all when an end has no finite point, and an end with no anchor now starts from its
element's centre instead of the canvas origin. Only the local path is recomputed;
nothing is written to the document.
