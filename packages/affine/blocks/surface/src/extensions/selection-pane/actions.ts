import {
  FrameBlockModel,
  GroupElementModel,
  MindmapElementModel,
} from '@labre/affine-model';
import type { BlockStdScope } from '@labre/std';
import {
  compareLayer,
  GfxBlockElementModel,
  GfxControllerIdentifier,
  type GfxModel,
  GfxPrimitiveElementModel,
  isStoredHiddenForEveryone,
} from '@labre/std/gfx';
import { generateKeyBetween } from 'fractional-indexing';
import * as Y from 'yjs';

import type { SelectionPaneNode } from './tree.js';

/**
 * The selection pane's writes (ADR 0031, stage 2). Every one of them:
 *
 * - refuses on a read-only document before reading anything else;
 * - writes nothing when nothing would change — an unchanged write is an empty
 *   undo step, and an undo that "does nothing" reads as a broken undo;
 * - takes ONE `captureSync()` first, so one gesture in the pane is one undo
 *   step, whatever it touched;
 * - writes through `gfx.updateElement`, which is `surface.updateElement` for an
 *   element and `store.updateBlock` for a block — never a `Y.Map` directly.
 *
 * They are reached through the `canvas.element.*` / `canvas.group.rename`
 * commands, so a host's own pane gets the same guards by calling `runCommand`.
 */

function gfxModel(std: BlockStdScope, id: string): GfxModel | null {
  const model = std.get(GfxControllerIdentifier).getElementById(id);
  return model instanceof GfxPrimitiveElementModel ||
    model instanceof GfxBlockElementModel
    ? model
    : null;
}

/**
 * The models a reorder compares against: those sharing the moved model's RAW
 * `group` — a group, a mindmap, a frame, or none.
 *
 * Raw and not the pane's container on purpose: an `index` only orders a model
 * among the models its group-like ancestor stacks together (`compare` puts a
 * frame's members right above the frame), so a key computed against a wider
 * list could be written and still not move the row.
 */
function stackSiblings(std: BlockStdScope, model: GfxModel): GfxModel[] {
  const group = model.group;
  const gfx = std.get(GfxControllerIdentifier);
  // With user layers a model is restacked within its layer (ADR 0031 §4):
  // a key computed against another layer's neighbours would not move it.
  const userLayers = gfx.surface?.userLayers;
  const layer = userLayers?.ranks ? userLayers.effectiveLayerOf(model) : null;
  return gfx.gfxElements
    .filter(
      other =>
        other.group === group &&
        (layer === null || userLayers!.effectiveLayerOf(other) === layer)
    )
    .sort(compareLayer);
}

/**
 * Move `id` so it sits directly ABOVE `above` in the stack — `null` puts it at
 * the bottom of its stack. Answers whether anything was written.
 *
 * The drop target of a drag in a top-first list: dropping a row just over row
 * X means "directly above X". The new `index` is a key between the two
 * neighbours (the same `fractional-indexing` keys `LayerManager` generates), so
 * one field of one model is written and nothing else moves.
 *
 * Refused, with nothing written: a read-only document; a mindmap node (it has
 * no index of its own — the whole mindmap moves as one, as the toolbar's
 * reorder already says); an `above` that is not stacked with `id`; and a
 * target that is where the model already is.
 */
export function reorderPaneElement(
  std: BlockStdScope,
  id: string,
  above: string | null
): boolean {
  if (std.store.readonly) return false;

  const model = gfxModel(std, id);
  if (!model || id === above) return false;
  if (model.group instanceof MindmapElementModel) return false;

  const siblings = stackSiblings(std, model);
  const others = siblings.filter(other => other !== model);
  let position = 0;
  if (above !== null) {
    const target = others.findIndex(other => other.id === above);
    if (target === -1) return false;
    position = target + 1;
  }

  // Already there: the model's current lower neighbour is the target.
  const current = siblings.indexOf(model);
  const lowerNow = current > 0 ? siblings[current - 1] : null;
  if ((lowerNow?.id ?? null) === above) return false;

  const lower = others[position - 1]?.index ?? null;
  const upper = others[position]?.index ?? null;
  // Two equal keys cannot be split. `generateIndex` never produces them, so
  // this only guards a hand-made document; refusing beats throwing in a drop.
  if (lower !== null && upper !== null && lower >= upper) return false;

  const index = generateKeyBetween(lower, upper);
  std.store.captureSync();
  std.get(GfxControllerIdentifier).updateElement(model, { index });
  return true;
}

/**
 * Lock or unlock each model ON ITS OWN. Answers whether anything was written.
 *
 * Deliberately not the contextual toolbar's lock: that one, given several
 * elements, wraps them into a new group and locks the group — a structural
 * edit a row's padlock must never make. Here each row keeps its place in the
 * tree; only `lockedBySelf` changes, and only where it differs.
 */
