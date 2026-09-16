import type { ChromeWording } from '@labre/affine-shared/services';

import {
  BRUSH_TOOLTIP_HIGHLIGHTER,
  BRUSH_TOOLTIP_PEN,
} from '../../../translations.js';
import {
  EdgelessBrushDarkIcon,
  EdgelessBrushLightIcon,
  EdgelessHighlighterDarkIcon,
  EdgelessHighlighterLightIcon,
} from './icons';
import type { Pen } from './types';

export const penIconMap = {
  dark: {
    brush: EdgelessBrushDarkIcon,
    highlighter: EdgelessHighlighterDarkIcon,
  },
  light: {
    brush: EdgelessBrushLightIcon,
    highlighter: EdgelessHighlighterLightIcon,
  },
};

export const penInfoMap: { [k in Pen]: { tip: string; shortcut: string } } = {
  brush: {
    tip: 'Pen',
    shortcut: 'P',
  },
  highlighter: {
    tip: 'Highlighter',
    shortcut: '⇧ P',
  },
};

/** `penInfoMap[pen].tip`'s i18n key/fallback pair — resolved at render. */
export const penTipWording = (pen: Pen): ChromeWording =>
  pen === 'brush' ? BRUSH_TOOLTIP_PEN : BRUSH_TOOLTIP_HIGHLIGHTER;
