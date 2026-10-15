---
'@labre/affine-block-surface': minor
'@labre/affine-model': minor
'@labre/affine-shared': minor
'@labre/affine': minor
'@labre/affine-gfx-bpmn': minor
'@labre/affine-gfx-c4': minor
'@labre/affine-gfx-uml': minor
'@labre/affine-gfx-wardley': minor
---

Readers run on a server, with no DOM and no editor (ADR 0012, P3 as amended).

- New editor-free subpaths: `@formicoidea/labre-core/interchange` (the interchange registry types, `InterchangeImportError`, `parseSvgSketch`, `sanitizeSvg`, `readXml` and its DOM-shaped view `XmlElement`) and `./interchange` in the bpmn, c4, uml and wardley framework bundles (their import capabilities and the exporters that need no editor). Together about 350 KiB minified; they load under plain Node ESM and Deno. Also `./model/headless` and `./shared/headless` in core, which they import.
- The BPMN reader and the SVG sketch no longer use `DOMParser` or DOMPurify. BPMN reads in linear time (2 000 tasks: 235 ms under Node). A `DOCTYPE` is skipped and no entity it declares is expanded or fetched; a declared `&name;` stays those characters where a DOM used to refuse the file or expand it.
- `sanitizeSvg` is an allow-list on the read tree and returns an `XmlElement` instead of a DOM `Element` (same members the readers used: `localName`, `namespaceURI`, `attributes`, `getAttribute`, `children`, `childNodes`, `textContent`, `parentElement`, `querySelector(All)` for compound selectors). It removes every `on*` attribute, every `javascript:`, `vbscript:` or `data:` value (an inline PNG, JPEG, GIF or WebP on `<image>` excepted), every `url()` that is not a `#ref`, `<use>`, `<foreignObject>`, `<script>` and the animation elements, and cuts what is nested past 256 levels. An id such as `links` is kept (no DOM, nothing to clobber).
- `decodeDrawio` refuses a `<diagram>` that inflates past 20 MiB (`DRAWIO_MAX_INFLATED_BYTES`), reading the stream with a count instead of buffering it, and an import over the host's `FileSizeLimitProvider` limit is refused before the file is read.
- Constants that lived beside element classes in `@labre/affine-model` moved to `consts.ts` files (UML frame, fragment, partition and region bands, the UML diagram kind, BPMN pool bands, shape text padding); every existing export path still exports them.
- `xml-reader` moved from the UML package to the surface package; UML still exports the same names.
- `scripts/build-bundles.mjs` (red zone, one conditional line): a framework bundle's `exports` gains `./interchange` when the package declares it.
- New translation keys: `com.labre.interchange.import.too-large`, `com.labre.interchange.svg.too-deep`, `com.labre.uml.import.drawio.error.no-decompression`, `com.labre.uml.import.drawio.error.empty-diagram`, `com.labre.uml.import.drawio.error.bad-payload`, `com.labre.uml.import.drawio.error.too-large`.
