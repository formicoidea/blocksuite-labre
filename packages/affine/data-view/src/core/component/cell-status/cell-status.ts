import { html, type TemplateResult } from 'lit';

import type { Cell } from '../../view-manager/cell.js';
import { cellEmptyStyle, cellSkeletonStyle } from './cell-status-css.js';

/**
 * What a cell container draws INSTEAD of its renderer while the cell is not
 * `ready` (ADR 0035 §9e): a skeleton while `pending`, an empty cell on
 * `error`. `undefined` when ready, so the container mounts its renderer as in
 * 0.48. No renderer is mounted otherwise, which is what keeps a cell whose
 * value never arrived from being edited over.
 */
export function renderCellStatus(
  cell: Cell | undefined
): TemplateResult | undefined {
  const status = cell?.status$?.value ?? 'ready';
  if (status === 'ready') return undefined;
  if (status === 'pending') {
    return html`<span
      class="${cellSkeletonStyle}"
      data-testid="dv-cell-skeleton"
      data-cell-status="pending"
      aria-busy="true"
    ></span>`;
  }
  return html`<span class="${cellEmptyStyle}" data-cell-status="error"></span>`;
}
