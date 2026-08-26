---
'@labre/std': patch
'@labre/affine-shared': patch
'@labre/affine-widget-edgeless-toolbar': patch
'@labre/affine': patch
---

feat(std): the senior menu caps at fourteen and ranks seven past it

A framework's senior button opens one row of buttons, and that row holds
**fourteen**. Until now that number was a design review: the registry test
refused a framework that _declared_ more than fourteen sub-menu commands, and
nothing said what a framework should do once its toolbox honestly outgrew them.
It now has an answer.

Below the cap nothing changes at all — the sub-menu is the framework's authored
list, whole and in the order its author wrote it. Past it, the row becomes a
**shortcut to the seven artefacts this user actually reaches for**: the four
most-used plus the three most-recent, deduplicated, with a command that tops
both axes taking one slot and handing the freed one back to frequency. Two axes
rather than one, because frequency alone never surfaces the tool picked up
yesterday and recency alone would reshuffle the row at every click.

The seven are then laid out **in authored order, never in rank order**. What the
ranking decides is membership; position stays where the framework put it,
because a menu whose buttons swap places under the cursor is precisely the
pattern this feature exists to avoid. On a fresh install, with nothing measured
yet, both axes collapse to authored order and the row shows the first seven — a
cold start that is deterministic rather than empty.

The ranking reads the framework's **whole catalogue**, not the fourteen its
author picked. An artefact left out of the row that a user invokes constantly
has earned a slot, and a selection that could only ever demote would never learn
that.

Beside the seven sits a permanent **More artefacts…** button, opening the
catalogue sidepanel on the framework's full toolbox — and it appears only when
something answers the new `ArtefactCatalogueProvider` seam, since a button that
opens nothing is a dead control. The seam ships here as an interface; the panel
behind it arrives in its own release.

**Nothing visible changes today.** The largest framework in the library declares
thirteen artefacts, so no senior menu is past the cap and every one of them
still shows its whole toolbox. This is the rule the BPMN full pack will be the
first to meet.
