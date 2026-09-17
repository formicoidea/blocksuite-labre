/**
 * The palette header of `docs/adr/0027`, on the real component: it opens on
 * the page the caller asked for, the drop-down jumps straight to a page, a
 * wheel still pages with wrap-around, and with a single page it is not drawn
 * at all — which is the whole of the "no regression for every other call site"
 * promise.
 */
import { ColorScheme, type Palette } from '@labre/affine-model';
import { beforeAll, describe, expect, test } from 'vitest';

import type { EdgelessColorPickerButton } from '../color-picker/button.js';
import type { PaletteGroup } from '../color-picker/framework-palette.js';
import { effects } from '../color-picker/index.js';

beforeAll(() => {
  effects();
});

const swatch = (key: string): Palette => ({ key, value: '#123456' });

const GROUPS: PaletteGroup[] = [
  { key: 'default', label: 'Default', palettes: [swatch('Blue')] },
  { key: 'wardley', label: 'Wardley map', palettes: [swatch('Wonder')] },
  { key: 'edgy', label: 'EDGY', palettes: [swatch('Identity')] },
];

async function mount(
  props: Partial<
    Pick<
      EdgelessColorPickerButton,
      'paletteGroups' | 'activeGroupKey' | 'palettes'
    >
  >
): Promise<EdgelessColorPickerButton> {
  const element = Object.assign(
    document.createElement('edgeless-color-picker-button'),
    {
      color: '#123456',
      label: 'Color',
      theme: ColorScheme.Light,
      enableCustomColor: false,
      pick: () => {},
      ...props,
    }
  );
  document.body.append(element);
  await element.updateComplete;
  return element;
}

const box = (element: EdgelessColorPickerButton) =>
  element.shadowRoot?.querySelector<HTMLSelectElement>(
    '.palette-carousel-name'
  ) ?? null;

/**
 * The selected option, found by its own flag: happy-dom keeps `selectedOptions`
 * stale and never moves `selectedIndex` off `-1` for options appended by lit.
 */
const name = (element: EdgelessColorPickerButton) =>
  Array.from(box(element)?.options ?? [])
    .find(item => item.selected)
    ?.textContent?.trim();

/** Pick a page from the drop-down the way the browser reports a choice. */
const choose = async (element: EdgelessColorPickerButton, label: string) => {
  const select = box(element);
  expect(select).not.toBeNull();
  const option = Array.from(select!.options).find(
    item => item.textContent?.trim() === label
  );
  expect(option).toBeDefined();
  select!.value = option!.value;
  select!.dispatchEvent(new Event('change', { bubbles: true }));
  await element.updateComplete;
};

/** Longer than the header's own wheel throttle, so each flick is its own. */
const settleWheel = () => new Promise(resolve => setTimeout(resolve, 250));

const wheel = async (element: EdgelessColorPickerButton, deltaY: number) => {
  const header = element.shadowRoot?.querySelector('.palette-carousel');
  expect(header).not.toBeNull();
  header!.dispatchEvent(
    new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true })
  );
  await element.updateComplete;
  await settleWheel();
};

describe('the palette carousel', () => {
  test('opens on the group the caller asked for', async () => {
    const element = await mount({
      paletteGroups: GROUPS,
      activeGroupKey: 'wardley',
    });
    expect(name(element)).toBe('Wardley map');
    expect(element.activePalettes).toEqual(GROUPS[1].palettes);
  });

  test('an unknown (or absent) key opens on the base palette, page one', async () => {
    const element = await mount({
      paletteGroups: GROUPS,
      activeGroupKey: 'bpmn',
    });
    expect(name(element)).toBe('Default');
  });

  test('the drop-down lists every page and jumps straight to one', async () => {
    const element = await mount({
      paletteGroups: GROUPS,
      activeGroupKey: 'default',
    });

    expect(
      Array.from(box(element)!.options).map(item => item.textContent?.trim())
    ).toEqual(['Default', 'Wardley map', 'EDGY']);

    // Two pages away in one gesture — the whole point of the drop-down.
    await choose(element, 'EDGY');
    expect(name(element)).toBe('EDGY');
    expect(element.activePalettes).toEqual(GROUPS[2].palettes);
  });

  test('a wheel over the header pages, wrapping both ways', async () => {
    const element = await mount({
      paletteGroups: GROUPS,
      activeGroupKey: 'default',
    });

    await wheel(element, 1);
    expect(name(element)).toBe('Wardley map');

    await wheel(element, 1);
    expect(name(element)).toBe('EDGY');

    // Past the last one, back to the first.
    await wheel(element, 1);
    expect(name(element)).toBe('Default');

    // …and the other way round, from the first to the last.
    await wheel(element, -1);
    expect(name(element)).toBe('EDGY');
    expect(element.activePalettes).toEqual(GROUPS[2].palettes);
  });

  test('a trackpad burst moves one page, not the whole ring', async () => {
    const element = await mount({
      paletteGroups: GROUPS,
      activeGroupKey: 'default',
    });

    const header = element.shadowRoot!.querySelector('.palette-carousel')!;
    for (let i = 0; i < 6; i++) {
      header.dispatchEvent(
        new WheelEvent('wheel', { deltaY: 8, bubbles: true, cancelable: true })
      );
    }
    await element.updateComplete;
    expect(name(element)).toBe('Wardley map');
  });

  test('a ctrl+wheel is the pinch gesture, and the header keeps its hands off', async () => {
    const element = await mount({
      paletteGroups: GROUPS,
      activeGroupKey: 'default',
    });

    const event = new WheelEvent('wheel', {
      deltaY: 8,
      bubbles: true,
      cancelable: true,
    });
    // happy-dom drops the modifier keys of a `WheelEventInit`.
    Object.defineProperty(event, 'ctrlKey', { value: true });
    element
      .shadowRoot!.querySelector('.palette-carousel')!
      .dispatchEvent(event);
    await element.updateComplete;

    expect(name(element)).toBe('Default');
    expect(event.defaultPrevented).toBe(false);
  });

  test("a single group is no carousel: the caller's own `palettes` still wins", async () => {
    // What a Wardley node's picker gets when the Wardley flag is off: its
    // node toolbar is always-on, its palette is not, so no framework page is
    // offered — and the notation swatches the toolbar seeded must stay.
    const seeded = [swatch('Wonder')];
    const element = await mount({
      paletteGroups: [GROUPS[0]],
      palettes: seeded,
    });
    expect(element.shadowRoot?.querySelector('.palette-carousel')).toBeNull();
    expect(element.activePalettes).toBe(seeded);
  });

  test('a new selection re-opens on ITS framework, forgetting the page paged to', async () => {
    const element = await mount({
      paletteGroups: GROUPS,
      activeGroupKey: 'wardley',
    });

    await choose(element, 'EDGY');
    expect(name(element)).toBe('EDGY');

    // The toolbar now serves another element, on no board at all.
    element.activeGroupKey = 'default';
    await element.updateComplete;
    expect(name(element)).toBe('Default');
  });

  test('no groups at all: the flat `palettes` prop still drives the panel', async () => {
    const element = await mount({});
    expect(element.shadowRoot?.querySelector('.palette-carousel')).toBeNull();
    expect(element.activePalettes).toBe(element.palettes);
  });

  test('"custom" is measured against the union of the pages, not the one on screen', async () => {
    const element = await mount({
      paletteGroups: GROUPS,
      activeGroupKey: 'default',
    });
    // `#123456` is the value of every swatch above, EDGY's included, so the
    // colour is never "custom" whichever page happens to be showing.
    expect(element.isCustomColor).toBe(false);
  });
});
