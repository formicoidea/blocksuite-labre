---
'@labre/affine-block-surface': patch
'@labre/affine-gfx-bpmn': patch
'@labre/affine-gfx-wardley': patch
'@labre/affine-gfx-edgy': patch
'@labre/affine-gfx-ddd-context-map': patch
'@labre/affine-gfx-ddd-core-domain': patch
'@labre/affine-gfx-ddd-event-storming': patch
'@labre/affine': patch
---

validation rules carry their provenance — standard, recommendation or Labre convention — and the violation bubble says so

A rule now declares where its authority comes from, as data rather than as prose
buried in its message: `standard` with the page of the specification it reads,
`recommendation` for a SHOULD or an industry linter's rule, `labre-convention`
for a house style of this editor and nothing else. The violation bubble shows it
as one discreet line under the finding, with the rule's own citation printed
verbatim — so a convention can never reach an architect dressed as a norm
violation, which is what an external review of the BPMN integration asked for.

The field is purely descriptive: no evaluator reads it, and a rule that declares
one raises exactly the findings it raised before.

All twenty-two BPMN rules declare it — twelve `standard`, each with its page,
eight `recommendation` naming a linter or the sentence the standard merely
permits, and two conventions that say so out loud. The self-loop check left
`bpmn.sequence-flow-endpoints` and became `bpmn.sequence-flow-self-loop`: the
endpoints matrix is BPMN 2.0.2 p.95 and the no-self-loop habit is ours, so one
rule could not have declared either honestly. Same wording, same severity, same
i18n keys, one new rule id in the profiles. The other five frameworks' rules are
annotated too — mostly `recommendation` naming the method, with the readability
nudges declared as the Labre conventions they always were.
