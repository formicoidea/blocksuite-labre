/**
 * The slash menu is the demonstrator of the "static config rendered by a
 * widget" i18n pattern: `nameWording` / `descriptionWording` /
 * `captionWording` sibling fields, resolved at render, mirroring the toolbar's
 * `labelWording` / `tooltipWording`.
 *
 * Three things this pins:
 * - with a fake `TranslationProvider`, the resolved name / description /
 *   caption / group header are the TRANSLATED ones;
 * - with none registered, they are the English literal — a standalone
 *   playground reads exactly as it did before any of this existed;
 * - search matches an item by its translated name AND by its English name
 *   (plus `searchAlias`), so neither a French user nor a habitual one is
 *   left unable to find an item.
 */
import type { BlockStdScope } from '@labre/std';
import { describe, expect, test } from 'vitest';

import {
  TranslationProvider,
  type TranslationService,
} from '@labre/affine-shared/services';

import { defaultSlashMenuConfig } from '../config.js';
import { slashMenuToolTips } from '../tooltips/index.js';
import { slashMenuGroupWording } from '../translations.js';
import type { SlashMenuActionItem } from '../types.js';
import {
  resolveSlashItemDescription,
  resolveSlashItemName,
  resolveSlashTooltipCaption,
  slashItemMatchesQuery,
} from '../utils.js';

const stdWith = (service?: TranslationService) =>
  ({
    getOptional: (id: unknown) =>
      id === TranslationProvider ? (service ?? null) : null,
  }) as unknown as BlockStdScope;

/** A tiny fake catalogue: French for the wordings this test exercises. */
const FR: Record<string, string> = {
  'com.labre.slash-menu.date.today': "Aujourd'hui",
  'com.labre.toolbar.move-up': 'Monter',
  'com.labre.slash-menu.actions.move-up.description':
    'Déplacer cette ligne vers le haut.',
  'com.labre.slash-menu.actions.copy-duplicate.caption': 'Copier / Dupliquer',
  'com.labre.slash-menu.group.actions': 'Actions (FR)',
  'com.labre.slash-menu.group.date': 'Date (FR)',
};

const frenchStd = stdWith({ t: key => FR[key] });
const noProviderStd = stdWith();

function items(): SlashMenuActionItem[] {
  const built = defaultSlashMenuConfig.items;
  const list = typeof built === 'function' ? built({} as never) : built;
  return list as SlashMenuActionItem[];
}

const itemNamed = (name: string) => {
  const found = items().find(item => item.name === name);
  if (!found) throw new Error(`no slash item named ${name}`);
  return found;
};

describe('slash menu item wordings', () => {
  test('resolve to the host catalogue when one is registered', () => {
    const today = itemNamed('Today');
    expect(resolveSlashItemName(frenchStd, today)).toBe("Aujourd'hui");

    const moveUp = itemNamed('Move Up');
    expect(resolveSlashItemName(frenchStd, moveUp)).toBe('Monter');
    expect(resolveSlashItemDescription(frenchStd, moveUp)).toBe(
      'Déplacer cette ligne vers le haut.'
    );
  });

  test('fall back to the English literal with no TranslationProvider', () => {
    const today = itemNamed('Today');
    expect(resolveSlashItemName(noProviderStd, today)).toBe('Today');

    const moveUp = itemNamed('Move Up');
    expect(resolveSlashItemName(noProviderStd, moveUp)).toBe('Move Up');
    expect(resolveSlashItemDescription(noProviderStd, moveUp)).toBe(
      'Shift this line up.'
    );
  });

  test('Copy and Duplicate resolve their own name but share one caption', () => {
    const copyTooltip = slashMenuToolTips['Copy'];
    expect(resolveSlashTooltipCaption(frenchStd, copyTooltip)).toBe(
      'Copier / Dupliquer'
    );
    expect(resolveSlashTooltipCaption(noProviderStd, copyTooltip)).toBe(
      'Copy / Duplicate'
    );

    const copy = itemNamed('Copy');
    const duplicate = itemNamed('Duplicate');
    expect(resolveSlashItemName(noProviderStd, copy)).toBe('Copy');
    expect(resolveSlashItemName(noProviderStd, duplicate)).toBe('Duplicate');
  });
});

describe('slash menu group headers', () => {
  test('resolve a group in the closed set, in both directions', () => {
    expect(slashMenuGroupWording('Actions')).toBeDefined();
    expect(slashMenuGroupWording('Date')).toBeDefined();
  });

  test('an unknown group name has no wording — renders raw', () => {
    expect(
      slashMenuGroupWording('Some Future Framework Group')
    ).toBeUndefined();
  });
});

describe('slash menu search', () => {
  test('matches by the English name with no provider registered', () => {
    const today = itemNamed('Today');
    expect(slashItemMatchesQuery(noProviderStd, today, 'today')).toBe(true);
    expect(slashItemMatchesQuery(noProviderStd, today, 'aujourd')).toBe(false);
  });

  test('matches by BOTH the English name and the resolved (translated) name', () => {
    const today = itemNamed('Today');
    expect(slashItemMatchesQuery(frenchStd, today, 'today')).toBe(true);
    expect(slashItemMatchesQuery(frenchStd, today, 'aujourd')).toBe(true);
  });

  test('still matches by searchAlias', () => {
    const del = itemNamed('Delete');
    expect(slashItemMatchesQuery(noProviderStd, del, 'remove')).toBe(true);
    expect(slashItemMatchesQuery(frenchStd, del, 'remove')).toBe(true);
  });
});
