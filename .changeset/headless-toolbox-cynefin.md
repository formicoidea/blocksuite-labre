---
'@labre/affine': minor
---

The Cynefin and estuarine toolbar can now be used without an editor (ADR 0045). `@formicoidea/labre-framework-cynefin` gains an `./interchange` entry exporting `CYNEFIN_ESTUARINE_TOOLBOX`, the list of the toolbar's items (the Cynefin framework background, the estuarine map, the constraint hexagon), each with a pure builder that returns the element the toolbar places; the hexagon takes an optional name, written as its inner text. A host with no editor (a server, an MCP tool) writes them with `surface.addElement` or the import materializer and gets the same elements as a user. The builders are also exported from the package index as `cynefinElement`, `estuarineMapElement` and `constraintHexagonElement`; the toolbar actions now call them.
