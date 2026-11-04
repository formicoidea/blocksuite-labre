import { HEADING_LEVELS, HEADING_SCALE } from '@labre/affine-shared/consts';
import { unsafeCSSVarV2 } from '@labre/affine-shared/theme';
import { css, unsafeCSS } from 'lit';

/** Inline code is set this much smaller than the text around it. */
const INLINE_CODE_SHRINK_PX = 3;

/**
 * H1…H6, generated from `HEADING_SCALE` so every size, line box and margin has
 * one source. Inline code in a heading stays `INLINE_CODE_SHRINK_PX` below the
 * heading's size; H6, the level closest to body text, keeps the body's code
 * padding (with its 2px bottom).
 */
const headingStyles = unsafeCSS(
  HEADING_LEVELS.map(level => {
    const { fontSize, fontWeight, letterSpacing, lineHeightExtra, marginTop } =
      HEADING_SCALE[level];
    return `
  .${level} {
    font-size: ${fontSize}px;
    font-weight: ${fontWeight};
    letter-spacing: ${letterSpacing}em;
    line-height: calc(1em + ${lineHeightExtra}px);
    margin-top: ${marginTop}px;
    margin-bottom: 10px;
  }

  .${level} code {
    font-size: ${fontSize - INLINE_CODE_SHRINK_PX}px;
    padding: ${level === 'h6' ? '0px 4px 2px' : '0px 4px'};
  }
`;
  }).join('')
);

/** Set by a collapsed heading on the block views it folds. */
export const COLLAPSED_SIBLING_ATTR = 'data-collapsed-sibling';

export const paragraphBlockStyles = css`
  [${unsafeCSS(COLLAPSED_SIBLING_ATTR)}] {
    display: none !important;
  }

  affine-paragraph {
    box-sizing: border-box;
    display: block;
    font-size: var(--affine-font-base);
  }

  .affine-paragraph-block-container {
    position: relative;
    border-radius: 4px;
  }
  .affine-paragraph-rich-text-wrapper {
    position: relative;
  }

  .affine-paragraph-block-container.highlight-comment {
    background-color: ${unsafeCSSVarV2('block/comment/highlightActive')};
    outline: 2px solid ${unsafeCSSVarV2('block/comment/highlightUnderline')};
  }

  affine-paragraph code {
    font-size: calc(var(--affine-font-base) - ${INLINE_CODE_SHRINK_PX}px);
    padding: 0px 4px 2px;
  }

  ${headingStyles}

  .quote {
    line-height: 26px;
    padding-left: 17px;
    margin-top: var(--affine-paragraph-space);
    padding-top: 10px;
    padding-bottom: 10px;
    position: relative;
  }
  .quote::after {
    content: '';
    width: 2px;
    height: calc(100% - 20px);
    margin-top: 10px;
    margin-bottom: 10px;
    position: absolute;
    left: 0;
    top: 0;
    background: var(--affine-quote-color);
    border-radius: 18px;
  }

  .affine-paragraph-placeholder {
    position: absolute;
    display: none;
    max-width: 100%;
    overflow-x: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    left: 0;
    bottom: 0;
    pointer-events: none;
    color: var(--affine-black-30);
    fill: var(--affine-black-30);
  }
  @media print {
    .affine-paragraph-placeholder {
      display: none !important;
    }
  }
  .affine-paragraph-placeholder.visible {
    display: block;
  }
  @media print {
    .affine-paragraph-placeholder.visible {
      display: none;
    }
  }
`;
