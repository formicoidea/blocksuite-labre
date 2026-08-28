---
'@labre/affine-gfx-c4': patch
'@labre/affine': patch
---

feat(edgeless): the C4 mermaid export becomes a declared interchange capability

The mermaid export joins the interchange registry as `c4:mermaid:export` —
framework `c4`, format `mermaid` (semantic, `.mmd`), direction export — so the
platform's answer to "what can Labre write, and for which framework" now
includes C4 without anyone reading a toolbar to find out.

Nothing about the file changes. The capability is a thin adapter over the same
pure serializer the command has always run: it picks the C4 artefacts out of
the elements it is handed, names the file, and states the content type. The
`c4.exportMermaid` command now runs THIS capability, so the command and the
registry cannot produce different bytes, filenames or content types — there is
one door, and the registry is the label on it.

One reading is C4's own: the selection is expressed through which boards the
caller puts in the element list. A C4 board is one level of one model, so every
board in the list becomes a document — the command passes the selected boards,
and a headless host that hands over the whole surface gets every board, one
document each.

Declared by the flag-gated view extension, like the rules and profiles: with
the `c4` flag off the capability is not offered, while a stored diagram keeps
painting (`docs/adr/0009`, `docs/adr/0012`).
