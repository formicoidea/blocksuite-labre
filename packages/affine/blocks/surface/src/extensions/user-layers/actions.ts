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

/** The seed a new layer is named with, resolved through the seam. */
function seedName(std: BlockStdScope, n: number): string {
  return translateKey(std, ...LAYER_SEED_NAME, { n });
}

/**
 * The name a layer row shows: its record's, or — for the default layer while
 * it has no record — the name the first-layer creation would write ("Layer
 * 1", ADR 0031 amendments). `null` for an id that is no layer.
 *
 * Reading it writes nothing: the default layer is shown from the start and
 * recorded only by a gesture that needs the record.
 */
export function userLayerName(std: BlockStdScope, id: string): string | null {
  const record = surfaceOf(std)?.props.layers?.[id];
  if (record) return record.name;
  return id === DEFAULT_LAYER_ID ? seedName(std, 1) : null;
}

/**
 * Record the default layer, inside the caller's transaction: the whole
 * `layers` prop while it is absent — as the first creation does — else the
 * one `'@default'` key, below every other layer. The seed name unless the
 * gesture says otherwise.
 */
function recordDefaultLayer(
  std: BlockStdScope,
  surface: SurfaceBlockModel,
  fields: Partial<SurfaceLayerRecord> = {}
) {
  const bottom = userLayersBottomUp(surface)[0]?.record.index ?? null;
  const record: SurfaceLayerRecord = {
    name: seedName(std, 1),
    index: generateKeyBetween(null, bottom),
    ...fields,
  };
  if (!surface.props.layers) {
    surface.props.layers = { [DEFAULT_LAYER_ID]: record };
  } else {
    surface.props.layers[DEFAULT_LAYER_ID] = record;
  }
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
  const seed = (n: number) => seedName(std, n);

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

/**
 * Rename a layer: one field of one record. Empty or unchanged writes nothing.
 *
 * The default layer with no record yet is renamed by recording it, named
 * (ADR 0031 amendments): "unchanged" is then against the seed name it shows.
 */
export function renameUserLayer(
  std: BlockStdScope,
  id: string,
  name: string
): boolean {
  if (std.store.readonly) return false;
  const surface = surfaceOf(std);
  const record = surface?.props.layers?.[id];
  const shown = userLayerName(std, id);
  const next = name.trim();
  if (!surface || shown === null || !next || next === shown) return false;
  std.store.captureSync();
  // Inside the store's transaction, not the props proxy's own: the proxy
  // writes with its own origin, which the undo manager does not track.
  std.store.transact(() => {
    if (record) record.name = next;
    else recordDefaultLayer(std, surface, { name: next });
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
 * Hide whole layers for EVERYONE, or show them again (ADR 0031 §7, stage
 * 7): `hidden: true` on each record — one write per layer, never one per
 * member — and the key REMOVED on show, never `false`. Answers how many
 * records were written.
 *
 * Hiding the default layer while it has no record records it, hidden, with
 * its seed name (ADR 0031 amendments); showing it has nothing to write.
 */
export function setUserLayersHiddenForEveryone(
  std: BlockStdScope,
  ids: readonly string[],
  hidden: boolean
): number {
  if (std.store.readonly) return 0;
  const surface = surfaceOf(std);
  if (!surface) return 0;
  const layers = surface.props.layers;
  const targets = ids
    .map(id => layers?.[id])
    .filter(
      (record): record is SurfaceLayerRecord =>
        !!record && (record.hidden === true) !== hidden
    );
  const recordDefault =
    hidden && ids.includes(DEFAULT_LAYER_ID) && !layers?.[DEFAULT_LAYER_ID];
  if (!targets.length && !recordDefault) return 0;

  std.store.captureSync();
  std.store.transact(() => {
    for (const record of targets) {
      if (hidden) {
        record.hidden = true;
      } else {
        delete record.hidden;
      }
    }
    if (recordDefault) recordDefaultLayer(std, surface, { hidden: true });
  });
  return targets.length + (recordDefault ? 1 : 0);
}

/**
 * Delete a user layer WITH its members, in one undo step (ADR 0031 §10).
 * Answers how many models went with it, or `null` when nothing was written.
 *
 * The read-only refusal comes first, then one `captureSync()`, then one
 * transaction: every top-level model whose effective layer is this one (a
 * group or a mindmap takes its descendants with it), then the record. A
 * connector of ANOTHER layer whose ends were here stays, loose, as when its
 * ends are deleted any other way — the members are removed one by one, not
 * through the "delete with connectors" path of the toolbar. A frame of this
 * layer goes; what it holds from other layers stays. `'@default'` cannot be
 * deleted.
 */
export function deleteUserLayer(std: BlockStdScope, id: string): number | null {
  if (std.store.readonly) return null;
  if (id === DEFAULT_LAYER_ID) return null;
  const surface = surfaceOf(std);
  const layers = surface?.props.layers;
  if (!surface || !layers?.[id]) return null;

  const gfx = std.get(GfxControllerIdentifier);
  const members = gfx.gfxElements.filter(
    model => surface.userLayers.effectiveLayerOf(model) === id
  );
  const carriers = members.filter(model => layerCarrier(model) === model);

  std.store.captureSync();
  std.store.transact(() => {
    for (const model of carriers) {
      if (gfx.getElementById(model.id)) gfx.deleteElement(model);
    }
    delete layers[id];
  });
  std.store.captureSync();
  return members.length;
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
 * An unknown layer id writes nothing. The default layer always exists, record
 * or not: moving there removes the `layer` key, a dangling id included.
 */
export function moveModelsToUserLayer(
  std: BlockStdScope,
  ids: readonly string[],
  layerId: string
): number {
  if (std.store.readonly) return 0;
  const surface = surfaceOf(std);
  if (!surface) return 0;
  if (layerId !== DEFAULT_LAYER_ID && !surface.props.layers?.[layerId]) {
    return 0;
  }

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
