import { css } from '@emotion/css';
import { cssVarV2 } from '@toeverything/theme/v2';

export const databaseBlockStyles = css({
  display: 'block',
  borderRadius: '8px',
  backgroundColor: 'var(--affine-background-primary-color)',
  padding: '8px',
  margin: '8px -8px -8px',
  // Drawn as the page (`isStandaloneDatabase`): the view bar sits under the
  // page heading, without the inline block's top margin and padding.
  '&[data-standalone]': {
    marginTop: 0,
    paddingTop: 0,
  },
});

export const databaseBlockSelectedStyles = css({
  backgroundColor: 'var(--affine-hover-color)',
  borderRadius: '4px',
});

export const databaseOpsStyles = css({
  padding: '2px',
  borderRadius: '4px',
  display: 'flex',
  cursor: 'pointer',
  alignItems: 'center',
  height: 'max-content',
  fontSize: '16px',
  color: cssVarV2.icon.primary,
  ':hover': {
    backgroundColor: 'var(--affine-hover-color)',
  },

  '@media print': {
    display: 'none',
  },
});

export const databaseHeaderBarStyles = css({
  '@media print': {
    display: 'none !important',
  },
});

export const databaseTitleStyles = css({
  overflow: 'hidden',
});

export const databaseHeaderContainerStyles = css({
  marginBottom: '16px',
  display: 'flex',
  flexDirection: 'column',
  // Drawn as the page, which scrolls sideways under a wide table: the view
  // bar stays in view, a viewport wide.
  'affine-database[data-standalone] &': {
    position: 'sticky',
    left: 'var(--affine-editor-side-padding, 24px)',
    width: 'calc(100cqw - 2 * var(--affine-editor-side-padding, 24px))',
  },
});

export const databaseTitleRowStyles = css({
  display: 'flex',
  gap: '12px',
  marginBottom: '8px',
  alignItems: 'center',
  // Drawn as the page, the page heading above is the database's name.
  'affine-database[data-standalone] &': {
    display: 'none',
  },
});

// Too narrow for the tabs and the tools side by side (a phone, P7), the tools
// drop to a line of their own, on the right, instead of squeezing the
// current view's tab to its icon.
export const databaseToolbarRowStyles = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  '& data-view-header-tools': {
    marginLeft: 'auto',
  },
});

export const databaseViewBarContainerStyles = css({
  flex: '1 1 200px',
  minWidth: 0,
});

export const databaseContentStyles = css({
  position: 'relative',
  backgroundColor: 'var(--affine-background-primary-color)',
  borderRadius: '4px',
});

export const databaseSourceMissingStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  margin: '8px 0',
  padding: '12px',
  borderRadius: '8px',
  fontSize: '14px',
  lineHeight: '22px',
  color: 'var(--affine-text-primary-color)',
  backgroundColor: 'var(--affine-hover-color)',
});

export const databaseSourceMissingHintStyles = css({
  color: 'var(--affine-text-secondary-color)',
});
