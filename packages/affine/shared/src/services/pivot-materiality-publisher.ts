/**
 * `PivotMaterialityPublisher` — the one place a board occurrence's derived
 * materialities are announced to the host (MF3 / ADR 0006 § 4).
 *
 * When the level-3 qualification of a **bound** element changes, the library
 * announces it and forgets. It never writes to the pivot record, never awaits
 * the host, never retries and never observes the result: the element is the
 * source of truth for the occurrence, the record is the source of truth for
 * itself, and the channel between them is one-way.
 *
 * ## Why a Yjs observer and not the setter, and not the command layer
 *
 * Both were rejected for the same concrete reason: **undo**.
 *
 * The `@field()` setter runs on a JS assignment only. Undo, redo and every
 * remote peer's change arrive through the element's `Y.Map` observer and never
 * touch it. Publishing from the setter — or from the command that calls it —
 * means: qualify a bound element, press Ctrl+Z, and the element reverts while
 * the record keeps the derived materiality. A silent, permanent desync on the
 * very first undo.
 *
 * Subscribing to the surface's change stream and gating on `local` fixes it and
 * costs nothing else:
 *
 * | Event                           | `local` | Publishes?                                |
 * | ------------------------------- | ------- | ----------------------------------------- |
 * | Author qualifies an element     | `true`  | Yes, on the authoring client only         |
 * | Author presses Ctrl+Z / Ctrl+Y  | `true`  | Yes — this is what fixes the undo desync  |
 * | Remote peer receives the change | `false` | No                                        |
 *
 * `local` also IS the de-duplication: it partitions the fleet into exactly one
 * publisher and N−1 silent observers, with no leader election, no lock and no
 * acknowledgement.
 *
 * ## Best-effort, and honest about it
 *
 * Patches are full-state and idempotent, so replaying one converges — which is
 * what makes the unobservable `void` return survivable. If the authoring client
 * is offline from the host at that moment the patch is lost and the record
 * stays stale until the next local change to that element. The safety net is
 * that the element is always authoritative: a host can rebuild every derived
 * materiality by scanning `collectPivotOccurrences`. Derived materialities are
 * a cache of the boards, never a second original.
 */
import { LifeCycleWatcher, type FrameworkId } from '@labre/std';
import { FRAMEWORK_IDS } from '@labre/std';
import {
  GfxControllerIdentifier,
  type GfxPrimitiveElementModel,
  isPivotBound,
  readElementTags,
  type SurfaceBlockModel,
} from '@labre/std/gfx';
import { effect } from '@preact/signals-core';

import {
  type OccurrenceMaterialityPatch,
  PivotPropertiesProvider,
  publishOccurrenceMaterialities,
} from './pivot-properties-service.js';

/** Props whose change can alter what a patch says. Everything else is noise. */
const MATERIAL_PROPS = new Set(['tags', 'role', 'pivotDocId']);

const touchesMateriality = (payload: {
  props: Record<string, unknown>;
  oldValues: Record<string, unknown>;
}) =>
  Object.keys(payload.props).some(key => MATERIAL_PROPS.has(key)) ||
  Object.keys(payload.oldValues).some(key => MATERIAL_PROPS.has(key));

/** `'wardley:component'` → `'wardley'`, when that names a real framework. */
function frameworkOfRole(role: string | undefined): FrameworkId | undefined {
  const namespace = role?.split(':')[0];
  return (FRAMEWORK_IDS as readonly string[]).includes(namespace ?? '')
    ? (namespace as FrameworkId)
    : undefined;
}

/**
 * `(pivotDocId, elementId)` — the host's primary key for a derived materiality.
 *
 * The pair is JSON-encoded rather than joined on a separator character: both
 * halves are opaque strings the library does not mint, so any separator we
 * picked could in principle occur inside one of them and make two distinct
 * occurrences collide on one cache entry — which would silently suppress a
 * legitimate patch, the one failure mode this cache must not have.
 */
const materialityKey = (pivotDocId: string, elementId: string) =>
  JSON.stringify([pivotDocId, elementId]);

