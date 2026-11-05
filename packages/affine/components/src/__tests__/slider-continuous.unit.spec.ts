/**
 * `<affine-slider>` continuous mode (`range: { min, max, step? }`), added for
 * the image crop's zoom (ADR 0037 amendment of 2026-11-04) beside the
 * discrete `points` the line-width and note-style panels use.
 *
 * This spec would have caught:
 * - a handle drawn at an index instead of at the value's place along the
 *   track, or a value under the pointer that ignores the step or the ends;
 * - arrow keys, Page Up/Down, Home and End that do nothing, overshoot the
 *   range or leak to the editor (which would move the selected element);
 * - a `select` re-emitted for the value already shown;
 * - the discrete mode changed on the way: its points, its cursor index and
 *   the absence of an ARIA slider role.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import { effects } from '../slider/index.js';
import type { Slider } from '../slider/slider.js';
import type {
  SliderContinuousRange,
  SliderRange,
  SliderSelectEvent,
} from '../slider/types.js';

beforeAll(() => {
  effects();
});

const mount = async (
  range: SliderRange | SliderContinuousRange,
  value: number
) => {
  const element = document.createElement('affine-slider') as Slider;
  element.range = range;
  element.value = value;
  element.tooltip = 'Zoom';
  const selected: number[] = [];
  element.addEventListener('select', event => {
    selected.push((event as SliderSelectEvent).detail.value);
  });
  document.body.append(element);
  await element.updateComplete;
  return { element, selected };
};

const container = (element: Slider) =>
  element.shadowRoot!.querySelector<HTMLElement>('.slider-container')!;

const press = (element: Slider, key: string) => {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    composed: true,
    cancelable: true,
  });
  container(element).dispatchEvent(event);
  return event;
};

const ZOOM = { min: 1, max: 4, step: 0.5 };

describe('affine-slider, continuous', () => {
  test('the handle sits at the value along the track', async () => {
    const { element } = await mount(ZOOM, 2.5);
    expect(element.style.getPropertyValue('--count')).toBe('2');
    expect(element.style.getPropertyValue('--cursor')).toBe('0.5');

    element.value = 4;
    await element.updateComplete;
    expect(element.style.getPropertyValue('--cursor')).toBe('1');
    // Out of range is drawn at the end, never past it.
    element.value = 9;
    await element.updateComplete;
    expect(element.style.getPropertyValue('--cursor')).toBe('1');
  });

  test('is an ARIA slider named by its tooltip', async () => {
    const { element } = await mount(ZOOM, 2);
    const track = container(element);
    expect(track.getAttribute('role')).toBe('slider');
    expect(track.getAttribute('aria-label')).toBe('Zoom');
    expect(track.getAttribute('aria-valuemin')).toBe('1');
    expect(track.getAttribute('aria-valuemax')).toBe('4');
    expect(track.getAttribute('aria-valuenow')).toBe('2');
    expect(track.tabIndex).toBe(0);
    expect(track.querySelectorAll('.point-button')).toHaveLength(0);
  });

  test('the keys move by a step, a page, or to an end', async () => {
    const { element, selected } = await mount(ZOOM, 2);
    const right = press(element, 'ArrowRight');
    expect(right.defaultPrevented).toBe(true);
    press(element, 'ArrowDown');
    press(element, 'PageUp');
    press(element, 'Home');
    press(element, 'End');
    expect(selected).toEqual([2.5, 1.5, 4, 1, 4]);
  });

  test('keys stop at the ends and say nothing when nothing moves', async () => {
    const { element, selected } = await mount(ZOOM, 4);
    press(element, 'ArrowRight');
    press(element, 'End');
    expect(selected).toEqual([]);
    // A key the slider does not own reaches the editor.
    const other = press(element, 'a');
    expect(other.defaultPrevented).toBe(false);
  });

  test('the pointer picks the value under it, on a step', async () => {
    const { element, selected } = await mount(ZOOM, 1);
    // 16px items: the track runs from 8px to 108px of a 116px slider.
    element.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 116, height: 24 }) as DOMRect;
    element.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 8 + 52,
        button: 0,
        bubbles: true,
        composed: true,
      })
    );
    element.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 500, bubbles: true })
    );
    element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    // Moving after the release selects nothing.
    element.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 8, bubbles: true })
    );
    // 52 % of 1..4 is 2.56, on the 0.5 step: 2.5; past the end: 4.
    expect(selected).toEqual([2.5, 4]);
  });

  test('a range with no step moves by a hundredth of its span', async () => {
    const { element, selected } = await mount({ min: 0, max: 10 }, 5);
    press(element, 'ArrowRight');
    expect(selected[0]).toBeCloseTo(5.1, 9);
  });
});

describe('affine-slider, discrete (unchanged)', () => {
  test('draws its points and puts the cursor on the selected index', async () => {
    const { element } = await mount({ points: [2, 4, 6, 8] }, 6);
    const track = container(element);
    expect(track.querySelectorAll('.point-button')).toHaveLength(4);
    expect(track.getAttribute('role')).toBeNull();
    expect(element.style.getPropertyValue('--count')).toBe('4');
    expect(element.style.getPropertyValue('--cursor')).toBe('2');
  });

  test('ignores the continuous keys', async () => {
    const { element, selected } = await mount({ points: [2, 4] }, 2);
    const event = press(element, 'ArrowRight');
    expect(event.defaultPrevented).toBe(false);
    expect(selected).toEqual([]);
  });
});
