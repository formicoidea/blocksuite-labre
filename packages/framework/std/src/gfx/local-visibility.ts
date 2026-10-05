import { computed, type ReadonlySignal, signal } from '@preact/signals-core';

import type { GfxLocalElementModel } from './model/surface/local-element-model.js';
import type { GfxGroupModel, GfxModel } from './model/model.js';
import { GfxPrimitiveElementModel } from './model/surface/element-model.js';

const NOTHING_HIDDEN: ReadonlySet<string> = new Set();

/**
 * What THIS viewer has hidden on the canvas — the per-editor predicate hook of
 * ADR 0031 §8.
 *
 * `std` knows nothing about why an element is hidden for one viewer; the
 * affine layer (`CanvasLocalVisibility`) registers a signal of ids and owns
 * their persistence. This class answers the one question the gfx plumbing
 * asks — "does this viewer see that model?" — at the places a viewer's eye
 * and hand reach the canvas: the renderers, the DOM block views, pointer
 * picking and the marquee.
 *
 * It is deliberately NOT consulted by `GridManager.search`: that answer is
 * shared with rules, legends and semantic exports, and one viewer's local
 * hide must never change what another viewer's rules say about the same
 * document.
 *
 * Reactive: `isHidden` reads a signal, so an effect or a `computed` that asks
 * re-runs when the set changes (the DOM block views rely on it). With nothing
 * registered, or nothing hidden, every answer is `false` after one size check.
 */
export class GfxLocalVisibility {
  private readonly _sources$ = signal<
    readonly ReadonlySignal<ReadonlySet<string>>[]
  >([]);

  /** Every id hidden for this viewer, across every registered source. */
  readonly hiddenIds$: ReadonlySignal<ReadonlySet<string>> = computed(() => {
    const sources = this._sources$.value;
    if (sources.length === 0) return NOTHING_HIDDEN;
    if (sources.length === 1) return sources[0].value;
    const union = new Set<string>();
    for (const source of sources) {
      for (const id of source.value) union.add(id);
    }
    return union;
  });

  /** Add a source of hidden ids. Returns its disposer. */
  register(source: ReadonlySignal<ReadonlySet<string>>): () => void {
    this._sources$.value = [...this._sources$.peek(), source];
    return () => {
      this._sources$.value = this._sources$
        .peek()
        .filter(existing => existing !== source);
    };
  }

  /**
   * Is `model` hidden for this viewer — itself, or through a group-like
   * ELEMENT ancestor (a group, a mindmap)?
   *
   * Frames are not walked, although they are group-compatible: a frame is a
   * slide, and hiding the frame hides the frame, not what it holds (ADR 0031
   * §5). A model no surface holds has no ancestors to ask about.
   */
  isHidden(model: GfxModel | GfxLocalElementModel): boolean {
    const hidden = this.hiddenIds$.value;
    if (hidden.size === 0) return false;
    if (hidden.has(model.id)) return true;

    let ancestors: GfxGroupModel[];
    try {
      ancestors = (model as GfxModel).groups ?? [];
    } catch {
      return false;
    }
    return ancestors.some(
      ancestor =>
        ancestor instanceof GfxPrimitiveElementModel && hidden.has(ancestor.id)
    );
  }
}
