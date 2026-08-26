---
'@labre/affine-block-callout': patch
---

fix(blocks): a callout you can actually write in

Three things were wrong at once inside a callout, and all three came from the
same place: the surrounding keymaps step aside for a callout child, and nothing
took over.

- **Backspace** at the start of a line only selected the whole callout. It now
  merges the line into the one above, formatting included, with the caret at
  the seam — exactly as it behaves everywhere else. It still selects the
  callout on the first line, without deleting the text.
- **Enter** did nothing at all. It now breaks the line in two inside the
  callout; at the end of a line it opens an empty one.
- **The slash menu refused to open** anywhere inside a callout. Its guard sat
  at config level, and the widget ORs every config's guard together before
  deciding — so one block's rule silenced the whole menu. The rule moved onto
  the Callout entry itself, which is the only thing the schema forbids there.

Clicking an empty callout now gives it a paragraph and the caret, and the emoji
sits level with the first line instead of floating.
