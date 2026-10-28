import {
  effects as colorPickerEffects,
  type FrameworkPalette,
} from '@labre/affine-components/color-picker';
import {
  effects as menuEffects,
  type Menu,
} from '@labre/affine-components/context-menu';
import { effects as portalEffects } from '@labre/affine-components/portal';
import { PALETTE_GROUP_DEFAULT } from '@labre/affine-components/translations';
import {
  type ChromeWording,
  PALETTE_NAME_BLACK,
} from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { signal } from '@preact/signals-core';
import { render } from 'lit';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  selectOptionColorGrid,
  selectOptionColorPages,
} from '../core/component/tags/color-menu.js';
import { selectOptionColors } from '../core/component/tags/colors.js';
import { softenedChipColor } from '../core/component/tags/softened-colors.js';
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
 * - a pick that leaves the menu open where the rows closed it;
 * - the kanban group header's option menu keeping rows of its own, with
 *   English names, or opening on a read-only view.
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

describe('the kanban group header', () => {
  async function header(readonly: boolean) {
    const updateData = vi.fn();
    const options = [
      { id: 'a', value: 'Alpha', color: selectOptionColors[2]!.color },
      { id: 'b', value: 'Bravo', color: selectOptionColors[5]!.color },
    ];
    const element = document.createElement(
      'data-view-group-title-select-view'
    ) as HTMLElement & {
      group: unknown;
      readonly: boolean;
      updateComplete: Promise<unknown>;
    };
    element.group = {
      value: 'a',
      rows: [],
      property: { data$: signal({ options }) },
      manager: { updateData },
    };
    element.readonly = readonly;
    document.body.append(element);
    await element.updateComplete;
    element
      .querySelector<HTMLElement>('.data-view-group-title-select-view')!
      .click();
    await frame();
    return { updateData };
  }

  it("picks an option's colour from the grid, named, writing the chip string", async () => {
    const { updateData } = await header(false);
    const swatches = await swatchesOf(document.body);
    expect(swatches.map(swatch => swatch.label)).toEqual(
      selectOptionColors.map(item => item.name)
    );
    expect(swatches.findIndex(swatch => swatch.active)).toBe(2);
    swatches[7]!.click();
    expect(updateData).toHaveBeenCalledTimes(1);
    expect(updateData.mock.calls[0]?.[0]).toEqual({
      options: [
        { id: 'a', value: 'Alpha', color: selectOptionColors[7]!.color },
        { id: 'b', value: 'Bravo', color: selectOptionColors[5]!.color },
      ],
    });
  });

  it('opens nothing on a read-only view', async () => {
    const { updateData } = await header(true);
    expect(document.querySelector('edgeless-color-panel')).toBeNull();
    expect(updateData).not.toHaveBeenCalled();
  });
});

/**
 * The framework pages (ADR 0036 amendment of 2026-10-14, "framework pages"):
 * with an editor at hand, every framework palette it registered follows the
 * ten chip colours as a page of softened swatches, under the canvas
 * carousel's own header.
 *
 * What it would have caught:
 * - the ten chip colours hidden, moved off page one, or written differently
 *   once pages exist;
 * - a framework page that paints its raw notation colour, keeps a swatch
 *   that cannot be softened (transparent), repeats a value, or names its
 *   swatches in English under a French host;
 * - a grid that opens on page one while the current colour sits on another;
 * - the keyboard losing its place when the page list closes, or the arrows
 *   no longer moving on a framework page.
 */
