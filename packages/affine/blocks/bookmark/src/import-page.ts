import {
  type AttachmentBlockSource,
  withHtmlDefaultView,
} from '@labre/affine-block-attachment';
import {
  applyCreationLayer,
  reassociateConnectorsCommand,
  sourceLayerOf,
} from '@labre/affine-block-surface';
import { toast } from '@labre/affine-components/toast';
import type { BookmarkBlockModel } from '@labre/affine-model';
import {
  EMBED_CARD_HEIGHT,
  EMBED_CARD_WIDTH,
} from '@labre/affine-shared/consts';
import {
  type AssetRef,
  type HtmlPageImport,
  HtmlFileConfigExtension,
  translateKey,
} from '@labre/affine-shared/services';
import { isSafeLinkUrl, normalizeUrl } from '@labre/affine-shared/utils';
import { Bound } from '@labre/global/gfx';
import { BlockSelection, type BlockStdScope } from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import type { BlockModel } from '@labre/store';
import { type ReadonlySignal, type Signal, signal } from '@preact/signals-core';

import { BOOKMARK_IMPORT_PAGE_FAILED } from './translations';

/**
 * A link card turned into the page it points at (ADR 0048, amendment of
 * 2026-11-04). The host reads the page, stores the bytes and says whether the
 * document already knows it, behind `HtmlFileConfig.importPage`. What happens here
 * is the document's part: the card makes way for an attachment, at its place, as
 * one undo step.
 */

function hostImporter(std: BlockStdScope) {
  return std.getOptional(HtmlFileConfigExtension.identifier)?.importPage;
}

/** A citation's card is held by its footnote, and an unsafe url opens nothing. */
export function canImportPage(std: BlockStdScope, model: BookmarkBlockModel) {
  return (
    Boolean(hostImporter(std)) &&
    !std.store.readonly &&
    !model.props.footnoteIdentifier &&
    isSafeLinkUrl(normalizeUrl(model.props.url))
  );
}

// Held by the card, not by the button: the toolbar is drawn again on every
// selection, and a second press must not start a second import.
const pending = new WeakMap<BookmarkBlockModel, Signal<boolean>>();

function importingState(model: BookmarkBlockModel) {
  const known = pending.get(model);
  if (known) return known;
  const state = signal<boolean>(false);
  pending.set(model, state);
  return state;
}

export function isImportingPage(
  model: BookmarkBlockModel
): ReadonlySignal<boolean> {
  return importingState(model);
}

function sourceOf({ name, size, type, sourceId }: AssetRef) {
  return { name, size, type, sourceId } satisfies AttachmentBlockSource;
}

function overwrite(std: BlockStdScope, replaces: string, asset: AssetRef) {
  if (replaces === asset.sourceId) return;
  const { store } = std;
  store
    .getBlocksByFlavour('affine:attachment')
    .map(({ model }) => model as BlockModel<AttachmentBlockSource>)
    .filter(attachment => attachment.props.sourceId === replaces)
    .forEach(attachment => store.updateBlock(attachment, sourceOf(asset)));
}

/** Around the card's centre: anchored by its corner, a wide view leaves its
 *  buttons off the screen. The layer is the card's (ADR 0031 §6). */
function placeOnCanvas(
  std: BlockStdScope,
  model: BookmarkBlockModel,
  props: ReturnType<typeof withHtmlDefaultView<AttachmentBlockSource>>
) {
  const style = 'style' in props ? props.style : 'cubeThick';
  const blockProps = {
    ...props,
    style,
    caption: model.props.caption ?? undefined,
    xywh: Bound.fromCenter(
      Bound.deserialize(model.xywh).center,
      EMBED_CARD_WIDTH[style],
      EMBED_CARD_HEIGHT[style]
    ).serialize(),
    layer: sourceLayerOf(model),
  };
  applyCreationLayer(std, blockProps);
  const id = std.store.addBlock('affine:attachment', blockProps, model.parent);
  std.command.exec(reassociateConnectorsCommand, {
    oldId: model.id,
    newId: id,
  });
  return id;
}

function selectBlock(std: BlockStdScope, id: string, onCanvas: boolean) {
  if (onCanvas) {
    std
      .get(GfxControllerIdentifier)
      .selection.set({ editing: false, elements: [id] });
    return;
  }
  const { selection } = std;
  selection.setGroup('note', [
    selection.create(BlockSelection, { blockId: id }),
  ]);
}

/** The card may have gone, or the document turned read-only, while the host read
 *  the page: nothing is written then. Resolves to the new block's id. */
function writeImported(
  std: BlockStdScope,
  model: BookmarkBlockModel,
  { asset, replaces }: Extract<HtmlPageImport, { status: 'imported' }>
): string | null {
  const { store } = std;
  const { parent } = model;
  if (store.readonly || !parent || !store.hasBlock(model.id)) return null;

  const onCanvas = parent.flavour === 'affine:surface';
  const props = withHtmlDefaultView(std, sourceOf(asset));
  let id = '';
  store.captureSync();
  store.transact(() => {
    if (replaces) overwrite(std, replaces, asset);
    id = onCanvas
      ? placeOnCanvas(std, model, props)
      : store.addBlock(
          'affine:attachment',
          { ...props, caption: model.props.caption ?? undefined },
          parent,
          parent.children.indexOf(model)
        );
    store.deleteBlock(model);
  });
  selectBlock(std, id, onCanvas);
  return id;
}

export async function importPage(
  std: BlockStdScope,
  model: BookmarkBlockModel
): Promise<string | null> {
  const importer = hostImporter(std);
  if (!importer || isImportingPage(model).peek()) return null;

  const importing = importingState(model);
  importing.value = true;
  let answer: HtmlPageImport;
  try {
    answer = await importer({
      url: normalizeUrl(model.props.url),
      docId: std.store.id,
    });
  } catch {
    answer = { status: 'refused' };
  } finally {
    importing.value = false;
  }

  if (answer.status === 'imported') return writeImported(std, model, answer);
  if (answer.status === 'refused') {
    toast(
      std.host,
      answer.message ?? translateKey(std, ...BOOKMARK_IMPORT_PAGE_FAILED)
    );
  }
  return null;
}
