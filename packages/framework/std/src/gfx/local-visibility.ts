import type { Store } from '@labre/store';
import { computed, type ReadonlySignal, signal } from '@preact/signals-core';

import { GfxBlockElementModel } from './model/gfx-block-model.js';
import type { GfxLocalElementModel } from './model/surface/local-element-model.js';
import type { GfxGroupModel, GfxModel } from './model/model.js';
import {
  GfxPrimitiveElementModel,
  isStoredHiddenForEveryone,
} from './model/surface/element-model.js';
import type { SurfaceBlockModel } from './model/surface/surface-model.js';

const NOTHING_HIDDEN: ReadonlySet<string> = new Set();

/**
 * The ids of the elements and gfx blocks hidden for everyone (ADR 0031 §7) —
 * the SHARED half of the paint and pick predicate, kept as a set so the
 * renderers ask one `has` per element and pay nothing when nobody hid
 * anything.
 *
 * Built from the document once per surface, then kept current by the
 * surface's element events and the store's block events, local or remote
 * alike: a peer's "hide for everyone" reaches this viewer the moment its
 * update does. Registered by `GfxController` into its
 * {@link GfxLocalVisibility}, beside the viewer's own local hide, so every
 * site that already skips what this viewer hid skips this too — and
 * `grid.search`, which reads neither, keeps counting both.
 */
export class GfxHiddenForEveryone {
  private readonly _ids$ = signal<ReadonlySet<string>>(NOTHING_HIDDEN);

  private _unwatch: (() => void) | null = null;

  /** Every id carrying the stored `hiddenForEveryone`. */
  get ids$(): ReadonlySignal<ReadonlySet<string>> {
    return this._ids$;
  }

  /** Follow `surface` and `store`; `null` stops following. */
  watch(store: Store, surface: SurfaceBlockModel | null) {
    this.dispose();
    if (!surface) return;

    const initial = new Set<string>();
    for (const element of surface.elementModels) {
      if (isStoredHiddenForEveryone(element)) initial.add(element.id);
    }
    for (const model of store.getAllModels()) {
      if (
        model instanceof GfxBlockElementModel &&
        isStoredHiddenForEveryone(model)
      ) {
        initial.add(model.id);
      }
    }
    this._ids$.value = initial.size ? initial : NOTHING_HIDDEN;

    const recheck = (id: string, model: unknown) => {
      const hidden = model !== null && isStoredHiddenForEveryone(model);
      const current = this._ids$.peek();
      if (current.has(id) === hidden) return;
      const next = new Set(current);
      if (hidden) next.add(id);
      else next.delete(id);
      this._ids$.value = next.size ? next : NOTHING_HIDDEN;
    };

    const subscriptions = [
      surface.elementAdded.subscribe(({ id }) =>
        recheck(id, surface.getElementById(id))
      ),
      surface.elementUpdated.subscribe(({ id }) =>
        recheck(id, surface.getElementById(id))
      ),
      surface.elementRemoved.subscribe(({ id }) => recheck(id, null)),
      store.slots.blockUpdated.subscribe(payload => {
        if (payload.type === 'delete') {
          recheck(payload.id, null);
          return;
        }
        if (
          payload.type === 'update' &&
          payload.props.key !== 'hiddenForEveryone'
        ) {
          return;
        }
        recheck(payload.id, store.getBlock(payload.id)?.model ?? null);
      }),
    ];
    this._unwatch = () => subscriptions.forEach(sub => sub.unsubscribe());
  }

  dispose() {
    this._unwatch?.();
    this._unwatch = null;
    this._ids$.value = NOTHING_HIDDEN;
  }
}

/**
 * What THIS viewer does not see on the canvas — the per-editor predicate hook
 * of ADR 0031 §8.
 *
 * `std` knows nothing about why an element is hidden for one viewer; the
 * affine layer (`CanvasLocalVisibility`) registers a signal of ids and owns
 * their persistence. `GfxController` registers one more source, the ids
 * hidden for everyone ({@link GfxHiddenForEveryone}): the shared half of the
 * same predicate, so the sites below skip both with one question. This class answers the one question the gfx plumbing
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
