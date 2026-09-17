---
'@labre/affine': patch
'@labre/affine-block-surface': patch
'@labre/affine-gfx-uml': minor
---

feat(blocks): the UML pack's last displayed strings cross the translation seam (ADR 0023). Its automatic legend resolves its box title through the shared `BOARD_LEGEND_TITLE` and its three sections ("Elements", "Frames", "Relations") through keys of its own; its Templates category resolves its tile name through the senior button's `com.labre.framework.uml`; and the nineteen fixed-wording remarks the PlantUML, XMI and draw.io readers and the shared materializer put in an import report now carry a key and its `{{name}}` parameters, resolved at report time like BPMN's. The surface's own "same provisional name" remark is keyed with them. Every one of them reads exactly as before with no `TranslationProvider` registered, with one wording change the seam asks for: the XMI reader's "N elements are declared inside another" is now the plural-neutral "{{count}} element(s) are declared…", since agreement is the host's.
