---
'@labre/affine-block-surface': minor
'@labre/affine-gfx-bpmn': patch
'@labre/affine-gfx-uml': patch
'@labre/affine-gfx-wardley': patch
---

Interchange readers are linear in the file and bounded in what they hold (ADR 0012, amendment "bounded").

- `readXml` refuses a document past 200 000 nodes or 2 MiB of decoded characters (`XML_MAX_NODES`, `XML_MAX_CHARACTERS`, options `maxNodes` / `maxCharacters`) while reading, with an `InterchangeImportError` keyed `com.labre.interchange.xml.too-large`. In conformant mode (BPMN, SVG) it stops at its first note.
- Namespaces resolve in one lookup per name (`XmlNamespaceScope`); an orphan close tag no longer searches the stack; a draw.io `<diagram>` is found without a backtracking regex; BPMN and XMI keep foreign children and attributes in place, in bags with no prototype, and an element named `constructor` reads as any unknown element.
- The SVG sanitizer cuts at 256 levels and below a removed element before reading anything there, keeps only a `<style>`'s own text, and refuses `image-set(…)` as it refuses `url(…)`.
- No `Math.min(...xs)` over a file's values and no recursion in `serializeXmlNode`: a 100 000-point polygon or a 100 000-deep tree no longer throws `RangeError`.
- The UML readers, served by `./interchange`: PlantUML source past 1 MiB is refused (`PLANTUML_MAX_CHARACTERS`) and a guillemet group is read up to 256 characters; XMI nested past 1 000 levels is refused (`XMI_MAX_DEPTH`); draw.io labels lose their tags without a backtracking regex; the materializer bounds boxes with loops; every table read by a word of the file has no prototype, so `<<constructor>>` stays a stereotype and residue attributes under the id `__proto__` are kept.
- `readXml` quotes a name to 64 characters in a note and lists 100 notes (`XML_MAX_NOTES`), then one `+N more` note.
- The Wardley SVG recogniser finds each text's first span in one pass.
- New translation keys: `com.labre.interchange.xml.too-large`, `com.labre.uml.import.plantuml.too-large`, `com.labre.uml.import.xmi.too-deep`.
