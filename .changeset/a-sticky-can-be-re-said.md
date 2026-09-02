---
'@labre/affine-gfx-ddd-event-storming': minor
---

feat(edgeless): event storming stickies morph into any sticky kind

A selected sticky now carries the **Change type** dropdown on its contextual
toolbar, so an orange square that turns out to have been a command becomes one
in a click — no delete, no redraw, no reconnecting the flows that already point
at it, no retyping the words.

The reachable set is the whole notation, in one family: nine kinds, in the
order the grammar reads them (`domainEvent`, `command`, `aggregate`, `actor`,
`constraint`, `policy`, `readModel`, `system`) with the **hotspot** last. Event
Storming is a wall of identically-shaped paper whose colour is the claim, so
splitting the kinds into families would be inventing a hierarchy the method
does not have — and "this sticky is really a question" is the single most
common thing a workshop discovers, which is why the diamond is in the family
rather than beside it.

One pick rewrites the face's role, its two colours and its silhouette; the
faux drop shadow behind it changes silhouette with the face (a diamond over an
untouched rectangle would float on a smudge), and the words follow only when
they are still the notation's own prompt — anything the workshop wrote is
theirs. All of it lands in a single ctrl+z.

`xywh` is untouched, as it is for every morph: an **aggregate** is born at 160
against the standard 120, and keeps that room when it becomes a command. The
paint says what a sticky means; the size says how much room the author gave it.

A sticky placed before roles existed (pre-WS5) carries none, so it has no kind
to change and is not offered the menu — nothing is backfilled. The dropdown is
gated by the `ddd-event-storming` flag like the rest of the framework's
tooling: switching it off takes the menu away and leaves every stored board
painting, loading and validating exactly as before.
