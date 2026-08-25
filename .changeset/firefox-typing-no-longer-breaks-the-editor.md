---
'@labre/std': patch
---

Typing in Firefox no longer breaks the text it lands in

Firefox reports selection boundaries inside `contenteditable` differently from
Chrome — sometimes on a non-text node, sometimes on one of the comment markers
Lit leaves between rendered fragments. The inline editor used `Range.comparePoint`
against those boundaries to decide whether an input belonged to it, so in Firefox
a keystroke could be judged "outside" and let through to the browser. The native
edit then removed a Lit marker node, and the next render of that paragraph threw
`ChildPart has no parentNode` — the block stopped updating for the rest of the
session.

The editor now decides ownership with plain DOM containment, always takes over
the edit rather than letting the browser mutate its DOM, and falls back to the
event's own target range (or a clamped selection, or a re-render) when the
selection cannot be resolved. A selection that genuinely reaches into a
neighbouring paragraph is still left to the range binding, and an unresolvable
target range no longer swallows the keystroke.
