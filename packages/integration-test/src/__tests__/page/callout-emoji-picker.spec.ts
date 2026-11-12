/**
 * **A callout's icon opens the library's one emoji picker, and the emoji
 * picked there is written where it always was** (issue 636 follow-up).
 *
 * The callout had an emoji menu of its own (`affine-emoji-menu`, emoji-mart)
 * while hosts got `affine-icon-picker`; the PO kept the callout's emoji-mart
 * picker and made it the Emoji tab of `affine-icon-picker`, which the callout
 * now opens. A callout stores an emoji and nothing else (`props.emoji`, a
 * string), so it opens the picker on the Emoji tab alone, with no Remove.
 *
 * What it would have caught:
 * - the callout still opening a menu of its own, or the unified picker
 *   offering it an Icons tab or a Remove it has no field for;
 * - a picked emoji written anywhere but `props.emoji`, or written as
 *   something other than the native character;
 * - the opening reaching for the network (emoji-mart's CDN default).
 */
import type { AffineIconPicker } from '@labre/affine/components/icon-picker';
import type { CalloutBlockModel } from '@labre/affine/model';
import { Text } from '@labre/store';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { wait } from '../utils/common.js';
import { addNote } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

const POLL_MS = 25;
const POLL_TRIES = 80;
const SETTLE_MS = 100;

async function until<T>(
  probe: () => T | null | undefined,
  what: string,
  tries = POLL_TRIES
): Promise<T> {
  const found = probe();
  if (found) return found;
  if (tries === 0) throw new Error(`never found ${what}`);
  await wait(POLL_MS);
  return until(probe, what, tries - 1);
}

describe("a callout's emoji", () => {
  let calloutId!: string;
  let cleanup!: () => void;

  beforeEach(async () => {
    cleanup = await setupEditor('page');
    const doc = window.doc;
    const noteId = addNote(doc);
    calloutId = doc.addBlock('affine:callout', {}, noteId);
    doc.addBlock('affine:paragraph', { text: new Text('note') }, calloutId);
    await wait(SETTLE_MS);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // The popup closes on a click away; the next spec shares this page.
    document.body.click();
    cleanup();
  });

  const callout = () =>
    window.doc.getBlock(calloutId)!.model as CalloutBlockModel;

  const openedPicker = async () => {
    const icon = await until(
      () =>
        window.editor.host?.querySelector<HTMLElement>(
          `affine-callout[data-block-id="${calloutId}"] .affine-callout-emoji-container`
        ),
      'the callout icon'
    );
    icon.click();
    return until(
      () =>
        [...window.editor.host!.querySelectorAll('.blocksuite-portal')]
          .map(portal =>
            portal.shadowRoot?.querySelector<AffineIconPicker>(
              'affine-icon-picker'
            )
          )
          .find(Boolean),
      'the icon picker'
    );
  };

  test('opens the unified picker on its Emoji tab alone, offline', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const picker = await openedPicker();
    await picker.updateComplete;
    const panel = picker.shadowRoot?.querySelector('affine-emoji-picker-panel');
    await until(
      () =>
        panel?.shadowRoot
          ?.querySelector('em-emoji-picker')
          ?.shadowRoot?.querySelector('.category button[aria-label]'),
      "emoji-mart's grid"
    );

    expect(window.editor.host!.querySelector('affine-emoji-menu')).toBeNull();
    expect(picker.shadowRoot?.querySelector('[data-tab]')).toBeNull();
    expect(
      picker.shadowRoot?.querySelector('[data-testid="icon-picker-remove"]')
    ).toBeNull();
    expect(picker.shadowRoot?.querySelector('affine-icon-picker-panel')).toBe(
      null
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('a picked emoji is written to props.emoji as its native character', async () => {
    expect(callout().props.emoji).toBe('😀');

    const picker = await openedPicker();
    const button = await until(
      () =>
        [
          ...(picker.shadowRoot
            ?.querySelector('affine-emoji-picker-panel')
            ?.shadowRoot?.querySelector('em-emoji-picker')
            ?.shadowRoot?.querySelectorAll<HTMLElement>(
              '.category button[aria-label]'
            ) ?? []),
        ].find(candidate => candidate.getAttribute('aria-label') !== '😀'),
      'an emoji other than the current one'
    );
    const picked = button.getAttribute('aria-label');
    button.click();

    await until(
      () => callout().props.emoji === picked,
      'the picked emoji in the model'
    );
    expect(callout().props.emoji).toBe(picked);
  });
});
