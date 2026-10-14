import { menu, type MenuConfig } from '@labre/affine-components/context-menu';
import type { ChromeWording } from '@labre/affine-shared/services';
import { html } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';

import { selectOptionColors } from './colors.js';

/**
 * The select options' colour picker as menu entries: a swatch, the colour's
 * name, a tick on the current one. One copy, read by an option's menu
 * (`multi-tag-select.ts`) and by a colour rule's (ADR 0036), so both pick
 * from the same palette with the same words.
 */
export function selectOptionColorActions(options: {
  current: string | undefined;
  say: (wording: ChromeWording) => string;
  select: (color: string) => void;
}): MenuConfig[] {
  return selectOptionColors.map(item => {
    const swatch = styleMap({
      backgroundColor: item.color,
      borderRadius: '50%',
      width: '20px',
      height: '20px',
    });
    return menu.action({
      name: item.wording ? options.say(item.wording) : item.name,
      prefix: html` <div style=${swatch}></div>`,
      isSelected: options.current === item.color,
      select: () => {
        options.select(item.color);
      },
    });
  });
}
