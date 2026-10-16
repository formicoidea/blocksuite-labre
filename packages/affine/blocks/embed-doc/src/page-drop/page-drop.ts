import { EdgelessCRUDIdentifier } from '@labre/affine-block-surface';
import {
  EMBED_CARD_HEIGHT,
  EMBED_CARD_WIDTH,
} from '@labre/affine-shared/consts';
import {
  type PageDrop,
  PageDropProvider,
  pageDropVerdict,
  TelemetryProvider,
} from '@labre/affine-shared/services';
import {
  calcDropTarget,
  getClosestBlockComponentByPoint,
  getLastNoteBlock,
  isInsideEdgelessEditor,
  matchModels,
} from '@labre/affine-shared/utils';
import { Bound, type IVec, Point } from '@labre/global/gfx';
import { type BlockStdScope, LifeCycleWatcher } from '@labre/std';
import { GfxControllerIdentifier, SurfaceBlockModel } from '@labre/std/gfx';
import type { BlockModel, Store } from '@labre/store';

const LINKED_DOC = 'affine:embed-linked-doc';

/** The canvas card's style, the one "Show here" and "Linked doc" insert. */
const CANVAS_STYLE = 'vertical';

/** Where the host's `undo` / `redo` ride on the card's undo step. */
const UNDO_HOOKS = 'labre:page-drop';

/** The drop line in a note: a block and which side of it. */
export interface PageDropLine {
  model: BlockModel;
  placement: 'before' | 'after';
}

/**
 * Where a dropped page's card goes (labre P7, ADR-0045 §7 amended
 * 2026-10-16), mirroring "Show here" (`fragments/doc-title`, `show-here.ts`):
 *
 * - on a drop line in a note (page view, or a note on the canvas): a block
 *   beside the line's block, climbing out of whatever cannot hold a card (a
 *   list item, a callout) to the first parent that can;
 * - on the canvas, off any note: a canvas card centred on the drop point,
 *   through the CRUD `addBlock`, which stamps the viewer's active layer
 *   (ADR 0031 §6), then selected;
 * - in the page view with no line (dropped under the content): the end of
 *   the last note.
 *
 * The caller owns the undo step (`captureSync` around it). Returns the new
 * card's id, or `null` when nothing was written (read-only, no root).
 */
export function placePageCard(
  std: BlockStdScope,
  pageId: string,
  at: { canvas: boolean; line: PageDropLine | null; point: IVec }
): string | null {
  const { store } = std;
  if (store.readonly || !store.root || !pageId) return null;

  let id: string | null = null;
  if (at.line) id = insertBeside(store, pageId, at.line);
  else if (at.canvas) id = insertOnCanvas(std, pageId, at.point);
  else id = insertAtEnd(store, pageId);

  if (id) {
    std.getOptional(TelemetryProvider)?.track('BlockCreated', {
      blockType: LINKED_DOC,
    });
  }
  return id;
}

function insertBeside(
  store: Store,
  pageId: string,
  line: PageDropLine
): string | null {
  let model: BlockModel | null = line.model;
  let placement = line.placement;
  while (model) {
    const parent = store.getParent(model);
    if (!parent) return null;
    if (store.schema.safeValidate(LINKED_DOC, parent.flavour)) {
      return (
        store.addSiblingBlocks(
          model,
          [{ flavour: LINKED_DOC, pageId }],
          placement
        )[0] ?? null
      );
    }
    // Out of a list item or a callout: the card goes after the container.
    model = parent;
    placement = 'after';
  }
  return null;
}

function insertAtEnd(store: Store, pageId: string): string | null {
  const root = store.root;
  if (!root) return null;
  const noteId =
    getLastNoteBlock(store)?.id ?? store.addBlock('affine:note', {}, root.id);
  return store.addBlock(LINKED_DOC, { pageId }, noteId);
}

function insertOnCanvas(
  std: BlockStdScope,
  pageId: string,
  point: IVec
): string | null {
  const gfx = std.get(GfxControllerIdentifier);
  const surface = gfx.surface;
  if (!surface) return null;
  const xywh = Bound.fromCenter(
    gfx.viewport.toModelCoordFromClientCoord(point),
    EMBED_CARD_WIDTH[CANVAS_STYLE],
    EMBED_CARD_HEIGHT[CANVAS_STYLE]
  ).serialize();
  const id = std
    .get(EdgelessCRUDIdentifier)
    .addBlock(LINKED_DOC, { pageId, xywh, style: CANVAS_STYLE }, surface);
  gfx.selection.set({ elements: [id], editing: false });
  return id;
}

