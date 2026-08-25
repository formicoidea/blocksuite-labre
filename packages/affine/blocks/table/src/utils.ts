/**
 * The affordances a table drags with its own mouse listeners: the column
 * width grip and the column/row drag handles.
 */
const TABLE_DRAG_HANDLE_SELECTOR =
  '[data-width-adjust-column-id], [data-drag-column-id], [data-drag-row-id]';

/**
 * Whether an event started on one of those affordances. In edgeless the canvas
 * claims `pointerdown`/`dragStart` before the table sees them, which turns a
 * column resize into a canvas drag; the controller uses this to keep the
 * gesture for itself.
 */
export const isTableDragHandle = (target: EventTarget | null): boolean =>
  target instanceof Element && !!target.closest(TABLE_DRAG_HANDLE_SELECTOR);

export const cleanSelection = () => {
  const selection = window.getSelection();
  if (selection) {
    selection.removeAllRanges();
  }
};
