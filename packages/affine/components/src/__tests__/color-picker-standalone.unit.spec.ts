/**
 * The custom colour picker mounts outside an editor: no `std` in the Lit
 * context, a host's words through `labels`, and the two trims a brand accent
 * needs (`hideAlpha`, `hideTabs`). The Labre "publish" panel relies on this
 * so its accent field is this picker rather than an `<input type="color">`.
 *
 * What it would have caught:
 * - a mount with no `std` throwing (a `translateKey` call, a null canvas
 *   context, a missing alpha control read for its rect);
 * - the host's labels ignored, or the English fallback lost when a label
 *   is left out;
 * - `hideAlpha` still drawing the alpha slider or the `%` field, or a pick
 *   reporting an 8-digit hex where the host stores a 6-digit one;
 * - `hideTabs` still drawing the `Colors` / `Custom` bar;
 * - a toolbar's picker (neither option) losing its tabs or its alpha field.
 */
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import {
  type EdgelessColorPicker,
  effects,
  type PickColorEvent,
} from '../color-picker/index.js';

// happy-dom lays nothing out; the picker derives the colour from the control
// positions, so the controls need a size for a hex edit to land.
const CONTROL_SIZE_PX = 200;

beforeAll(() => {
  if (!customElements.get('edgeless-color-picker')) effects();
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, CONTROL_SIZE_PX, CONTROL_SIZE_PX)
  );
});

afterEach(() => {
  document.body.innerHTML = '';
});

async function mount(init: Partial<EdgelessColorPicker> = {}) {
  const picker = document.createElement(
    'edgeless-color-picker'
  ) as EdgelessColorPicker;
  const picks: PickColorEvent[] = [];
  picker.pick = event => picks.push(event);
  Object.assign(picker, init);
  document.body.append(picker);
  await picker.updateComplete;
  const root = picker.shadowRoot!;
  const texts = (selector: string) =>
    [...root.querySelectorAll(selector)].map(el => el.textContent?.trim());
  return { picker, root, picks, texts };
}

describe('the colour picker outside an editor', () => {
  test('mounts with no std and keeps its English words, tabs and alpha', async () => {
    const { picker, root, texts } = await mount();
    expect(picker.std).toBeUndefined();
    expect(texts('nav button')).toEqual(['Colors', 'Custom']);
    expect(root.querySelector('.color-slider-wrapper.alpha')).not.toBeNull();
    expect(root.querySelector('.field.alpha')).not.toBeNull();
  });

  test("displays the host's labels, the fallback filling any gap", async () => {
    const { root, texts } = await mount({
      labels: { colors: 'Couleurs', light: 'Clair' },
    });
    expect(texts('nav button')).toEqual(['Couleurs', 'Custom']);
    (root.querySelectorAll('nav button')[1] as HTMLButtonElement).click();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(texts('.modes .mode button > div:last-child')).toEqual([
      'Clair',
      'Dark',
    ]);
  });

  test('hideAlpha and hideTabs leave the single-colour picker, picking a hex 6', async () => {
    const { picker, root, picks } = await mount({
      hideAlpha: true,
      hideTabs: true,
    });
    expect(root.querySelector('nav')).toBeNull();
    expect(root.querySelector('.color-slider-wrapper.alpha')).toBeNull();
    expect(root.querySelector('.field.alpha')).toBeNull();

    const hex = root.querySelector('.field.color input') as HTMLInputElement;
    hex.value = '2a7bd3';
    hex.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(picker.hex6$.value).toBe('#2a7bd3');
    const picked = picks.find(event => event.type === 'pick');
    expect(picked && 'detail' in picked ? picked.detail.value : null).toEqual({
      normal: '#2a7bd3',
    });
  });
});
