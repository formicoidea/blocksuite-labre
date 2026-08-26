---
'@labre/affine-shared': patch
'@labre/affine-inline-preset': patch
---

Coloured text survives a paste from the web

Markdown import treated every scrap of inline HTML as literal characters, so
copying a paragraph out of a web page — or re-importing a document this editor
had exported — produced `<span style="color: #c83030;">` sitting in the text,
with the colour lost and the tag on show. A balanced run of inline tags is now
handed to the HTML converter instead: the text comes back formatted, and a
`color` declaration is matched against the eight supported text highlights,
taking whichever of the light or dark reference is nearer. A colour that
resembles none of them leaves the text uncoloured, which is what keeps a pasted
document readable in both themes. Unbalanced or block-level HTML is untouched
and still arrives verbatim, as before.
