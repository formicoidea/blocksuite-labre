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
- New translation key: `com.labre.interchange.xml.too-large`.
