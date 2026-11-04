import { css } from 'lit';

export const EMBED_HTML_MIN_WIDTH = 370;
export const EMBED_HTML_MIN_HEIGHT = 80;
export const EMBED_HTML_CARD_HEIGHT = 72;

export const styles = css`
  .affine-embed-html-retired {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 12px;
    border-radius: 8px;
    border: 1px solid var(--affine-border-color);
    background: var(--affine-background-secondary-color);
    color: var(--affine-text-secondary-color);
    font-family: var(--affine-font-family);
    user-select: none;
    overflow: hidden;
  }

  .affine-embed-html-retired-icon {
    display: flex;
    flex-shrink: 0;
  }

  .affine-embed-html-retired-text {
    flex: 1;
    min-width: 0;
  }

  .affine-embed-html-retired-title {
    color: var(--affine-text-primary-color);
    font-size: var(--affine-font-sm);
    font-weight: 600;
    line-height: 22px;
  }

  .affine-embed-html-retired-description {
    font-size: var(--affine-font-xs);
    line-height: 20px;
  }
`;
