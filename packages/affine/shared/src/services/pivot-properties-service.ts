/**
 * `PivotPropertiesProvider` — the injectable `pivotDocId` → properties seam
 * (MF1, ADR 0006).
 *
 * ADR 0005 gives a surface element an optional `pivotDocId` pointing at a
 * host-owned **pivot record**. This is what turns that string into something a
 * user can see, without the library ever learning what a pivot record is, and
 * without the host's data layer getting between the user and their gesture.
 *
 * Two properties carry the whole design:
 *
 * - `properties$` returns a `ReadonlySignal` **synchronously**. There is no
 *   `Promise`-returning method on the read path, so no call site can `await`
 *   one — blocking is structurally impossible, not merely discouraged. Same
 *   shape as `DocDisplayMetaExtension`, minus the one thing worth not copying:
 *   the host never hands the library rendered markup.
 * - The popup's content is host-configured (`hoverFields`), and that is a
 *   performance contract: a pivot record may carry dozens of properties,
 *   several of them expensive, and a hover must not pay for what it will not
 *   draw.
 */
import { createIdentifier } from '@labre/global/di';
import type { BlockStdScope, FrameworkId } from '@labre/std';
import type { ExtensionType } from '@labre/store';
import type { ReadonlySignal } from '@preact/signals-core';
import { computed } from '@preact/signals-core';

/**
 * Typed, render-free property values. No markup, ever — not a `TemplateResult`,
 * not an HTML string, not a component reference (ADR 0006 § 5).
 *
 * Consumers MUST handle this union exhaustively **with a default branch**: an
 * unknown `kind` renders as nothing and never throws, which is what lets a new
 * value kind ship without breaking an older host or an older library. Treat the
 * union as public API — adding a kind is cheap, changing one is a breaking
 * change for every host.
 */
export type PivotPropertyValue =
  | { kind: 'text'; value: string }
  | { kind: 'number'; value: number; unit?: string }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'date'; value: string } // ISO-8601
  | { kind: 'tags'; value: string[] }
  | { kind: 'user'; value: { id: string; name: string } }
  | { kind: 'ref'; value: { docId: string; label?: string } };

export type PivotProperty = {
  /** Stable, host-defined key. Used for ordering and diffing, not display. */
  key: string;
  /** Display label, already localized by the host. */
  label: string;
  value: PivotPropertyValue;
  /**
   * Where the value came from. `derived-from-occurrence` marks properties the
   * host wrote back from a board occurrence (see {@link
   * OccurrenceMaterialityPatch}); the library renders them distinctly and never
   * lets the user edit them here.
   */
  provenance?: 'authored' | 'derived-from-occurrence';
};

export type PivotSnapshot = {
  docId: string;
  title: string;
  /** Host-ordered. The library preserves the order and does not sort. */
  properties: PivotProperty[];
};

export type PivotQueryState =
  | { status: 'loading' }
  | { status: 'ready'; snapshot: PivotSnapshot }
  /** The binding is dangling: record deleted, or not visible to this user. */
  | { status: 'missing' }
  | { status: 'error'; reason?: string };

/** Which properties a consuming surface asks for. */
export type PivotPropertiesConfig = {
  /**
   * Property keys the hover popup displays, in this order. The provider MUST
   * load and return ONLY these.
   *
   * `[]` disables the asynchronous complement entirely while keeping the
   * provider registered: the library does not call `properties$` **at all** —
   * not "calls it and ignores the answer". No call, no request, no work. It is
   * the deliberate opt-out for hosts that want the hover to stay purely local.
   */
  hoverFields: readonly string[];
};

/**
 * One occurrence's derived contribution to a pivot record, announced and
 * forgotten. The library never writes to the pivot record and never observes
 * the result (ADR 0006 § 4).
 *
 * Declared here — ahead of the `PivotMaterialityPublisher` that will emit it,
 * which waits on the type-3 qualification of ADR 0007 — because ADRs 0005,
 * 0006 and 0007 freeze ONE contract: a host implementing this interface today
 * must be able to implement the whole of it, and the optional method must not
 * change shape when the publisher lands.
 */
