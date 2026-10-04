import type { Store } from '@labre/store';

import type { Layer } from '../gfx/layer.js';
import {
  type GfxGroupCompatibleInterface,
  isGfxGroupCompatibleModel,
} from '../gfx/model/base.js';
import { type GfxBlockElementModel } from '../gfx/model/gfx-block-model.js';
import type { GfxModel } from '../gfx/model/model.js';
import { GfxLocalElementModel } from '../gfx/model/surface/local-element-model.js';
import type { SurfaceBlockModel } from '../gfx/model/surface/surface-model.js';
import { userLayersOf } from '../gfx/model/surface/user-layers.js';

export function getLayerEndZIndex(layers: Layer[], layerIndex: number) {
  const layer = layers[layerIndex];
  return layer ? layer.zIndex + layer.elements.length - 1 : 0;
}

export function updateLayersZIndex(layers: Layer[], startIdx: number) {
  const startLayer = layers[startIdx];
  let curIndex = startLayer.zIndex;

  for (let i = startIdx; i < layers.length; ++i) {
    const curLayer = layers[i];

    curLayer.zIndex = curIndex;
    curIndex += curLayer.elements.length;
  }
}

export function getElementIndex(indexable: GfxModel) {
  const groups = indexable.groups as GfxGroupCompatibleInterface[];

  if (groups.length) {
    const groupIndexes = groups
      .map(group => group.index)
      .reverse()
      .join('-');

    return `${groupIndexes}-${indexable.index}`;
  }

  return indexable.index;
}

export function ungroupIndex(index: string) {
  return index.split('-')[0];
}

/**
 * Insert `element` after every element that sorts before it or ties with it.
 *
 * The array is kept sorted by `compare`, so that predicate holds on a prefix
 * and the position is found by bisection. The linear scan it replaces asked
 * `compare` (which walks both elements' group chains) of every element on
 * every insert: a paste of N elements was N² comparisons. Where an index is
 * shared by two unrelated subtrees `compare` is not transitive and both pick
 * a tied position, not always the same one (layer-ordered-insert.unit.spec).
 */
export function insertToOrderedArray(array: GfxModel[], element: GfxModel) {
  let low = 0;
  let high = array.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (compare(array[mid], element) === SortOrder.AFTER) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }

  array.splice(low, 0, element);
}

export function removeFromOrderedArray(array: GfxModel[], element: GfxModel) {
  const idx = array.indexOf(element);

  if (idx !== -1) {
    array.splice(idx, 1);
  }
}

export enum SortOrder {
  AFTER = 1,
  BEFORE = -1,
  SAME = 0,
}

export function isInRange(edges: [GfxModel, GfxModel], target: GfxModel) {
  return compare(target, edges[0]) >= 0 && compare(target, edges[1]) < 0;
}

export function renderableInEdgeless(
  doc: Store,
  surface: SurfaceBlockModel,
  block: GfxBlockElementModel
) {
  const parent = doc.getParent(block);

  return parent === doc.root || parent === surface;
}

export function compareIndex(aIndex: string, bIndex: string) {
  return aIndex === bIndex
    ? SortOrder.SAME
    : aIndex < bIndex
      ? SortOrder.BEFORE
      : SortOrder.AFTER;
}

function compareLocal(
  a: GfxModel | GfxLocalElementModel,
  b: GfxModel | GfxLocalElementModel
) {
  const isALocal = a instanceof GfxLocalElementModel;
  const isBLocal = b instanceof GfxLocalElementModel;

  if (isALocal && a.creator && a.creator === b) {
    return SortOrder.AFTER;
  }

  if (isBLocal && b.creator && b.creator === a) {
    return SortOrder.BEFORE;
  }

  if (isALocal && isBLocal && a.creator && a.creator === b.creator) {
    return compareIndex(a.index, b.index);
  }

  const left = isALocal && a.creator ? a.creator : a;
  const right = isBLocal && b.creator ? b.creator : b;

  // ADR 0031 §4: user layer rank first, then everything below unchanged.
  const byLayer = compareUserLayer(left, right);
  if (byLayer !== SortOrder.SAME) return byLayer;

  return { a: left, b: right };
}

/**
 * The first step of {@link compare} (ADR 0031 §4): two models in different
 * user layers stack by their layers' `index`; anything else is `SAME`, and
 * today's comparator decides.
 *
 * The fast path is the first `return`: a surface with no `layers` answers
 * `null` ranks after one cached read, so a document without user layers
 * sorts with exactly the code that sorted it before layers existed. A local
 * element without a creator has no layer and keeps today's order — above the
 * content, as overlays always were.
 */
function compareUserLayer(
  a: GfxModel | GfxLocalElementModel,
  b: GfxModel | GfxLocalElementModel
): SortOrder {
  if (a instanceof GfxLocalElementModel || b instanceof GfxLocalElementModel) {
    return SortOrder.SAME;
  }
  const layers = userLayersOf(a);
  const ranks = layers?.ranks;
  if (!layers || !ranks) return SortOrder.SAME;

  const aLayer = layers.effectiveLayerOf(a);
  const bLayer = layers.effectiveLayerOf(b);
  if (aLayer === bLayer) return SortOrder.SAME;
  // A default layer with no record (the loser of a first-layer race, ADR
  // 0031 open point 6) stacks at the bottom: `''` precedes every key.
  return compareIndex(ranks.get(aLayer) ?? '', ranks.get(bLayer) ?? '');
}

/**
 * A comparator function for sorting elements in the surface.
 * SortOrder.AFTER means a should be rendered after b and so on.
 * @returns
 */
export function compare(
  a: GfxModel | GfxLocalElementModel,
  b: GfxModel | GfxLocalElementModel
) {
  const result = compareLocal(a, b);

  if (typeof result === 'number') {
    return result;
  }

  a = result.a;
  b = result.b;

  // Each `groups` read walks the group chain through `getGroup`, a scan of
  // every container on the surface: read each side once.
  const aGroups = a.groups as GfxGroupCompatibleInterface[];
  const bGroups = b.groups as GfxGroupCompatibleInterface[];

  if (
    isGfxGroupCompatibleModel(a) &&
    bGroups.includes(a as GfxGroupCompatibleInterface)
  ) {
    return SortOrder.BEFORE;
  } else if (
    isGfxGroupCompatibleModel(b) &&
    aGroups.includes(b as GfxGroupCompatibleInterface)
  ) {
    return SortOrder.AFTER;
  } else {
    let i = 1;
    let aGroup:
      | GfxModel
      | GfxGroupCompatibleInterface
      | GfxLocalElementModel
      | undefined = aGroups.at(-i);
    let bGroup:
      | GfxModel
      | GfxGroupCompatibleInterface
      | GfxLocalElementModel
      | undefined = bGroups.at(-i);

    while (aGroup === bGroup && aGroup) {
      ++i;
      aGroup = aGroups.at(-i);
      bGroup = bGroups.at(-i);
    }

    aGroup = aGroup ?? a;
    bGroup = bGroup ?? b;

    return compareIndex(aGroup.index, bGroup.index);
  }
}
