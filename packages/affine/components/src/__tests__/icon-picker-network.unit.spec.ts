/**
 * Opening the emoji picker makes no network request.
 *
 * The Emoji tab is emoji-mart's picker. Left to its defaults, emoji-mart
 * downloads its emoji dataset, and every locale but English, from
 * `cdn.jsdelivr.net`: a third-party request the library may not make on its
 * own (CLAUDE.md, "a default network endpoint owned by a third party"), and
 * one a host promising no third-party request could not even see coming. The
 * panel therefore always hands it `data` and `i18n`.
 *
 * What it would have caught: the panel built without `data` (the dataset
 * fetched on first opening), or without `i18n` while a `locale` is set (the
 * locale file fetched). The last test shows the spy does see emoji-mart's
 * fetch when it is let loose, so the empty spies above it mean something.
 */
import type { TranslationService } from '@labre/affine-shared/services';
import emojiMartData from '@emoji-mart/data';
import { init } from 'emoji-mart';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import * as entry from '../icon-picker/index.js';

const POLL_MS = 25;
const POLL_TRIES = 40;

beforeAll(() => {
  entry.effects();
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

const tick = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function until<T>(
  probe: () => T | null | undefined,
  tries = POLL_TRIES
): Promise<T> {
  const found = probe();
  if (found) return found;
  if (tries === 0) throw new Error('emoji-mart drew no emoji');
  await tick(POLL_MS);
  return until(probe, tries - 1);
}

/** Waits until emoji-mart has drawn its grid somewhere in the page. */
function drawnEmojiMart() {
  return until(() => {
    const portal = document.querySelector('.blocksuite-portal');
    const host = portal?.shadowRoot ?? document;
    return host
      .querySelector('affine-icon-picker')
      ?.shadowRoot?.querySelector('affine-emoji-picker-panel')
      ?.shadowRoot?.querySelector('em-emoji-picker')
      ?.shadowRoot?.querySelector('.category button[aria-label]');
  });
}

function spyOnNetwork() {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async () => new Response('{}'));
}

async function openAndCancel(
  anchor: Element,
  translation: TranslationService | undefined
) {
  const result = entry.openIconPicker(anchor, {
    activeTab: 'emoji',
    rememberRecent: false,
    translation,
  });
  await drawnEmojiMart();
  document.body.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
  );
  return result;
}

describe('the emoji picker opens offline', () => {
  test('openIconPicker on the Emoji tab, in English and with a catalogue', async () => {
    const fetchSpy = spyOnNetwork();
    const anchor = document.createElement('button');
    document.body.append(anchor);

    await openAndCancel(anchor, undefined);
    await openAndCancel(anchor, {
      t: key => (key.endsWith('.foods') ? 'Nourriture' : undefined),
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("the callout's one-tab picker", async () => {
    const fetchSpy = spyOnNetwork();
    const picker = Object.assign(document.createElement('affine-icon-picker'), {
      tabs: ['emoji'] as const,
      showRemove: false,
      rememberRecent: false,
    });
    document.body.append(picker);
    await picker.updateComplete;

    await drawnEmojiMart();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('emoji-mart left to its defaults does fetch: the spy can see it', async () => {
    const fetchSpy = spyOnNetwork();

    await init({ data: emojiMartData, locale: 'fr' });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('cdn.jsdelivr.net')
    );
  });
});
