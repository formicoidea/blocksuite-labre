---
'@labre/affine-block-surface': minor
'@labre/affine-gfx-bpmn': minor
'@labre/affine-gfx-ddd-core-domain': minor
'@labre/affine-gfx-wardley': minor
'@labre/affine': minor
---

The reading panel now says where an artefact sits on its frame beyond Wardley:
a sub-domain on a Core Domain Chart reads its quadrant under "Zone", among the
quadrants of the chart's variant (classic or migration), and a BPMN flow object
or data shape inside a pool reads its lane under "Lane". A zone is named the way
the board paints it — a renamed quadrant or a lane's name wins over the
vocabulary — and a zone the board never names reads "Unnamed".
`ReadingProfile.frame.axis` is now optional (absent reads the frame in two
dimensions) and the frame declares its own `label` and `none` wordings, required;
the panel no longer hard-codes "Evolution phase". New keys for hosts:
`com.labre.core-domain.reading.field.zone`,
`com.labre.core-domain.reading.zone.none`, `com.labre.bpmn.reading.field.lane`,
`com.labre.bpmn.reading.lane.none`, `com.labre.reading.zone.unnamed`;
`com.labre.reading.field.phase` and `com.labre.reading.phase.none` now ship with
the Wardley bundle (same keys, same English). The map audit no longer reports a
zone of a variant the chart is not turned to; `backgroundZones`,
`backgroundZoneAt` and `backgroundPlotRatios` are the shared helpers.
