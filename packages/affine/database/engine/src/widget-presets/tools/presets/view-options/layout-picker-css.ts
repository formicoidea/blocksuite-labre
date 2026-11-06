import { css } from '@emotion/css';

/**
 * The layout picker (Table, Gallery, List, Kanban) is a row of equal tiles
 * in a menu that portals to the body, so its rules are global classes.
 *
 * On a phone the row did not fit the sheet: four tiles that never wrap and
 * never shrink, each its label's width plus 32px of padding, pushed past the
 * 390px sheet (labre recette P7-21, "Bases lisibles sur téléphone"). Narrow,
 * the tiles wrap two by two and may shrink, their label cut with an ellipsis
 * as a last resort; wide, the row is the single row it always was.
 *
 * The phone sheet, unlike the popover, does not set `border-box` for what it
 * holds: in a host without a global reset a tile's `width: 100%` plus its
 * padding ran 8px past its column, so the row sets it for its own tree.
 */
const NARROW = '@media (max-width: 480px)';

export const layoutPickerRowStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  '&, & *': {
    boxSizing: 'border-box',
  },
  rowGap: '4px',
  [NARROW]: {
    gap: '8px',
  },
});

export const layoutPickerItemStyle = css({
  flex: '1 1 0',
  [NARROW]: {
    flex: '1 1 calc(50% - 4px)',
    minWidth: 0,
  },
});

export const layoutPickerTileStyle = css({
  color: 'var(--affine-text-emphasis-color)',
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '6px 16px',
  whiteSpace: 'nowrap',
  [NARROW]: {
    padding: '6px 8px',
  },
  '@media (pointer: coarse)': {
    minHeight: '44px',
  },
});

export const layoutPickerLabelStyle = css({
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});
