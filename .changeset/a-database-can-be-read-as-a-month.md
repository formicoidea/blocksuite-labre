---
'@labre/data-view': patch
'@labre/affine-block-database': patch
'@labre/affine-block-data-view': patch
'@labre/affine-components': patch
---

A database can now be read as a month

Until now a database offered two shapes: a table and a kanban board. Neither
of them answers the question a transformation roadmap asks first — what is
happening in March? A calendar view now sits beside them: pick it from the
slash menu ("Calendar View"), from the view switcher, or convert an existing
table or kanban into one and keep its filters and sort.

The view maps one date property to the grid and, optionally, a second one to
close a range, so a workstream that runs from the 4th to the 19th is drawn as
a single bar across the weeks it spans rather than as a dot on its start day.
Cards can be dragged from one day to another (a range keeps its length), a
range can be stretched by its edges, and clicking an empty day creates a row
already dated. Months are navigated with the arrows or the "Today" button.

Hosts can feed the same grid from outside the document by registering a
`CalendarExternalSourceProvider`; the editor ships none, so a standalone
playground simply shows the database's own rows.
