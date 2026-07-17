---
'@labre/store': minor
---

Export a public production `Workspace`: `WorkspaceImpl`

`@labre/store` now exports `WorkspaceImpl` (and `DocImpl` / `WorkspaceMetaImpl`)
from its main entry — a production-blessed, self-contained `Workspace` that
owns its root `Y.Doc` and defaults to inert in-memory sync engines (the host
wires persistence/sync on the exposed `Y.Doc`s, or passes real
`docSources`/`blobSources`). Previously the only `Workspace` implementation was
`TestWorkspace`, marked `@internal / do not use in production` and reachable
only from the `store/test` subpath, so the consuming app had to build its
production workspace on a test class.

`WorkspaceImpl` and `TestWorkspace` are independent siblings of a shared
internal `WorkspaceBase` (neither extends the other), so test-only evolutions
never reach production. `TestWorkspace` stays exactly where it is under
`store/test`; all existing test/playground imports are unchanged.
