---
'@labre/affine-block-callout': patch
---

fix(blocks): the callout emoji sits on the first line, whatever that line is

The emoji is a fixed 24px box beside a column whose first line may be an H1 or
an ordinary paragraph, and it carried a single hard-coded margin — so it hung
well above a heading, and the taller the heading the wider the gap.

Its drop is now read from the first child and follows it: turn the first line
into a heading and the emoji moves down with it, level with the text.
