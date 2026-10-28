import { css } from '@emotion/css';

// A cell whose value is on its way: a spinner centred in the cell, the
// height of a drawn one, never a skeleton (recette 3; the host's rule,
// ADR-0057 on the Labre side).
export const cellLoadingStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  minHeight: '32px',
  fontSize: '16px',
});

export const cellEmptyStyle = css({
  display: 'block',
  minHeight: '32px',
});
