---
'@labre/affine-widget-edgeless-selected-rect': patch
'@labre/affine-block-surface': patch
'@labre/affine-block-root': patch
'@labre/affine-gfx-group': patch
'@labre/std': patch
---

fix(edgeless): a readonly board refuses element moves, resizes and tool arming

Surface-element writes go through `store.transact`. `SurfaceBlockModel` does
throw on readonly, but that is an exception raised at the bottom of a gesture:
several paths never reach it, and the ones that do surface an uncaught error on
`window` instead of a clean refusal.

What actually changes on a readonly board:

- **The mouse no longer moves anything.** `DefaultTool.dragStart` went straight
  to `handleElementMove`, which writes `xywh` through a `@field()` accessor —
  raw `store.transact`, no crud, no exception. A drag on a readonly board wrote
  into the Yjs document exactly as on an editable one. Panning and rubber-band
  selection stay available; moving content, alt-drag cloning and resizing do
  not. `InteractivityManager.handleElementMove` / `handleElementResize` /
  `handleElementRotate` / `requestElementClone` carry the same guard as a
  backstop.
- **`edgeless-selected-rect` drops its 8 resize handles.** The gate existed but
  only ran on selection change, so a board switched to readonly while something
  was selected kept its handles — and dragging one wrote.
- **Creation-tool shortcuts refuse to arm** (`p`, `Shift-p`, `c`, `t`, `n`,
  `f`, `e`). They call `surface.addElement` / `store.addBlock` directly and
  raised uncaught `BlockSuiteError`s on `window`. Selection, pan and the
  presentation navigator still switch.
- **`createGroupFromSelectedCommand` / `ungroupCommand`** refuse **before**
  their `removeChild` calls, which used to run even though the follow-up
  `addElement` would refuse — orphaning the selection out of its parent group,
  or dissolving the group outright on `Shift+Mod+G`. This is the one
  destructive bug of the set.
- **Mindmap keyboard writes**: node text overwrite on letter-typing (both the
  wrapped hotkeys and the generic keyDown listener), `addNode` on Enter/Tab,
  arrow-key element moves (arrow **navigation** stays), Backspace/Delete.
- **`ValidationManager.setException` / `setProfile` / `revokeExceptionsOn`**
  return empty/`false`; every caller gates its `track` on those returns, so a
  write that never happened is never reported.
- **`applyLastStyle`**: no targets, so the command's `when` fails and the
  keystroke falls through to the `redo-windows` alias that shares Mod+Y on
  Windows.

`EdgelessCRUDExtension` (`addElement` / `updateElement` / `deleteElements` /
`removeElement`) and `EdgelessRootService.removeElement` / `reorderElement` now
refuse with a `console.error` instead of letting the model throw — the same
contract as `store.updateBlock` / `deleteBlock` / `moveBlocks`. That is a change
of failure MODE, not a new refusal: the surface model already said no.

`framework/store` and `sync` are untouched.
