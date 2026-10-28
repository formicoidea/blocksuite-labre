import type { ReadonlySignal } from '@preact/signals-core';

/**
 * Cell hydration (ADR 0035 §9e, issue B2): a widening of the data-source
 * contract, not a seam.
 *
 * A host source whose values arrive after its rows (Labre keeps them in SQL,
 * labre ADR-0047) says, per cell, whether the value it answers is the real one
 * yet, and, for the whole source, whether values are still loading or failed.
 * Every member is optional: a source that says nothing is `ready` at once,
 * which is the inline source and every 0.48 host source, unchanged.
 *
 * Nothing is written in any state. A cell that is not `ready` mounts no
 * renderer and refuses `valueSet`, so neither the user nor a paste, a fill or
 * a kanban drop can write over a value the source has not delivered.
 */
export type CellStatus = 'ready' | 'pending' | 'error';

export type ValuesStatus = 'loading' | 'ready' | 'error';

export interface ValuesState {
  readonly status: ValuesStatus;
  /** `Date.now()` when the source entered `status`. */
  readonly since: number;
}

export interface DataSourceHydration {
  cellStatus?(rowId: string, propertyId: string): CellStatus;
  valuesState$?: ReadonlySignal<ValuesState>;
  /** Present when the source can try again after an `error`. */
  retryValues?(): void;
}

export const VALUES_READY: ValuesState = Object.freeze({
  status: 'ready',
  since: 0,
});

/** How long values may load before a banner says so (REQ-DB-12). */
export const VALUES_SLOW_AFTER_MS = 3000;

export function cellStatusOf(
  source: DataSourceHydration,
  rowId: string,
  propertyId: string
): CellStatus {
  return source.cellStatus?.(rowId, propertyId) ?? 'ready';
}

export function valuesStateOf(source: DataSourceHydration): ValuesState {
  return source.valuesState$?.value ?? VALUES_READY;
}

/** What a count shows while values are not ready. */
export const VALUES_PENDING_MARK = '…';

/** Counts (group headers, column statistics) show an ellipsis until `true`. */
export function valuesReady(source: DataSourceHydration): boolean {
  return valuesStateOf(source).status === 'ready';
}

export type ValuesBanner = 'none' | 'slow' | 'error';

/**
 * Which banner a view shows: none while values load for less than
 * {@link VALUES_SLOW_AFTER_MS}, `slow` after, `error` as soon as loading
 * failed. Pure, so the 3 s rule is tested without a timer.
 */
export function valuesBannerOf(state: ValuesState, now: number): ValuesBanner {
  if (state.status === 'error') return 'error';
  if (state.status === 'loading' && now - state.since >= VALUES_SLOW_AFTER_MS) {
    return 'slow';
  }
  return 'none';
}
