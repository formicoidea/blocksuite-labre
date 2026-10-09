---
'@labre/affine-shared': minor
---

One drag-to-reorder for the side panels (ADR 0034). New `createPanelReorderDrag` and `panelReorderGap` in `@labre/affine-shared/utils`: the gesture the frame panel and the selection pane now both run on.

- The frame panel's drag runs on the controller the selection pane uses: pointer events, the 5px threshold, the drop line now drawn under the last card for a drop at the end (it was drawn at the top of the list), a read-only document offers no drag, and `pointercancel` or Escape cancel the drag without writing anything.
- The selection pane moves the whole selection when the pressed row is selected, provided the rows share one stack (otherwise every drop is refused with a `not-allowed` cursor); its ghost counts the moved rows. Escape now CANCELS a drag (ghost and line disappear, the release writes nothing) instead of waiting for the release.
- `canvas.element.reorder` accepts `ids` beside `id` (`{ ids, above }` moves several models of one stack as a block, in their relative order); new `reorderPaneElements` action in `@labre/affine-block-surface`. `{ id, above }` is unchanged.
- `FramePanelBody.domHost` is removed: nothing read it since the drag moved to the controller.
