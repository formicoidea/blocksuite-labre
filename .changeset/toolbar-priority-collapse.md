---
'@labre/affine-shared': minor
'@labre/affine-components': minor
'@labre/affine-widget-toolbar': minor
'@labre/affine-block-surface': minor
---

fix(edgeless): the contextual toolbar is one line, and gives way instead of wrapping

PO arbitration of 02/08/2026. The contextual toolbar of a selected element used
to WRAP when it ran out of width — which, on the map the PO was looking at, put
the "⋮" alone on a second line. A toolbar whose height depends on the selection
is a toolbar that moves under the cursor. It now stays one line at every width,
and spends its least important entries instead.

**The row measures itself.** Every render is measured once, whole; when it
overflows the cap the editor gives it, the widget re-renders it with the entries
that have to give way. Widen the editor and they come back — the collapse is a
view state and nothing about it is written to the document.

**Two ways to give way, in that order.** An entry that declares an `icon` AND a
`label` drops its label first and keeps it as its tooltip: a row of icons is
still a row of things you can click. Only then does an entry leave the row for
the "⋮" menu that is already there, where it keeps its FULL label and its
behaviour. Every entry that can shrink shrinks before any entry moves.

**Nothing in the widget names a framework.** Which entry gives way is decided
entirely by the entries' own config: a new `priority?: number` on every toolbar
action (higher stays on the row longer, `0` by default), plus whether the entry
has an icon and a label to trade. Say nothing and you keep exactly the order the
toolbar has today, minus the wrap — an entry rendered later gives way first. An
entry that brings its own template (`content`) or its own sub-actions is opaque
to the widget and keeps its place: the two qualification dropdowns keep their
text, because a dropdown nested inside a dropdown is worse than a dropdown that
stayed.

For our own tranches: **Read this component** gains an eye icon, so a tight row
turns it into an icon with a tooltip rather than pushing it into the menu; and
**Revoke exception** — rare, wordy, with no icon to fall back to — declares
`priority: -1` so it is the first entry to move, despite sorting early.

The measuring and re-rendering live in the widget; the arithmetic that decides
which entries are spent is a pure function in `@labre/affine-shared`, pinned by
its own unit suite.
