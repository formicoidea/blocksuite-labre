---
'@labre/affine-block-surface': minor
---

feat(edgeless): validate what relations join and which zone an artefact sits in

Two new rule families in the validation engine, plus the two seams the
frameworks about to use them need.

`relation-endpoints` judges a typed edge on WHAT it joins rather than on where
it is drawn: a framework declares the sentences it sanctions — `source` _verb_
`target`, all three named by role — and the engine reads the persisted
`source → target` pair against them. It also arbitrates the three things a pair
of artefacts can carry too much of: a relation looping back onto its own source,
the same relation drawn twice, and two patterns that may not coexist between one
couple (an anti-corruption layer and a conformist link say opposite things). Each
mode of failure carries its own wording, because the four are fixed with four
different gestures. An end the framework's grammar never mentions — a hotspot, a
neutral shape, an artefact of another framework — yields silence: a link onto
something the model has not named yet is somebody sketching, and a grammar that
indicted the sketch would be switched off within a day.

`element-in-zone` judges an artefact against the named REGIONS of the frame it
sits on, where `element-in-background` only asked whether it was on the frame at
all: "an outsourced subdomain has no business in the Core quadrant". The zone
rectangles come from the declaration the renderer already paints from, resolved
against the instance the subject is actually on, so a rule restates no
coordinate and follows the map when it is moved or resized. An artefact off
every frame is silence — that is another rule's question — and the verdict does
not depend on the zone tints being switched on: a quadrant stays a quadrant when
the user prints the chart in black and white.

Being a framework's ROOT INSTANCE — what the profile picker, the Map quality
checklist and the check-up are offered on — is no longer derived from the
registered rules alone. A framework may now declare its background role
outright (`ValidationFrameworkExtension`), which is what a framework whose
expectations are all negotiated rather than computed needs: it ships nudges and
no rule, and inventing a rule that never fires to make its panel appear would be
data claiming an effect it does not have. Frameworks that ship rules are
unaffected and declare nothing.

Finally, a background's zones and texts can name the `variants` they belong to,
exactly as its washes already could — one declaration, two readings of the same
frame, selected by one model prop. A zone takes its own label with it, and a
label the current variant does not paint is no longer offered for in-place
editing. `element-in-zone` reads the same reading: a quadrant this instance does
not show is not ground an artefact can be judged against.
