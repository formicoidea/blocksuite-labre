import { effects as colorPickerEffects } from '@labre/affine-components/color-picker';
import {
  effects as menuEffects,
  type Menu,
} from '@labre/affine-components/context-menu';
import { effects as portalEffects } from '@labre/affine-components/portal';
import type { ChromeWording } from '@labre/affine-shared/services';
import { signal } from '@preact/signals-core';
import { render } from 'lit';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { selectOptionColorGrid } from '../core/component/tags/color-menu.js';
import { selectOptionColors } from '../core/component/tags/colors.js';
import { coreEffects } from '../core/effect.js';
import {
  createStandaloneCell,
  type PropertyMetaConfig,
  type StandaloneCellSource,
} from '../core/index.js';
import { propertyPresetsEffects } from '../property-presets/effect.js';
import { propertyPresets } from '../property-presets/index.js';

/**
 * An option's colour and a colour rule's are picked from the canvas swatch
 * grid (`<edgeless-color-panel>`), fed with the select options' ten chip
 * colours (ADR 0036 amendment of 2026-10-14). The rule's own pick is held in
 * `color-rules.unit.spec.ts`, beside the view it writes to.
 *
 * What it would have caught:
 * - a grid fed with the canvas palette, or in another order, instead of the
 *   options' ten colours;
 * - a pick that writes anything but the `selectOptionColors[i].color` string
 *   the former menu rows wrote (a resolved value, a palette key);
 * - a swatch labelled in English under a French host, or the current colour
 *   not ringed;
 * - a pick that leaves the menu open where the rows closed it.
 */

beforeAll(() => {
  if (!customElements.get('uni-lit')) coreEffects();
  if (!customElements.get('affine-database-text-cell')) {
    propertyPresetsEffects();
  }
  if (!customElements.get('affine-menu')) menuEffects();
  if (!customElements.get('blocksuite-portal')) portalEffects();
  if (!customElements.get('edgeless-color-panel')) colorPickerEffects();
});

afterEach(() => {
  document.body.innerHTML = '';
});

const frame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

const french: Wording = ([key, fallback]) => `fr:${key}:${fallback}`;
type Wording = (wording: ChromeWording) => string;

type Swatch = HTMLElement & {
  color: string;
  label: string | undefined;
  active: boolean;
};

async function swatchesOf(root: ParentNode): Promise<Swatch[]> {
  const panel = root.querySelector<HTMLElement & { updateComplete: unknown }>(
    'edgeless-color-panel'
  );
  expect(panel).not.toBeNull();
  await panel!.updateComplete;
  return [
    ...(panel!.shadowRoot?.querySelectorAll<Swatch>('edgeless-color-button') ??
      []),
  ];
}

describe('the options colour grid', () => {
  it('shows the ten chip colours, named by the host, the current one ringed', async () => {
    const select = vi.fn();
    const menu = { options: { onComplete: vi.fn() }, close: vi.fn() };
    const [entry] = selectOptionColorGrid({
      current: selectOptionColors[1]!.color,
      say: french,
      select,
    });
    const container = document.createElement('div');
    document.body.append(container);
    render(entry!(menu as unknown as Menu, 0), container);

    const swatches = await swatchesOf(container);
    expect(swatches.map(swatch => swatch.color)).toEqual(
      selectOptionColors.map(item => item.color)
    );
    expect(swatches.map(swatch => swatch.label)).toEqual(
      selectOptionColors.map(item => french(item.wording as ChromeWording))
    );
    expect(swatches.map(swatch => swatch.active)).toEqual(
      selectOptionColors.map((_, index) => index === 1)
    );

    swatches[3]!.click();
    expect(select).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledWith(selectOptionColors[3]!.color);
    expect(menu.options.onComplete).toHaveBeenCalledTimes(1);
    expect(menu.close).toHaveBeenCalledTimes(1);
  });

  it('an option menu writes the chip colour string the rows wrote', async () => {
    const options = [
      { id: 'a', value: 'Alpha', color: selectOptionColors[0]!.color },
    ];
    const dataSet = vi.fn();
    const source = {
      propertyId: 'p',
      name$: signal('Prop'),
      data$: signal({ options }),
      value$: signal<unknown>(['a']),
      readonly$: signal(false),
      valueSet: vi.fn(),
      dataSet,
    } as unknown as StandaloneCellSource;
    const host = document.createElement('dv-standalone-cell');
    host.cell = createStandaloneCell(
      propertyPresets.multiSelectPropertyConfig as unknown as PropertyMetaConfig,
      source
    );
    document.body.append(host);
    await host.updateComplete;
    host.edit();
    await frame();

    const more = document.querySelector<HTMLElement>(
      'affine-multi-tag-select [data-testid="option-more"]'
    );
    expect(more).not.toBeNull();
    more!.click();
    await frame();

    const swatches = await swatchesOf(document.body);
    expect(swatches.map(swatch => swatch.active)).toEqual(
      selectOptionColors.map((_, index) => index === 0)
    );
    swatches[6]!.click();

    expect(dataSet).toHaveBeenCalled();
    const written = dataSet.mock.calls.at(-1)?.[0] as {
      options: { id: string; color: string }[];
    };
    expect(written.options).toEqual([
      { id: 'a', value: 'Alpha', color: selectOptionColors[6]!.color },
    ]);
    expect(document.querySelector('edgeless-color-panel')).toBeNull();
  });
});
