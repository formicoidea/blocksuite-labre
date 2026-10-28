import {
  type ChromeWording,
  PALETTE_NAME_BLUE,
  PALETTE_NAME_GREEN,
  PALETTE_NAME_GREY,
  PALETTE_NAME_MAGENTA,
  PALETTE_NAME_ORANGE,
  PALETTE_NAME_PURPLE,
  PALETTE_NAME_RED,
  PALETTE_NAME_WHITE,
  PALETTE_NAME_YELLOW,
} from '@labre/affine-shared/services';
import { cssVarV2 } from '@toeverything/theme/v2';

import { TAG_COLOR_TEAL } from '../../../translations.js';

export type SelectOptionColor = {
  oldColor: string;
  color: string;
  /** The English name, `wording`'s fallback. */
  name: string;
  /**
   * What the option menu shows, resolved where an editor is at hand;
   * absent (a colour list a host built in 0.48), `name` is shown.
   */
  wording?: ChromeWording;
};
export const selectOptionColors: SelectOptionColor[] = [
  {
    oldColor: 'var(--affine-tag-red)',
    color: cssVarV2('chip/label/red'),
    name: PALETTE_NAME_RED[1],
    wording: PALETTE_NAME_RED,
  },
  {
    oldColor: 'var(--affine-tag-pink)',
    color: cssVarV2('chip/label/magenta'),
    name: PALETTE_NAME_MAGENTA[1],
    wording: PALETTE_NAME_MAGENTA,
  },
  {
    oldColor: 'var(--affine-tag-orange)',
    color: cssVarV2('chip/label/orange'),
    name: PALETTE_NAME_ORANGE[1],
    wording: PALETTE_NAME_ORANGE,
  },
  {
    oldColor: 'var(--affine-tag-yellow)',
    color: cssVarV2('chip/label/yellow'),
    name: PALETTE_NAME_YELLOW[1],
    wording: PALETTE_NAME_YELLOW,
  },
  {
    oldColor: 'var(--affine-tag-green)',
    color: cssVarV2('chip/label/green'),
    name: PALETTE_NAME_GREEN[1],
    wording: PALETTE_NAME_GREEN,
  },
  {
    oldColor: 'var(--affine-tag-teal)',
    color: cssVarV2('chip/label/teal'),
    name: TAG_COLOR_TEAL[1],
    wording: TAG_COLOR_TEAL,
  },
  {
    oldColor: 'var(--affine-tag-blue)',
    color: cssVarV2('chip/label/blue'),
    name: PALETTE_NAME_BLUE[1],
    wording: PALETTE_NAME_BLUE,
  },
  {
    oldColor: 'var(--affine-tag-purple)',
    color: cssVarV2('chip/label/purple'),
    name: PALETTE_NAME_PURPLE[1],
    wording: PALETTE_NAME_PURPLE,
  },
  {
    oldColor: 'var(--affine-tag-gray)',
    color: cssVarV2('chip/label/grey'),
    name: PALETTE_NAME_GREY[1],
    wording: PALETTE_NAME_GREY,
  },
  {
    oldColor: 'var(--affine-tag-white)',
    color: cssVarV2('chip/label/white'),
    name: PALETTE_NAME_WHITE[1],
    wording: PALETTE_NAME_WHITE,
  },
];

const oldColorMap = Object.fromEntries(
  selectOptionColors.map(tag => [tag.oldColor, tag.color])
);

export const getColorByColor = (color: string) => {
  if (color.startsWith('--affine-tag')) {
    return oldColorMap[color] ?? color;
  }
  return color;
};

/** select tag color poll */
const selectTagColorPoll = selectOptionColors.map(color => color.color);

function tagColorHelper() {
  let colors = [...selectTagColorPoll];
  return (): string => {
    if (colors.length === 0) {
      colors = [...selectTagColorPoll];
    }
    const index = Math.floor(Math.random() * colors.length);
    const color = colors.splice(index, 1)[0];
    if (!color) return '';
    return color;
  };
}

export const getTagColor = tagColorHelper();
