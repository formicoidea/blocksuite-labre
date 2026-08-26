import type { SurfaceBlockModel } from '@labre/std/gfx';
import { InteractivityExtension } from '@labre/std/gfx';
import { effect } from '@preact/signals-core';

import { EDGY_RELATION_DELAY_MS, resolveEdgyRelations } from './relation';

/**
 * Turns "a connector was drawn, or one of its ends just moved" into a naming.
 *
 * Registered from the FLAG-GATED `EdgyViewExtension`, not from the always-on
 * render one, and the distinction is `docs/adr/0009`'s: this is a creation
 * tool. It authors content — it writes a role and a label into the document —
 * and it only ever fires on an edge the flag-gated toolbox itself stamped
 * `edgy:relation`. A board drawn while the flag was on keeps every verb it was
 * given, painted by the always-on renderer and read by the always-on
 * vocabulary; with the flag off nothing new is named because nothing new is
 * being armed. Registering it always-on would mean the library kept authoring
 * EDGY content for a host that switched EDGY off.
 *
 * The subscription mechanics are `EstuarineGhostManager`'s, including the part
 * that matters: the surface is a SIGNAL, null at mount and replaced when the
 * surface block is.
 */
export class EdgyRelationResolver extends InteractivityExtension {
  static override key = 'edgy-relation-resolver';

  private _subscriptions: { unsubscribe(): void }[] = [];

  private _disposeSurfaceEffect: (() => void) | null = null;

  private _pending: ReturnType<typeof setTimeout> | null = null;

  private _candidates = new Set<string>();

  override mounted() {
    this._disposeSurfaceEffect = effect(() => {
      this._resubscribe(this.gfx.surface$.value);
    });
  }

  override unmounted() {
    this._disposeSurfaceEffect?.();
    this._disposeSurfaceEffect = null;
    this._unsubscribe();
    this._forget();
    super.unmounted();
  }

  private _forget() {
    if (this._pending) clearTimeout(this._pending);
    this._pending = null;
    this._candidates.clear();
  }

  private _unsubscribe() {
    for (const subscription of this._subscriptions) subscription.unsubscribe();
    this._subscriptions = [];
  }

  private _resubscribe(surface: SurfaceBlockModel | null) {
    this._unsubscribe();
    // Candidates queued against the previous surface are about elements this
    // one has never heard of.
    this._forget();
    if (!surface) return;

    this._subscriptions.push(
      surface.elementAdded.subscribe(({ id, local }) => {
        if (!local) return;
        this._schedule(id);
      })
    );
    this._subscriptions.push(
      surface.elementUpdated.subscribe(({ id, props, local }) => {
        // LOCAL only, the filter `reading.ts` documents at length: `local`
        // partitions the fleet into one writer and N−1 silent observers with
        // no leader election. Without it, everyone on a shared board would
        // name the same relation the moment it synced — the same role and the
        // same word each time, so nothing would corrupt, but each peer would
        // get an undo entry for a gesture they did not make.
        if (!local) return;
        // Only the two ends can turn an unnamed relation into a sentence.
        // Every other prop — a drag, a restyle, a label edit — must not even
        // rearm the timer.
        if (!props || (!('source' in props) && !('target' in props))) return;
        this._schedule(id);
      })
    );
  }

  private _schedule(id: string) {
    this._candidates.add(id);
    if (this._pending) clearTimeout(this._pending);
    this._pending = setTimeout(() => {
      this._pending = null;
      this._flush();
    }, EDGY_RELATION_DELAY_MS);
  }

  private _flush() {
    const surface = this.gfx.surface;
    const candidates = this._candidates;
    // Whatever happens below, what accumulated is accounted for: a set left
    // behind would be replayed against a later, unrelated gesture.
    this._candidates = new Set();
    if (!surface) return;
    resolveEdgyRelations(surface, candidates);
  }
}
