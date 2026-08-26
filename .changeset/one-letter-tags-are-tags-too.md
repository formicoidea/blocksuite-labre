---
'@labre/data-view': patch
---

Typing a letter into a select cell searches instead of creating a broken tag

Start typing over a focused select or multi-select cell and the first character
was pushed through the generic "set this cell from a string" path. For a tag
column that meant fabricating a tag out of a single character, and the picker
then opened with an empty search box — so a one-letter tag could neither be
found nor selected, only accidentally created.

The typed character is now staged on the cell and handed to the tag picker as
its initial search text. Typing `C` over a status cell opens the picker already
filtered to `C`: existing one-letter tags show up and can be picked, and
creating a new one stays a deliberate choice. Text, number and date columns keep
the old behaviour.