/** A patch reduced to what a host would store, for de-duplication. */
const patchFingerprint = (patch: OccurrenceMaterialityPatch) =>
  JSON.stringify([
    patch.present,
    patch.framework ?? null,
    patch.role ?? null,
    // Sorted so that two writes of the same qualification in a different order
    // are one patch, not two.
    Object.keys(patch.tags)
      .sort()
      .map(tagId => [tagId, patch.tags[tagId]]),
  ]);

export class PivotMaterialityPublisher extends LifeCycleWatcher {
  static override readonly key = 'pivot-materiality-publisher';

  /** Elements whose state is to be re-examined at the end of this microtask. */
  private readonly _pending = new Set<string>();

  private _flushing = false;

  /**
   * The record each element was last known to be bound to, so that unbinding —
   * or re-binding — can retract the OLD record's materiality. Without it the
   * retraction has no `pivotDocId` to name: by the time the change is seen, the
   * element no longer carries the old one.
   */
  private readonly _lastBinding = new Map<string, string>();

  /**
   * Last published fingerprint per `(pivotDocId, elementId)`. One user gesture
   * produces several payloads for one element — the stash/pop path alone emits
   * one per stashed prop — and a drag emits dozens that change nothing a patch
   * describes. Publishing the element's CURRENT FULL STATE and dropping it when
   * it repeats is what keeps that to one patch per real change.
   */
  private readonly _published = new Map<string, string>();

  private _subscriptions: { unsubscribe(): void }[] = [];

  private _disposeSurfaceEffect: (() => void) | null = null;

  override mounted() {
    // Degradation, and the reason it is checked once: with no host provider —
    // the playground, unit tests, a labreapp build that failed to register —
    // there is nobody to announce to, so nothing is subscribed and the whole
    // watcher costs one lookup. Binding and qualification keep working: they
    // are element-local writes and never needed the host.
    if (!this.std.getOptional(PivotPropertiesProvider)?.publishOccurrenceMaterialities) {
      return;
    }

    // The surface is a SIGNAL, not a fact: it can legitimately be null at mount
    // and arrive later, and it is replaced if the surface block is.
    this._disposeSurfaceEffect = effect(() => {
      this._resubscribe(this.std.get(GfxControllerIdentifier).surface$.value);
    });
  }

  override unmounted() {
    this._disposeSurfaceEffect?.();
    this._disposeSurfaceEffect = null;
    this._unsubscribe();
    this._pending.clear();
    this._lastBinding.clear();
    this._published.clear();
    super.unmounted();
  }

  private _unsubscribe() {
    for (const subscription of this._subscriptions) subscription.unsubscribe();
    this._subscriptions = [];
  }

  private _resubscribe(surface: SurfaceBlockModel | null) {
    this._unsubscribe();
    this._pending.clear();
    // A new surface is a new document: nothing published about the last one
    // says anything about this one.
    this._lastBinding.clear();
    this._published.clear();
    if (!surface) return;

    this._subscriptions.push(
      surface.elementAdded.subscribe(({ id, local }) => {
        if (local) this._schedule(surface, id);
        else this._track(surface, id);
      })
    );
    this._subscriptions.push(
      surface.elementUpdated.subscribe(payload => {
        if (!touchesMateriality(payload)) return;
        if (payload.local) this._schedule(surface, payload.id);
        else this._track(surface, payload.id);
      })
    );
    this._subscriptions.push(
      surface.elementRemoved.subscribe(({ id, local }) => {
        if (!local) {
          // Someone else's deletion is someone else's retraction to emit. Drop
          // the bookkeeping so a later occurrence reusing this id — an undo on
          // the peer, a paste — is not silenced by a stale fingerprint.
          const previous = this._lastBinding.get(id);
          if (previous !== undefined) {
            this._published.delete(materialityKey(previous, id));
          }
          this._lastBinding.delete(id);
          return;
        }
        // The element is already gone from the surface, so the flush below
        // cannot read it — which is exactly right: an absent element retracts.
        this._schedule(surface, id);
      })
    );

    // Elements already on the surface when this mounts are NOT published. They
    // are not a local change, and republishing a whole board on every editor
    // open would flood the host with patches it already holds. The rebuild path
    // (`collectPivotOccurrences`) is the deliberate way to resynchronise.
    for (const element of surface.elementModels) this._track(surface, element.id);
  }

