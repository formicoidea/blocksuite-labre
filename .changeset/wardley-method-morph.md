---
'@labre/affine': patch
---

The Wardley "Change type" menu now offers Component + method beside component,
market, ecosystem and pipeline, in both directions. A component that becomes a
method paints Make until a method is picked. A method that becomes another kind
keeps its `wardley:method` tag stored (unused) and gets it back when it becomes
a method again. Name, centre, nature and connectors are kept, through the
pipeline's handle when a pipeline is involved. Nothing persisted changes (ADR
0046, amendment of 2026-11-04).
