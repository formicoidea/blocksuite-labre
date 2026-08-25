---
'@labre/affine-block-surface': patch
'@labre/affine-gfx-wardley': patch
---

W2 only speaks while the dashed columns are on the map

An inertia bar is judged against the phase divider it straddles. Hide the
dividers — the "Columns (dividers)" toggle of the Wardley toolbar — and the
verdict was still being handed down against a line that is no longer on the
canvas: a warning whose only suggestion ("slide the bar until it sits astride
the dashed line") pointed at nothing the user could see. W2 is now ACTIVE only
while the columns are displayed.

**Scoped, not weakened.** Nothing about the rule's geometry changed. Switch the
columns back on and every finding comes back, on the same bars, in the same
places, with the same wording — and the four other visibility toggles of a
Wardley map (axes, phase labels, corner labels, visibility labels) leave W2
exactly where it was. The other three rules are untouched with the columns
hidden: a toggle that switched the whole check-up off would be a toggle nobody
would dare use.

**The condition is data, and the engine still names no framework.** The dividers
are drawn from `axes[].ticks.visibleProp`, and that is the field the rule now
reads: the transition bands are resolved against the INSTANCE being measured, so
a frame whose graduations are hidden yields no band and asks nothing of the
symbols on it — the same silence a frame that declares no transition at all
already produced. A framework that offers no such toggle is bit-for-bit
unaffected, and the reading pass, which describes what a map MEANS rather than
what it draws, still sees every declared frontier.

**The toggle re-judges live.** The props worth re-evaluating for are no longer a
constant: the manager derives them from the declarations it was handed, so a
framework's own visibility prop wakes the engine exactly like a move does.
Hiding the columns clears the marks on the spot instead of leaving them up until
some unrelated drag happened to wake it.

No document changes: `showColumnDividers` already existed and already defaulted
to shown, so every map ever drawn is judged today exactly as it was yesterday.
