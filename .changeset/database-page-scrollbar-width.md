---
'@labre/affine': patch
---

A full-page database long enough to scroll down no longer shows a horizontal scrollbar. Its widths (the heading, the root's inset, the sticky view bar) read `100cqw` of the page's scroller, which in Chrome counts the vertical scrollbar, so the page overflowed sideways by that scrollbar's width; they now read the editor host, a child of the scroller, and the heading is `100%` wide.
