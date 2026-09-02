---
'@labre/affine-gfx-ddd-core-domain': minor
'@labre/affine-gfx-ddd-shared': patch
---

feat(edgeless): core domain dots and markers morph inside their families

A Core Domain sub-domain dot and a Team Topologies marker can now be told to be
a nearby kind of themselves, from the **Change type** dropdown on their own
contextual toolbar — the same affordance BPMN nodes and C4 components already
carry. Realising halfway through a chart that this dot is really a platform
sub-domain no longer costs a delete, a re-draw and a re-typed caption: the
position on the chart, the movement arrows attached to it and the name somebody
wrote are all kept.

Two families, and nothing between them: the five dots
(`bigBet`, `platform`, `outsourced`, `bcCurrent`, `bcFuture`) are mutually
reachable, and so are the three markers (`collaboration`, `xaas`,
`facilitating`). A dot never becomes a marker — a sub-domain is plotted ON the
chart and a marker is an annotation ABOUT it, which is the same disjunction the
role vocabulary draws.

The words follow two different rules, because they are two different kinds of
thing. The **caption** is content: it is rewritten only when it is still exactly
the source kind's own creation prompt, so a dot called "Billing" keeps that name
whatever it becomes. The marker's **letter** is notation — C, X and F are Team
Topologies' own glyphs, not words anybody wrote — so it is always rewritten to
the target's, in the same undo step as the colour.

The kind is read back out of the artefact's `role`, so a dot drawn before the
role vocabulary existed simply is not offered the menu: nothing is inferred from
its colour and nothing is backfilled. The dropdown is TOOLING and lives in the
flag-gated view extension (`docs/adr/0009`) — turning `ddd-core-domain` off
takes the menu away and leaves every stored chart loading, painting and
round-tripping exactly as before.
