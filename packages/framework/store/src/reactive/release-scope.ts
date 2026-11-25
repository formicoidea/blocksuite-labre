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
 * A block scope has its own registry (a flat-data block's arrays, per store);
 * a nested prop's tree is shared by every store on the document and has the
 * module-level one (`memory.ts`, `SharedPropTree`, ADR 0057 guard 6).
 * Unscoped callers (the workspace meta, the reactive unit tests) keep the
 * module-level registry and its behaviour.
 *
 * A target is held once however often it is tracked: the reactive layer binds
 * the same `Text` or `Boxed` several times (a flat-data cell is bound when
 * its data is read, then again when it is assigned into its nested proxy,
 * as on the base), and each `_release` is idempotent besides, so nothing is
 * detached twice (Yjs warns on removing a handler it does not hold).
 *
 * What is tracked is held WEAKLY: an observer whose Yjs type was collected
 * cannot hold anything, and a strong handle per prop write would make a live
 * store grow with every nested replacement (a new `Y.Map` per database cell
 * edit) until the block is removed. What `release()` finds still alive is
 * exactly what can still be reached from the document.
 */
export class ReleaseScope {
  private _released = false;

  private readonly _tracked = new Set<WeakRef<Releasable>>();

  /** What `_tracked` holds a reference to, so a target is tracked once. */
  private readonly _seen = new WeakSet<Releasable>();

  private _sweepAt = FIRST_SWEEP_AT;

  /**
   * @param proxies The registry the proxies built in this scope resolve their
   * Yjs type in, one proxy per type. Its own by default (a flat-data block's
   * arrays, per store); the module-level one for a shared nested-prop tree.
   */
  constructor(readonly proxies: typeof globalProxies = new WeakMap()) {}

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
    if (this._seen.has(target)) return;
    this._seen.add(target);
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
