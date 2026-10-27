import { EdgelessCRUDIdentifier } from '@labre/affine-block-surface';
import {
  EMBED_CARD_HEIGHT,
  EMBED_CARD_WIDTH,
  LINKED_DOC_NOTE_STYLE,
} from '@labre/affine-shared/consts';
import { TelemetryProvider } from '@labre/affine-shared/services';
import { getLastNoteBlock } from '@labre/affine-shared/utils';
import { Bound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';

const LINKED_DOC = 'affine:embed-linked-doc';

/** The canvas card's style, the one "Linked doc" inserts on the canvas. */
const CANVAS_STYLE = 'vertical';

/**
 * "Show here" (labre ADR-0045 §7): insert a card of page `pageId` into the
 * open document, so a child page the document held without showing becomes
 * shown. The host computes the "Not shown" list; once the card exists, its
 * own reading of the document drops the page from it. Nothing here knows a
 * parent or a child: the card is an ordinary `affine:embed-linked-doc`,
 * exactly what pasting a link to that page would make.
 *
 * - page view: at the end of the last note the page view shows (a new note
 *   when there is none);
 * - canvas: centred in the visible part of the canvas, through the CRUD
 *   `addBlock`, which stamps the viewer's active layer (ADR 0031 §6), then
 *   selected so the reader sees what appeared.
 *
 * One gesture, one undo step (`captureSync`). A read-only document gets
 * nothing. Returns the new card's id, or `null` when nothing was written.
 */
export function showPageHere(
  std: BlockStdScope,
  surface: 'page' | 'canvas',
  pageId: string
): string | null {
  const { store } = std;
  if (store.readonly || !store.root || !pageId) return null;

  store.captureSync();
  const id =
    surface === 'canvas'
      ? insertOnCanvas(std, pageId)
      : insertInPage(std, pageId);
  if (id) {
    std.getOptional(TelemetryProvider)?.track('BlockCreated', {
      blockType: LINKED_DOC,
    });
  }
  return id;
}

function insertInPage(std: BlockStdScope, pageId: string): string | null {
  const { store } = std;
  const root = store.root;
  if (!root) return null;
  const noteId =
    getLastNoteBlock(store)?.id ?? store.addBlock('affine:note', {}, root.id);
  return store.addBlock(
    LINKED_DOC,
    { pageId, style: LINKED_DOC_NOTE_STYLE },
    noteId
  );
}

function insertOnCanvas(std: BlockStdScope, pageId: string): string | null {
  const gfx = std.get(GfxControllerIdentifier);
  const surface = gfx.surface;
  if (!surface) return null;
  const xywh = Bound.fromCenter(
    [gfx.viewport.centerX, gfx.viewport.centerY],
    EMBED_CARD_WIDTH[CANVAS_STYLE],
    EMBED_CARD_HEIGHT[CANVAS_STYLE]
  ).serialize();
  const id = std
    .get(EdgelessCRUDIdentifier)
    .addBlock(LINKED_DOC, { pageId, xywh, style: CANVAS_STYLE }, surface);
  gfx.selection.set({ elements: [id], editing: false });
  return id;
}
