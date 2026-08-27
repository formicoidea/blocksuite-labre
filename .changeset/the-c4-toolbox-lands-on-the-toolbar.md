---
'@labre/affine-gfx-c4': patch
'@labre/affine': patch
---

feat(edgeless): the C4 senior button, board and catalogue tooling

The C4 pack shipped its models and its rendering last week: a diagram drawn by
hand painted correctly, and there was no way to draw one. This is the toolbox.

A **C4 button** joins the edgeless toolbar, and its sub-menu holds thirteen
entries: the four levels of the model (person, software system, container,
component), the relationship that joins any two of them, the board they are
drawn on, the database, the system and container boundaries, the mobile app and
the web browser, and the two "somebody else owns this" variants of the person
and the system. Thirteen against a menu that holds fourteen — C4 is the last
framework that FITS, so nothing is ranked away and the row is exactly the list
above, in that order.

The order is not decorative. It leads with the seven a C4 diagram cannot be
drawn without, because the day a fourteenth artefact lands those seven become
the first thing a new user meets. BPMN learned that in a live recette, with a
first contact that offered six ways to draw a circle and nothing to connect
them.

Everything is in the **artefact catalogue** and bindable from
Settings › Shortcuts, filed under four headers: Elements, Relations, Diagrams
and Boundaries — the last of which is new to the library, because a boundary is
neither an element of the model nor the sheet it is drawn on.

Every element is created in the stencil's own colours and stamped with the role
that says what it MEANS — which is the only thing that can say so, since three
of the four levels are the same rounded rectangle. The person and the database
are created as outlines the renderer fills in, so their head-and-body and their
cylinder are drawn rather than approximated.

The **relationship tool** arms a straight, dashed, grey arrow with a filled
head: the stencil's own line, and the only kind of line C4 has. It is a typed
edge — its verb is "uses", the source is the element with the need — so hovering
it says which way it reads, on a board whose C4 button is switched off as much
as on one where it is on.

Selecting a board offers its own row: lock or unlock resizing, and **generate a
legend** of the notation actually used on it. The legend lists what is drawn and
nothing else — a board of cylinders lists a database and not a container — and
it arrives as real, editable elements you can move and rewrite. Renaming a board
or a boundary is unchanged: double-click the words.

With the C4 tooling switched off, a stored board keeps painting, stays
selectable and keeps its resize toggle; the legend button goes with the rest of
the C4 gestures, since generating one CREATES elements.