describe('the framework pages', () => {
  const WARDLEY: FrameworkPalette = {
    framework: 'wardley',
    labelWording: ['com.labre.framework.wardley', 'Wardley'],
    palettes: [
      {
        key: 'Wonder',
        value: '#3ec9f2',
        labelWording: ['com.labre.wardley.palette.wonder', 'Wonder'],
      },
      {
        key: 'Wonder again',
        value: '#3EC9F2',
        labelWording: ['com.labre.wardley.palette.wonder', 'Wonder'],
      },
      { key: 'Transparent', value: 'transparent' },
      { key: 'Black', value: { dark: '#ffffff', light: '#000000' } },
    ],
  };
  const EMPTY: FrameworkPalette = {
    framework: 'bpmn',
    labelWording: ['com.labre.framework.bpmn', 'BPMN'],
    palettes: [{ key: 'Transparent', value: 'transparent' }],
  };
  const EDGY: FrameworkPalette = {
    framework: 'edgy',
    labelWording: ['com.labre.framework.edgy', 'EDGY'],
    palettes: [
      {
        key: 'Identity',
        value: '#00ea4e',
        labelWording: ['com.labre.edgy.palette.identity', 'Identity'],
      },
    ],
  };

  /** What the grid reads off an editor: its palettes and its words. */
  const fakeStd = (...palettes: FrameworkPalette[]) =>
    ({
      provider: {
        getAll: () => new Map(palettes.map(p => [p.framework, p])),
      },
      getOptional: () => null,
    }) as unknown as BlockStdScope;

  async function open(current: string | undefined) {
    const select = vi.fn();
    const menu = { options: { onComplete: vi.fn() }, close: vi.fn() };
    const [entry] = selectOptionColorGrid({
      current,
      say: french,
      select,
      std: fakeStd(EDGY, EMPTY, WARDLEY),
    });
    const container = document.createElement('div');
    document.body.append(container);
    render(entry!(menu as unknown as Menu, 0), container);
    const carousel = container.querySelector<
      HTMLElement & { updateComplete: Promise<unknown> }
    >('dv-color-carousel');
    expect(carousel).not.toBeNull();
    await carousel!.updateComplete;
    return { select, menu, carousel: carousel! };
  }

  const header = (carousel: HTMLElement) =>
    carousel.shadowRoot!.querySelector<HTMLButtonElement>(
      '.palette-carousel-name'
    )!;
  const rows = (carousel: HTMLElement) => [
    ...carousel.shadowRoot!.querySelectorAll<HTMLButtonElement>(
      '.palette-carousel-option'
    ),
  ];

  it('builds page one from the chip colours, then one page per framework that softens to something', () => {
    const pages = selectOptionColorPages(french, fakeStd(EDGY, EMPTY, WARDLEY));
    expect(pages.map(page => page.key)).toEqual(['default', 'wardley', 'edgy']);
    expect(pages[0]!.palettes.map(p => p.value)).toEqual(
      selectOptionColors.map(item => item.color)
    );
    expect(pages[1]!.palettes.map(p => p.value)).toEqual([
      softenedChipColor('#3ec9f2'),
      softenedChipColor('#000000'),
    ]);
    expect(pages[1]!.label).toBe(french(WARDLEY.labelWording));
    expect(selectOptionColorPages(french)).toHaveLength(1);
    expect(selectOptionColorPages(french, fakeStd(EMPTY))).toHaveLength(1);
  });

  it('opens on page one, which picks exactly the chip string', async () => {
    const { select, carousel } = await open(selectOptionColors[2]!.color);
    expect(header(carousel).textContent).toContain(
      french(PALETTE_GROUP_DEFAULT)
    );
    const swatches = await swatchesOf(carousel.shadowRoot!);
    expect(swatches.map(swatch => swatch.color)).toEqual(
      selectOptionColors.map(item => item.color)
    );
    expect(swatches.findIndex(swatch => swatch.active)).toBe(2);
    swatches[8]!.click();
    expect(select).toHaveBeenCalledWith(selectOptionColors[8]!.color);
  });

  it('pages to a framework and picks its softened colour, named by the host', async () => {
    const { select, menu, carousel } = await open(undefined);
    header(carousel).click();
    await carousel.updateComplete;
    expect(rows(carousel).map(row => row.textContent?.trim())).toEqual([
      french(PALETTE_GROUP_DEFAULT),
      french(WARDLEY.labelWording),
      french(EDGY.labelWording),
    ]);
    rows(carousel)[1]!.click();
    await carousel.updateComplete;
    const swatches = await swatchesOf(carousel.shadowRoot!);
    expect(swatches.map(swatch => swatch.label)).toEqual([
      french(['com.labre.wardley.palette.wonder', 'Wonder']),
      french(PALETTE_NAME_BLACK),
    ]);
    swatches[0]!.click();
    expect(select).toHaveBeenCalledWith(softenedChipColor('#3ec9f2'));
    expect(menu.close).toHaveBeenCalledTimes(1);
  });

  it('opens on the page that holds the current colour, ringed', async () => {
    const { carousel } = await open(softenedChipColor('#00ea4e'));
    expect(header(carousel).textContent).toContain(french(EDGY.labelWording));
    const swatches = await swatchesOf(carousel.shadowRoot!);
    expect(swatches.map(swatch => swatch.active)).toEqual([true]);
  });

  it('keeps the keyboard path across pages', async () => {
    const { carousel } = await open(undefined);
    header(carousel).click();
    await carousel.updateComplete;
    // A page picked from the list hands the focus back to the header.
    rows(carousel)[1]!.focus();
    rows(carousel)[1]!.click();
    await carousel.updateComplete;
    expect(carousel.shadowRoot!.activeElement).toBe(header(carousel));
    // Escape closes the list the same way, on the page it was opened on.
    header(carousel).click();
    await carousel.updateComplete;
    rows(carousel)[2]!.focus();
    rows(carousel)[2]!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    await carousel.updateComplete;
    expect(rows(carousel)).toHaveLength(0);
    expect(carousel.shadowRoot!.activeElement).toBe(header(carousel));
    // On the framework page, the grid's own arrows still move.
    const swatches = await swatchesOf(carousel.shadowRoot!);
    expect(swatches).toHaveLength(2);
    swatches[0]!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
    );
    const panel = carousel.shadowRoot!.querySelector('edgeless-color-panel');
    expect(panel?.shadowRoot?.activeElement).toBe(swatches[1]);
  });

  it("the kanban header reads its editor's pages", async () => {
    const element = document.createElement(
      'data-view-group-title-select-view'
    ) as HTMLElement & {
      group: unknown;
      readonly: boolean;
      std: BlockStdScope;
      updateComplete: Promise<unknown>;
    };
    element.group = {
      value: 'a',
      rows: [],
      property: {
        data$: signal({
          options: [{ id: 'a', value: 'Alpha', color: 'x' }],
        }),
      },
      manager: { updateData: vi.fn() },
    };
    element.readonly = false;
    element.std = fakeStd(WARDLEY);
    document.body.append(element);
    await element.updateComplete;
    element
      .querySelector<HTMLElement>('.data-view-group-title-select-view')!
      .click();
    await frame();
    expect(document.querySelector('dv-color-carousel')).not.toBeNull();
  });
});
