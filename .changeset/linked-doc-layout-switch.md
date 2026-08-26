---
'@labre/affine-widget-linked-doc': patch
---

fix(blocks): switching keyboard layout no longer closes the @ popover

Typing `@`, then pressing Alt+Shift to switch keyboard layout — the ordinary
gesture of anyone writing in two languages — closed the linked-doc popover and
threw away the query. The browser reports that switch as a keydown whose key is
`GroupNext` or `GroupPrevious`, and the popover's shared keydown observer reads
"a modifier plus another key" as a reason to abort.

The popover now swallows those two keys: the layout changes, the popover, the
query and the selection stay exactly as they were.
