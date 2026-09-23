/**
 * **Would have caught #390 (5).** `renderMenu` used to sew the menu shell's
 * accessible name together as `` `${resolvedLabel.toLowerCase()}-menu` ``.
 * That was a stable identifier while `label` was an English literal; once
 * `labelWording` joined the translation seam the attribute became half a
 * sentence per language — a French host read
 * `aria-label="changer le type de forme-menu"`.
 *
 * The contract proved here: a menu's accessible name is either the resolution
 * of its own `menuAriaWording`, or a composition from the ENGLISH `label` —
 * never a seam between a translated word and an English suffix.
 */
import type { ChromeWording } from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { describe, expect, test } from 'vitest';

import type { Menu } from '../config/types.js';
import { renderMenu } from '../config/utils.js';

/** A host whose catalogue answers `entries` and nothing else. */
const hostWith = (entries: Record<string, string>): BlockStdScope =>
  ({
    getOptional: () => ({ t: (key: string) => entries[key] }),
  }) as unknown as BlockStdScope;

const SWITCH_SHAPE_TYPE: ChromeWording = [
  'com.labre.shape.toolbar.switch-type',
  'Switch shape type',
];
const SWITCH_SHAPE_TYPE_MENU: ChromeWording = [
  'com.labre.shape.toolbar.switch-type-menu',
  'switch shape type-menu',
];

const FR = {
  [SWITCH_SHAPE_TYPE[0]]: 'Changer le type de forme',
  [SWITCH_SHAPE_TYPE_MENU[0]]: 'menu du type de forme',
};

/**
 * The rendered `aria-label` of the menu SHELL. `renderMenu` returns a lit
 * `TemplateResult`, so the attribute is read out of its static strings and the
 * value bound after them — no DOM, no custom-element registry.
 */
function shellAria<T>(menu: Menu<T>): unknown {
  const result = renderMenu(menu) as unknown as {
    strings: readonly string[];
    values: readonly unknown[];
  };
  const index = result.strings.findIndex(chunk =>
    chunk.includes('aria-label="')
  );
  expect(index, 'the shell renders an aria-label').toBeGreaterThanOrEqual(0);
  return result.values[index];
}

const menuWith = <T>(extra: Partial<Menu<T>>): Menu<string> =>
  ({
    label: 'Switch shape type',
    items: [{ key: 'Square', value: 'square' }],
    currentValue: 'square',
    onPick: () => {},
    ...extra,
  }) as Menu<string>;

describe('renderMenu: the shell aria-label', () => {
  test('a declared menuAriaWording is resolved through the host', () => {
    const aria = shellAria(
      menuWith({
        labelWording: SWITCH_SHAPE_TYPE,
        menuAriaWording: SWITCH_SHAPE_TYPE_MENU,
        std: hostWith(FR),
      })
    );
    expect(aria).toBe('menu du type de forme');
  });

  test('no catalogue: the fallback is letter for letter what shipped', () => {
    const aria = shellAria(
      menuWith({
        labelWording: SWITCH_SHAPE_TYPE,
        menuAriaWording: SWITCH_SHAPE_TYPE_MENU,
        std: hostWith({}),
      })
    );
    expect(aria).toBe('switch shape type-menu');
  });

  test('no wording: the name is composed from the ENGLISH label, never the translated one', () => {
    const aria = shellAria(
      menuWith({ labelWording: SWITCH_SHAPE_TYPE, std: hostWith(FR) })
    );
    // The label IS translated on the button…
    expect(aria).toBe('switch shape type-menu');
    // …and the shell's name carries none of it: no seam between a translated
    // word and an English suffix.
    expect(String(aria)).not.toContain('forme');
  });

  test('a caller with no std at all is unchanged', () => {
    expect(shellAria(menuWith({}))).toBe('switch shape type-menu');
  });
});
