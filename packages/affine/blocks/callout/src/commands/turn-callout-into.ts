import { CalloutBlockModel } from '@labre/affine-model';
import { matchModels } from '@labre/affine-shared/utils';
import { BlockSelection, type Command } from '@labre/std';
import { type BlockModel, type Store, Text } from '@labre/store';

const isAncestor = (store: Store, ancestor: BlockModel, block: BlockModel) => {
  for (let at = store.getParent(block); at; at = store.getParent(at)) {
    if (at === ancestor) return true;
  }
  return false;
};

/**
 * The selected callouts "Turn into → <text kind>" would unwrap, or none at all.
 *
 * Decided BEFORE anything is written, and all-or-nothing: if one callout
 * cannot be converted, none is (#468). A callout cannot be when its parent
 * does not accept the target flavour (a code block under a database row),
 * or when a grandchild could not live under the block its own parent becomes
 * — and a code block keeps no children at all, so a callout whose content
 * has nested blocks is not turned into code (the merge would drop them).
 * Anything that is not a callout is skipped, and a callout nested in another
 * selected callout moves with it rather than being converted twice.
 */
export function calloutUnwrapTargets(
  store: Store,
  models: BlockModel[],
  flavour: string
): CalloutBlockModel[] {
  const { schema } = store;
  const callouts = models.filter((model): model is CalloutBlockModel =>
    matchModels(model, [CalloutBlockModel])
  );
  const outermost = callouts.filter(
    callout => !callouts.some(other => isAncestor(store, other, callout))
  );
  const feasible = outermost.every(callout => {
    const parent = store.getParent(callout);
    if (!parent || !schema.isValid(flavour, parent.flavour)) return false;
    return callout.children.every(child =>
      flavour === 'affine:code'
        ? child.children.length === 0
        : child.children.every(grandchild =>
            schema.isValid(grandchild.flavour, flavour)
          )
    );
  });
  return feasible ? outermost : [];
}

/**
 * "Turn into → <text kind>" on a selected callout (#468): the exact inverse of
 * `turnIntoCalloutCommand`. The callout is a HUB whose own `text` is unused
 * and whose words live in its children, so the conversion UNWRAPS: each child
 * becomes a block of the target kind at the callout's place, in order, its
 * own children moved under it; a target of `affine:code` merges a callout's
 * children into one code block, the way `mergeToCodeModel` merges a
 * selection; an empty callout yields one empty block. The callout's emoji is
 * dropped with it — it belongs to the frame being removed.
 *
 * Add first, prove with `getModelById`, delete only after (#418, #423): every
 * new block is built before anything moves, and if one cannot be, the ones
 * already built are deleted and every callout stays as it was. Only then are
 * the grandchildren moved (validated up front by `calloutUnwrapTargets`) and
 * the callouts deleted. The lifted blocks are therefore NEW blocks carrying
 * the text, like the paragraph `turnIntoCalloutCommand` creates, while the
 * grandchildren keep their identity.
 */
export const turnCalloutIntoCommand: Command<
  { models: BlockModel[]; flavour: string; props?: { type?: string } },
  { updatedBlocks: BlockModel[] }
> = (ctx, next) => {
  const { std, models, flavour, props } = ctx;
  const store = std.store;
  if (store.readonly) return;

  const callouts = calloutUnwrapTargets(store, models, flavour);
  if (callouts.length === 0) return;

  store.captureSync();

  const created: BlockModel[] = [];
  const adoptions: [BlockModel[], BlockModel][] = [];
  const add = (callout: CalloutBlockModel, text?: Text) => {
    const parent = store.getParent(callout);
    // Inserted right before the callout, so the blocks keep their order.
    const block = parent
      ? store.getModelById(
          store.addBlock(
            flavour,
            { ...props, ...(text && { text }) },
            parent,
            parent.children.indexOf(callout)
          )
        )
      : null;
    if (block) created.push(block);
    return block;
  };

  // `addBlock` returns an id even for a block the store refused, so only
  // `getModelById` proves the block exists (`add` above).
  const build = (callout: CalloutBlockModel) => {
    const sources = callout.children;
    if (flavour === 'affine:code') {
      const joined = sources
        .map(source => source.text?.toString())
        .filter(Boolean)
        .join('\n');
      return add(callout, new Text(joined)) !== null;
    }
    if (sources.length === 0) return add(callout) !== null;
    return sources.every(source => {
      const block = add(callout, source.text?.clone());
      if (block && source.children.length > 0)
        adoptions.push([source.children, block]);
      return block !== null;
    });
  };
  if (!callouts.every(build)) {
    created.forEach(block => store.deleteBlock(block));
    return;
  }

  adoptions.forEach(([children, block]) => store.moveBlocks(children, block));
  callouts.forEach(callout => store.deleteBlock(callout));

  // The gesture started from a block selection (the callout's handle), so it
  // ends on one; deferred a frame so the new blocks have rendered.
  requestAnimationFrame(() => {
    std.selection.setGroup(
      'note',
      created.map(block =>
        std.selection.create(BlockSelection, { blockId: block.id })
      )
    );
  });
  return next({ updatedBlocks: created });
};
