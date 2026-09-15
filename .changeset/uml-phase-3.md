---
'@labre/affine-gfx-uml': minor
'@labre/affine-model': minor
'@labre/affine': minor
---

UML 2.5.1 phase 3, sequence diagrams: the `sd` frame and the interaction it holds — lifelines with a named head and a dashed spine, execution bars, destruction marks, combined fragments whose operands are bands you add like a lane (alt, opt, loop, par, break, critical and the rest), and the `ref` interaction use. Five kinds of message (synchronous, asynchronous, reply, create, delete) draw §17.4.4's arrowheads and carry a parsed `name(args) : return` label; a sheet reads top to bottom, so the vertical order of the messages is the order of the conversation. Four rules, their readings, morphs, templates, toolbar and legend rows. PlantUML and XMI now **read** sequence diagrams as well as writing them — a `.puml` or a Papyrus `.xmi` opens as a drawn diagram, and a file this pack wrote comes back byte for byte — and draw.io recognises lifelines, destructions, fragments and messages best effort. Scope and exclusions in ADR 0022.
