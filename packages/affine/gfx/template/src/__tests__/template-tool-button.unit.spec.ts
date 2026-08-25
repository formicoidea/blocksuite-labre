import { beforeAll, describe, expect, test, vi } from 'vitest';

import { EdgelessTemplateButton } from '../toolbar/template-tool-button.js';

beforeAll(() => {
  if (!customElements.get('edgeless-template-button')) {
    customElements.define('edgeless-template-button', EdgelessTemplateButton);
  }
});

describe('EdgelessTemplateButton', () => {
  test('stops the panel positioning loop when the button is removed', async () => {
    const button = new EdgelessTemplateButton();
    document.body.append(button);
    await button.updateComplete;

    // Stand in for the loop `_togglePanel` starts once the panel is laid out;
    // opening the real panel needs a live edgeless host.
    const cleanup = vi.fn();
    Reflect.set(button, '_autoUpdateCleanup', cleanup);

    button.remove();

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(Reflect.get(button, '_autoUpdateCleanup')).toBeNull();
  });
});
