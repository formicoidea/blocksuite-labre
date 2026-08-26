---
'@labre/affine-gfx-bpmn': patch
---

BPMN facts answer where an artefact sits, without an editor to ask.

`bpmnPoolOf` and `bpmnLaneOf` say which pool an element is drawn on and which
lane of that pool it falls in — the centre against ratios of the plot, the first
matching band in order, exactly the convention the audit already uses one level
down. Pure functions over models: a rule, a host or a test can ask without a
`BlockStdScope` and without waiting for a validation rule to be registered.

Together with the typed-flow reading the connector package already exposes
(`asTypedEdge` / `edgeIsBound` / `edgeVerbOf`), this is the contract the BPMN
validation rules consume. Nothing about a stored document changes.
