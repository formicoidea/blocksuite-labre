import { EdgelessCRUDIdentifier } from '@labre/affine-block-surface';
import {
  type GroupElementModel,
  MindmapElementModel,
} from '@labre/affine-model';
import { translateKey } from '@labre/affine-shared/services';
import type { Command } from '@labre/std';
import {
  batchAddChildren,
  batchRemoveChildren,
  generateKeyBetween,
  generateNKeysBetween,
  type GfxController,
  GfxControllerIdentifier,
  type GfxModel,
  GfxPrimitiveElementModel,
  measureOperation,
} from '@labre/std/gfx';

import { GROUP_SEED_NAME } from '../translations';

/**
 * Every element that sits at the root of the board, in painting order.
 */
const getTopLevelOrderedElements = (gfx: GfxController) => {
  const topLevelElements = gfx.layer.layers.reduce<GfxModel[]>(
    (elements, layer) => {
      layer.elements.forEach(element => {
        if (element.group === null) {
          elements.push(element as GfxModel);
        }
      });

      return elements;
    },
    []
  );

  topLevelElements.sort((a, b) => gfx.layer.compare(a, b));
  return topLevelElements;
};

/**
 * The indexes the children of an ungrouped group should take: the slot the
 * group itself occupied, so that everything it contained stays where the user
 * last saw it instead of jumping to the top of the stack.
 *
 * The fallbacks go from "the exact slot" to "always valid", because the
 * interval between the two siblings can be unusable — a document written by an
 * older version, or two siblings sharing an index.
 */
const buildUngroupIndexes = (
  orderedElements: GfxModel[],
  afterIndex: string | null,
  beforeIndex: string | null,
  fallbackAnchorIndex: string
) => {
  if (orderedElements.length === 0) {
    return [];
  }

  const count = orderedElements.length;
  const tryGenerateN = (left: string | null, right: string | null) => {
    try {
      const generated = generateNKeysBetween(left, right, count);
      return generated.length === count ? generated : null;
    } catch {
      return null;
    }
  };

  const tryGenerateOneByOne = (left: string | null, right: string | null) => {
    try {
      let cursor = left;
      return orderedElements.map(() => {
        cursor = generateKeyBetween(cursor, right);
        return cursor;
      });
    } catch {
      return null;
    }
  };

  // Preferred: keep ungrouped children in the original group slot.
  return (
    tryGenerateN(afterIndex, beforeIndex) ??
    // Fallback: ignore the upper bound when legacy/broken data has reversed interval.
    tryGenerateN(afterIndex, null) ??
    // Fallback: use group index as anchor when sibling interval is unavailable.
    tryGenerateN(fallbackAnchorIndex, null) ??
    // Last resort: always valid.
    tryGenerateN(null, null) ??
    // Defensive fallback for unexpected library behavior.
    tryGenerateOneByOne(null, null) ??
    []
  );
};

/**
 * The layer a new group is stored in (ADR 0031 §5): the effective layer of
 * its HIGHEST member, so grouping never sinks what was on top. `'@default'`
 * is passed explicitly — the creation middleware then writes no key, rather
 * than reading "absent" as "the viewer's active layer". Nothing at all while
 * the surface has no user layer.
 */
function groupLayerProps(
  gfx: GfxController,
  elements: GfxModel[] | string[]
): { layer?: string } {
  const userLayers = gfx.surface?.userLayers;
  if (!userLayers?.ranks) return {};
  const models = elements
    .map(el => (typeof el === 'string' ? gfx.getElementById(el) : el))
    .filter((model): model is GfxModel => !!model && 'index' in model)
    .sort((a, b) => gfx.layer.compare(a, b));
  const highest = models.at(-1);
  return highest ? { layer: userLayers.effectiveLayerOf(highest) } : {};
}

/**
 * Ungrouping a top-level group hands its layer to each released child, in
 * the ungroup's own transaction (ADR 0031 §5): a member's own `layer` was
 * ignored while it was inside, and may be stale.
 */
function releaseChildrenToGroupLayer(
  gfx: GfxController,
  group: GroupElementModel,
  children: GfxModel[]
) {
  const userLayers = gfx.surface?.userLayers;
  if (!userLayers?.ranks) return;
  const layer = group.layer;
  for (const child of children) {
    const own =
      child instanceof GfxPrimitiveElementModel
        ? child.layer
        : (child.props as { layer?: string }).layer;
    if (own === layer) continue;
    if (layer === undefined) {
      if (child instanceof GfxPrimitiveElementModel) {
        child.clearField('layer');
      } else {
        delete (child.props as { layer?: string }).layer;
      }
    } else {
      gfx.updateElement(child, { layer });
    }
  }
}

