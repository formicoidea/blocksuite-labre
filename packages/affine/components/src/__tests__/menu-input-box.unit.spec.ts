/**
 * GUARD — a menu's fields stay inside the menu, whatever the host's CSS.
 *
 * What it would have caught (labre recette of 2.1, 2026-10-30): the playground
 * sets `* { box-sizing: border-box }` and the library was drawn under it; a
 * host without that reset (labre) drew `.affine-menu-input` (width 100%, plus
 * its padding and border) about 5px past the menu's right edge, and the
 * type-ahead `.affine-menu-search` kept an input's intrinsic 190px.
 */
import { describe, expect, test } from 'vitest';

import { MenuInput } from '../context-menu/input.js';
import { MenuComponent } from '../context-menu/menu-renderer.js';

const cssOf = (styles: unknown) =>
  [styles]
    .flat(Infinity)
    .map(s => (s as { cssText?: string }).cssText ?? '')
    .join('\n')
    .replace(/\s+/g, ' ');

describe('a menu field', () => {
  test('sizes its own box, padding and border inside its width', () => {
    expect(cssOf(MenuInput.styles)).toMatch(
      /\.affine-menu-input \{ box-sizing: border-box; min-width: 0;/
    );
  });

  test('lets the type-ahead field shrink with its row', () => {
    expect(cssOf(MenuComponent.styles)).toMatch(
      /\.affine-menu-search \{ flex: 1; min-width: 0; width: 100%;/
    );
  });
});
