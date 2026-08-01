---
'@labre/affine-block-surface': minor
'@labre/affine-gfx-wardley': minor
---

feat(edgeless): minimal validation engine and its first Wardley rule (PF5/PF7)

Frameworks can now declare validation rules, and elements that break one get a
discreet mark on the canvas. Wave 1 — the path end to end, one rule wide.

- `@labre/affine-block-surface`: the engine. Rules are declarative, versioned
  DATA owned by their framework (`{ id, framework, family, severity, appliesTo,
messageKey, version }`); the engine only knows how to evaluate a FAMILY. One
  family ships: `element-in-background`. Results are violation OBJECTS
  (`{ ruleId, elementIds, severity, messageKey, suggestion? }`) on a reactive
  signal, `ValidationManager.violations$` — the seam a host conformance panel
  will read. The engine holds no prose: every human-readable string is an i18n
  key resolved by the host.
- `@labre/affine-gfx-wardley`: the pilot rule. A `wardley:component` — or any
  role specialising it, so `market` and `ecosystem` come free — drawn outside
  the map is flagged `component-outside-map`. A `warning`, never blocking: the
  sketch always wins. A map-less canvas raises nothing. The map background now
  carries a role of its own, `wardley:map`, so both sides of a rule are roles
  and the engine never reads a shape type. Existing backgrounds are not
  backfilled: authored without the role, they frame nothing and raise nothing —
  an older document stays a sketch.
- Affordance (PF7, minimal): elements in violation get amber corner brackets
  drawn by a canvas overlay. No element model is touched, nothing is written to
  the document, no undo entry is created. No conformance panel yet.

Proportionality is enforced by construction: an element with no role is never
evaluated, and a framework's rules only ever match its own roles.

Gating follows the reversed flag contract (`docs/adr/0009`) with no new
machinery: rules are registered by the FLAG-GATED `WardleyViewExtension`, so
turning the `wardley` flag off removes them with the rest of the tooling.
Already-drawn maps keep rendering, they simply stop being checked, and a board
with every framework disabled does zero validation work.

Like every flag in this library, that gate is an assembly-time gate, not a
runtime switch: flipping a flag mid-session neither starts nor stops
validation, and marks already on screen stay there until the editor is
reassembled.

Performance is asserted, not hoped for: a bench in the normal unit suite builds
a 500-element reference map — backed by real `Y.Map`s, so field reads and
`xywh` deserialization cost what they cost in production — and fails the build
if a full evaluation exceeds one 60 fps frame (16 ms). It currently runs in
~0.15 ms, and ~0.0002 ms with the flag off.
