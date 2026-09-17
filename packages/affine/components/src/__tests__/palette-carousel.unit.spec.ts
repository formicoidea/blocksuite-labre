/**
 * The `‹ Label ›` header of `docs/adr/0027`, on the real component: it opens on
 * the page the caller asked for, it wraps around in both directions, and with
 * a single page it is not drawn at all — which is the whole of the "no
 * regression for every other call site" promise.
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

const name = (element: EdgelessColorPickerButton) =>
  element.shadowRoot?.querySelector('.palette-carousel-name')?.textContent;

const nav = (element: EdgelessColorPickerButton, label: string) =>
  element.shadowRoot?.querySelector<HTMLButtonElement>(
    `.palette-carousel-nav[aria-label="${label}"]`
  );

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

  test('next and previous wrap around', async () => {
    const element = await mount({
      paletteGroups: GROUPS,
      activeGroupKey: 'default',
    });

    nav(element, 'Next palette')?.click();
    await element.updateComplete;
    expect(name(element)).toBe('Wardley map');

    nav(element, 'Next palette')?.click();
    await element.updateComplete;
    expect(name(element)).toBe('EDGY');

    // Past the last one, back to the first.
    nav(element, 'Next palette')?.click();
    await element.updateComplete;
    expect(name(element)).toBe('Default');

    // …and the other way round, from the first to the last.
    nav(element, 'Previous palette')?.click();
    await element.updateComplete;
    expect(name(element)).toBe('EDGY');
    expect(element.activePalettes).toEqual(GROUPS[2].palettes);
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

    nav(element, 'Next palette')?.click();
    await element.updateComplete;
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
