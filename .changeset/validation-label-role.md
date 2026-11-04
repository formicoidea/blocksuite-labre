---
'@labre/affine': patch
---

A `label-presence` rule may declare `labelRole`: an element with no text of its own is then named by the text grouped with it under that role, the way the reading panel names it. `bpmn.unlabeled-step` (version 2) uses it and asks every activity, event and gateway again, so a check-up now reports an unnamed event or a gateway that asks no question, and stays silent on one named by its grouped label. Nothing persisted changes.
