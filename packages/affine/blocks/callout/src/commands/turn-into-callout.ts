import {
  CodeBlockModel,
  ListBlockModel,
  ParagraphBlockModel,
} from '@labre/affine-model';
import { focusTextModel } from '@labre/affine-rich-text';
import {
  isInsideBlockByFlavour,
  matchModels,
} from '@labre/affine-shared/utils';
import type { Command } from '@labre/std';
import type { BlockModel, Store } from '@labre/store';

const isAncestor = (store: Store, ancestor: BlockModel, block: BlockModel) => {
  for (let at = store.getParent(block); at; at = store.getParent(at)) {
    if (at === ancestor) return true;
  }
  return false;
};

/**
 * The selected blocks "Turn into → Callout" would actually wrap.
 *
 * Decided BEFORE anything is written, so that a refusal costs nothing: a
 * block already inside a callout (a callout never nests) or inside an
 * edgeless text (where the slash item is not offered either), a parent that
 * does not accept a callout, or a child the inner paragraph could not adopt —
 * `deleteBlock({ bringChildrenTo })` detaches the source before it validates
 * the children, so a refused child there would orphan the whole block. A
 * selected child of another selected block is dropped too: it moves with its
 * parent.
 */
export function calloutConversionTargets(
  store: Store,
  models: BlockModel[]
): BlockModel[] {
  const { schema } = store;
  const convertible = models.filter(model => {
    if (
      !matchModels(model, [ParagraphBlockModel, ListBlockModel, CodeBlockModel])
    )
      return false;
    if (isInsideBlockByFlavour(store, model, 'affine:callout')) return false;
    if (isInsideBlockByFlavour(store, model, 'affine:edgeless-text'))
      return false;
    const parent = store.getParent(model);
    if (!parent || !schema.isValid('affine:callout', parent.flavour))
      return false;
    return model.children.every(child =>
      schema.isValid(child.flavour, 'affine:paragraph')
    );
  });
  return convertible.filter(
    model => !convertible.some(other => isAncestor(store, other, model))
  );
}

/**
 * Wraps each selected paragraph, list item or code block in a callout (#418).
 *
 * A callout is a hub with no text of its own, so this cannot be
 * `transformModel`: the callout takes the block's place, a paragraph inside it
 * takes the text, and the block's children move under that paragraph. Every
 * callout is built before any source is removed; if one cannot be, the ones
 * already built are deleted and every source stays as it was.
 */
export const turnIntoCalloutCommand: Command<
  { models: BlockModel[] },
  { updatedBlocks: BlockModel[] }
> = (ctx, next) => {
  const { std, models } = ctx;
  const store = std.store;
  if (store.readonly) return;

  const targets = calloutConversionTargets(store, models);
  if (targets.length === 0) return;

  store.captureSync();

  const callouts: BlockModel[] = [];
  const paragraphs: BlockModel[] = [];
  for (const model of targets) {
    const parent = store.getParent(model);
    const callout = parent
      ? store.getModelById(
          store.addBlock(
            'affine:callout',
            {},
            parent,
            parent.children.indexOf(model)
          )
        )
      : null;
    if (callout) callouts.push(callout);
    // `addBlock` returns an id even for a block the store refused, so only
    // `getModelById` proves the block exists.
    const paragraph = callout
      ? store.getModelById(
          store.addBlock(
            'affine:paragraph',
            { text: model.text?.clone() },
            callout
          )
        )
      : null;
    if (!paragraph) {
      callouts.forEach(created => store.deleteBlock(created));
      return;
    }
    paragraphs.push(paragraph);
  }

  targets.forEach((model, i) =>
    store.deleteBlock(model, { bringChildrenTo: paragraphs[i] })
  );

  const first = paragraphs[0];
  focusTextModel(std, first.id, first.text?.length ?? 0);
  return next({ updatedBlocks: paragraphs });
};
