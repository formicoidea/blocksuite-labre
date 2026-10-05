import type { BlockStdScope } from '@labre/std';
import {
  DEFAULT_LAYER_ID,
  GfxControllerIdentifier,
  ownLayerOf,
  type SurfaceMiddleware,
  SurfaceMiddlewareBuilder,
} from '@labre/std/gfx';

import { CanvasActiveLayer } from './active-layer.js';

/**
 * The layer to REQUEST for a model derived from `source` — the note an
 * auto-complete arrow clones, the note the slicer splits off, the block that
 * replaces another when its view changes — so it lands beside its source
 * once {@link resolveCreationLayer} has read it. A source in the default
 * layer asks for {@link DEFAULT_LAYER_ID} explicitly: "absent" would hand the
 * derived model to the viewer's active layer instead.
 */
export function sourceLayerOf(source: unknown): string {
  return ownLayerOf(source) ?? DEFAULT_LAYER_ID;
}

/**
 * The layer a model being CREATED is stored in (ADR 0031 §6), as the value
 * to write: a layer id, or `undefined` for the default layer.
 *
 * - `requested` names a layer of THIS surface → kept (a duplicate, an
 *   alt-drag clone, a paste within the document stays beside its source);
 * - `requested` is {@link DEFAULT_LAYER_ID} → the default layer, explicitly:
 *   a caller that computed "default" (a new group whose highest member is in
 *   it) is not overridden by the active layer;
 * - anything else — absent, or an id with no record here (a paste from
 *   another document, a template, an import) → the viewer's active layer.
 *
 * A surface with no layer at all writes nothing, whatever was asked.
 */
export function resolveCreationLayer(
  std: BlockStdScope,
  requested: unknown
): string | undefined {
  const layers = std.get(GfxControllerIdentifier).surface?.props.layers;
  if (!layers) return undefined;
  if (requested === DEFAULT_LAYER_ID) return undefined;
  if (typeof requested === 'string' && layers[requested]) return requested;
  const active =
    std.getOptional(CanvasActiveLayer)?.resolve() ?? DEFAULT_LAYER_ID;
  return active === DEFAULT_LAYER_ID ? undefined : active;
}

/**
 * Stamp the creation layer on `props` in place: set it, or remove the key so
 * a default-layer model writes no `layer` at all.
 */
export function applyCreationLayer(
  std: BlockStdScope,
  props: Record<string, unknown>
) {
  const layer = resolveCreationLayer(std, props.layer);
  if (layer === undefined) {
    delete props.layer;
  } else {
    props.layer = layer;
  }
}

/**
 * Every `surface.addElement` goes through this `beforeAdd` middleware, beside
 * `EditPropsMiddlewareBuilder` (ADR 0031 §6): a framework command adding an
 * element directly gets the same rule as the canvas tools.
 */
export class UserLayerMiddlewareBuilder extends SurfaceMiddlewareBuilder {
  static override key = 'userLayer';

  middleware: SurfaceMiddleware = ctx => {
    if (ctx.type !== 'beforeAdd') return;
    const props = { ...ctx.payload.props };
    applyCreationLayer(this.std, props);
    ctx.payload.props = props;
  };
}
