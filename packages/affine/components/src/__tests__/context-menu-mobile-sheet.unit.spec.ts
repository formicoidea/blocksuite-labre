import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * On a phone a context menu (a base's view menu, its filter and sort panels)
 * is a bottom action sheet over a scrim, no longer a full-screen page that
 * hides the view it configures (P7, "Vues de base sur mobile").
 *
 * What it would have caught:
 * - the 0.48 mobile menu, `height: 100%` from the top of the screen, whose
 *   only way out was "Done";
 * - a scrim that does not close the sheet, or a tap inside the sheet that
 *   does.
 */
vi.mock('@labre/global/env', async importOriginal => ({
  ...(await importOriginal<typeof import('@labre/global/env')>()),
  IS_MOBILE: true,
}));

import { effects } from '../context-menu/index.js';
import {
  MobileMenuComponent,
  popMenu,
  popupTargetFromElement,
} from '../context-menu/menu-renderer.js';

beforeAll(() => {
  effects();
});

beforeEach(() => {
  document.body.replaceChildren();
});

const open = (onClose = vi.fn()) => {
  const anchor = document.createElement('div');
  document.body.append(anchor);
  popMenu(popupTargetFromElement(anchor), {
    options: { items: [], onClose },
  });
  const sheet = document.querySelector('mobile-menu');
  const scrim = sheet?.parentElement;
  if (!sheet || !scrim) throw new Error('no mobile menu');
  return { sheet, scrim, onClose };
};

describe('mobile context menu', () => {
  test('is anchored to the bottom, not stretched over the screen', () => {
    const rule = MobileMenuComponent.styles
      .toString()
      .replace(/\s+/g, ' ')
      .match(/mobile-menu \{[^}]*\}/)?.[0];
    expect(rule).toContain('bottom: 0');
    expect(rule).toContain('max-height: 85%');
    expect(rule).not.toContain('height: 100%');
  });

  test('a tap on the scrim closes it, a tap inside does not', () => {
    const { sheet, scrim, onClose } = open();
    expect(scrim.style.background).toContain('mobile-modal');

    sheet.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onClose).not.toHaveBeenCalled();
    expect(document.querySelector('mobile-menu')).not.toBeNull();

    scrim.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.querySelector('mobile-menu')).toBeNull();
  });
});
