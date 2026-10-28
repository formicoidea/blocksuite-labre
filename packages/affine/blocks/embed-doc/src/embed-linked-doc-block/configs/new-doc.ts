import { insertContent } from '@labre/affine-rich-text';
import {
  LINKED_DOC_NOTE_STYLE,
  REFERENCE_NODE,
} from '@labre/affine-shared/consts';
import {
  LinkedDocCreationProvider,
  TelemetryProvider,
} from '@labre/affine-shared/services';
import {
  createDefaultDoc,
  writeDefaultDocBlocks,
} from '@labre/affine-shared/utils';
import type { BlockStdScope } from '@labre/std';
import type { BlockModel, Store } from '@labre/store';

const LINKED_DOC = 'affine:embed-linked-doc';

/**
 * Whether the slash menu offers "New Page" here: the card's schema is
 * registered, and the host, if it creates docs, does not refuse it on this
 * editor (`LinkedDocCreationProvider.canCreateLinkedDoc`).
 */
export function canCreateDocHere(
  std: BlockStdScope,
  model: BlockModel
): boolean {
  if (!model.store.schema.flavourSchemaMap.has(LINKED_DOC)) return false;
  const creation = std.getOptional(LinkedDocCreationProvider);
  return creation?.canCreateLinkedDoc?.(std.host) ?? true;
}

/**
 * The slash menu's "New Page": creates a page and leaves a CARD of it
 * (`affine:embed-linked-doc`) right after the block the gesture was typed in.
 * A paragraph the gesture left empty is replaced by the card, as Notion turns
 * the line into the page. A card shows a child where its parent places it; an
 * inline mention is only a reference (Labre ADR-0045 §9, host side).
 *
 * The page comes from the host's `LinkedDocCreationProvider` when there is
 * one (the host persists it, registers it, decides its parent), else from the
 * workspace (`createDefaultDoc`, the playground and standalone editors).
 *
 * One undo step for the card and the removed line. When no card can go there
 * (a parent whose schema refuses it, an edgeless text for one), the gesture
 * falls back on the inline mention it used to leave, so it always yields a way
 * to the page. Returns the new page's id, or null on a read-only store.
 */
export function createDocFromSlash(
  std: BlockStdScope,
  model: BlockModel
): string | null {
  const { store } = std;
  if (store.readonly) return null;
  const pageId = createNewDoc(std).id;
  store.captureSync();
  if (insertCard(store, model, pageId)) {
    std.getOptional(TelemetryProvider)?.track('BlockCreated', {
      blockType: LINKED_DOC,
    });
  } else {
    insertContent(std, model, REFERENCE_NODE, {
      reference: { type: 'LinkedPage', pageId },
    });
  }
  return pageId;
}

function createNewDoc(std: BlockStdScope): Store {
  const creation = std.getOptional(LinkedDocCreationProvider);
  if (!creation) return createDefaultDoc(std.store.workspace);
  const doc = creation.createLinkedDoc(std.host, '');
  doc.load(() => writeDefaultDocBlocks(doc));
  // The new page's first undo must not empty it (as in `createDefaultDoc`).
  doc.resetHistory();
  return doc;
}

function insertCard(
  store: Store,
  anchor: BlockModel,
  pageId: string
): string | null {
  const parent = store.getParent(anchor);
  if (!parent || !store.schema.isValid(LINKED_DOC, parent.flavour)) {
    return null;
  }
  const cardId = store.addBlock(
    LINKED_DOC,
    { pageId, style: LINKED_DOC_NOTE_STYLE },
    parent,
    parent.children.indexOf(anchor) + 1
  );
  if (anchor.flavour === 'affine:paragraph' && anchor.text?.length === 0) {
    store.deleteBlock(anchor);
  }
  return cardId;
}
