import { unsafeCSSVarV2 } from '@labre/affine-shared/theme';
import { css } from 'lit';

/**
 * Layout shared by both panels: a search header, a scrollable grid of groups
 * and — for the emoji panel — a group navigation footer.
 */
export const panelStyles = css`
  .picker-panel {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
    font-family: var(--affine-font-family);
    color: ${unsafeCSSVarV2('text/primary')};
  }

  .picker-search {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    flex: none;
  }

  .picker-search-input {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    height: 32px;
    padding: 0 10px;
    border-radius: 4px;
    border: 1px solid ${unsafeCSSVarV2('layer/insideBorder/border')};
    background: ${unsafeCSSVarV2('layer/background/primary')};
  }

  .picker-search-input svg {
    flex: none;
    font-size: 16px;
    color: ${unsafeCSSVarV2('icon/primary')};
  }

  .picker-search-input input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    font-size: var(--affine-font-sm);
    font-family: inherit;
    color: inherit;
  }

  .picker-trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 32px;
    height: 32px;
    padding: 0;
    border-radius: 4px;
    border: 1px solid ${unsafeCSSVarV2('layer/insideBorder/border')};
    background: transparent;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
  }

  .picker-popup {
    display: flex;
    gap: 2px;
    padding: 4px;
    border-radius: 4px;
    border: 1px solid ${unsafeCSSVarV2('layer/insideBorder/border')};
    background: ${unsafeCSSVarV2('layer/background/overlayPanel')};
    box-shadow: var(--affine-shadow-2);
  }

  .picker-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0 12px 8px;
  }

  .picker-group-name {
    position: sticky;
    top: 0;
    z-index: 1;
    padding: 6px 0 4px;
    font-size: var(--affine-font-xs);
    font-weight: 500;
    color: ${unsafeCSSVarV2('text/secondary')};
    background: ${unsafeCSSVarV2('layer/background/overlayPanel')};
  }

  .picker-group-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(32px, 1fr));
    gap: 2px;
  }

  .picker-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 4px;
    border: none;
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
    font-size: 20px;
    line-height: 1;
  }

  .picker-cell svg {
    width: 24px;
    height: 24px;
  }

  .picker-cell:hover,
  .picker-trigger:hover {
    background: ${unsafeCSSVarV2('layer/background/hoverOverlay')};
  }

  .picker-empty {
    padding: 24px 0;
    text-align: center;
    font-size: var(--affine-font-sm);
    color: ${unsafeCSSVarV2('text/secondary')};
  }

  .picker-footer {
    display: flex;
    align-items: center;
    gap: 2px;
    flex: none;
    padding: 4px 12px 8px;
    border-top: 1px solid ${unsafeCSSVarV2('layer/insideBorder/border')};
  }

  .picker-footer button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    opacity: 0.6;
  }

  .picker-footer button[data-active='true'],
  .picker-footer button:hover {
    opacity: 1;
    background: ${unsafeCSSVarV2('layer/background/hoverOverlay')};
  }
`;
