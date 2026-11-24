---
'@labre/std': patch
---

An editor unmounted while active (removed after a click, a focus or with the
pointer over it) is no longer kept in memory by `UIEventDispatcher`, whose
active dispatcher is a static: it stayed there, with its std, DI container
and detached DOM tree, until another editor was activated. `unmounted()` now
deactivates the dispatcher, so `std.event.active` reads `false` after the
editor is removed.
