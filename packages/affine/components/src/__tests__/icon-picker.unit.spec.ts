/**
 * The picker's elements, mounted on their own: the tabbed `affine-icon-picker`,
 * its emoji half (emoji-mart's picker, the callout's since the picker was
 * unified with it) and its icon half.
 *
 * What it would have caught on the emoji half:
 * - a pick that does not come out as `{ type: 'emoji', unicode }`;
 * - emoji-mart's own words (search, categories, skin tones) left in English
 *   instead of read through the `com.labre.*` wordings and the host's
 *   `translation`;
 * - `rememberRecent: false` still writing the picks to `localStorage`, or
 *   taking "Frequently used" away from every picker opened after it until the
 *   page reloads (emoji-mart keeps its categories at module level and spliced
 *   the empty `frequent` one out of them: a host's `openIconPicker` with
 *   `rememberRecent: false` then cost every callout its row);
 * - emoji-mart, built imperatively, left behind with its document listeners
 *   when the panel goes (the callout's emoji menu once leaked one per opening);
 * - the one-tab picker (the callout's) still drawing a tab bar or a frame
 *   around emoji-mart's own.
 */
import { type LitElement, nothing } from 'lit';
import { beforeAll, describe, expect, test } from 'vitest';

import type { AffineIconPickerPanel } from '../icon-picker/affine-icon-picker-panel.js';
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

/** emoji-mart's shadow root inside an emoji panel, once its init has run. */
async function emojiMart(panel: HTMLElement): Promise<ShadowRoot> {
  for (let i = 0; i < 40; i++) {
    const root = panel.shadowRoot?.querySelector('em-emoji-picker')?.shadowRoot;
    if (root?.querySelector('.category button[aria-label]')) return root;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error('emoji-mart drew no emoji');
}

const cells = (root: HTMLElement) => [
  ...(root.shadowRoot?.querySelectorAll<HTMLElement>('.picker-cell') ?? []),
];

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

  test('one tab and no Remove: no tab bar, no frame, emoji-mart alone', async () => {
    const picker = await mount(
      Object.assign(document.createElement('affine-icon-picker'), {
        rememberRecent: false,
        tabs: ['emoji'] as const,
        showRemove: false,
      })
    );

    // `activeTab` still says 'icons' (its default): a tab not offered falls
    // back to the first one that is.
    expect(picker.activeTab).toBe('icons');
    expect(picker.shadowRoot?.querySelector('header')).toBeNull();
    expect(picker.hasAttribute('data-bare')).toBe(true);
    const panel = picker.shadowRoot?.querySelector('affine-emoji-picker-panel');
    expect(panel).not.toBeNull();
    expect(panel?.framed).toBe(false);
    picker.remove();
  });

  test('two tabs: the frame is drawn and the emoji panel fills it', async () => {
    const picker = await mount(
      Object.assign(document.createElement('affine-icon-picker'), {
        rememberRecent: false,
        activeTab: 'emoji' as const,
      })
    );

    expect(picker.hasAttribute('data-bare')).toBe(false);
    expect(
      picker.shadowRoot?.querySelector('affine-emoji-picker-panel')?.framed
    ).toBe(true);
    picker.remove();
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
  const openPanel = async (
    props: Partial<AffineEmojiPickerPanel> = {}
  ): Promise<AffineEmojiPickerPanel> =>
    mount(
      Object.assign(document.createElement('affine-emoji-picker-panel'), {
        rememberRecent: false,
        ...props,
      })
    );

  test('picking an emoji emits its unicode', async () => {
    const panel = await openPanel();
    const details: IconPickerSelectDetail[] = [];
    panel.addEventListener('select', event =>
      details.push((event as CustomEvent<IconPickerSelectDetail>).detail)
    );

    const button = (await emojiMart(panel)).querySelector<HTMLElement>(
      '.category button[aria-label]'
    )!;
    button.click();

    expect(details).toEqual([
      { type: IconType.Emoji, unicode: button.getAttribute('aria-label') },
    ]);
    panel.remove();
  });

  test("emoji-mart's words come from the wordings, English by default", async () => {
    const english = await emojiMart(await openPanel());
    expect(english.querySelector('input')?.getAttribute('placeholder')).toBe(
      'Search'
    );
    expect(
      [...english.querySelectorAll('.category .sticky')].map(
        heading => heading.textContent
      )
    ).toContain('Food & Drink');
    document.body.innerHTML = '';

    const catalogue: Record<string, string> = {
      'com.labre.filterable-list.search-placeholder': 'Rechercher',
      'com.labre.emoji-group.foods': 'Nourriture',
    };
    const translated = await emojiMart(
      await openPanel({ translation: { t: key => catalogue[key] } })
    );
    expect(translated.querySelector('input')?.getAttribute('placeholder')).toBe(
      'Rechercher'
    );
    const headings = [...translated.querySelectorAll('.category .sticky')].map(
      heading => heading.textContent
    );
    expect(headings).toContain('Nourriture');
    expect(headings).toContain('Animals & Nature');
    document.body.innerHTML = '';
  });

  test('rememberRecent off shows no frequent row and stores no pick', async () => {
    localStorage.removeItem('emoji-mart.frequently');
    const root = await emojiMart(await openPanel({ rememberRecent: false }));

    expect(root.querySelector('.category[data-id="frequent"] button')).toBe(
      null
    );
    root.querySelector<HTMLElement>('.category button[aria-label]')!.click();
    expect(localStorage.getItem('emoji-mart.frequently')).toBeNull();
    document.body.innerHTML = '';
  });

  test('a picker without recents leaves "Frequently used" to the next one', async () => {
    localStorage.removeItem('emoji-mart.frequently');
    const without = await emojiMart(await openPanel({ rememberRecent: false }));
    expect(without.querySelector('.category[data-id="frequent"]')).toBeNull();
    document.body.innerHTML = '';

    const next = await emojiMart(await openPanel({ rememberRecent: true }));

    expect(next.querySelector('.category[data-id="frequent"]')).not.toBeNull();
    document.body.innerHTML = '';
  });

  test('emoji-mart is unmounted with the panel', async () => {
    const panel = await openPanel();
    await emojiMart(panel);

    panel.remove();

    expect(panel.shadowRoot?.querySelector('em-emoji-picker')).toBeNull();
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
