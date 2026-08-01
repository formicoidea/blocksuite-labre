---
'@labre/affine-block-surface': minor
'@labre/affine-shared': minor
---

feat(edgeless): tell me what is wrong, and keep telling me (PF7)

The validation affordance stopped at "something here is off": a mute amber
bracket, drawn for as long as the violation held. It answered neither of the
two questions a user actually has — _what_ is wrong, and _is it still wrong an
hour later_. This slice answers both, on two clocks.

- **The moment it happens.** A violation that APPEARS flashes its bracket at
  full strength for three seconds, then fades out over half a second. That is
  when the user still remembers the gesture that caused it and can undo it in
  one move.
- **For as long as it holds.** Once — and only once — the bracket has finished
  fading, a small amber badge takes its place, just outside the anchor's
  top-right corner. The two are never on screen together. A board left
  overnight still shows what it breaks, without a canvas full of brackets.
- **On demand.** Clicking either marker opens a bubble naming the rules broken
  on that anchor: label, severity, and remediation hint when the rule carries
  one. It closes on a click elsewhere, on Escape, or on pan/zoom, and flips
  above or to the left of its marker rather than run off the viewport. Clicking
  a marker does not select the shape underneath — the pointer pair is stopped
  there, so neither selection nor a drag starts.

Both markers are sized in MODEL units and scale with the board, like the
elements they annotate. Screen-constant annotations are right for a transient
snap guide and wrong here: on a hundred-component map, zoomed out, they grow
relative to the content until the marks are all you can see. Zoomed out far
enough these shrink with everything else — deliberately. The exception is the
click target, which keeps a 44 px screen floor as invisible padding around the
model-sized visual, so a badge three pixels wide is still reachable by thumb
(the pattern `edgeless-auto-complete` already uses on this canvas). The bubble
stays in screen pixels: prose rendered at quarter size is not smaller prose,
it is unreadable prose.

The bubble consumes normalised violation OBJECTS and nothing else: no rule
logic reached the UI, and no rule wording is hard-coded in the library. Rule
labels are i18n keys resolved through a new, optional host seam
(`TranslationExtension` / `TranslationProvider` in `@labre/affine-shared`,
mirroring `TelemetryExtension`). With no catalogue registered the raw key is
shown rather than a sentence the library invented for somebody else's rule;
only the bubble's own chrome — the severity chip — carries an English default.

Anchoring is unchanged and shared with the bracket: one badge per outermost
enclosing group. The bubble lists one line per RULE broken on that anchor, not
one per element — two components of a group both drawn off the map are two
violations on the signal, but repeating the same sentence twice would say
nothing extra.

`audit` violations are now excluded from the canvas affordance, as their
severity has always said they should be: collected for reporting, invisible to
the drawing user. They still reach `violations$` untouched, for a host panel.

Escape is taken only within the editor host, never on `document`: with a bubble
open it dismisses the bubble instead of clearing the canvas selection, and a
library has no business making that call for the whole page.

Nothing here touches evaluation, the violation object or the 16 ms budget, and
nothing is written to the document — the "first seen" timestamps that drive the
flash are session state, rebuilt on every reload, so a document records which
rules it breaks and never when you happened to look. No clock runs without a
violation: the fade's animation frames stop by themselves once every mark has
settled, the single timer that wakes the badge for the handover is armed only
while a bracket is still up, and the element-tracking subscription only exists
while something is flagged.
