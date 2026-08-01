---
'@labre/affine-block-surface': minor
---

fix(edgeless): revoke an exception from the element, not from a grey dot

PO acceptance on PF8: the way back out of a waived validation rule moves to the
contextual toolbar of the element that carries it, and the grey badge that used
to hold it disappears.

**The grey badge is gone.** PF8 kept a muted dot on the canvas for every excused
finding, so it could be clicked to revoke. That put a permanent marker on the
board for something the user had explicitly decided to stop caring about — the
affordance argued with the decision it was reporting. An excused finding now
draws nothing at all: no bracket, no badge. The amber badge of a LIVE violation
is untouched (PF7), and the engine still reports the excused finding on
`violations$`, so a host panel and an export still see it. Nothing is hidden;
the canvas just stops shouting about a settled question.

**"Revoke exception" lives on the element.** Selecting the thing is the path
everybody already knows, so the way back sits where everything else you can do
to an element sits. Which element gets the entry follows exactly the rule the
canvas mark already followed: the outermost enclosing canvas group — i.e. the
whole component built by the senior menu — or the element itself when it is not
grouped. Dissolve the group and the entry moves down to the element, with
nothing to invalidate. A framework background answers for the map-wide
arbitration written on it, so the same entry there takes back the map scope.

The entry appears only when the selected element actually answers for an
exception, and only when a registered rule can still be arbitrated on — so a
board with the framework switched off never shows it, while the exceptions
themselves stay in the document, untouched (PF8.6). Its label goes through the
`TranslationProvider` seam like the rest of the validation chrome.

Registered on `custom:affine:surface:*`, the free wildcard slot merged into
every canvas element's toolbar: one registration covers a group, a bare
framework element and a background alike, and no framework's own toolbar config
is touched.

The detail bubble is unchanged: it still lists an excused finding with its state
and a Revoke, for the case where it shares an anchor with a live one.
