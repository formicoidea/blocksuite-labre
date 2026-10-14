import { css } from '@emotion/css';

// The title band's loading chip, in a cell (`labre-title-band-skeleton`):
// same hover tone, same radius, no motion to honour or disable.
export const cellSkeletonStyle = css({
  display: 'block',
  width: '60%',
  maxWidth: '120px',
  height: '16px',
  margin: '8px',
  borderRadius: '6px',
  backgroundColor: 'var(--affine-hover-color)',
});

export const cellEmptyStyle = css({
  display: 'block',
  minHeight: '32px',
});
