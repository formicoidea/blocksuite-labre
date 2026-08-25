---
'@labre/affine-gfx-connector': patch
'@labre/affine': patch
---

fix(edgeless): the direction reveal is one sentence, laid along the link

PO acceptance of 02/08/2026, point 5: `depends on` was hiding the chevron and
did not say what it was about. It now reads as the whole statement, turned onto
the line it describes:

```
Kettle | depends on > Electricity
```

- **The sentence, not the verb.** The label is `{consumer} {verb} {provider}`,
  the two names read from the document — an element's own text, or the text of
  the sibling in its group carrying a role of `kind: 'text'`, which is how a
  framework artefact is composed on this canvas. Read generically, by kind: no
  framework's label role is named. An unnamed end is dropped rather than
  blanked, so a bare map still reads `depends on`.
- **Along the link.** The label centres on the middle of the drawn path by ARC
  LENGTH and is rotated to the angle of the median segment. The old placement
  took the middle VERTEX, which on a two-point path is the target endpoint —
  which is how the tooltip ended up on the tip of the link, on top of the
  chevron. When the angle would stand the text on its head the box is turned by
  180°; the sentence itself never reverses.
- **The point IS the arrow.** The box ends in a point on the side facing the
  target, so the reveal is one mark instead of two that cover each other. On a
  box turned 180° the point moves to its other end, because that is the end
  still facing the provider. Reversing the edge (M3) turns the box over and
  moves the point with it.
- **The canvas chevron is gone**, and with it `EdgeDirectionOverlay`: there is
  nothing left for it to draw. The reveal is DOM only now, still in model units
  (the box scales with the zoom), still on hover AND selection, still silent on
  an edge bound to nothing, and still wording the verb through the host's
  catalogue.

Breaking for a host that reached into these: `EdgeDirectionOverlay`,
`targetAnchorOf` and `midpointOf` are removed in favour of `labelAnchorOf`, and
the label's test id is `edge-direction-label` (was `edge-direction-verb`).
