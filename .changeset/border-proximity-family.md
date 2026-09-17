---
'@labre/affine-block-surface': patch
'@labre/affine-gfx-uml': patch
---

feat(blocks): a UML port dragged into the middle of its component is now reported. The validation engine gains a seventeenth rule family, `border-proximity` (ADR 0024): the subject's centre must sit within a declared tolerance, in model units, of the outline of a carrier node it overlaps. Overlap is the gate, so a glyph touching no carrier raises nothing and a sketch stays a sketch; the finding indicts the carrier and the carried element together, measured against the nearest carrier. UML ships its first rule of the family, `uml.port-on-border` (§11.3.4, tolerance 16 — the port glyph's own side), an audit on the sketch and a warning under Specification.
