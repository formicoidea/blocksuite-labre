import { LifeCycleWatcher } from '@labre/std';
import type {
  SurfaceElementDamage,
  SurfaceElementDamageReport,
} from '@labre/std/gfx';

import {
  TelemetryProvider,
  type TelemetryService,
} from './telemetry-service.js';

/**
 * The whole surface API this watcher touches, named structurally on purpose:
 * it is also the entire harness a unit spec has to stand up, and it keeps the
 * watcher from caring which block flavour grew a `damagedElements` map next.
 */
export type DamageReportingSurface = {
  readonly damagedElements: ReadonlyMap<string, SurfaceElementDamage>;
  readonly elementDamaged: {
    subscribe(next: (report: SurfaceElementDamageReport) => void): {
      unsubscribe(): void;
    };
  };
};

export function isDamageReportingSurface(
  model: unknown
): model is DamageReportingSurface {
  const candidate = model as Partial<DamageReportingSurface> | null;
  return (
    !!candidate &&
    candidate.damagedElements instanceof Map &&
    typeof candidate.elementDamaged?.subscribe === 'function'
  );
}

/**
 * Reports `DocumentDamaged` — how many documents open carrying elements the
 * editor cannot draw (#318, follow-up of #321).
 *
 * **Why a state read and not only a subscription.** The surface builds its
 * element models when the block model is created, well before any view or
 * `LifeCycleWatcher` is mounted, so every element the document OPENED with is
 * already damaged by the time this watcher exists. It therefore reads
 * `surface.damagedElements` once at mount for the opening batch, and only then
 * subscribes for what a remote sync delivers afterwards.
 *
 * **One event per batch, elements deduplicated for the watcher's lifetime.**
 * A sync can deliver several damaged elements in one go; sending one event per
 * element would make "how many damaged documents" unreadable, and re-sending an
 * id already counted would make it wrong. Later arrivals are therefore
 * aggregated in a microtask and filtered against what was already reported.
 *
 * `page` is left unset here for the reason `BlockLifecycleTelemetryWatcher`
 * leaves it unset: this is store plumbing, it has no editor mode to state, and
 * a damaged document is damaged in either one.
 *
 * Inert when no `TelemetryService` is injected.
 */
export class DocumentDamageTelemetryWatcher extends LifeCycleWatcher {
  static override readonly key = 'document-damage-telemetry';

  /** Ids already counted, so a document never counts an element twice. */
  private readonly _counted = new Set<string>();

  private readonly _pending = new Set<string>();

  private _flushScheduled = false;

  private _stopped = false;

  private _subscriptions: { unsubscribe(): void }[] = [];

  private _telemetry?: TelemetryService;

  override mounted() {
    const telemetry = this.std.getOptional(TelemetryProvider);
    if (!telemetry) return;
    this._telemetry = telemetry;

    // Structural, not `instanceof SurfaceBlockModel`: the watcher needs two
    // members, not a class, and the guard is what states that.
    const surfaces = (
      this.std.store.getModelsByFlavour('affine:surface') as unknown[]
    ).filter(isDamageReportingSurface);

    for (const surface of surfaces) {
      for (const id of surface.damagedElements.keys()) this._pending.add(id);
      this._subscriptions.push(
        surface.elementDamaged.subscribe(({ id }) => {
          this._pending.add(id);
          this._schedule();
        })
      );
    }

    // The opening batch, synchronously: it is complete already, and nothing
    // gained by making the host wait a tick for the number it opened with.
    this._flush();
  }

  override unmounted() {
    this._stopped = true;
    for (const subscription of this._subscriptions) subscription.unsubscribe();
    this._subscriptions = [];
    this._pending.clear();
    this._counted.clear();
    this._telemetry = undefined;
    super.unmounted();
  }

  private _schedule() {
    if (this._flushScheduled) return;
    this._flushScheduled = true;
    queueMicrotask(() => {
      this._flushScheduled = false;
      if (!this._stopped) this._flush();
    });
  }

  private _flush() {
    const fresh = [...this._pending].filter(id => !this._counted.has(id));
    this._pending.clear();
    if (fresh.length === 0) return;
    for (const id of fresh) this._counted.add(id);
    this._telemetry?.track('DocumentDamaged', {
      reason: 'missing-xywh',
      elementCount: fresh.length,
    });
  }
}
