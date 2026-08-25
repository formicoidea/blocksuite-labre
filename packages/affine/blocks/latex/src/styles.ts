import { unsafeCSSVar, unsafeCSSVarV2 } from '@labre/affine-shared/theme';
import { css } from 'lit';

export const latexBlockStyles = css`
  .latex-block-container {
    display: flex;
    position: relative;
    width: 100%;
    height: 100%;
    padding: 10px 24px;
    flex-direction: column;
    /**
     * The rendered formula must span the container so a wide equation can be
     * scrolled through (overflow-x below); centring shrank it to its content
     * and pushed the overflow out of reach.
     */
    align-items: stretch;
    justify-content: center;
    border-radius: 4px;
    overflow-x: auto;
    user-select: none;
  }

  .latex-block-container:hover {
    background: ${unsafeCSSVar('hoverColor')};
  }

  .latex-block-error-placeholder {
    color: ${unsafeCSSVarV2('text/highlight/fg/red')};
    font-family: Inter;
    font-size: 12px;
    font-weight: 500;
    line-height: normal;
    user-select: none;
  }

  .latex-block-empty-placeholder {
    color: ${unsafeCSSVarV2('text/secondary')};
    font-family: Inter;
    font-size: 12px;
    font-weight: 500;
    line-height: normal;
    user-select: none;
  }
`;
