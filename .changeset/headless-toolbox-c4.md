---
'@labre/affine': minor
---

C4's toolbar can now be used without an editor (ADR 0045). `@formicoidea/labre-framework-c4/interchange` exports `C4_TOOLBOX`, the list of the toolbar's items (board, every component kind, the two boundaries, the relationship), each with a pure builder that returns the elements the toolbar places: a component's shape, its three written tiers and their group, a board, a boundary, a relationship connector. A host with no editor (a server, an MCP tool) writes them with `surface.addElement` or the import materializer and gets the same elements as a user. The builders are also exported from the package index as `c4NodeElements`, `c4BoardElement`, `c4BoundaryElement` and `c4RelationshipElement`; the toolbar actions now call them. `@formicoidea/labre-core/interchange` exports the `FrameworkToolbox`, `ToolboxItem`, `ToolboxLink` and `ToolboxPoint` types, and `@formicoidea/labre-core/model/headless` now exports `C4_BOARD_TITLE_BAND_HEIGHT`.