export const createGroupCommand: Command<
  { elements: GfxModel[] | string[] },
  { groupId: string }
> = (ctx, next) => {
  const { std, elements } = ctx;
  const gfx = std.get(GfxControllerIdentifier);
  const crud = std.get(EdgelessCRUDIdentifier);

  const groups = gfx.layer.canvasElements.filter(
    el => el.type === 'group'
  ) as GroupElementModel[];
  const groupId = crud.addElement('group', {
    ...groupLayerProps(gfx, elements),
    children: elements.reduce(
      (pre, el) => {
        const id = typeof el === 'string' ? el : el.id;
        pre[id] = true;
        return pre;
      },
      {} as Record<string, true>
    ),
    // Translated HERE and once: the title is document content the moment it
    // lands (ADR 0023), so the host's catalogue is asked at placement and
    // never again — a renamed group keeps its name.
    title: translateKey(std, ...GROUP_SEED_NAME, { n: groups.length + 1 }),
  });
  if (!groupId) {
    return;
  }

  next({ groupId });
};

export const createGroupFromSelectedCommand: Command<
  {},
  { groupId: string }
> = (ctx, next) => {
  measureOperation('edgeless:create-group-from-selected', () => {
    const { std } = ctx;
    const gfx = std.get(GfxControllerIdentifier);
    const { selection, surface } = gfx;

    if (!surface) {
      return;
    }
    // Guarded BEFORE the child rewrites below: they write through raw
    // transactions, and `crud.addElement` would refuse afterwards — leaving the
    // selection orphaned from its parent group on a readonly board.
    if (std.store.readonly) {
      return;
    }

    if (
      selection.selectedElements.length === 0 ||
      !selection.selectedElements.every(
        element =>
          element.group === selection.firstElement.group &&
          !(element.group instanceof MindmapElementModel)
      )
    ) {
      return;
    }

    const parent = selection.firstElement.group;
    const selectedElements = [...selection.selectedElements];
    let groupId: string | undefined;

    // One transaction for the whole regrouping, so a single undo takes the
    // board back to where it was.
    std.store.transact(() => {
      const [_, result] = std.command.exec(createGroupCommand, {
        elements: selectedElements,
      });

      if (!result.groupId) {
        return;
      }

      groupId = result.groupId;
      const group = surface.getElementById(groupId);

      if (parent !== null && group) {
        batchRemoveChildren(parent, selectedElements);
        batchAddChildren(parent, [group as GfxModel]);
      }
    });

    if (!groupId) {
      return;
    }

    selection.set({
      editing: false,
      elements: [groupId],
    });

    next({ groupId });
  });
};

export const ungroupCommand: Command<{ group: GroupElementModel }, {}> = (
  ctx,
  next
) => {
  measureOperation('edgeless:ungroup', () => {
    const { std, group } = ctx;
    const gfx = std.get(GfxControllerIdentifier);
    const { selection } = gfx;
    const parent = group.group;
    const elements = [...group.childElements];

    if (group instanceof MindmapElementModel) {
      return;
    }
    // The child rewrites and the index rewrites below are raw transactions.
    if (std.store.readonly) {
      return;
    }

    const orderedElements = [...elements].sort((a, b) =>
      gfx.layer.compare(a, b)
    );
    const siblings = parent
      ? [...parent.childElements].sort((a, b) => gfx.layer.compare(a, b))
      : getTopLevelOrderedElements(gfx);
    const groupPosition = siblings.indexOf(group);
    const beforeSiblingIndex =
      groupPosition > 0 ? (siblings[groupPosition - 1]?.index ?? null) : null;
    const afterSiblingIndex =
      groupPosition === -1
        ? null
        : (siblings[groupPosition + 1]?.index ?? null);
    const nextIndexes = buildUngroupIndexes(
      orderedElements,
      beforeSiblingIndex,
      afterSiblingIndex,
      group.index
    );

    // One transaction for the whole ungrouping: opening one per child made a
    // single undo put a single child back.
    std.store.transact(() => {
      if (parent !== null) {
        batchRemoveChildren(parent, [group]);
      }

      batchRemoveChildren(group, elements);

      // keep relative index order of group children after ungroup
      orderedElements.forEach((element, idx) => {
        const index = nextIndexes[idx];
        if (element.index !== index) {
          element.index = index;
        }
      });

      if (parent !== null) {
        batchAddChildren(parent, orderedElements);
      } else {
        releaseChildrenToGroupLayer(gfx, group, orderedElements);
      }
    });

    selection.set({
      editing: false,
      elements: orderedElements.map(ele => ele.id),
    });
    next();
  });
};
