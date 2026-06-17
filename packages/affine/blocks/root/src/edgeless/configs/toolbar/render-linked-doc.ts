import { isFrameBlock } from '@labre/affine-block-frame';
import { getSurfaceBlock, isNoteBlock } from '@labre/affine-block-surface';
import {
  type FrameBlockModel,
  type NoteBlockModel,
  NoteDisplayMode,
} from '@labre/affine-model';
import { replaceIdMiddleware } from '@labre/affine-shared/adapters';
import {
  DocModeProvider,
  LinkedDocCreationProvider,
} from '@labre/affine-shared/services';
import { getBlockProps } from '@labre/affine-shared/utils';
import type { EditorHost } from '@labre/std';
import { GfxBlockElementModel, type GfxModel } from '@labre/std/gfx';
import { type Store, Text } from '@labre/store';

import {
  getElementProps,
  mapFrameIds,
  sortEdgelessElements,
} from '../../../edgeless/utils/clone-utils.js';

export function createLinkedDocFromNote(
  doc: Store,
  note: NoteBlockModel,
  docTitle?: string
) {
  const _doc = doc.workspace.createDoc();
  const transformer = doc.getTransformer([
    replaceIdMiddleware(doc.workspace.idGenerator),
  ]);
  const blockSnapshot = transformer.blockToSnapshot(note);
  if (!blockSnapshot) {
    console.error('Failed to create linked doc from note');
    return;
  }
  blockSnapshot.props.displayMode = NoteDisplayMode.DocAndEdgeless;
  const linkedDoc = _doc.getStore({ id: doc.id });
  linkedDoc.load(() => {
    const rootId = linkedDoc.addBlock('affine:page', {
      title: new Text(docTitle),
    });
    linkedDoc.addBlock('affine:surface', {}, rootId);
    transformer
      .snapshotToBlock(blockSnapshot, linkedDoc, rootId)
      .catch(console.error);
  });

  return linkedDoc;
}

export function createLinkedDocFromEdgelessElements(
  host: EditorHost,
  elements: GfxModel[],
  docTitle?: string
) {
  // The host can override creation to persist/register the doc (see
  // LinkedDocCreationProvider); otherwise fall back to an in-workspace doc.
  const creation = host.std.getOptional(LinkedDocCreationProvider);
  const linkedDoc = creation
    ? creation.createLinkedDoc(host, docTitle)
    : host.store.workspace.createDoc().getStore();
  const transformer = host.store.getTransformer();
  linkedDoc.load(() => {
    const rootId = linkedDoc.addBlock('affine:page', {
      title: new Text(docTitle),
    });
    const surfaceId = linkedDoc.addBlock('affine:surface', {}, rootId);
    const surface = getSurfaceBlock(linkedDoc);
    if (!surface) return;

    const sortedElements = sortEdgelessElements(elements);
    const ids = new Map<string, string>();
    sortedElements.forEach(model => {
      let newId = model.id;
      if (model instanceof GfxBlockElementModel) {
        const blockProps = getBlockProps(model);
        if (isNoteBlock(model)) {
          const blockSnapshot = transformer.blockToSnapshot(model);
          if (blockSnapshot) {
            transformer
              .snapshotToBlock(blockSnapshot, linkedDoc, rootId)
              .catch(console.error);
          }
        } else {
          if (isFrameBlock(model)) {
            mapFrameIds(blockProps as FrameBlockModel['props'], ids);
          }

          newId = linkedDoc.addBlock(model.flavour, blockProps, surfaceId);
        }
      } else {
        const props = getElementProps(model, ids);
        newId = surface.addElement(props);
      }
      ids.set(model.id, newId);
    });
  });

  host.std.get(DocModeProvider).setPrimaryMode('edgeless', linkedDoc.id);
  return linkedDoc;
}
