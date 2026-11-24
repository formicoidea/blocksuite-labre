import type {
  DataSourcePickerService,
  DataSourcePickerViewPlacement,
} from '@labre/affine-shared/services';
import type { Store } from '@labre/store';

/**
 * A host confirms the placement of a view of one of its existing sources
 * before the library writes it (ADR 0035 amendment of 2026-11-22, issue
 * #701), the symmetric of `deleteViewThroughHost`. In Labre, placing a view
 * of a source in a page gives that page's audience a path to the source, so
 * the host announces it and lets the reader cancel. Observing the view once
 * it landed would not do: a view arriving by sync is no placement, and a
 * cancel could no longer prevent the write.
 *
 * Only a gesture calls this, so an undo, a redo, a paste, a template or a
 * remote change never reaches the host.
 */
export type ViewPlacementRef = Omit<DataSourcePickerViewPlacement, 'place'>;

/**
 * Places the view through the host's `placeView` when it has one, at once
 * otherwise (the 4.1 gesture). `placeNow` writes it as one undo step and
 * says whether it wrote anything; it runs at most once, and never on a
 * document that turned read-only, or for a block deleted, while the host
 * was asking.
 */
export function placeViewThroughHost(options: {
  picker: DataSourcePickerService | null | undefined;
  store: Store;
  /** `null`: not a view of a host database, placed at once. */
  ref: ViewPlacementRef | null;
  placeNow: () => boolean;
}): void {
  const { picker, store, ref, placeNow } = options;
  const placeView = picker?.placeView;
  if (!placeView || !ref || store.readonly) {
    placeNow();
    return;
  }
  let used = false;
  placeView.call(picker, {
    ...ref,
    place: () => {
      if (used || store.readonly) return false;
      // The host may answer late: a block a peer deleted meanwhile takes
      // no view (4.1 wrote within the click, so had no such window).
      if (ref.blockId !== undefined && !store.getModelById(ref.blockId)) {
        return false;
      }
      used = true;
      return placeNow();
    },
  });
}
