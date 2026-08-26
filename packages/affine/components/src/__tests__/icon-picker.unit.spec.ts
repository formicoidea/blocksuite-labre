import { type LitElement, nothing } from 'lit';
import { beforeAll, describe, expect, test } from 'vitest';

import type { AffineIconPickerPanel } from '../icon-picker/affine-icon-picker-panel.js';
import {
  emojiUnicode,
  filterEmojiGroups,
  getEmojiGroups,
} from '../icon-picker/emoji-data.js';
import type { AffineEmojiPickerPanel } from '../icon-picker/emoji-picker-panel.js';
import {
  DEFAULT_ICON_COLOR,
  filterIcons,
  getIcons,
  renderAffineIcon,
} from '../icon-picker/icon-data.js';
import { effects } from '../icon-picker/index.js';
import { pushRecent, readRecent } from '../icon-picker/recent-store.js';
import { IconType, type IconPickerSelectDetail } from '../icon-picker/types.js';

beforeAll(() => {
  effects();
});

const mount = async <T extends LitElement>(element: T): Promise<T> => {
  document.body.append(element);
  await element.updateComplete;
  return element;
};

const cells = (root: HTMLElement) => [
  ...(root.shadowRoot?.querySelectorAll<HTMLElement>('.picker-cell') ?? []),
];

describe('emoji data', () => {
  test('groups the dataset into the eight upstream categories', () => {
    const groups = getEmojiGroups();

    expect(groups.map(group => group.name)).toEqual([
      'Smileys & People',
      'Animals & Nature',
      'Food & Drink',
      'Activity',
      'Travel & Places',
      'Objects',
      'Symbols',
      'Flags',
    ]);
    expect(groups.every(group => group.emojis.length > 0)).toBe(true);
  });

  test('filters on keywords and drops the groups left empty', () => {
    const filtered = filterEmojiGroups(getEmojiGroups(), 'pizza');

    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('Food & Drink');
    expect(filtered[0].emojis.map(emoji => emoji.skins[0])).toContain('🍕');
  });

  test('an empty keyword leaves the groups untouched', () => {
    expect(filterEmojiGroups(getEmojiGroups(), '   ')).toEqual(
      getEmojiGroups()
    );
  });

  test('a skin tone falls back to the neutral variant when there is none', () => {
    const toneless = { id: 'x', name: 'x', keywords: [], skins: ['🍕'] };
    const toned = {
      id: 'wave',
      name: 'wave',
      keywords: [],
      skins: ['👋', '👋🏻', '👋🏼', '👋🏽', '👋🏾', '👋🏿'],
    };

    expect(emojiUnicode(toneless, 3)).toBe('🍕');
    expect(emojiUnicode(toned, 3)).toBe('👋🏽');
    expect(emojiUnicode(toned, undefined)).toBe('👋');
  });
});

describe('icon data', () => {
  test('offers every icon of the set, without its Icon suffix', () => {
    const icons = getIcons();

    expect(icons.length).toBeGreaterThan(100);
    expect(icons.some(icon => icon.name === 'Search')).toBe(true);
    expect(icons.every(icon => !icon.name.endsWith('Icon'))).toBe(true);
  });

  test('filters on camel-case words of the name', () => {
    const filtered = filterIcons(getIcons(), 'collection');

    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every(icon => /collection/i.test(icon.name))).toBe(true);
  });

  test('an unknown icon name renders nothing rather than throwing', () => {
    expect(renderAffineIcon('NotAnIconWeShip')).toBe(nothing);
  });
});

describe('recent store', () => {
  test('keeps the most recent first, de-duplicated and capped at ten', () => {
    const key = 'affine:icon-picker:test-recents';

    for (const value of ['a', 'b', 'c', 'a']) pushRecent(key, value);
    expect(readRecent(key)).toEqual(['a', 'c', 'b']);

    for (let i = 0; i < 12; i++) pushRecent(key, `x${i}`);
    expect(readRecent(key)).toHaveLength(10);
    expect(readRecent(key)[0]).toBe('x11');
  });
});

describe('affine-icon-picker', () => {
  test('opens on the Icons tab and switches to Emoji', async () => {
    const picker = await mount(
      Object.assign(document.createElement('affine-icon-picker'), {
        rememberRecent: false,
      })
    );

    const tab = (value: string) =>
      picker.shadowRoot?.querySelector<HTMLElement>(`[data-tab="${value}"]`);

    expect(tab('icons')?.dataset.active).toBe('true');
    expect(
      picker.shadowRoot?.querySelector('affine-icon-picker-panel')
    ).not.toBeNull();

    tab('emoji')?.click();
    await picker.updateComplete;

    expect(tab('emoji')?.dataset.active).toBe('true');
    expect(
      picker.shadowRoot?.querySelector('affine-emoji-picker-panel')
    ).not.toBeNull();
  });

  test('Remove emits a null selection', async () => {
    const picker = await mount(
      Object.assign(document.createElement('affine-icon-picker'), {
        rememberRecent: false,
      })
    );

    const details: IconPickerSelectDetail[] = [];
    picker.addEventListener('select', event =>
      details.push((event as CustomEvent<IconPickerSelectDetail>).detail)
    );

    picker.shadowRoot
      ?.querySelector<HTMLElement>('[data-testid="icon-picker-remove"]')
      ?.click();

    expect(details).toEqual([null]);
  });

  test('the Remove affordance can be hidden', async () => {
    const picker = await mount(
      Object.assign(document.createElement('affine-icon-picker'), {
        rememberRecent: false,
        showRemove: false,
      })
    );

    expect(
      picker.shadowRoot?.querySelector('[data-testid="icon-picker-remove"]')
    ).toBeNull();
  });
});

