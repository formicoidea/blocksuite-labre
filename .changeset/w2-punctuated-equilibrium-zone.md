---
'@labre/affine-block-surface': patch
'@labre/affine-gfx-wardley': patch
---

fix(edgeless): W2 measures the punctuated equilibrium zone, and says which half failed

Recette PO of 01/08/2026: two inertia bars dropped squarely on the "Product"
and "Commodity" dividers, both flagged, both told they were "not on a
dependency at a phase transition". Reproduced and measured: the bars were
**0.00 units** off the transition — the boundary half was satisfied to the
unit — and 410 and 846 units from the nearest dependency, against a 24-unit
tolerance. The verdict was right; the sentence hid the only thing the user
could act on.

- **The zone of punctuated equilibrium is declared data.** A framework
  background now carries `transitionBandWidth`, a ratio of the plot, and
  `backgroundTransitionBands()` exposes each transition as a named band
  (`custom-built|product`) in model coordinates. Wardley declares `0.1` — ±5%
  of the plot either side of each divider, ±76 model units on the 1600-wide
  reference map against the 40 absolute units it replaces. The old absolute
  slack was 5.5% of the plot on an 800-wide map and 1.3% on a 3200-wide one:
  the same gesture judged four times as harshly for having resized the map.
  Being a ratio, the band now survives resizing.
- **W2 speaks twice.** `com.labre.wardley.validation.inertia-off-carrier` ("not
  drawn on a dependency") and
  `com.labre.wardley.validation.inertia-off-equilibrium-zone` ("sits mid-phase,
  outside the zone of punctuated equilibrium"), each with its own suggestion.
  Still one rule, one badge on one bar; the finding names the half that failed,
  and the carrier wins when both do — a symbol attached to nothing has to find
  something to be about before where it sits can mean anything.
  `com.labre.wardley.validation.inertia-off-transition` and its suggestion key
  are gone; a host shipping a catalogue replaces them with the two above.
- `AttachmentDef.boundaryTolerance` is replaced by the frame's declared band.
  A rule asking for a boundary against a background that declares none warns
  once and drops the requirement rather than indicting every subject.
- `backgroundTransitionBands()` guards the declared width: `<= 0` warns and
  drops the requirement (no silently inverted band), and a width wider than the
  gap between two transitions warns and is narrowed to that gap (no silently
  overlapping bands).
- **`Violation.boundaryId`** names the frontier a finding is about
  (`custom-built|product`) — the nearest band the subject missed, so "outside
  the equilibrium zone" also says which zone. Absent when the carrier is what
  failed.
