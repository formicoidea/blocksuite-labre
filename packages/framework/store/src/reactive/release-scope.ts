import type { proxies as globalProxies } from './memory.js';

/**
 * @internal
 * Something that observes a Yjs type on behalf of a store and can stop.
 */
export interface Releasable {
  /** Detach every observer this object attached to Yjs. Writes nothing. */
  _release(): void;
}

/** Sweep dead references once the set reaches this size… */
const FIRST_SWEEP_AT = 64;

/** …then again when it has grown by this factor since the last sweep. */
const SWEEP_GROWTH = 2;

/**
 * @internal
 * Everything one block of one store attached to Yjs through the reactive
 * layer: its nested-prop proxies, the `Text` and `Boxed` instances built for
 * its props, and the registry that makes a Yjs type resolve to one proxy
 * (#746, ADR 0057).
 *
 * A Yjs type lives as long as the document, so an observer left on it keeps
 * whatever the observer closes over, the store included, for as long as the
 * workspace is open. `release()` detaches them all; it reads and detaches,
 * and never writes to Yjs.
 *
 * Each scope has its own registry: a store never reuses a proxy another store
 * created. One module-level registry keyed by the Yjs type (`memory.ts`)
 * would hand a second store on the same document (a query preview, a readonly
 * mirror) the FIRST store's proxy for every nested prop, bound to that
 * store's model: the preview would never be notified of a nested change, and
 * releasing the first store would freeze the preview's data (ADR 0057 guard
 * 6).
 * Unscoped callers (the workspace meta, the reactive unit tests) keep the
 * module-level registry and its behaviour.
 *
 * What is tracked is held WEAKLY: an observer whose Yjs type was collected
 * cannot hold anything, and a strong handle per prop write would make a live
 * store grow with every nested replacement (a new `Y.Map` per database cell
 * edit) until the block is removed. What `release()` finds still alive is
 * exactly what can still be reached from the document.
 */
export class ReleaseScope {
  /** The proxy built by this scope for each Yjs type, one per type. */
  readonly proxies: typeof globalProxies = new WeakMap();

  private _released = false;

  private readonly _tracked = new Set<WeakRef<Releasable>>();

  private _sweepAt = FIRST_SWEEP_AT;

  get released() {
    return this._released;
  }

  /**
   * Keep a handle on `target` so `release()` can detach it. A target tracked
   * after the release (a stale read of a released model building a proxy) is
   * released at once: nothing attaches to Yjs on behalf of a released store.
   */
  track(target: Releasable) {
    if (this._released) {
      target._release();
      return;
    }
    this._tracked.add(new WeakRef(target));
    if (this._tracked.size < this._sweepAt) return;
    this._tracked.forEach(ref => {
      if (!ref.deref()) this._tracked.delete(ref);
    });
    this._sweepAt = Math.max(FIRST_SWEEP_AT, this._tracked.size * SWEEP_GROWTH);
  }

  /** Detach everything tracked. Idempotent; writes nothing to Yjs. */
  release() {
    if (this._released) return;
    this._released = true;
    this._tracked.forEach(ref => ref.deref()?._release());
    this._tracked.clear();
  }
}