describe('affine-emoji-picker-panel', () => {
  const openPanel = async (): Promise<AffineEmojiPickerPanel> =>
    mount(
      Object.assign(document.createElement('affine-emoji-picker-panel'), {
        rememberRecent: false,
      })
    );

  test('filtering narrows the rendered grid', async () => {
    const panel = await openPanel();
    const before = cells(panel).length;

    const input = panel.shadowRoot?.querySelector('input');
    if (!input) throw new Error('missing filter input');
    input.value = 'pizza';
    input.dispatchEvent(new Event('input'));
    await panel.updateComplete;

    const after = cells(panel);
    expect(after.length).toBeLessThan(before);
    expect(after.some(cell => cell.textContent?.includes('🍕'))).toBe(true);
  });

  test('a keyword nobody matches shows the empty state', async () => {
    const panel = await openPanel();

    const input = panel.shadowRoot?.querySelector('input');
    if (!input) throw new Error('missing filter input');
    input.value = 'zzzznotanemoji';
    input.dispatchEvent(new Event('input'));
    await panel.updateComplete;

    expect(panel.shadowRoot?.querySelector('.picker-empty')?.textContent).toBe(
      'No emoji found'
    );
  });

  test('picking an emoji emits its unicode', async () => {
    const panel = await openPanel();

    const details: IconPickerSelectDetail[] = [];
    panel.addEventListener('select', event =>
      details.push((event as CustomEvent<IconPickerSelectDetail>).detail)
    );

    const input = panel.shadowRoot?.querySelector('input');
    if (!input) throw new Error('missing filter input');
    input.value = 'pizza';
    input.dispatchEvent(new Event('input'));
    await panel.updateComplete;

    cells(panel)
      .find(cell => cell.textContent?.includes('🍕'))
      ?.click();

    expect(details).toEqual([{ type: IconType.Emoji, unicode: '🍕' }]);
  });

  test('a skin tone is applied to the rendered emojis', async () => {
    const panel = await openPanel();

    const input = panel.shadowRoot?.querySelector('input');
    if (!input) throw new Error('missing filter input');
    input.value = 'wave';
    input.dispatchEvent(new Event('input'));
    await panel.updateComplete;

    panel.shadowRoot
      ?.querySelector<HTMLElement>('[data-testid="skin-tone-trigger"]')
      ?.click();
    await panel.updateComplete;

    const menu = panel.shadowRoot?.querySelector(
      '[data-testid="skin-tone-menu"]'
    );
    expect(menu).not.toBeNull();
    menu?.querySelectorAll<HTMLElement>('button')[5]?.click();
    await panel.updateComplete;

    const details: IconPickerSelectDetail[] = [];
    panel.addEventListener('select', event =>
      details.push((event as CustomEvent<IconPickerSelectDetail>).detail)
    );
    cells(panel)
      .find(cell => cell.textContent?.includes('👋'))
      ?.click();

    expect(details).toHaveLength(1);
    const [detail] = details;
    expect(detail && 'unicode' in detail && detail.unicode).toBe('👋🏿');
  });
});

describe('affine-icon-picker-panel', () => {
  const openPanel = async (): Promise<AffineIconPickerPanel> =>
    mount(
      Object.assign(document.createElement('affine-icon-picker-panel'), {
        rememberRecent: false,
      })
    );

  test('filtering narrows the rendered grid and picking emits name + colour', async () => {
    const panel = await openPanel();

    const input = panel.shadowRoot?.querySelector('input');
    if (!input) throw new Error('missing filter input');
    input.value = 'collection';
    input.dispatchEvent(new Event('input'));
    await panel.updateComplete;

    const details: IconPickerSelectDetail[] = [];
    panel.addEventListener('select', event =>
      details.push((event as CustomEvent<IconPickerSelectDetail>).detail)
    );

    const cell = cells(panel).find(
      candidate => candidate.dataset.iconName === 'AddCollection'
    );
    expect(cell).toBeDefined();
    cell?.click();

    expect(details).toEqual([
      {
        type: IconType.AffineIcon,
        name: 'AddCollection',
        color: DEFAULT_ICON_COLOR,
      },
    ]);
  });

  test('a colour picked in the menu is carried by the next selection', async () => {
    const panel = await openPanel();

    const input = panel.shadowRoot?.querySelector('input');
    if (!input) throw new Error('missing filter input');
    input.value = 'collection';
    input.dispatchEvent(new Event('input'));
    await panel.updateComplete;

    panel.shadowRoot
      ?.querySelector<HTMLElement>('[data-testid="icon-color-trigger"]')
      ?.click();
    await panel.updateComplete;

    panel.shadowRoot
      ?.querySelector<HTMLElement>('[data-color-name="red"]')
      ?.click();
    await panel.updateComplete;

    const details: IconPickerSelectDetail[] = [];
    panel.addEventListener('select', event =>
      details.push((event as CustomEvent<IconPickerSelectDetail>).detail)
    );
    cells(panel)
      .find(candidate => candidate.dataset.iconName === 'AddCollection')
      ?.click();

    const [detail] = details;
    expect(detail && 'color' in detail && detail.color).toContain(
      'callout-icon-red'
    );
  });
});
