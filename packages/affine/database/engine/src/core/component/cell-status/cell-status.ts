import { LoadingIcon } from '@labre/affine-components/icons';
import { html, type TemplateResult } from 'lit';

import type { Cell } from '../../view-manager/cell.js';
import { cellEmptyStyle, cellLoadingStyle } from './cell-status-css.js';

/**
 * What a cell container draws INSTEAD of its renderer while the cell is not
 * `ready` (ADR 0035 §9e): a spinner while `pending`, an empty cell on
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
      class="${cellLoadingStyle}"
      data-testid="dv-cell-loading"
      data-cell-status="pending"
      aria-busy="true"
      >${LoadingIcon()}</span
    >`;
  }
  return html`<span class="${cellEmptyStyle}" data-cell-status="error"></span>`;
}
