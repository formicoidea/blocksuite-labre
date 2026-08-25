import { MenuInput } from '@labre/affine-components/context-menu';
import { signal } from '@preact/signals-core';
import { beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * `MenuInput` lives in `@labre/affine-components`, which has no test harness of
 * its own; the data-view property menu is its main consumer, so the behaviour
 * is pinned here.
 */
const TAG = 'test-menu-input';

beforeAll(() => {
  if (!customElements.get(TAG)) {
    customElements.define(TAG, class extends MenuInput {});
  }
});

const createMenuStub = () => ({
  currentFocused$: signal<unknown>(undefined),
  setFocusOnly: vi.fn(),
  closeSubMenu: vi.fn(),
  focusTo: vi.fn(),
  close: vi.fn(),
});

const mountInput = async (data: Record<string, unknown>) => {
  const menu = createMenuStub();
  const element = document.createElement(TAG) as MenuInput;
  element.data = data as MenuInput['data'];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  element.menu = menu as any;
  document.body.append(element);
  await element.updateComplete;
  return { element, menu };
};

describe('MenuInput', () => {
  it('saves the value on Enter before closing the menu', async () => {
    const onBlur = vi.fn();
    const { element, menu } = await mountInput({
      initialValue: 'Old name',
      onBlur,
    });
    element.inputRef.focus();
    element.inputRef.value = 'New name';

    element.inputRef.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );

    expect(onBlur).toHaveBeenCalledWith('New name');
    expect(menu.close).toHaveBeenCalled();
    element.remove();
  });

  it('reports the value when focus is lost', async () => {
    const onBlur = vi.fn();
    const { element } = await mountInput({
      initialValue: 'Old name',
      onBlur,
    });
    element.inputRef.focus();
    element.inputRef.value = 'Typed then abandoned';

    element.inputRef.blur();

    expect(onBlur).toHaveBeenCalledWith('Typed then abandoned');
    element.remove();
  });
});