/**
 * The drop line under a client point, as the editor's own file drop draws it
 * (`FileDropExtension.dropTarget$`): none on the canvas itself or on a block
 * that sits on it, only inside a note.
 */
export function dropLineAt(
  std: BlockStdScope,
  clientX: number,
  clientY: number
): PageDropLine | null {
  const point = new Point(clientX, clientY);
  const element = getClosestBlockComponentByPoint(point);
  if (!element) return null;
  const model = element.model;
  if (matchModels(std.store.getParent(model), [SurfaceBlockModel])) return null;
  const target = calcDropTarget(point, model, element);
  if (!target) return null;
  const placement = target.placement === 'before' ? 'before' : 'after';
  return { model: target.modelState.model, placement };
}

/**
 * Hangs the host's `undo` / `redo` on the undo step that holds the card (the
 * last one, the caller having opened it with `captureSync`), so one Mod+Z
 * removes the card AND puts back what the host did. Yjs gives a popped step's
 * twin (the redo step an undo creates, and back) a fresh `meta`: the hooks are
 * carried over at each pop. A step whose card was already gone (removed by
 * another peer) changes nothing, so Yjs skips it and the host's hooks are not
 * called: the page stays where the drop put it, nothing is lost.
 */
export function rideUndoStep(store: Store, drop: PageDrop): void {
  if (!drop.undo && !drop.redo) return;
  store.history.undoManager.undoStack.at(-1)?.meta.set(UNDO_HOOKS, drop);
}

/** The `stack-item-popped` half of {@link rideUndoStep}. */
export function runUndoHooks(
  store: Store,
  event: { stackItem: { meta: Map<unknown, unknown> }; type: 'undo' | 'redo' }
): void {
  const drop = event.stackItem.meta.get(UNDO_HOOKS) as PageDrop | undefined;
  if (!drop) return;
  const manager = store.history.undoManager;
  const twin =
    event.type === 'undo' ? manager.redoStack.at(-1) : manager.undoStack.at(-1);
  twin?.meta.set(UNDO_HOOKS, drop);
  if (event.type === 'undo') drop.undo?.();
  else drop.redo?.();
}

/**
 * Drops already placed: an editor nested in another (a synced page's
 * content) sees the same bubbling event as its host, and one drop is one card.
 */
const handled = new WeakSet<object>();

/**
 * The whole drop: ask the host, place the card in one undo step, hang the
 * host's hooks on it. A drop the host turns down, or a card that cannot be
 * placed, writes nothing (the host's own change is undone at once).
 */
export function dropPage(
  std: BlockStdScope,
  event: Pick<DragEvent, 'dataTransfer' | 'clientX' | 'clientY'>,
  canvas: boolean
): string | null {
  const { dataTransfer } = event;
  if (!dataTransfer || dataTransfer.files.length > 0) return null;
  if (handled.has(event)) return null;
  if (pageDropVerdict(std, dataTransfer) !== 'accept') return null;
  const service = std.getOptional(PageDropProvider);
  if (!service) return null;

  const { store } = std;
  const line = dropLineAt(std, event.clientX, event.clientY);
  handled.add(event);
  const drop = service.drop({ dataTransfer, docId: store.id });
  if (!drop) return null;

  store.captureSync();
  const id = placePageCard(std, drop.pageId, {
    canvas,
    line,
    point: [event.clientX, event.clientY],
  });
  if (!id) {
    drop.undo?.();
    return null;
  }
  rideUndoStep(store, drop);
  store.captureSync();
  return id;
}

/**
 * Mounts the page drop on the editor: a native drop the host accepts places
 * the page's card, and the history runs the host's hooks with the card's
 * undo step. Without a `PageDropProvider` nothing changes: `dropPage` returns
 * at the verdict.
 */
export class PageDropWatcher extends LifeCycleWatcher {
  static override readonly key = 'labre-page-drop-watcher';

  private readonly _onPopped = (event: {
    stackItem: { meta: Map<unknown, unknown> };
    type: 'undo' | 'redo';
  }) => runUndoHooks(this.std.store, event);

  override mounted() {
    super.mounted();
    const { std } = this;
    std.event.disposables.add(
      std.event.add('nativeDrop', context => {
        const event = context.get('dndState').raw;
        // Never `return true`: that would stop the dispatch before the file
        // drop's own handler, which clears the drop line it drew.
        if (dropPage(std, event, isInsideEdgelessEditor(std.host))) {
          event.preventDefault();
        }
      })
    );
    const manager = std.store.history.undoManager;
    manager.on('stack-item-popped', this._onPopped);
    std.event.disposables.add(() =>
      manager.off('stack-item-popped', this._onPopped)
    );
  }
}
