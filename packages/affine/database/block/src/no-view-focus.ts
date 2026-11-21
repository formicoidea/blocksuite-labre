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
 * the empty state has drawn. The way back too: a local write that brings
 * a view back after none (an undo typed on the empty state's button, which
 * the view takes away) gives it to the view's "⋯". A peer's write moves
 * nothing: this rests on the transaction being remote, so a sync provider
 * that applies updates without an origin reads as local here.
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
  let hadViews = model.props.views.length > 0;
  return model.store.slots.blockUpdated.subscribe(event => {
    if (event.type !== 'update' || event.id !== model.id) return;
    if (event.props.key !== 'views') return;
    const hasViews = model.props.views.length > 0;
    const crossed = hasViews !== hadViews;
    hadViews = hasViews;
    if (event.isLocal && crossed) void restore();
  });
}
