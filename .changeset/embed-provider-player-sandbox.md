---
'@labre/affine': patch
---

fix(blocks): the dedicated YouTube, Figma and Loom embeds now render their iframe sandboxed, like every other embedded frame. They each carry `sandbox="allow-same-origin allow-scripts allow-presentation"` — enough for the players to run, no more — and the three levels of the iframe sandbox policy now live in one module of the embed package instead of inside the generic iframe block, so a new embed block cannot be shipped without one (a test sweeps every template of the package and names the offender).
