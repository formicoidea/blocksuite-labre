---
'@labre/affine-block-note': patch
---

Clicking a note title on the canvas puts the caret in the title

Entering a note on the canvas always routed the click through the note's
content: the click point was clamped into the children container, so a click
anywhere on the note title landed in the first line of the body instead. The
title was reachable only by clicking the body first and then arrowing back up.

A click that falls inside the title band is now honoured where it fell. Clicks
on the body keep the clamp that keeps them inside the text.
