---
'@labre/affine-block-attachment': minor
---

A reader of a read-only document can download an attachment (#744, ADR 0058).
The toolbar that holds Download is never shown on read-only, and the canvas
viewer does not mount it, so nothing let the reader get the file.

- On a read-only document, an attachment card draws a « Download » button
  (in the size line of a horizontal card, beside the title of a vertical
  one), and an embedded attachment draws it over its top-left corner (beside
  the player for audio). It is a real button, in the tab order, pressed by
  Enter and Space, with the keyboard focus ring, named « Download
  <file name> ». It runs the toolbar's own download and writes nothing to the
  document. It works on the canvas and in the read-only canvas viewer: a
  press on it neither pans nor selects. An editable document looks exactly
  as before: no button.
- The host's peek view (`PeekViewProvider`) now opens any attachment on a
  read-only document, not only a PDF (upstream toeverything/AFFiNE#15905,
  268371c). On an editable document only a PDF opens, as before; without a
  peek provider nothing opens.

New key for the host's catalogue (the French line is information for the host, which owns that catalogue):

- `com.labre.attachment.button.download` — « Download {{name}} », the
  button's accessible name and tooltip; `{{name}}` is the file's full name.
  Its visible word is the existing `com.labre.toolbar.download`.
  French: « Télécharger {{name}} ».
