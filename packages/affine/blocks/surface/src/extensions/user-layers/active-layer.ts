import { LifeCycleWatcher } from '@labre/std';
import {
  DEFAULT_LAYER_ID,
  GfxControllerIdentifier,
  type SurfaceBlockModel,
} from '@labre/std/gfx';
import { signal } from '@preact/signals-core';

/**
 * The layer new elements land in, for THIS viewer (ADR 0031 §6): the one
 * selected in the selection pane, or the default layer.
 *
 * Per viewer and per session — never stored, in the document or anywhere
 * else: a reload starts on the default layer. A layer deleted or never
 * created on this surface resolves to the default layer, so a stale choice
 * cannot send new elements to a dangling id.
 */
export class CanvasActiveLayer extends LifeCycleWatcher {
  static override key = 'canvas-active-layer';

  /** The chosen layer id, as chosen; read {@link resolve} for the effective one. */
  readonly chosen$ = signal<string>(DEFAULT_LAYER_ID);

  private get _surface(): SurfaceBlockModel | null {
    return this.std.get(GfxControllerIdentifier).surface;
  }

  /** The layer a new element lands in: the chosen one if it still exists. */
  resolve(): string {
    const chosen = this.chosen$.value;
    if (chosen === DEFAULT_LAYER_ID) return DEFAULT_LAYER_ID;
    return this._surface?.props.layers?.[chosen] ? chosen : DEFAULT_LAYER_ID;
  }

  /** Make `id` the active layer for this viewer. */
  choose(id: string) {
    this.chosen$.value = id;
  }
}
