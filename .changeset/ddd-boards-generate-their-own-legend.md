---
'@labre/affine-gfx-ddd-shared': minor
'@labre/affine-gfx-ddd-context-map': minor
'@labre/affine-gfx-ddd-event-storming': minor
'@labre/affine-gfx-ddd-core-domain': minor
---

feat(edgeless): the three DDD boards generate the legend of what is drawn on them

Select a **Context Map board**, an **Event Storming board** or a **Core Domain
Chart** and its toolbar now offers a legend button. Pressing it reads what is
actually inside the background's perimeter and drops a legend of exactly that,
bottom-left of the board — the same gesture a Wardley map has had for a while,
and the same result: a real, editable, movable group of elements, not an overlay.
A board with three sticky kinds on it gets a three-row legend; add a fourth kind
and press the button again for a legend that mentions it.

What each board lists:

- **Context Map** — the bounded context, and one row per relationship pattern
  drawn, with its DDD Crew abbreviation and its own line style (dashed for
  Separate Ways and Big Ball of Mud, exactly as the board draws them);
- **Event Storming** — one row per sticky kind stuck to the board, in its own
  colour, hotspot included, plus a Flow row once an arc has been drawn;
- **Core Domain Chart** — one row per sub-domain kind placed, in its own colour,
  one row per Team Topologies marker used, square and letter included, plus the
  red dashed Movement over time.

The legend reads the artefacts' **semantic roles**, not their shapes and not
their fill colours. That is what makes it agree with the validation rules — both
read the same field — and it is what keeps a restyled sticky in the legend and an
orange rectangle somebody drew to think with out of it.

One consequence on the Core Domain Chart, whose legend button already existed and
used to scan fill colours: a chart the tool recognises nothing on — every chart
drawn before roles existed — now yields a framed, titled legend with no rows
instead of the whole notation; a legend lists what is drawn, not what could have
been. The five sub-domain colours it does list are the same five the palette
draws with, by construction, and so are the three marker colours.

Reading by role is also what finally lets the chart list its **Team Topologies
markers** honestly. Collaboration, X-as-a-Service and Facilitating are now
artefacts the tool recognises rather than three coloured squares, so a chart with
a marker on it gets a "Team interaction modes" section naming the ones actually
used — with the same letter in the same coloured square the chart draws — and a
chart with none is not told about modes it did not use. Being recognised costs
them nothing else: a marker is an annotation, not a sub-domain, so the overlap
and legend-colour checks written on sub-domains still leave it alone, including
when it is parked right against the dot it comments on.

Every legend box is now titled **"Legend"**. The three DDD tools shipped with a
French title on an otherwise English notation; the boxes are elements written
into the document, so existing ones keep whatever title they were drawn with.

The **Context Map palette keeps its own Legend entry**, which still lays out the
full notation, cloud included. The two gestures answer two
different questions — "what does this notation mean" and "what did we actually
draw here" — so that module deliberately has both. The cloud is the one artefact
the automatic legend cannot mention: it carries no role, on purpose, because a
relationship drawn onto one is a sketch the tool stays silent about.

Every legend button is available with its framework's button switched off: a
legend is elements written into the document, not tooling.
