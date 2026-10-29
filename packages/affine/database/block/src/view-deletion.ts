import type { DatabaseBlockModel } from '@labre/affine-model';
import type {
  DataSourcePickerService,
  DataSourcePickerViewDeletion,
  DataSourcePickerViewRef,
} from '@labre/affine-shared/services';
import type * as Y from 'yjs';

/**
 * A host decides what a deleted view takes with it (ADR 0035 amendment of
 * 2026-10-29). Labre sends a source to its trash with the last view reading
 * it, and must confirm that BEFORE the view goes, then restore it when the
 * removal is undone. So the delete gesture of a view of a host database
 * becomes a request (`DataSourcePickerService.deleteView`) whose `remove()`
 * is the 1.0 removal, and the undo step it makes is tagged so an undo or a
 * redo of it reaches `viewHistory`.
 *
 * The tag rides in the undo step's `meta`. Yjs builds a NEW step for the
 * opposite stack while it pops one ('stack-item-added' with the undo manager
 * as origin, fired inside the pop's transaction, before 'stack-item-popped'),
 * so the tag is carried over to that step, and an undo, redo, undo… chain
 * keeps reporting. Remote updates never pop a step: they report nothing.
 */

const VIEW_REMOVED = 'labre:database-view-removed';

type StackItem = Y.UndoManager['undoStack'][number];

interface HistoryWatch {
  picker: DataSourcePickerService;
}

// One listener pair per undo manager, whatever the number of blocks: the
// step outlives the block's data source (a block remounted after a mode
// switch, or unmounted, still has its removals undone).
const watches = new WeakMap<Y.UndoManager, HistoryWatch>();

function isViewRef(value: unknown): value is DataSourcePickerViewRef {
  if (typeof value !== 'object' || value === null) return false;
  const ref = value as Record<string, unknown>;
  return (
    typeof ref.databaseId === 'string' &&
    typeof ref.viewId === 'string' &&
    typeof ref.docId === 'string' &&
    typeof ref.blockId === 'string'
  );
}

function watchHistory(
  undoManager: Y.UndoManager,
  picker: DataSourcePickerService
): void {
  const known = watches.get(undoManager);
  if (known) {
    known.picker = picker;
    return;
  }
  const watch: HistoryWatch = { picker };
  watches.set(undoManager, watch);
  let replay: StackItem | null = null;
  undoManager.on('stack-item-added', event => {
    if (event.origin === undoManager) replay = event.stackItem;
  });
  undoManager.on('stack-item-popped', event => {
    const opposite = replay;
    replay = null;
    const ref: unknown = event.stackItem.meta.get(VIEW_REMOVED);
    if (!isViewRef(ref)) return;
    opposite?.meta.set(VIEW_REMOVED, ref);
    try {
      watch.picker.viewHistory?.(ref, event.type);
    } catch (error) {
      // A host failure must not break the undo itself.
      console.error(error);
    }
  });
}

/**
 * Deletes view `viewId` of `model`, through the host's `deleteView` when it
 * has one and the block shows one of its databases; at once otherwise.
 * `removeNow` is the 1.0 removal (one undo step); `afterRemove` runs after a
 * removal the host asked for (the view to show next).
 */
export function deleteViewThroughHost(options: {
  model: DatabaseBlockModel;
  viewId: string;
  picker: DataSourcePickerService | null;
  removeNow: () => void;
  afterRemove: () => void;
}): void {
  const { model, viewId, picker, removeNow, afterRemove } = options;
  const store = model.store;
  const databaseId = model.props.externalSourceId;
  const deleteView = picker?.deleteView;
  if (!picker || !deleteView || !databaseId || store.readonly) {
    removeNow();
    return;
  }
  const view = model.props.views.find(v => v.id === viewId);
  if (!view) return;

  const ref: DataSourcePickerViewRef = {
    databaseId,
    viewId,
    docId: store.id,
    blockId: model.id,
    ...(view.sourceId === undefined ? {} : { sourceId: view.sourceId }),
  };
  let used = false;
  const request: DataSourcePickerViewDeletion = {
    ...ref,
    viewName: typeof view.name === 'string' ? view.name : '',
    remove: () => {
      if (used || store.readonly) return false;
      if (!model.props.views.some(v => v.id === viewId)) return false;
      used = true;
      const undoManager = store.history.undoManager;
      watchHistory(undoManager, picker);
      let added: StackItem | null = null;
      const grab = (event: { stackItem: StackItem }) => {
        added = event.stackItem;
      };
      undoManager.on('stack-item-added', grab);
      try {
        removeNow();
      } finally {
        undoManager.off('stack-item-added', grab);
      }
      (added as StackItem | null)?.meta.set(VIEW_REMOVED, ref);
      afterRemove();
      return true;
    },
  };
  deleteView.call(picker, request);
}
