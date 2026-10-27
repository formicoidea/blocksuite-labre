---
'@labre/affine': minor
---

EDGY's toolbar can now be used without an editor (ADR 0045). `@formicoidea/labre-framework-edgy` gains an `./interchange` entry exporting `EDGY_TOOLBOX`, the list of the toolbar's items (the facets background, the board, People, Outcome, Object, Activity, the relation), each with a pure builder that returns the elements the toolbar places: a facets background with its three names, a board, a box carrying its name, People's glyph, name and their group, a relation connector. "EDGY dynamic" is not an item: it inserts a template snapshot. A host with no editor (a server, an MCP tool) writes them with `surface.addElement` or the import materializer and gets the same elements as a user. The builders are also exported from the package index as `edgyFacetsElement`, `edgyBoardElement`, `edgyBoxElement`, `edgyPeopleElements` and `edgyRelationElement`, with `EDGY_FACETS_SIZE` and `EDGY_PEOPLE_SIZE`; the toolbar actions now call them.
