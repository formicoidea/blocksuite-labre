import { css } from '@emotion/css';
import { cssVarV2 } from '@toeverything/theme/v2';

import { ROW_COLOR_PROPERTY } from '../../../core/view/color-rules.js';

/**
 * The view element itself never scrolls: the inner wrapper does.
 *
 * Upstream disabled horizontal scrolling of the mobile table altogether "to
 * prevent crashes on iOS Safari" (AFFiNE#12203, blocksuite#8784), which left
 * every column past the first unreachable on a phone. The scroll now lives on
 * ONE inner element, contained (`overscroll-behavior`) so it never chains into
 * the page; the host stays clipped as before.
 * ponytail: unverified on a real iOS Safari here; if the crash comes back, the
 * fallback is a paged column switcher, not `hidden` again.
 */
export const mobileTableViewHost = css({
  position: 'relative',
  width: '100%',
  overflowX: 'hidden',
  overflowY: 'hidden',
});

export const mobileTableViewWrapper = css({
  position: 'relative',
  width: '100%',
  paddingBottom: '4px',
  overflowX: 'auto',
  overflowY: 'hidden',
  overscrollBehaviorX: 'contain',
});

/**
 * The title column stays in view while the others scroll under it: opaque,
 * with the row's colour painted over the page colour.
 */
export const mobileStickyTitle = css({
  position: 'sticky',
  left: 0,
  zIndex: 1,
  backgroundColor: 'var(--affine-background-primary-color)',
  backgroundImage: `linear-gradient(var(${ROW_COLOR_PROPERTY}, transparent), var(${ROW_COLOR_PROPERTY}, transparent))`,
});

export const mobileTableViewContainer = css({
  position: 'relative',
  width: 'fit-content',
  minWidth: '100%',
});

export const mobileCellDivider = css({
  width: '1px',
  height: '100%',
  backgroundColor: cssVarV2.layer.insideBorder.border,
});
