/**
 * The palette header of `docs/adr/0027`, on the real component: it opens on
 * the page the caller asked for, the header's inline list jumps straight to a
 * page, a wheel over the PANEL still pages with wrap-around, and with a single
 * page it is not drawn at all — which is the whole of the "no regression for
 * every other call site" promise.
 *
 * The recette of the pointer itself lives in the integration spec, which is the
 * only place a REAL click exists; happy-dom has no popper and no compositor, so
 * here a `click()` is the honest stand-in — and it is a click, not a default
 * action, which is exactly what the drop-down this replaces could not survive.
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

const header = (element: EdgelessColorPickerButton) =>
  element.shadowRoot?.querySelector<HTMLButtonElement>(
    '.palette-carousel-name'
  ) ?? null;

/** The page on screen: the name the header shows. */
const name = (element: EdgelessColorPickerButton) =>
  header(element)?.querySelector('.label')?.textContent?.trim();

const rows = (element: EdgelessColorPickerButton) =>
  Array.from(
    element.shadowRoot?.querySelectorAll<HTMLButtonElement>(
      '.palette-carousel-option'
    ) ?? []
  );

const grid = (element: EdgelessColorPickerButton) =>
  element.shadowRoot?.querySelector('edgeless-color-panel') ?? null;

/**
 * The box the swatches of ONE page live in. Its `data-direction` is the whole
 * of the motion contract: the stylesheet picks the keyframes off it, and the
 * box is re-keyed on the page index so the animation restarts (and cancels the
 * one in flight) rather than queueing behind it. What the animation LOOKS like
 * is a matter for a browser; that it is aimed the right way is a matter here.
 */
const pageBox = (element: EdgelessColorPickerButton) =>
  element.shadowRoot?.querySelector('.palette-carousel-page') ?? null;

const direction = (element: EdgelessColorPickerButton) =>
  pageBox(element)?.getAttribute('data-direction');

/** The name travels with the swatches it names, from the same side. */
const nameDirection = (element: EdgelessColorPickerButton) =>
  header(element)?.querySelector('.label')?.getAttribute('data-direction');

const openList = async (element: EdgelessColorPickerButton) => {
  header(element)!.click();
  await element.updateComplete;
};

/** Jump to a page by its name, the way a user reads the list. */
const choose = async (element: EdgelessColorPickerButton, label: string) => {
  if (!rows(element).length) await openList(element);
  const row = rows(element).find(
    item => item.querySelector('.label')?.textContent?.trim() === label
  );
  expect(row).toBeDefined();
  row!.click();
  await element.updateComplete;
};

/** Longer than the header's own wheel throttle, so each flick is its own. */
const settleWheel = () => new Promise(resolve => setTimeout(resolve, 250));

/** The wheel is bound on the PANEL, not on the name: the whole picker pages. */
const panel = (element: EdgelessColorPickerButton) =>
  element.shadowRoot!.querySelector('[data-orientation="vertical"]')!;

