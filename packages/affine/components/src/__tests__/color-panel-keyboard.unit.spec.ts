/**
 * The colour panel's keyboard path (ADR 0036 amendment of 2026-10-14). The
 * database options' colour moved from ten focusable menu rows to this grid,
 * so the grid had to stay reachable without a pointer; the canvas's panels
 * gain it too.
 *
 * What it would have caught:
 * - a grid with no tab stop, or one tab stop per swatch;
 * - arrows that do not move between swatches, or that also reach the
 *   canvas (a nudge, a pan) once the grid handled them;
 * - Enter or Space not picking, or picking another way than a click;
 * - a swatch without its name as a tooltip, or a radio without its state.
 */
import { ColorScheme, type Palette } from '@labre/affine-model';
import type { ColorEvent } from '@labre/affine-shared/utils';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import { type EdgelessColorPanel, effects } from '../color-picker/index.js';

beforeAll(() => {
  if (!customElements.get('edgeless-color-panel')) effects();
});

afterEach(() => {
  document.body.innerHTML = '';
});

const palettes: Palette[] = [
  'Red',
  'Orange',
  'Yellow',
  'Green',
  'Teal',
  'Blue',
  'Purple',
].map((key, index) => ({ key, value: `#0000${index}0` }));

async function mount(value: string | null, columns?: number) {
  const panel = document.createElement(
    'edgeless-color-panel'
  ) as EdgelessColorPanel;
  panel.palettes = palettes;
  panel.theme = ColorScheme.Light;
  panel.value = value;
  panel.columns = columns;
  const picked = vi.fn();
  panel.addEventListener('select', event =>
    picked((event as ColorEvent).detail)
  );
  const outside = vi.fn();
  document.body.addEventListener('keydown', outside);
  document.body.append(panel);
  await panel.updateComplete;
  const swatches = () => [
    ...(panel.shadowRoot?.querySelectorAll<HTMLElement>(
      'edgeless-color-button'
    ) ?? []),
  ];
  return { panel, swatches, picked, outside };
}

const press = (target: HTMLElement, key: string) =>
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, composed: true })
  );

const tabStops = (swatches: HTMLElement[]) =>
  swatches.map(swatch => swatch.getAttribute('tabindex'));

describe('the colour panel keyboard path', () => {
  test('one tab stop, on the current colour, else the first', async () => {
    const current = await mount(palettes[2]!.value as string);
    expect(current.panel.getAttribute('role')).toBe('radiogroup');
    expect(tabStops(current.swatches())).toEqual(
      palettes.map((_, index) => (index === 2 ? '0' : '-1'))
    );
    expect(
      current.swatches().map(swatch => swatch.getAttribute('aria-checked'))
    ).toEqual(palettes.map((_, index) => String(index === 2)));
    document.body.innerHTML = '';
    const none = await mount(null);
    expect(tabStops(none.swatches())[0]).toBe('0');
  });

  test('the arrows move between swatches and go no further', async () => {
    const { panel, swatches, outside } = await mount(
      palettes[2]!.value as string,
      3
    );
    press(swatches()[2]!, 'ArrowRight');
    await panel.updateComplete;
    expect(panel.shadowRoot?.activeElement).toBe(swatches()[3]);
    expect(tabStops(swatches())[3]).toBe('0');
    press(swatches()[3]!, 'ArrowDown');
    await panel.updateComplete;
    expect(panel.shadowRoot?.activeElement).toBe(swatches()[6]);
    press(swatches()[6]!, 'ArrowDown');
    await panel.updateComplete;
    expect(panel.shadowRoot?.activeElement).toBe(swatches()[6]);
    press(swatches()[6]!, 'ArrowLeft');
    await panel.updateComplete;
    expect(panel.shadowRoot?.activeElement).toBe(swatches()[5]);
    expect(outside).not.toHaveBeenCalled();
    press(swatches()[5]!, 'a');
    expect(outside).toHaveBeenCalledTimes(1);
  });

  test('Enter and Space pick as a click does', async () => {
    const { swatches, picked, outside } = await mount(null);
    press(swatches()[1]!, 'Enter');
    press(swatches()[4]!, ' ');
    swatches()[5]!.click();
    expect(picked.mock.calls.map(([palette]) => palette)).toEqual([
      palettes[1],
      palettes[4],
      palettes[5],
    ]);
    expect(outside).not.toHaveBeenCalled();
  });

  test('a swatch shows its name as a tooltip', async () => {
    const { swatches } = await mount(null);
    const swatch = swatches()[0] as HTMLElement & {
      updateComplete: Promise<unknown>;
    };
    await swatch.updateComplete;
    expect(
      swatch.shadowRoot?.querySelector('.color-unit')?.getAttribute('title')
    ).toBe('Red');
    expect(swatch.getAttribute('aria-label')).toBe('Red');
  });
});
