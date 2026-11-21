import type { DatabaseBlockModel } from '@labre/affine-model';

/** What the database block's root renderer offers (`DataViewRootUI`). */
export interface FocusRestorer {
  restoreFocus(): Promise<void>;
}

/**
 * The focus after a removal that leaves the block with no view (ADR 0035
 * amendment of 2026-11-20, WCAG 2.4.3). A menu opened from the keyboard
 * gives the focus back when it closes (`popupTargetReturningFocus`), but a
 * host that intercepts the deletion (`DataSourcePickerService.deleteView`)
 * asks first, often in a dialog of its own, and calls `remove()` later:
 * the view is still there when the menu closes, the "⋯" takes the focus
 * back, then the removal takes the "⋯" away and the focus falls to the
 * body. So every LOCAL write of `views` that leaves none (the direct
 * removal, the host's `remove()`, an undo or redo of either) asks the
 * renderer to `restoreFocus`, which moves it only when nobody holds it once
 * the empty state has drawn. A peer's removal moves nothing.
 *
 * The host's side: close your dialog, its own focus return included,
 * before you call `remove()`. A dialog still holding the focus at that
 * moment keeps it, and returns it to the "⋯" that the removal takes away.
 */
export function focusAfterLastViewRemoved(
  model: DatabaseBlockModel,
  renderer: () => FocusRestorer | null
) {
  // Never rejects: a host's broken element must not break the removal.
  const restore = async () => {
    try {
      await renderer()?.restoreFocus();
    } catch (error) {
      console.error(error);
    }
  };
  return model.store.slots.blockUpdated.subscribe(event => {
    if (event.type !== 'update' || event.id !== model.id) return;
    if (!event.isLocal || event.props.key !== 'views') return;
    if (model.props.views.length > 0) return;
    void restore();
  });
}