  /**
   * Record what record an element is bound to, **without publishing anything**.
   *
   * ## Who owns a retraction in a collaborative session
   *
   * The client whose LOCAL transaction removes the occurrence — deletion,
   * unbind, or re-bind. That is the same rule as every other emission here
   * (`local` partitions the fleet into one publisher and N−1 observers), and it
   * is the only rule that can work: the peer that ORIGINALLY bound the element
   * sees the deletion as a remote change, so if retraction belonged to the
   * binder, nobody would emit it at all.
   *
   * Owning the retraction requires knowing which record to retract from, and by
   * the time the deletion is seen the element is gone. Hence this: **tracking
   * the binding is bookkeeping, not publication.** Every client keeps the map
   * for everything it can see, whoever wrote it, so that whichever client
   * eventually performs the removal can name the record. Without it, retraction
   * only ever worked when one client both created and deleted the occurrence —
   * the rare case in an open collaborative session, and the host would keep a
   * materiality attributed to an occurrence that no longer exists.
   *
   * A remote peer that CHANGES a binding updates this map silently: it is
   * publishing its own retraction and its own patch, and a second one from here
   * would be a duplicate, not a safety net.
   */
  private _track(surface: SurfaceBlockModel, id: string) {
    const element = surface.getElementById(id);
    if (element && isPivotBound(element)) {
      this._lastBinding.set(id, element.pivotDocId);
    } else {
      this._lastBinding.delete(id);
    }
  }

  /**
   * Coalesce per element within one microtask, then publish the element's
   * CURRENT FULL STATE — never a delta. `_onChange` is also invoked directly on
   * the stash/pop path, so one gesture legitimately produces several payloads
   * for the same element.
   */
  private _schedule(surface: SurfaceBlockModel, id: string) {
    this._pending.add(id);
    if (this._flushing) return;
    this._flushing = true;
    queueMicrotask(() => {
      this._flushing = false;
      const ids = [...this._pending];
      this._pending.clear();
      for (const pending of ids) this._publish(surface, pending);
    });
  }

  private _publish(surface: SurfaceBlockModel, id: string) {
    const element = surface.getElementById(id) ?? null;
    const previous = this._lastBinding.get(id);
    const current =
      element && isPivotBound(element) ? element.pivotDocId : undefined;

    // Retract on the OLD record when the binding is gone or has moved. An
    // element deleted, unbound, or re-bound elsewhere must not leave the record
    // holding materialities attributed to an occurrence that no longer exists
    // there — "the library never deletes host data" would quietly become "the
    // library leaks host data" (ADR 0006 § 4.3).
    if (previous !== undefined && previous !== current) {
      this._emit({
        pivotDocId: previous,
        elementId: id,
        framework: undefined,
        role: undefined,
        tags: {},
        present: false,
      });
      this._lastBinding.delete(id);
      this._published.delete(materialityKey(previous, id));
    }

    if (!element || current === undefined) return;

    this._lastBinding.set(id, current);
    this._emit(buildOccurrencePatch(element, current));
  }

  private _emit(patch: OccurrenceMaterialityPatch) {
    const key = materialityKey(patch.pivotDocId, patch.elementId);
    const fingerprint = patchFingerprint(patch);
    if (this._published.get(key) === fingerprint) return;

    if (patch.present) this._published.set(key, fingerprint);
    else this._published.delete(key);

    // Guarded, fire-and-forget: a throwing host is swallowed, because there is
    // nothing a caller could do with the failure and the element remains the
    // source of truth either way.
    publishOccurrenceMaterialities(this.std, patch);
  }
}

/**
 * The full state of one occurrence, as the host stores it. Exported for the
 * host's own rebuild path and for tests — it is a pure function of the element.
 */
export function buildOccurrencePatch(
  element: GfxPrimitiveElementModel,
  pivotDocId: string
): OccurrenceMaterialityPatch {
  return {
    pivotDocId,
    elementId: element.id,
    framework: frameworkOfRole(element.role),
    role: element.role,
    // A flattened snapshot: a transport DTO, not the persisted shape. On the
    // element the same data is a nested `Y.Map<string[]>` so that concurrent
    // qualification merges per tag.
    tags: readElementTags(element),
    present: true,
  };
}
