import {
  FontFamily,
  FontStyle,
  FontWeight,
  TextAlign,
} from '@labre/affine-model';
import type { ToolbarContext } from '@labre/affine-shared/services';
import { render } from 'lit';
import { describe, expect, test } from 'vitest';

import { edgelessTextToolbarConfig } from '../edgeless-toolbar/config.js';

/**
 * A stand-in for a selected `affine:edgeless-text`: the shared actions accept
 * anything whose `type` matches, which keeps the store out of the test. The
 * point is that, like the real block model, the style props live under `props`
 * and NOT on the instance.
 */
const textModel = {
  id: 'edgeless-text-1',
  type: 'edgeless-text',
  props: {
    color: '#000000',
    fontFamily: FontFamily.Poppins,
    fontStyle: FontStyle.Italic,
    fontWeight: FontWeight.SemiBold,
    textAlign: TextAlign.Center,
  },
};

function renderAction(id: string) {
  const action = edgelessTextToolbarConfig.actions.find(
    action => action.id === id
  );
  expect(action, `no toolbar action ${id}`).toBeDefined();

  const ctx = {
    getSurfaceModelsByType: () => [textModel],
    // `translateKey` only ever asks for the optional translation provider.
    std: { getOptional: () => undefined },
  } as unknown as ToolbarContext;

  const container = document.createElement('div');
  render(action!.content!(ctx), container);
  return container;
}

describe('edgeless text toolbar reflects the text own style', () => {
  test('the font style button carries the weight and style of the text', () => {
    const panel = renderAction('c.font-style').querySelector(
      'edgeless-font-weight-and-style-panel'
    ) as HTMLElement & {
      fontFamily: FontFamily;
      fontStyle: FontStyle;
      fontWeight: FontWeight;
    };

    expect(panel).not.toBeNull();
    expect(panel.fontWeight).toBe(FontWeight.SemiBold);
    expect(panel.fontStyle).toBe(FontStyle.Italic);
    expect(panel.fontFamily).toBe(FontFamily.Poppins);
  });

  test('the font button carries the family of the text', () => {
    const panel = renderAction('a.font').querySelector(
      'edgeless-font-family-panel'
    ) as HTMLElement & { value: FontFamily };

    expect(panel).not.toBeNull();
    expect(panel.value).toBe(FontFamily.Poppins);
  });

  test('the alignment menu marks the alignment of the text as active', () => {
    const container = renderAction('e.alignment');
    const active = (label: string) =>
      (
        container.querySelector(`[aria-label="${label}"]`) as HTMLElement & {
          active: boolean;
        }
      ).active;

    expect(active('Center')).toBe(true);
    expect(active('Left')).toBe(false);
  });
});
