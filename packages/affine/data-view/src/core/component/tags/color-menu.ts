import type { NamedPalette } from '@labre/affine-components/color-picker';
import type { MenuConfig } from '@labre/affine-components/context-menu';
import { ColorScheme } from '@labre/affine-model';
import type { ChromeWording } from '@labre/affine-shared/services';
import type { ColorEvent } from '@labre/affine-shared/utils';
import { html } from 'lit';

import { selectOptionColors } from './colors.js';

/**
 * The select options' palette as the canvas swatch grid's palettes. A
 * swatch's value is the option colour string itself, so a pick writes what
 * the former menu rows wrote (ADR 0036 amendment of 2026-10-14). The grid
 * gets no `std` (a popup renders outside the editor), so it shows a label
 * wording's fallback: the name is resolved here and handed over as that
 * fallback.
 */
export function selectOptionColorPalettes(
  say: (wording: ChromeWording) => string
): NamedPalette[] {
  return selectOptionColors.map(item => ({
    key: item.color,
    value: item.color,
    labelWording: [
      item.wording?.[0] ?? item.name,
      item.wording ? say(item.wording) : item.name,
    ],
  }));
}

/**
 * The select options' colour picker as one menu entry: the canvas swatch
 * grid (`<edgeless-color-panel>`), the current colour ringed. One copy, read
 * by an option's menu (`multi-tag-select.ts`) and by a colour rule's (ADR
 * 0036), so both pick from the same palette with the same words. A pick
 * closes the menu, as the menu rows it replaces did.
 */
export function selectOptionColorGrid(options: {
  current: string | undefined;
  say: (wording: ChromeWording) => string;
  select: (color: string) => void;
}): MenuConfig[] {
  const palettes = selectOptionColorPalettes(options.say);
  return [
    menu => {
      const onSelect = (event: ColorEvent) => {
        event.stopPropagation();
        const color = event.detail.value;
        if (typeof color !== 'string') return;
        options.select(color);
        menu.options.onComplete?.();
        menu.close();
      };
      // The scheme only picks a side of a dark/light pair; an option colour
      // is a CSS variable string, resolved by the page's own theme.
      return html`<div style="padding: 4px;">
        <edgeless-color-panel
          data-testid="dv-color-grid"
          .palettes=${palettes}
          .value=${options.current ?? null}
          .theme=${ColorScheme.Light}
          .columns=${5}
          @select=${onSelect}
        ></edgeless-color-panel>
      </div>`;
    },
  ];
}
