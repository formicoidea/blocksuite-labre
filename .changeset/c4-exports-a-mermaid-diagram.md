---
'@labre/affine-gfx-c4': patch
'@labre/affine': patch
---

feat(edgeless): a C4 board leaves as a mermaid diagram

Select a C4 board, open the "⋮" on its toolbar, and "Export as mermaid"
downloads it as a `.mmd` file in mermaid's C4 syntax — the one you paste into
mermaid.live, into a GitHub or GitLab markdown file, into Notion, or commit next
to the code the diagram is about. A C4 diagram drawn here is no longer only a
picture of an architecture.

It exports the SELECTED board, and this is the one place C4's export deliberately
does not do what BPMN's does. A BPMN document is a process and half a process is
not a smaller process, so that export takes the whole surface. A C4 board is one
LEVEL of one model — a context diagram, a container diagram, a component diagram
— and the whole point of drawing three of them side by side is that they are
three separate diagrams. Select several and you get several documents in one
file, each complete and each announced by a comment; mermaid renders one diagram
per document, so merging them would produce a file no renderer accepts.

The diagram type is read off what is actually drawn rather than asked of you: a
board holding a component is a `C4Component`, one holding a container, a
database, a mobile app or a web browser is a `C4Container`, and anything else is
a `C4Context`. The board's name becomes the diagram's `title`.

All nine elements map. A person and an external person become `Person` and
`Person_Ext`, a system and an external system `System` and `System_Ext`, a
container `Container`, a database `ContainerDb`, and a component `Component`. A
mobile app and a web browser are containers with a technology written on them —
`Container(…, "mobile app")` and `Container(…, "web browser")` — because neither
is a level of its own: they are a container with a picture.

Boundaries come out nested the way you drew them. A container boundary drawn
inside a system boundary is written inside it, and an element belongs to the
innermost boundary whose frame its centre sits in — the same centre-in-the-plot
arithmetic the audit and the validation rules already use, so the file and the
canvas can never disagree about what is inside what.

Aliases are derived from the names, so the file reads: `Rel(customer,
single_page_app, "Uses")` rather than a line of surface ids. Two elements with
the same name get a counting suffix (`billing`, `billing_2`), and a name that
folds to nothing keeps a short placeholder.

**The export speaks only what the author stated.** A connector with no C4 role
relates nothing, so it is not an untyped relationship — it is not a relationship
at all, and it is absent. So is a box drawn with the C4 stencil and never stamped
with a role, an element sitting on another board, and a relationship with a free
end or an end on something outside the diagram, which mermaid has no way to write
down. Guessing here would put words in an architect's mouth.

Labels survive whatever is in them, with three exceptions the format forces: a
multi-line label is joined into one line (a macro call is one line), a double
quote becomes an apostrophe (the C4 grammar has no escape for one inside a
quoted argument), and a run of `%%` collapses to one `%` (it would otherwise open
a comment and swallow the rest of the statement). Accents, CJK and emoji all come
through untouched. An element or a boundary with nothing written on it is named
`"?"` rather than exported as a blank box.

One consequence worth knowing: the export is C4's fourteenth catalogue entry
against fourteen slots, so the framework still fits its sub-menu exactly — the
thirteen artefacts, in author order, with nothing arbitrated. It has spent the
last slot, and a fifteenth entry of any kind would start ranking the sub-menu by
what you reach for, as BPMN's already is.

The serializer is a pure function — element models in, mermaid string out, no
editor anywhere near it — and is exported from the package, so a host can
serialize a board it never rendered.
