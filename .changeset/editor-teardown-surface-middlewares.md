---
'@labre/std': patch
---

An unmounted editor no longer stays in memory through its document's canvas
surface. `SurfaceMiddlewareExtension` installed the editor's surface
middlewares on the store's surface model and never took them out, so a host
that keeps its workspace open kept one detached editor (its std, DI
container and DOM tree) per document opened on the canvas, and a write to the
surface with no editor mounted still ran the unmounted editor's `beforeAdd`
(last-used props, layer index). The editor now takes its middlewares back on
unmount, unless a later editor has installed its own (a mode switch), and a
store with no surface no longer keeps the effect waiting for one after the
editor is gone.

`SurfaceBlockModel.applyMiddlewares(middlewares)` now returns a function that
removes them again if they are still the installed ones; callers that ignore
the result keep the previous behaviour.

Hosts: call `workspace.dispose()` when a workspace goes; its awareness
interval otherwise keeps the workspace, its stores and their blocks
reachable (docs/integrate/02-mount.md).
