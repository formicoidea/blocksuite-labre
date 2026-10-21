import isMatch from 'lodash.ismatch';

import type { Block, BlockModel, BlockViewType } from '../block/index.js';

export type QueryMatch = {
  id?: string;
  flavour?: string;
  props?: Record<string, unknown>;
  viewType: BlockViewType;
};

/**
 * - `strict` means that only blocks that match the query will be included.
 * - `loose` means that all blocks will be included first, and then the blocks will be run through the query.
 * - `include` means that only blocks and their ancestors that match the query will be included.
 */
type QueryMode = 'strict' | 'loose' | 'include';

export type Query = {
  match: QueryMatch[];
  mode: QueryMode;
};

export function runQuery(query: Query, block: Block) {
  const blockViewType = getBlockViewType(query, block);
  block.blockViewType = blockViewType;

  if (blockViewType !== 'hidden' && canHideBlocks(query)) {
    const queryMode = query.mode;
    setAncestorsToDisplayIfHidden(queryMode, block);
  }
}

/**
 * A loose query hides a block only through a `viewType: 'hidden'` entry, so
 * without one no ancestor can be hidden and the walk below is a no-op. The
 * walk costs one O(n) `getParent` per ancestor, which made opening a store
 * with the default query quadratic in the block count (#507, guard
 * `__tests__/query.unit.spec.ts`).
 */
function canHideBlocks(query: Query): boolean {
  if (query.mode !== 'loose') return true;
  return query.match.some(entry => entry.viewType === 'hidden');
}

function getBlockViewType(query: Query, block: Block): BlockViewType {
  const flavour = block.model.flavour;
  const id = block.model.id;
  const queryMode = query.mode;
  const props = block.model.keys.reduce(
    (acc, key) => {
      return {
        ...acc,
        [key]: block.model.props[key as keyof BlockModel['props']],
      };
    },
    {} as Record<string, unknown>
  );
  let blockViewType: BlockViewType =
    queryMode === 'loose' ? 'display' : 'hidden';

  query.match.some(queryObject => {
    const {
      id: queryId,
      flavour: queryFlavour,
      props: queryProps,
      viewType,
    } = queryObject;
    const matchQueryId = queryId == null ? true : queryId === id;
    const matchQueryFlavour =
      queryFlavour == null ? true : queryFlavour === flavour;
    const matchQueryProps =
      queryProps == null ? true : isMatch(props, queryProps);
    if (matchQueryId && matchQueryFlavour && matchQueryProps) {
      blockViewType = viewType;
      return true;
    }
    return false;
  });

  return blockViewType;
}

function setAncestorsToDisplayIfHidden(mode: QueryMode, block: Block) {
  const doc = block.model.store;
  let parent = doc.getParent(block.model);
  while (parent) {
    const parentBlock = doc.getBlock(parent.id);
    if (parentBlock && parentBlock.blockViewType === 'hidden') {
      parentBlock.blockViewType = mode === 'include' ? 'display' : 'bypass';
    }
    parent = doc.getParent(parent);
  }
}
