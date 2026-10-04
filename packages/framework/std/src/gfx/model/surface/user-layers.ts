import type { Store } from '@labre/store';

import type { GfxModel } from '../model.js';
import { GfxPrimitiveElementModel } from './element-model.js';
import type { SurfaceBlockModel } from './surface-model.js';

/**
 * The layer every element belongs to while it names none (ADR 0031 §2, §3).
 * A `@` cannot appear in a nanoid, so it never collides with a real layer id;
 * it has no record while the surface has no `layers`, and is written as
 * `undefined` on an element, never as this string.
 */
export const DEFAULT_LAYER_ID = '@default';

/** One user layer, stored on the surface under its id (ADR 0031 §2). */
export type SurfaceLayerRecord = {
  /** Seeded through the translation seam at creation; content from then on. */
  name: string;
  /** Fractional key, bottom → top; the same alphabet as an element's `index`. */
  index: string;
  /** "Hide for everyone" on the whole layer. Absent = visible. */
  hidden?: true;
};

/**
 * What a model names as its own layer: an element's `layer` field, a gfx
 * block's `layer` prop. `undefined` = the default layer.
 */
export function ownLayerOf(model: unknown): string | undefined {
  if (model instanceof GfxPrimitiveElementModel) return model.layer;
  try {
    const props = (model as { props?: { layer?: unknown } }).props;
    return typeof props?.layer === 'string' ? props.layer : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The user layers of one surface, resolved for the comparator (ADR 0031 §4).
 *
 * Two caches, both thrown away by a revision bump rather than kept in step:
 *
 * - the rank of every layer id (its record's `index`), rebuilt when the
 *   `layers` prop changes — `null` while the surface has no layer, which is
 *   the fast path: `compare` then never asks for an effective layer at all;
 * - each model's EFFECTIVE layer, rebuilt when anything that decides it
 *   changes: a `layer` write, a regroup, an element added or removed.
 *
 * The effective layer is the `layer` of the model's outermost group-like
 * ELEMENT ancestor (a group, a mindmap), else its own; a dangling id or none
 * is {@link DEFAULT_LAYER_ID}. Frames are not counted: a frame is a slide,
 * and a background layer under a content layer inside one frame is the point
 * of layers. Nothing here writes: a dangling id is read as the default and
 * left as it is.
 */
export class SurfaceUserLayers {
  private _ranks: ReadonlyMap<string, string> | null | undefined = undefined;

  private _revision = 0;

  private readonly _effective = new WeakMap<
    object,
    { revision: number; layer: string }
  >();

  constructor(private readonly _surface: SurfaceBlockModel) {}

  /** Every layer id with its rank key, or `null` when there is no layer. */
  get ranks(): ReadonlyMap<string, string> | null {
    if (this._ranks === undefined) {
      const layers = this._surface.props.layers;
      if (!layers || Object.keys(layers).length === 0) {
        this._ranks = null;
      } else {
        const ranks = new Map<string, string>();
        for (const [id, record] of Object.entries(layers)) {
          if (record && typeof record.index === 'string') {
            ranks.set(id, record.index);
          }
        }
        this._ranks = ranks.size ? ranks : null;
      }
    }
    return this._ranks;
  }

  /** The `layers` record changed: ranks and effective layers are stale. */
  invalidateRanks() {
    this._ranks = undefined;
    this._revision++;
  }

  /** Something that decides an effective layer changed. */
  invalidateMembership() {
    this._revision++;
  }

  /** The layer `model` stacks and shows with. */
  effectiveLayerOf(model: GfxModel): string {
    const cached = this._effective.get(model);
    if (cached && cached.revision === this._revision) return cached.layer;

    let named = ownLayerOf(model);
    let groups: readonly unknown[] = [];
    try {
      groups = model.groups ?? [];
    } catch {
      groups = [];
    }
    for (let i = groups.length - 1; i >= 0; i--) {
      if (groups[i] instanceof GfxPrimitiveElementModel) {
        named = ownLayerOf(groups[i]);
        break;
      }
    }
    const ranks = this.ranks;
    const layer =
      named !== undefined && ranks?.has(named) ? named : DEFAULT_LAYER_ID;
    this._effective.set(model, { revision: this._revision, layer });
    return layer;
  }
}

/**
 * Which surface a model's layers are read from. An element knows its
 * surface; a gfx block knows its store, and the surface registers itself for
 * its store when it initialises, so the comparator never queries the store.
 */
const SURFACE_OF_STORE = new WeakMap<Store, SurfaceBlockModel>();

export function registerSurfaceOfStore(
  store: Store,
  surface: SurfaceBlockModel
) {
  SURFACE_OF_STORE.set(store, surface);
}

export function userLayersOf(model: unknown): SurfaceUserLayers | null {
  if (model instanceof GfxPrimitiveElementModel) {
    return model.surface?.userLayers ?? null;
  }
  const store = (model as { store?: Store }).store;
  return store ? (SURFACE_OF_STORE.get(store)?.userLayers ?? null) : null;
}