export type OccurrenceMaterialityPatch = {
  /** The bound pivot record. */
  pivotDocId: string;
  /**
   * Which occurrence this patch describes. The host's primary key, together
   * with `pivotDocId` — derived materialities are stored per occurrence, which
   * is what lets one be retracted precisely when its element disappears while
   * the record's other occurrences keep theirs (ADR 0006 § 4.3/4.4).
   */
  elementId: string;
  /**
   * Owning framework, when the occurrence has one — derived from the namespace
   * of its `role` (`'wardley:component'` → `'wardley'`).
   *
   * OPTIONAL, which is a deviation from ADR 0006 § 4's `framework: FrameworkId`,
   * for exactly the reason ADR 0007 § 7 was already amended on the twin
   * telemetry field: ADR 0007 § 6 states that no rung of the ladder requires
   * the previous one, so a plain rectangle bound to a pivot record — no role at
   * all — is a legal state that belongs to no framework. A required field would
   * oblige the library to invent an identity, which is the one thing taking
   * `FrameworkId` from ADR 0008 exists to stop. Absent rather than `'unknown'`,
   * per the repo convention.
   */
  framework?: FrameworkId;
  /** Role id, e.g. `'wardley:component'`. `undefined` once the role is cleared. */
  role: string | undefined;
  /**
   * Type-3 tags: tag def id -> selected value ids. `{}` = cleared. A plain
   * object on purpose: this is a transport DTO, not the persisted shape.
   */
  tags: Record<string, string[]>;
  /**
   * `false` = this occurrence no longer exists (element deleted, or unbound).
   * The host drops every derived materiality keyed by `(pivotDocId, elementId)`.
   * When `false`, `role` is `undefined` and `tags` is `{}`.
   */
  present: boolean;
};

export interface PivotPropertiesService {
  /**
   * MUST return synchronously and MUST NOT throw. The returned signal may start
   * at `loading` and settle later; the library never awaits it. Caching,
   * deduplication, revalidation and cancellation are the host's business —
   * `fields` is part of the cache key.
   *
   * `fields` is the configured list, passed explicitly on every call. The
   * provider MUST NOT load, compute, join or return properties outside it.
   * Unknown or unauthorized keys are **skipped silently**: the provider returns
   * the subset it can supply, never errors, never returns a placeholder row and
   * never blocks the rest.
   *
   * The `MUST NOT throw` is a contract for hosts, not an assumption the library
   * is entitled to make — it sits on the hover path, so
   * {@link queryPivotProperties} guards it anyway.
   */
  properties$(
    pivotDocId: string,
    opts: { fields: readonly string[] }
  ): ReadonlySignal<PivotQueryState>;

  /**
   * Optional zero-cost cache peek, for cases where the library wants to avoid
   * even a `loading` flash. MUST be O(1) and side-effect free.
   */
  peek?(
    pivotDocId: string,
    opts: { fields: readonly string[] }
  ): PivotSnapshot | undefined;

  /**
   * Fire-and-forget write-back of one occurrence's derived materialities.
   * Returns `void`, deliberately not a `Promise`: the library cannot await it,
   * retry it, or observe its failure. The channel is unidirectional and
   * best-effort — a change on the record never mutates an element.
   */
  publishOccurrenceMaterialities?(patch: OccurrenceMaterialityPatch): void;
}

export const PivotPropertiesProvider = createIdentifier<PivotPropertiesService>(
  'LabrePivotPropertiesService'
);

export const PivotPropertiesConfigIdentifier =
  createIdentifier<PivotPropertiesConfig>('LabrePivotPropertiesConfig');

