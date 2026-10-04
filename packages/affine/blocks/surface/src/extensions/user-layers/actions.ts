import { translateKey } from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import {
  DEFAULT_LAYER_ID,
  GfxBlockElementModel,
  GfxControllerIdentifier,
  type GfxModel,
  GfxPrimitiveElementModel,
  ownLayerOf,
  type SurfaceBlockModel,
  type SurfaceLayerRecord,
} from '@labre/std/gfx';
import { nanoid } from '@labre/store';
import { generateKeyBetween } from 'fractional-indexing';

import { CanvasActiveLayer } from './active-layer.js';
import { LAYER_SEED_NAME } from './translations.js';

/**
 * The user layers' writes (ADR 0031 §2, §5, stage 6). Every one of them:
 *
 * - refuses on a read-only document before reading anything else;
 * - writes nothing when nothing would change;
 * - takes ONE `captureSync()` first, so one gesture is one undo step;
 * - writes ONE record, or ONE field of a record — never the whole `layers`
 *   prop, except the very first creation, which has no record to write into.
 *   That is what lets two peers' edits of two layers merge key by key.
 *
 * Reached through the `canvas.layer.*` commands, so a host's own pane gets
 * the same guards by calling `runCommand`.
 */

function surfaceOf(std: BlockStdScope): SurfaceBlockModel | null {
  return std.get(GfxControllerIdentifier).surface;
}

/** The layer records, bottom first. Empty while the surface has none. */
export function userLayersBottomUp(
  surface: SurfaceBlockModel | null
): { id: string; record: SurfaceLayerRecord }[] {
  const layers = surface?.props.layers;
  if (!layers) return [];
  return Object.entries(layers)
    .filter(([, record]) => record && typeof record.index === 'string')
    .map(([id, record]) => ({ id, record }))
    .sort((a, b) =>
      a.record.index === b.record.index
        ? a.id < b.id
          ? -1
          : 1
        : a.record.index < b.record.index
          ? -1
          : 1
    );
}

/**
 * Create a user layer on top of the others and make it this viewer's active
 * layer. Answers its id, or `null` when nothing was written.
 *
 * The FIRST creation writes two records in one transaction: `'@default'`,
 * named through the seam ("Layer 1"), and the new one above it. That one
 * write sets the whole `layers` prop, so two peers doing it at the same
 * moment keep one record set (ADR 0031 open point 6, accepted for v1): the
 * other peer's members fall back to the default layer, nothing is dropped.
 */
export function createUserLayer(
  std: BlockStdScope,
  name?: string
): string | null {
  if (std.store.readonly) return null;
  const surface = surfaceOf(std);
  if (!surface) return null;

  const existing = userLayersBottomUp(surface);
  const id = nanoid();
  const seed = (n: number) => translateKey(std, ...LAYER_SEED_NAME, { n });

  std.store.captureSync();
  std.store.transact(() => {
    if (!existing.length) {
      const bottom = generateKeyBetween(null, null);
      surface.props.layers = {
        [DEFAULT_LAYER_ID]: { name: seed(1), index: bottom },
        [id]: {
          name: name?.trim() || seed(2),
          index: generateKeyBetween(bottom, null),
        },
      };
      return;
    }
    const top = existing[existing.length - 1].record.index;
    surface.props.layers![id] = {
      name: name?.trim() || seed(existing.length + 1),
      index: generateKeyBetween(top, null),
    };
  });
  std.getOptional(CanvasActiveLayer)?.choose(id);
  return id;
}

/** Rename a layer: one field of one record. Empty or unchanged writes nothing. */
export function renameUserLayer(
  std: BlockStdScope,
  id: string,
  name: string
): boolean {
  if (std.store.readonly) return false;
  const record = surfaceOf(std)?.props.layers?.[id];
  const next = name.trim();
  if (!record || !next || next === record.name) return false;
  std.store.captureSync();
  // Inside the store's transaction, not the props proxy's own: the proxy
  // writes with its own origin, which the undo manager does not track.
  std.store.transact(() => {
    record.name = next;
  });
  return true;
}

/**
 * Move a layer so it sits directly ABOVE `above` — `null` puts it at the
 * bottom. One field (`index`) of one record; a reorder racing a peer's
 * rename of the same layer merges.
 */
export function reorderUserLayer(
  std: BlockStdScope,
  id: string,
  above: string | null
): boolean {
  if (std.store.readonly || id === above) return false;
  const layers = userLayersBottomUp(surfaceOf(std));
  const moving = layers.find(layer => layer.id === id);
  if (!moving) return false;
  const others = layers.filter(layer => layer.id !== id);
  let position = 0;
  if (above !== null) {
    const target = others.findIndex(layer => layer.id === above);
    if (target === -1) return false;
    position = target + 1;
  }
  const current = layers.indexOf(moving);
  if ((layers[current - 1]?.id ?? null) === above) return false;

  const lower = others[position - 1]?.record.index ?? null;
  const upper = others[position]?.record.index ?? null;
  if (lower !== null && upper !== null && lower >= upper) return false;

  std.store.captureSync();
  std.store.transact(() => {
    moving.record.index = generateKeyBetween(lower, upper);
  });
  return true;
}

/**
 * The model a "move to layer" writes on: the outermost group-like ELEMENT
 * holding `model` (a group, a mindmap), else `model` itself — a group lives
 * in one layer, stored once on its outermost group (ADR 0031 §5).
 */
function layerCarrier(model: GfxModel): GfxModel {
  let groups: readonly unknown[] = [];
  try {
    groups = model.groups ?? [];
  } catch {
    groups = [];
  }
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] instanceof GfxPrimitiveElementModel) {
      return groups[i] as GfxModel;
    }
  }
  return model;
}

/**
 * Write `layer` on one model — set it, or REMOVE the key for the default
 * layer (never the string `'@default'`). Inside the caller's transaction.
 */
export function writeModelLayer(
  std: BlockStdScope,
  model: GfxModel,
  layer: string
) {
  if (layer === DEFAULT_LAYER_ID) {
    if (model instanceof GfxPrimitiveElementModel) {
      model.clearField('layer');
    } else if (model instanceof GfxBlockElementModel) {
      delete (model.props as { layer?: string }).layer;
    }
    return;
  }
  std.get(GfxControllerIdentifier).updateElement(model, { layer });
}

/**
 * Move models to the layer `layerId`. Answers how many models were written —
 * a grouped model moves its outermost group, so that may be fewer than asked.
 * An unknown layer id writes nothing.
 */
export function moveModelsToUserLayer(
  std: BlockStdScope,
  ids: readonly string[],
  layerId: string
): number {
  if (std.store.readonly) return 0;
  const surface = surfaceOf(std);
  if (!surface?.props.layers?.[layerId]) return 0;

  const gfx = std.get(GfxControllerIdentifier);
  const carriers = new Set<GfxModel>();
  for (const id of ids) {
    const model = gfx.getElementById(id);
    if (
      model instanceof GfxPrimitiveElementModel ||
      model instanceof GfxBlockElementModel
    ) {
      carriers.add(layerCarrier(model));
    }
  }
  const targets = [...carriers].filter(
    model => (ownLayerOf(model) ?? DEFAULT_LAYER_ID) !== layerId
  );
  if (!targets.length) return 0;

  std.store.captureSync();
  std.store.transact(() => {
    for (const model of targets) writeModelLayer(std, model, layerId);
  });
  return targets.length;
}
