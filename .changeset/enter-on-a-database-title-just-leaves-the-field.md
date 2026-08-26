---
'@labre/affine-block-database': patch
---

Enter on a database title no longer leaves a phantom record behind

Validating the title of a database with Enter — the one gesture everybody makes
after typing a name — prepended a row to the table. The user got a title and an
empty record they never asked for, at the top of their data, and the field kept
the caret so nothing signalled what had happened.

Enter now does what it looks like it does: it commits the title and leaves the
field. Adding a record stays where it belongs, on the "+" affordances of the
view. An Enter that only confirms an IME composition is still ignored, as
before.
