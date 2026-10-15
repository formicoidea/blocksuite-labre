import {
  BASE_PALETTE_KEY,
  contributedFrameworkPalettes,
  type FrameworkPalette,
  type NamedPalette,
  type PaletteGroup,
} from '@labre/affine-components/color-picker';
import type { MenuConfig } from '@labre/affine-components/context-menu';
import { PALETTE_GROUP_DEFAULT } from '@labre/affine-components/translations';
import { ColorScheme } from '@labre/affine-model';
import {
  type ChromeWording,
  PALETTE_NAME_WORDINGS,
} from '@labre/affine-shared/services';
import type { ColorEvent } from '@labre/affine-shared/utils';
import type { BlockStdScope } from '@labre/std';
import { html } from 'lit';

import { selectOptionColors } from './colors.js';
import { softenedChipColor } from './softened-colors.js';

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
 * One framework palette as a page of softened chip colours (ADR 0036
 * amendment of 2026-10-14, "framework pages"): each swatch softened from its
 * light value by `softenedChipColor`, named with the framework's own swatch
 * wording (or the default theme's for the shared neutrals), resolved here as
 * the grid gets no `std`. A value that softens to nothing (transparent) and
 * a second swatch softening to the same string are left out.
 */
export function softenedFrameworkPalettes(
  framework: FrameworkPalette,
  say: (wording: ChromeWording) => string
): NamedPalette[] {
  const seen = new Set<string>();
  const page: NamedPalette[] = [];
  for (const palette of framework.palettes) {
    const value = softenedChipColor(palette.value);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    const wording = palette.labelWording ?? PALETTE_NAME_WORDINGS[palette.key];
    page.push({
      key: palette.key,
      value,
      ...(wording ? { labelWording: [wording[0], say(wording)] } : {}),
    });
  }
  return page;
}

/**
 * The pages of the database colour grid: the ten chip colours first, always
 * there, then one page per framework palette this editor registered, in the
 * canvas carousel's order (`contributedFrameworkPalettes`). A palette is
 * registered by its framework's FLAG-GATED view extension, so a framework
 * switched off offers no page: tooling only (ADR 0009), what was picked from
 * it keeps painting. Without `std` (a context outside an editor), the first
 * page alone.
 */
export function selectOptionColorPages(
  say: (wording: ChromeWording) => string,
  std?: BlockStdScope
): PaletteGroup[] {
  const base: PaletteGroup = {
    key: BASE_PALETTE_KEY,
    label: say(PALETTE_GROUP_DEFAULT),
    palettes: selectOptionColorPalettes(say),
  };
  if (!std) return [base];
  const frameworks = contributedFrameworkPalettes(std)
    .map(framework => ({
      key: framework.framework,
      label: say(framework.labelWording),
      palettes: softenedFrameworkPalettes(framework, say),
    }))
    .filter(group => group.palettes.length > 0);
  return [base, ...frameworks];
}

/**
 * The select options' colour picker as one menu entry: the canvas swatch
 * grid (`<edgeless-color-panel>`), the current colour ringed. One copy, read
 * by an option's menu (`multi-tag-select.ts`), by a colour rule's (ADR
 * 0036) and by the kanban group header's, so all pick from the same pages
 * with the same words. A pick closes the menu, as the menu rows it replaces
 * did. With framework pages (`std` given, a framework on), the grid sits
 * under the canvas carousel's header (`<dv-color-carousel>`) and opens on
 * the page that holds the current colour; with the first page alone, the DOM
 * is the single grid it always was.
 */
export function selectOptionColorGrid(options: {
  current: string | undefined;
  say: (wording: ChromeWording) => string;
  select: (color: string) => void;
  std?: BlockStdScope;
}): MenuConfig[] {
  const groups = selectOptionColorPages(options.say, options.std);
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
      if (groups.length > 1) {
        return html`<dv-color-carousel
          .groups=${groups}
          .current=${options.current ?? null}
          .std=${options.std}
          @select=${onSelect}
        ></dv-color-carousel>`;
      }
      // The scheme only picks a side of a dark/light pair; an option colour
      // is a CSS variable string, resolved by the page's own theme.
      return html`<div style="padding: 4px;">
        <edgeless-color-panel
          data-testid="dv-color-grid"
          .palettes=${groups[0]?.palettes ?? []}
          .value=${options.current ?? null}
          .theme=${ColorScheme.Light}
          .columns=${5}
          @select=${onSelect}
        ></edgeless-color-panel>
      </div>`;
    },
  ];
}
