---
'@labre/affine': patch
---

An Event Storming hotspot is now created at 180 instead of 120, so its name fits
the diamond at the stickies' Kalam 20 instead of being shrunk by the contained
fit (rule R38, ADR 0029 amendment). The command, the toolbox item and the
template all read the new `HOTSPOT_SIZE`, exported beside `AGGREGATE_SIZE`.
Nothing is migrated: a hotspot drawn earlier keeps its size, and a sticky
morphed into a hotspot keeps its own.
