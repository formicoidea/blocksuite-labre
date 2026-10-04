import { LifeCycleWatcher } from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import { effect, type ReadonlySignal, signal } from '@preact/signals-core';

import { EditPropsStore } from './edit-props-store.js';

/**
 * Hide is LOCAL by default (ADR 0031 §1, §8): what this viewer hid on this
 * document's canvas, and nothing anybody else can see.
 *
 * - **Never written to the document.** The ids live in a signal and persist
 *   through `EditPropsStore`'s `localHiddenElements`, a `localStorage` prop
 *   keyed by document id exactly like the viewport — so a reload keeps them
 *   (open point 7, resolved at acceptance) and no Yjs update is ever produced.
 * - **Pruned on load**: ids the document no longer has are dropped the first
 *   time the surface is there to ask, so the list does not grow forever.
 * - **Not `display`**: the canvas text editor owns that flag and closing it on
 *   a locally hidden text would unhide it.
 *
 * The signal is registered into `gfx.localVisibility`, the per-editor hook the
 * renderers, the DOM block views, pointer picking and the marquee read. It is
 * never read by `grid.search`: rules, legends and semantic exports count a
 * hidden element, because hiding is not deleting.
 *
 * Not gated by `store.readonly`: hiding is a way of LOOKING at a document, so
 * a reader may do it — nothing they do here reaches the document.
 *
 * Whole user layers hide the same way (stage 7): a second set of ids, kept
 * and persisted beside the first (`localHiddenLayers`), registered with
 * `gfx.localVisibility.registerLayers` — every model whose effective layer
 * is in it is hidden for this viewer.
 */
export class CanvasLocalVisibility extends LifeCycleWatcher {
  static override key = 'canvas-local-visibility';

  private readonly _hiddenIds$ = signal<ReadonlySet<string>>(new Set());

  private readonly _hiddenLayerIds$ = signal<ReadonlySet<string>>(new Set());

  private _disposers: (() => void)[] = [];

  /** The ids this viewer hid. */
  get hiddenIds$(): ReadonlySignal<ReadonlySet<string>> {
    return this._hiddenIds$;
  }

  /** The user layers this viewer hid. */
  get hiddenLayerIds$(): ReadonlySignal<ReadonlySet<string>> {
    return this._hiddenLayerIds$;
  }

  isHidden(id: string): boolean {
    return this._hiddenIds$.value.has(id);
  }

  /** Hide whole user layers for this viewer. Answers how many changed. */
  hideLayers(ids: Iterable<string>): number {
    const next = new Set(this._hiddenLayerIds$.peek());
    let changed = 0;
    for (const id of ids) {
      if (next.has(id)) continue;
      next.add(id);
      changed++;
    }
    if (changed) this._commitLayers(next);
    return changed;
  }

  /** Show user layers again. Answers how many were hidden. */
  showLayers(ids: Iterable<string>): number {
    const next = new Set(this._hiddenLayerIds$.peek());
    let changed = 0;
    for (const id of ids) {
      if (next.delete(id)) changed++;
    }
    if (changed) this._commitLayers(next);
    return changed;
  }

  /** Hide `ids`. Answers how many were not hidden yet. */
  hide(ids: Iterable<string>): number {
    const next = new Set(this._hiddenIds$.peek());
    let changed = 0;
    for (const id of ids) {
      if (next.has(id)) continue;
      next.add(id);
      changed++;
    }
    if (changed) this._commit(next);
    return changed;
  }

  /** Show `ids` again. Answers how many were hidden. */
  show(ids: Iterable<string>): number {
    const next = new Set(this._hiddenIds$.peek());
    let changed = 0;
    for (const id of ids) {
      if (next.delete(id)) changed++;
    }
    if (changed) this._commit(next);
    return changed;
  }

  /**
   * Show every element this viewer hid. Answers how many were hidden.
   * Hidden layers are {@link showAllLayers}'s, so each count reports one
   * target.
   */
  showAll(): number {
    const count = this._hiddenIds$.peek().size;
    if (count) this._commit(new Set());
    return count;
  }

  /** Show every layer this viewer hid. Answers how many were hidden. */
  showAllLayers(): number {
    const count = this._hiddenLayerIds$.peek().size;
    if (count) this._commitLayers(new Set());
    return count;
  }

  private _commitLayers(next: ReadonlySet<string>) {
    this._hiddenLayerIds$.value = next;
    this.std
      .getOptional(EditPropsStore)
      ?.setStorage('localHiddenLayers', [...next]);
  }

  private _commit(next: ReadonlySet<string>) {
    this._hiddenIds$.value = next;
    this.std
      .getOptional(EditPropsStore)
      ?.setStorage('localHiddenElements', [...next]);
  }

  override mounted() {
    super.mounted();
    const gfx = this.std.get(GfxControllerIdentifier);
    this._disposers.push(gfx.localVisibility.register(this._hiddenIds$));
    this._disposers.push(
      gfx.localVisibility.registerLayers(this._hiddenLayerIds$)
    );
    this._restoreLayers();

    const stored =
      this.std.getOptional(EditPropsStore)?.getStorage('localHiddenElements') ??
      [];
    if (!stored.length) return;

    // The surface may arrive after mount; prune the first time it is there.
    let pruned = false;
    const stop = effect(() => {
      if (pruned || !gfx.surface$.value) return;
      pruned = true;
      const kept = stored.filter(id => gfx.getElementById(id) !== null);
      if (kept.length === stored.length) {
        this._hiddenIds$.value = new Set(kept);
      } else {
        this._commit(new Set(kept));
      }
    });
    this._disposers.push(stop);
  }

  /**
   * Restore the hidden layers, pruned of layers the surface no longer has —
   * the first time the surface is there to ask.
   */
  private _restoreLayers() {
    const gfx = this.std.get(GfxControllerIdentifier);
    const stored =
      this.std.getOptional(EditPropsStore)?.getStorage('localHiddenLayers') ??
      [];
    if (!stored.length) return;
    let pruned = false;
    const stop = effect(() => {
      const surface = gfx.surface$.value;
      if (pruned || !surface) return;
      pruned = true;
      const layers = surface.props.layers ?? {};
      const kept = stored.filter(id => id in layers);
      if (kept.length === stored.length) {
        this._hiddenLayerIds$.value = new Set(kept);
      } else {
        this._commitLayers(new Set(kept));
      }
    });
    this._disposers.push(stop);
  }

  override unmounted() {
    this._disposers.forEach(dispose => dispose());
    this._disposers = [];
    super.unmounted();
  }
}
