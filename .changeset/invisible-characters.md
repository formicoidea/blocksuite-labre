---
'@labre/affine': minor
---

Special characters. Two new core commands on the palette, the agent and the host's view menu (`getViewActions`), in both views:

- `text.invisibles.toggle` ("Show special characters", `checked`): this viewer sees a dot per space, an arrow per tab, a degree sign per no-break space, a red mark per invisible character, and ↵ / ¶ at line ends. Nothing is written to the document; the choice is kept per viewer in `localStorage`. A host may set the default with the new optional `showInvisibles` field of `EditorSettingProvider` (absent: off). Telemetry `InvisibleCharactersToggled { visible }`.
- `text.invisibles.remove` ("Remove invisible characters", editable documents only): strips the zero-width spaces (U+200B), word joiners (U+2060), BOMs (U+FEFF), soft hyphens (U+00AD), U+180E, the invisible operators (U+2061–U+2064), the tag characters (U+E0000–U+E007F) and stray zero-width joiners from every text of the document — paragraphs, title, table and database cells, canvas labels — in one undo step. Code blocks, emoji sequences, subdivision flags, the ZWNJ (U+200C) and the French no-break spaces (U+00A0, U+202F) are kept. Toast through the notification seam (`com.labre.command.text.invisibles.removed`, `{{count}}`); telemetry `InvisibleCharactersRemoved { count, blockCount }`.

The inline editor now tells a placeholder from text by the `data-v-empty` attribute, not by its content: a zero-width space a user stored alone in a run no longer shifts the caret.
