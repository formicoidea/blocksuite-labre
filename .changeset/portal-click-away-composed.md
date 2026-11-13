---
'@labre/affine-components': patch
---

`createLitPortal({ closeOnClickAway: true })` no longer closes a portal on a click inside it when the portal is held by a shadow tree: the click-away test reads the event's composed path instead of its retargeted `target`. The zoom bar's vertical menu now stays open while you zoom with it; a click outside still closes every such portal.