/**
 * The ONLY way in. **No noop default is registered**: unlike telemetry — where
 * a noop keeps the bus uniformly wired — absence here is a *meaningful* state
 * (standalone playground, unit tests, a labreapp build that failed to
 * register), and making it the tested default is what keeps the degraded path
 * honest.
 */
export function PivotPropertiesExtension(
  service: PivotPropertiesService,
  config: PivotPropertiesConfig
): ExtensionType {
  return {
    setup: di => {
      di.override(PivotPropertiesProvider, () => service);
      di.override(PivotPropertiesConfigIdentifier, () => config);
    },
  };
}

const errorState = (reason: string): ReadonlySignal<PivotQueryState> =>
  computed(() => ({ status: 'error', reason }));

/**
 * The guarded read every in-library consumer uses. Synchronous by construction,
 * and the one place the provider contract is enforced rather than trusted:
 *
 * - **No provider registered** → `undefined`. Not a call, not a state: the
 *   asynchronous complement does not exist in this assembly. The caller renders
 *   its local facts only — no spinner, no empty "Properties" section, no error
 *   — and hides (rather than disables) any affordance whose *only* purpose is
 *   to reach the record, per the `QuickSearchProvider` precedent.
 * - **`hoverFields` empty, or no config registered** → `undefined`, and the
 *   provider is **not called at all**. Absent config with a provider present is
 *   a host wiring error, not a crash: it degrades to `hoverFields: []`, whose
 *   observable behaviour is identical to no provider.
 * - **The provider throws** → `{ status: 'error' }`. A host's broken build must
 *   not become a crash-on-hover.
 *
 * `undefined` is deliberately NOT folded into `{ status: 'missing' }`: `missing`
 * means "the binding is dangling — the record was deleted, or you cannot see
 * it", which is a fact worth one discreet line. "This editor has no host data
 * layer" is not that fact, and rendering it as one would put an error in front
 * of every standalone user.
 */
export function queryPivotProperties(
  std: BlockStdScope,
  pivotDocId: string
): ReadonlySignal<PivotQueryState> | undefined {
  const provider = std.getOptional(PivotPropertiesProvider);
  if (!provider) return undefined;

  const fields = std.getOptional(PivotPropertiesConfigIdentifier)?.hoverFields;
  if (!fields?.length) return undefined;

  try {
    return provider.properties$(pivotDocId, { fields });
  } catch (error) {
    console.error('PivotPropertiesProvider.properties$ threw', error);
    return errorState(error instanceof Error ? error.message : String(error));
  }
}

/**
 * The guarded `peek`. Same rules as {@link queryPivotProperties}, and a throw
 * is swallowed into `undefined` — a cache peek exists to avoid a flash, so
 * failing it must cost nothing but the flash.
 */
export function peekPivotProperties(
  std: BlockStdScope,
  pivotDocId: string
): PivotSnapshot | undefined {
  const provider = std.getOptional(PivotPropertiesProvider);
  if (!provider?.peek) return undefined;

  const fields = std.getOptional(PivotPropertiesConfigIdentifier)?.hoverFields;
  if (!fields?.length) return undefined;

  try {
    return provider.peek(pivotDocId, { fields });
  } catch (error) {
    console.error('PivotPropertiesProvider.peek threw', error);
    return undefined;
  }
}

/**
 * The guarded write-back. Fire-and-forget by contract, so a throwing host is
 * swallowed rather than surfaced: there is nothing a caller could do with the
 * failure, and the element remains the source of truth either way.
 */
export function publishOccurrenceMaterialities(
  std: BlockStdScope,
  patch: OccurrenceMaterialityPatch
): void {
  const provider = std.getOptional(PivotPropertiesProvider);
  if (!provider?.publishOccurrenceMaterialities) return;

  try {
    provider.publishOccurrenceMaterialities(patch);
  } catch (error) {
    console.error(
      'PivotPropertiesProvider.publishOccurrenceMaterialities threw',
      error
    );
  }
}
