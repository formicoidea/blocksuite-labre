---
'@labre/affine-gfx-bpmn': patch
'@labre/affine': patch
---

BPMN interchange keeps where a name is drawn. An imported event, gateway or data shape now places its name in the box the file's `bpmndi:BPMNLabel` gives (beside or above the symbol, as bpmn.io draws it) instead of always under it, and falls back to under the symbol when that box is missing or not a sane rectangle. The `.bpmn` export writes a `BPMNLabel` from the real position of each grouped label, offset with the rest of the drawing, in place of the one an earlier import carried, so a label the user moved comes back where it was. `BpmnExportBoard` gains an optional `labelBounds` map beside `labels`; nothing persisted changes (ADR 0029, amendment of 2026-11-04).