export function setPaneElementsLocked(
  std: BlockStdScope,
  ids: readonly string[],
  locked: boolean
): boolean {
  if (std.store.readonly) return false;

  const targets = ids
    .map(id => gfxModel(std, id))
    .filter(
      (model): model is GfxModel =>
        model !== null && (model.lockedBySelf === true) !== locked
    );
  if (!targets.length) return false;

  const gfx = std.get(GfxControllerIdentifier);
  std.store.captureSync();
  std.store.transact(() => {
    for (const model of targets) {
      gfx.updateElement(model, { lockedBySelf: locked });
    }
  });
  return true;
}

/**
 * Hide models for EVERYONE, or show them again (ADR 0031 §7). Answers how
 * many models were written.
 *
 * Writes the stored `hiddenForEveryone` — never `hidden`, which mindmap
 * collapse owns. Hiding writes `true`; showing REMOVES the key (`clearField`
 * on an element, the props proxy's delete on a block), never stores `false`,
 * so an unhidden document is byte-identical to one never hidden. Models
 * already in the asked state are skipped, so a gesture that changes nothing
 * writes nothing and pushes no undo step; the rest go in one transaction
 * after one `captureSync()`.
 */
export function setPaneElementsHiddenForEveryone(
  std: BlockStdScope,
  ids: readonly string[],
  hidden: boolean
): number {
  if (std.store.readonly) return 0;

  const targets = ids
    .map(id => gfxModel(std, id))
    .filter(
      (model): model is GfxModel =>
        model !== null && isStoredHiddenForEveryone(model) !== hidden
    );
  if (!targets.length) return 0;

  const gfx = std.get(GfxControllerIdentifier);
  std.store.captureSync();
  std.store.transact(() => {
    for (const model of targets) {
      if (hidden) {
        gfx.updateElement(model, { hiddenForEveryone: true });
      } else if (model instanceof GfxPrimitiveElementModel) {
        model.clearField('hiddenForEveryone');
      } else {
        // The props proxy deletes the `prop:` key (ADR 0031 §7).
        delete (model.props as { hiddenForEveryone?: true }).hiddenForEveryone;
      }
    }
  });
  return targets.length;
}

/**
 * Rename a group through its existing stored `title`. Answers whether
 * anything was written. An empty or unchanged title writes nothing.
 */
export function renamePaneGroup(
  std: BlockStdScope,
  id: string,
  title: string
): boolean {
  if (std.store.readonly) return false;

  const model = gfxModel(std, id);
  if (!(model instanceof GroupElementModel)) return false;
  const next = title.trim();
  if (!next || next === model.title.toString()) return false;

  std.store.captureSync();
  std
    .get(GfxControllerIdentifier)
    .updateElement(model, { title: new Y.Text(next) });
  return true;
}

/** Something the pane can be filtered by: a frame, and only a frame. */
export interface SelectionPaneFilterTarget {
  id: string;
  /**
   * Always `'frame'`. A framework board was offered too until the product
   * owner's review narrowed the filter to frames (ADR 0031, amendments); the
   * field stays so a host reading it has nothing to change.
   */
  kind: 'frame';
}

/** The frames on the canvas, top first — what the pane's filter offers. */
export function selectionPaneFilterTargets(
  std: BlockStdScope
): SelectionPaneFilterTarget[] {
  return std
    .get(GfxControllerIdentifier)
    .gfxElements.filter(model => model instanceof FrameBlockModel)
    .sort((a, b) => compareLayer(b, a))
    .map(model => ({ id: model.id, kind: 'frame' }));
}

/**
 * The ids a frame filter keeps: the frame's `childElementIds` and their
 * descendants. `null` for an id that is not a frame. The frame itself is not
 * among them: it is not a row (ADR 0031, amendments).
 */
export function selectionPaneFilterMembers(
  std: BlockStdScope,
  targetId: string
): Set<string> | null {
  const target = std.get(GfxControllerIdentifier).getElementById(targetId);
  if (!(target instanceof FrameBlockModel)) return null;

  const ids = new Set<string>();
  for (const child of target.childElements) {
    ids.add(child.id);
    if ('descendantElements' in child) {
      for (const descendant of (child as { descendantElements: GfxModel[] })
        .descendantElements) {
        ids.add(descendant.id);
      }
    }
  }
  return ids;
}

/**
 * The tree narrowed to `members`: a row is kept when it is a member or holds
 * one, so a group reaching into a frame stays as the path to its member.
 */
export function filterSelectionPaneTree(
  nodes: readonly SelectionPaneNode[],
  members: ReadonlySet<string>
): SelectionPaneNode[] {
  const kept: SelectionPaneNode[] = [];
  for (const node of nodes) {
    const children = node.children
      ? filterSelectionPaneTree(node.children, members)
      : undefined;
    if (members.has(node.id) || (children && children.length)) {
      kept.push(children ? { ...node, children } : node);
    }
  }
  return kept;
}
