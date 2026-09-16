import {
  SLASH_MENU_COPY_DUPLICATE_CAPTION,
  SLASH_MENU_DELETE,
  SLASH_MENU_MOVE_DOWN,
  SLASH_MENU_MOVE_UP,
  SLASH_MENU_NOW,
  SLASH_MENU_TODAY,
  SLASH_MENU_TOMORROW,
  SLASH_MENU_YESTERDAY,
} from '../translations';
import type { SlashMenuTooltip } from '../types';
import { CopyTooltip } from './copy';
import { DeleteTooltip } from './delete';
import { MoveDownTooltip } from './move-down';
import { MoveUpTooltip } from './move-up';
import { NowTooltip } from './now';
import { TodayTooltip } from './today';
import { TomorrowTooltip } from './tomorrow';
import { YesterdayTooltip } from './yesterday';

export const slashMenuToolTips: Record<string, SlashMenuTooltip> = {
  Today: {
    figure: TodayTooltip,
    caption: 'Today',
    captionWording: SLASH_MENU_TODAY,
  },

  Tomorrow: {
    figure: TomorrowTooltip,
    caption: 'Tomorrow',
    captionWording: SLASH_MENU_TOMORROW,
  },

  Yesterday: {
    figure: YesterdayTooltip,
    caption: 'Yesterday',
    captionWording: SLASH_MENU_YESTERDAY,
  },

  Now: {
    figure: NowTooltip,
    caption: 'Now',
    captionWording: SLASH_MENU_NOW,
  },

  'Move Up': {
    figure: MoveUpTooltip,
    caption: 'Move Up',
    captionWording: SLASH_MENU_MOVE_UP,
  },

  'Move Down': {
    figure: MoveDownTooltip,
    caption: 'Move Down',
    captionWording: SLASH_MENU_MOVE_DOWN,
  },

  Copy: {
    figure: CopyTooltip,
    caption: 'Copy / Duplicate',
    captionWording: SLASH_MENU_COPY_DUPLICATE_CAPTION,
  },

  Delete: {
    figure: DeleteTooltip,
    caption: 'Delete',
    captionWording: SLASH_MENU_DELETE,
  },
};
