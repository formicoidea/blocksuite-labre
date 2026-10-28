import { createIdentifier } from '@labre/global/di';

/**
 * Set on a data source (`serviceSet`) by the block that hosts its views when
 * the host offers a menu beside "New" (templates and options, ADR 0035
 * amendment of 2026-10-14). The header's "New" then draws a chevron that
 * calls `open`; the main part still adds a row through `addRow`, as without
 * it. Absent, "New" is the single button of 0.48, nothing else drawn.
 *
 * `label` is resolved by the block, which owns the wording and the
 * translation seam, so data-view declares no key for a host's menu.
 */
export interface NewRowMenuOpener {
  label(): string;
  /** Asked at every render of "New"; `false` draws no chevron for this
   *  view. Absent, the chevron is drawn. */
  canOpen?(viewId: string): boolean;
  open(anchor: HTMLElement, viewId: string): void;
}

export const NewRowMenuOpenerKey = createIdentifier<NewRowMenuOpener>(
  'data-view-new-row-menu-opener'
);
