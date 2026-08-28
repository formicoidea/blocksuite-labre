---
'@labre/affine-block-surface': patch
---

fix(edgeless): restyling a framework flow no longer restyles the plain connector

The sibling of the tool-arming leak: `EdgelessCRUDExtension.updateElement`
recorded EVERY element restyle into the shared last-props, which are keyed by
type. Restyle an existing BPMN message flow or C4 relationship through the
element toolbar and the dashed, marker-headed look was memorised as "the last
connector" — so the next plain connector drew dressed as the flow.

The crud now skips last-props recording when the element (or the patch) carries
a `role`: framework artefacts keep their costume to themselves, while a user
restyling a plain element still teaches the next one, exactly as before.
