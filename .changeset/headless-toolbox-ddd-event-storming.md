---
'@labre/affine': minor
---

Event Storming's toolbar can now be used without an editor (ADR 0045). `@formicoidea/labre-framework-ddd-event-storming/interchange` is a new entry exporting `EVENT_STORMING_TOOLBOX` (the board, the eight colour-coded stickies and the hotspot, each with a pure builder, and the flow as its one link) and the builders `eventStormingBoardElement`, `eventStormingStickyElements`, `eventStormingStickyOpts`, `eventStormingFlowElement` and `eventStormingFlowStyle`, with `AGGREGATE_SIZE`, all also exported from the package index. The stickies are built by `stickyElements` from `@formicoidea/labre-ddd-shared/headless`, the builder the palette's prefab writes, and the toolbar's board, stickies and flow now read their props from the same builders, so nothing stored changes.
