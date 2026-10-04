---
'@labre/affine-gfx-uml': minor
---

A UML object's name is now created underlined through its text decoration
(ADR 0030 §4): the line runs under the words rather than across the name
compartment, and the author can restyle or remove it from the text toolbar.
`umlNameDecoration` is the one preset the toolbox, the PlantUML/XMI/draw.io
importers and the templates read. Objects drawn before this change are not
migrated: their name carries no decoration, so the object glyph keeps
painting its old rule for them; any stored decoration, `none` included,
hands the line to the text.
