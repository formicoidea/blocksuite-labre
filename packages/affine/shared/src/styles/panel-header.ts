import { css } from 'lit';

import { fontSMStyle } from './font';

/**
 * The header of a side panel, as the frame panel draws it
 * (`fragments/frame-panel`, `header/frame-panel-header.ts`): one 36px row,
 * 8px side padding, no divider under it, a 14px / 500 secondary-text title
 * and icon buttons whose glyph is secondary until hovered or active.
 *
 * Every side panel's header takes it from here — the frame panel, the
 * selection pane and the artefact catalogue — so the three cannot drift
 * apart (held by `panel-header-parity.unit.spec.ts` in `affine/all`). It lives
 * this low because a widget may not import the frame panel: the frame panel
 * depends on the frame block, which depends on the edgeless toolbar.
 *
 * A component opts in by adding the three classes to its own markup:
 * `affine-panel-header` on the row, `affine-panel-header-title` on the title,
 * `affine-panel-header-button` on each icon button.
 */
export const panelHeaderStyles = css`
  .affine-panel-header {
    display: flex;
    flex: none;
    width: 100%;
    height: 36px;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    box-sizing: border-box;
    padding: 0 8px;
  }

  ${fontSMStyle('.affine-panel-header-title')}

  .affine-panel-header-title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--affine-text-secondary-color);
  }

  .affine-panel-header-button svg {
    color: var(--affine-icon-secondary);
  }

  .affine-panel-header-button:hover svg,
  .affine-panel-header-button.active svg {
    color: var(--affine-icon-color);
  }
`;

/**
 * Pointer travel, on either axis, before a press on a card or a row of a side
 * panel becomes a drag rather than a click — the frame panel's threshold,
 * shared with the selection pane so the two panels start a drag alike.
 */
export const PANEL_DRAG_THRESHOLD_PX = 5;

/** Whether a press at `from` moved to `to` has travelled far enough to drag. */
export function panelDragStarted(
  from: { x: number; y: number },
  to: { x: number; y: number }
): boolean {
  return (
    Math.abs(from.x - to.x) >= PANEL_DRAG_THRESHOLD_PX ||
    Math.abs(from.y - to.y) >= PANEL_DRAG_THRESHOLD_PX
  );
}
