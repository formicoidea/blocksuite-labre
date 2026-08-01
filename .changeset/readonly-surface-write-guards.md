---
'@labre/affine-block-surface': patch
'@labre/affine-block-root': patch
'@labre/affine-gfx-group': patch
---

fix(edgeless): a readonly document refuses surface-element writes

`store.transact` carries no readonly guard (unlike the store's block CRUD),
so several gestures wrote into a readonly document. From the PR #89 recon:

- **Central guard** in `EdgelessCRUDExtension` (`addElement`,
  `updateElement`, `deleteElements`, `removeElement`) — the write bottleneck
  for apply-last-style, group creation, duplicate and the toolbars.
- `ValidationManager.setException` / `setProfile` / `revokeExceptionsOn`
  refuse and return empty/false, which also keeps their callers' telemetry
  silent — a write that never happened is never reported.
- Keyboard sites that bypass crud: mindmap node text overwrite on
  letter-typing (both the wrapped hotkeys and the generic keyDown listener),
  mindmap `addNode` on Enter/Tab, arrow-key element moves, Backspace/Delete
  deletion, and the group/ungroup commands (guarded **before** their
  `removeChild` calls, which used to run even when the follow-up
  `addElement` would refuse).

Arrow-key mindmap **navigation** and tool switching stay available on a
readonly board — only writes are refused.
