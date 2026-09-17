---
'@labre/affine-gfx-bpmn': minor
'@labre/affine-block-surface': patch
---

A generated legend now lists its sections in the order the framework declares them, instead of the order the board happens to fill them: the same notation reads the same way whatever is drawn, and only the rows change. Empty sections are still dropped.

A BPMN pool gets an automatic legend. Select a pool and the new **Legend** button on its toolbar draws a box naming the artefacts the process actually uses — each row the real glyph, painted by the same renderer and from the same preset as the artefact on the board: the thin green ring against the thick red one, the envelope, the clock, the diamond with its X or its +, the corner person and cog, the folded page, the cylinder, the bracket, and the three flow lines with their own endpoints. Rows appear only for what is inside the pool, a plain "Task" never appears just because a user task is there, and the sections are the catalogue's own headers, so no new wording ships. Every row is derived from the command that draws the artefact, so renaming a role renames its row and restyling a preset restyles its swatch.

The legend never documents itself: what it draws carries no role, so no validation rule counts it and generating a second one describes the same process.

**Breaking, and deliberate — the `.bpmn` export now only writes artefacts that carry a role.** Roles arrived on 2026-08-26 and nothing was backfilled, so a process drawn between the pack's release (2026-06-13) and that date is no longer exported at all; redrawing it, or re-importing a `.bpmn` of it, restores the export. The alternative was an interchange file that could not be trusted: a legend glyph is a real BPMN node with a real kind, so the previous class-based filter would have written it into the file as a ghost `<task>` or `<startEvent>`.

With the `bpmn` flag off the Legend button and the Validation dropdown go with the rest of the tooling; the pool keeps its resize handle and its lane gestures, and a legend already drawn keeps being painted.