const wheel = async (element: EdgelessColorPickerButton, deltaY: number) => {
  panel(element).dispatchEvent(
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

  test('the header opens an inline list of every page, in place of the grid', async () => {
    const element = await mount({
      paletteGroups: GROUPS,
      activeGroupKey: 'default',
    });

    // Closed, the picker is a header above a grid and nothing else.
    expect(rows(element)).toHaveLength(0);
    expect(grid(element)).not.toBeNull();

    await openList(element);

    expect(
      rows(element).map(row => row.querySelector('.label')?.textContent?.trim())
    ).toEqual(['Default', 'Wardley map', 'EDGY']);
    // The list TAKES THE PLACE of the swatches: no nested popover to position.
    expect(grid(element)).toBeNull();
    expect(header(element)?.getAttribute('aria-expanded')).toBe('true');
    // The page in force is marked, and only it.
    expect(rows(element).map(row => row.getAttribute('aria-current'))).toEqual([
      'true',
      'false',
      'false',
    ]);
    // Each row previews its page: swatch dots beside the name.
    expect(
      rows(element)[1].querySelectorAll('.palette-carousel-dot').length
    ).toBe(1);
  });

  test('a row jumps straight to its page and gives the grid back', async () => {
    const element = await mount({
      paletteGroups: GROUPS,
      activeGroupKey: 'default',
    });

    // Two pages away in one gesture — the whole point of the list.
    await choose(element, 'EDGY');
    expect(name(element)).toBe('EDGY');
    expect(element.activePalettes).toEqual(GROUPS[2].palettes);
    expect(rows(element)).toHaveLength(0);
    expect(grid(element)).not.toBeNull();
  });

  test('the header closes the list again without changing the page', async () => {
    const element = await mount({
      paletteGroups: GROUPS,
      activeGroupKey: 'wardley',
    });

    await openList(element);
    expect(rows(element)).toHaveLength(3);

    header(element)!.click();
    await element.updateComplete;

    expect(rows(element)).toHaveLength(0);
    expect(name(element)).toBe('Wardley map');
  });

  test('Escape closes the list, and stops there so the menu survives', async () => {
    const element = await mount({
      paletteGroups: GROUPS,
      activeGroupKey: 'wardley',
    });
    await openList(element);

    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    rows(element)[0].dispatchEvent(event);
    await element.updateComplete;

    expect(rows(element)).toHaveLength(0);
    expect(name(element)).toBe('Wardley map');
    // `editor-menu-button` hides the whole popper on an Escape that reaches it.
    expect(event.cancelBubble).toBe(true);
  });

  test('a wheel anywhere over the panel pages, wrapping both ways', async () => {
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

  test('a wheel over the swatch grid pages too — the name is not a target', async () => {
    const element = await mount({
      paletteGroups: GROUPS,
      activeGroupKey: 'default',
    });

    grid(element)!.dispatchEvent(
      new WheelEvent('wheel', { deltaY: 1, bubbles: true, cancelable: true })
    );
    await element.updateComplete;
    await settleWheel();

    expect(name(element)).toBe('Wardley map');
  });

  test('with the list open the wheel is the list’s, not the carousel’s', async () => {
    const element = await mount({
      paletteGroups: GROUPS,
      activeGroupKey: 'default',
    });
    await openList(element);

    await wheel(element, 1);
    expect(name(element)).toBe('Default');
    expect(rows(element)).toHaveLength(3);
  });

  test('a trackpad burst moves one page, not the whole ring', async () => {
    const element = await mount({
      paletteGroups: GROUPS,
      activeGroupKey: 'default',
    });

    for (let i = 0; i < 6; i++) {
      panel(element).dispatchEvent(
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
    panel(element).dispatchEvent(event);
    await element.updateComplete;

    expect(name(element)).toBe('Default');
    expect(event.defaultPrevented).toBe(false);
  });

  test('the page arrives from the side the wheel came from, wrap included', async () => {
    const element = await mount({
      paletteGroups: GROUPS,
      activeGroupKey: 'default',
    });

    // Nothing has moved yet: the first paint comes from nowhere in particular.
    expect(direction(element)).toBe('settle');

    // The wheel throttle is a module-level stamp, so the flick of the test
    // before this one still counts against the first flick of this one.
    await settleWheel();

    await wheel(element, 1);
    expect(direction(element)).toBe('next');
    expect(nameDirection(element)).toBe('next');

    await wheel(element, -1);
    expect(direction(element)).toBe('prev');
    expect(nameDirection(element)).toBe('prev');

    // Wrapping from the last page to the first is still a step FORWARD: the
    // wheel's own sign says so, and the index delta (2 → 0) would lie.
    await wheel(element, -1);
    expect(name(element)).toBe('EDGY');
    await wheel(element, 1);
    expect(name(element)).toBe('Default');
    expect(direction(element)).toBe('next');
  });

  test('a row picked from the list comes in from where it sat', async () => {
    const element = await mount({
      paletteGroups: GROUPS,
      activeGroupKey: 'default',
    });

    // Two rows down the list: from the right.
    await choose(element, 'EDGY');
    expect(direction(element)).toBe('next');

    // …and back up it: from the left.
    await choose(element, 'Default');
    expect(direction(element)).toBe('prev');

    // The page already on screen goes nowhere, so neither do the swatches.
    await choose(element, 'Default');
    expect(direction(element)).toBe('settle');
  });

  test('closing the list gives the grid back without replaying the last slide', async () => {
    const element = await mount({
      paletteGroups: GROUPS,
      activeGroupKey: 'default',
    });

    await wheel(element, 1);
    expect(direction(element)).toBe('next');

    await openList(element);
    header(element)!.click();
    await element.updateComplete;

    expect(grid(element)).not.toBeNull();
    expect(name(element)).toBe('Wardley map');
    expect(direction(element)).toBe('settle');
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
    // No carousel, no page box either: the grid keeps the DOM it always had.
    expect(pageBox(element)).toBeNull();
    expect(grid(element)).not.toBeNull();
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

  test('a new selection also puts the list away', async () => {
    const element = await mount({
      paletteGroups: GROUPS,
      activeGroupKey: 'wardley',
    });
    await openList(element);

    element.activeGroupKey = 'edgy';
    await element.updateComplete;

    expect(rows(element)).toHaveLength(0);
    expect(grid(element)).not.toBeNull();
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
