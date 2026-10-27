---
'@labre/affine': minor
---

The Core Domain Chart's toolbar can now be used without an editor (ADR 0045). `@formicoidea/labre-framework-ddd-core-domain/interchange` is a new entry exporting `CORE_DOMAIN_TOOLBOX` (the chart, the five sub-domain dots, the three Team Topologies markers and the movement over time, each with a pure builder) and the builders `coreDomainChartElement`, `coreDomainSubdomainElements`, `coreDomainMarkerElements`, `coreDomainMovementElement` and `coreDomainMovementStyle`, also exported from the package index. The dots and markers are built by the shared `dotElements` and `markerElements` of `@formicoidea/labre-ddd-shared/headless`, the very builders the palette's prefabs write.
