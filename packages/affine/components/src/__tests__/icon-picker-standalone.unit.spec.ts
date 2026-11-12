/**
 * The icon picker opens outside an editor, from the public entry
 * `@labre/affine/components/icon-picker` (issue #636): the Labre shell lets a
 * user choose a workspace icon with it (Settings › Workspace, the
 * create-workspace dialog), where no `std` exists.
 *
 * What it would have caught:
 * - the entry defining its elements at import (house rule: `effects()` only),
 *   or `effects()` throwing when a second caller runs it;
 * - `openIconPicker` not resolving the picked emoji or icon as plain JSON, or
 *   `null` for "Remove", or the popup staying in the page afterwards;
 * - a cancel (Escape, click outside, the host's signal, a second opening)
 *   leaving the promise pending or the popup open, or Escape reaching a host
 *   dialog behind the picker;
 * - the host's translation service ignored with no `std`, or the English
 *   fallback lost when it has no entry for a key.
 */
import { afterEach, beforeAll, describe, expect, test } from 'vitest';

import * as entry from '../icon-picker/index.js';
import type { AffineIconPicker } from '../icon-picker/icon-picker.js';
import { IconType } from '../icon-picker/types.js';

const ICON_PICKER_TAGS = [
  'affine-icon-picker',
  'affine-emoji-picker-panel',
  'affine-icon-picker-panel',
];

// Runs before `beforeAll`: the import above is the only thing that happened.
const definedAtImport = ICON_PICKER_TAGS.filter(tag => customElements.get(tag));

beforeAll(() => {
  entry.effects();
});

afterEach(() => {
  document.body.innerHTML = '';
});

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

function anchor() {
  const button = document.createElement('button');
  button.textContent = 'Icon';
  document.body.append(button);
  return button;
}

async function openedPicker(): Promise<AffineIconPicker> {
  await tick();
  const portal = document.querySelector('.blocksuite-portal');
  const picker = portal?.shadowRoot?.querySelector('affine-icon-picker');
  if (!picker) throw new Error('no icon picker in the page');
  await picker.updateComplete;
  return picker;
}

async function panel(picker: AffineIconPicker, tag: string) {
  const element = picker.shadowRoot?.querySelector(tag) as
    | (HTMLElement & { updateComplete: Promise<unknown> })
    | null;
  if (!element) throw new Error(`no ${tag}`);
  await element.updateComplete;
  return element;
}

const portals = () => document.querySelectorAll('.blocksuite-portal').length;

describe('registration', () => {
  test('importing the entry defines nothing; effects() does, twice safely', () => {
    expect(definedAtImport).toEqual([]);
    expect(() => entry.effects()).not.toThrow();
    expect(ICON_PICKER_TAGS.filter(tag => !customElements.get(tag))).toEqual(
      []
    );
  });
});

describe('openIconPicker outside an editor', () => {
  test('resolves the picked emoji as JSON and closes', async () => {
    const result = entry.openIconPicker(anchor(), {
      activeTab: 'emoji',
      rememberRecent: false,
    });
    const picker = await openedPicker();
    expect(picker.std).toBeUndefined();
    const emojis = await panel(picker, 'affine-emoji-picker-panel');
    const cell = emojis.shadowRoot!.querySelector<HTMLElement>('.picker-cell')!;
    const unicode = cell.textContent!.trim();
    cell.click();

    const icon = await result;
    expect(icon).toEqual({ type: IconType.Emoji, unicode });
    expect(JSON.parse(JSON.stringify(icon))).toEqual(icon);
    expect(portals()).toBe(0);
  });

  test('resolves the picked icon with its name and tint', async () => {
    const result = entry.openIconPicker(anchor(), {
      color: '#2a7bd3',
      rememberRecent: false,
    });
    const picker = await openedPicker();
    const icons = await panel(picker, 'affine-icon-picker-panel');
    icons
      .shadowRoot!.querySelector<HTMLElement>('[data-icon-name="Search"]')!
      .click();

    expect(await result).toEqual({
      type: IconType.AffineIcon,
      name: 'Search',
      color: '#2a7bd3',
    });
    expect(portals()).toBe(0);
  });

  test('resolves null on Remove', async () => {
    const result = entry.openIconPicker(anchor(), { rememberRecent: false });
    const picker = await openedPicker();
    picker
      .shadowRoot!.querySelector<HTMLElement>(
        '[data-testid="icon-picker-remove"]'
      )!
      .click();

    expect(await result).toBeNull();
  });

  test('Escape cancels with undefined and stops before a host dialog', async () => {
    const result = entry.openIconPicker(anchor(), { rememberRecent: false });
    await openedPicker();
    let hostSawEscape = false;
    const hostListener = () => (hostSawEscape = true);
    document.addEventListener('keydown', hostListener);

    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );

    expect(await result).toBeUndefined();
    expect(hostSawEscape).toBe(false);
    expect(portals()).toBe(0);
    document.removeEventListener('keydown', hostListener);
  });

  test('a click outside cancels, a click inside does not', async () => {
    const result = entry.openIconPicker(anchor(), { rememberRecent: false });
    const picker = await openedPicker();
    await tick();
    picker
      .shadowRoot!.querySelector<HTMLElement>('[data-tab="emoji"]')!
      .click();
    expect(portals()).toBe(1);

    document.body.click();

    expect(await result).toBeUndefined();
    expect(portals()).toBe(0);
  });

  test("the host's signal and a second opening cancel", async () => {
    const host = new AbortController();
    const first = entry.openIconPicker(anchor(), {
      rememberRecent: false,
      signal: host.signal,
    });
    await openedPicker();
    host.abort();
    expect(await first).toBeUndefined();

    const second = entry.openIconPicker(anchor(), { rememberRecent: false });
    await openedPicker();
    const third = entry.openIconPicker(anchor(), { rememberRecent: false });
    expect(await second).toBeUndefined();
    expect(portals()).toBe(1);
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    expect(await third).toBeUndefined();
  });

  test("reads the host's catalogue, English where it has no entry", async () => {
    const result = entry.openIconPicker(anchor(), {
      rememberRecent: false,
      translation: {
        t: key =>
          key === 'com.labre.icon-picker.tab.emoji' ? 'Émoji' : undefined,
      },
    });
    const picker = await openedPicker();
    const tabs = [
      ...picker.shadowRoot!.querySelectorAll<HTMLElement>('[data-tab]'),
    ].map(tab => tab.textContent!.trim());
    expect(tabs).toEqual(['Émoji', 'Icons']);

    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    await result;
  });
});
