---
'@labre/affine-block-code': patch
---

Code block line numbers answer to a global preference, not only to each block

Turning line numbers off was a per-block chore: every new snippet came back
with them, and there was no way to state the preference once.

A code block now resolves the question in three steps — the embedder's feature
flag still overrules everything (mobile keeps line numbers off), then the
block's own toolbar override, then a global default read from the host's
`EditorSettingProvider` under the `codeBlockLineNumbers` key. The library reads
that setting and never writes it: persisting the preference is the host's
business, the same seam as the telemetry adapter. With no setting service
injected the default stays "shown", so nothing changes for a standalone editor.
