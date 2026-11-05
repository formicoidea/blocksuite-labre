---
'@labre/affine': patch
---

A Wardley pipeline now carries a nature (activity, data, practice or knowledge)
like a component: the qualification entry of its contextual toolbar offers the
`wardley:nature` tag on the pipeline body, whether the pipeline was drawn or
morphed, and never on its handle. The pipeline keeps its own role (no parent),
so a component placed on a pipeline raises no overlap finding. The reading panel
and the renderer JSON export do not read a pipeline's nature yet. Nothing
persisted changes (ADR 0046, amendment of 2026-11-04).
