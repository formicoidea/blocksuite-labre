---
'@labre/affine': minor
---

The page note on the canvas now shows the document title by default, editable like the rest of the note once it is being edited and read-only on a read-only document. `NoteConfigExtension`'s `pageBlockTitle` became optional and may return `nothing`: a host that renders its own title registers `pageBlockTitle` (returning `nothing` to draw none on the canvas); a host that registered one keeps its title unchanged.
