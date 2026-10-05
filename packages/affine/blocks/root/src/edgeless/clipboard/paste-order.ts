import type { BlockStdScope } from '@labre/std';
import {
  GfxControllerIdentifier,
  type SerializedElement,
  SortOrder,
} from '@labre/std/gfx';
import type { BlockSnapshot } from '@labre/store';

/*
 * The paste's stacking order, decided on the PASTED DATA before any model
 * exists. Its own module, which the package does not re-export, so that
 * `paste-order-parity.unit.spec.ts` can hold its copy of the canvas'
 * ancestor rule to `compareLayer` without making it API.
 */

/**
 * Child id → container id, as the pasted data spells it: a group's or a mind
 * map's `children`, a frame's `childElementIds`.
 *
 * The paste reads its parentage from here and not from the models: a canvas
 * container written in the final transaction registers its children (its
 * `childIds`, `getGroup`) only when that transaction ends, so inside it a
 * model would answer "no parent".
 */
export function pastedParentage(
  elementsRawData: (SerializedElement | BlockSnapshot)[]
) {
  const parents = new Map<string, string>();
  for (const data of elementsRawData) {
    const children =
      'flavour' in data ? data.props.childElementIds : data.children;
    if (!children || typeof children !== 'object') continue;

    for (const childId of Object.keys(children)) {
      parents.set(childId, data.id);
    }
  }
  return parents;
}

/**
 * The fresh indexes of the pasted elements, by their id in the pasted data: on
 * top of the board, in the order they had where they were copied from — a
 * container before its children, and otherwise by the original index of the
 * topmost pasted ancestor (then of the next one down, then of the element
 * itself). The original indexes are recorded in `originalIndexes`.
 */
export function pastedIndexes(
  std: BlockStdScope,
  elementsRawData: (SerializedElement | BlockSnapshot)[],
  parents: Map<string, string>,
  originalIndexes: Map<string, string>
) {
  for (const data of elementsRawData) {
    const index = 'flavour' in data ? data.props.index : data.index;
    if (typeof index === 'string' && !originalIndexes.has(data.id)) {
      originalIndexes.set(data.id, index);
    }
  }

  // Pasted ancestors, nearest first — the order `GfxModel.groups` uses.
  const ancestors = new Map<string, string[]>();
  for (const id of originalIndexes.keys()) {
    const chain: string[] = [];
    for (
      let parent = parents.get(id);
      parent && !chain.includes(parent);
      parent = parents.get(parent)
    ) {
      chain.push(parent);
    }
    ancestors.set(id, chain);
  }

  function compare(a: string, b: string) {
    const aGroups = ancestors.get(a) ?? [];
    const bGroups = ancestors.get(b) ?? [];

    if (bGroups.includes(a)) {
      return SortOrder.BEFORE;
    } else if (aGroups.includes(b)) {
      return SortOrder.AFTER;
    }

    let i = 1;
    let aGroup = aGroups.at(-i);
    let bGroup = bGroups.at(-i);

    while (aGroup === bGroup && aGroup) {
      ++i;
      aGroup = aGroups.at(-i);
      bGroup = bGroups.at(-i);
    }

    const aIndex = originalIndexes.get(aGroup ?? a);
    const bIndex = originalIndexes.get(bGroup ?? b);

    return aIndex === bIndex
      ? SortOrder.SAME
      : aIndex! < bIndex!
        ? SortOrder.BEFORE
        : SortOrder.AFTER;
  }

  const nextIndex = std
    .get(GfxControllerIdentifier)
    .layer.createIndexGenerator();
  const newIndexes = new Map<string, string>();
  [...originalIndexes.keys()].sort(compare).forEach(id => {
    newIndexes.set(id, nextIndex());
  });
  return newIndexes;
}
