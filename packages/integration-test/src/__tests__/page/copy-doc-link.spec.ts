import type { RichText } from '@labre/affine-rich-text';
import {
  GenerateDocUrlExtension,
  NotificationExtension,
} from '@labre/affine/shared/services';
import { IS_MAC } from '@labre/global/env';
import { BlockSelection, TextSelection } from '@labre/std';
import { Text } from '@labre/store';
import { userEvent } from '@vitest/browser/context';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { addNote } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * `Ctrl/Cmd+Alt+L` copies the current document's link — the half of the round
 * trip a unit test cannot reach.
 *
 * What is under test here is the DISPATCH, not the body: that a real keystroke
 * delivered to a focused page editor reaches the registered command through
 * `ShortcutKeymapExtension('global')` and the `toShortcutDescriptor`
 * projection. The chord is `Mod-Alt-l` precisely because `Mod-l` is the
 * browser's address bar and is never delivered to the page at all, so "does
 * the key arrive?" is the question with teeth.
 *
 * The clipboard is observed through a stub rather than read back: a headless
 * Chromium grants no clipboard permission by default, `writeText` rejects, and
 * the command (rightly) swallows that with `console.error` — so a real read
 * would test the harness's permissions, not the feature. The stub sits at the
 * exact boundary the command calls.
 */

declare global {
  interface Window {
    __copiedLinks?: string[];
  }
}

const HOST_ORIGIN = 'https://labre.cc';

/** `Mod` resolves per platform, and so must the keystroke driving it. */
const CHORD = IS_MAC
  ? '{Meta>}{Alt>}l{/Alt}{/Meta}'
  : '{Control>}{Alt>}l{/Alt}{/Control}';

/** A host that routes `doc:home` and honours `ReferenceParams`. */
const hostUrls = GenerateDocUrlExtension({
  generateDocUrl: (docId, params) => {
    const url = new URL(`${HOST_ORIGIN}/doc/${encodeURIComponent(docId)}`);
    for (const [key, value] of Object.entries(params ?? {})) {
      url.searchParams.set(
        key,
        Array.isArray(value) ? value.join(',') : String(value)
      );
    }
    return url.toString();
  },
});

const toasts: string[] = [];
const hostNotifications = NotificationExtension({
  toast: message => {
    toasts.push(message);
  },
  confirm: () => Promise.resolve(true),
  prompt: () => Promise.resolve(null),
  notify: () => {},
});

/**
 * The descriptor to put back afterwards, or `undefined` when `navigator` had
 * no OWN `clipboard` property — which is the normal case, since it lives on
 * `Navigator.prototype`. Restoring only "if there was one" would therefore
 * leave the stub in place for every spec file that runs after this one:
 * `isolate: false` gives this whole package ONE browser page.
 */
let realClipboard: PropertyDescriptor | undefined;
let stubbedClipboard = false;

describe('copy document link', () => {
  let paragraphId!: string;

  beforeEach(async () => {
    const cleanup = await setupEditor('page', [hostUrls, hostNotifications]);

    toasts.length = 0;
    window.__copiedLinks = [];
    realClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    stubbedClipboard = true;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (text: string) => {
          window.__copiedLinks?.push(text);
          return Promise.resolve();
        },
      },
    });

    const doc = window.doc;
    const noteId = addNote(doc);
    paragraphId = doc.addBlock(
      'affine:paragraph',
      { text: new Text('la carte') },
      noteId
    );
    await wait(100);

    const richText = window.editor.host!.querySelector<RichText>(
      `[data-block-id="${paragraphId}"] rich-text`
    );
    if (!richText) throw new Error('the paragraph rich text is missing');
    await userEvent.click(richText);
    const std = window.editor.std;
    std.selection.setGroup('note', [
      std.selection.create(TextSelection, {
        from: { blockId: paragraphId, index: 0, length: 0 },
        to: null,
      }),
    ]);
    await wait();

    return cleanup;
  });

  afterEach(() => {
    if (!stubbedClipboard) return;
    stubbedClipboard = false;
    if (realClipboard) {
      Object.defineProperty(navigator, 'clipboard', realClipboard);
    } else {
      // No own property to put back: deleting the stub uncovers the real
      // accessor on `Navigator.prototype` again.
      delete (navigator as { clipboard?: unknown }).clipboard;
    }
  });

  test('the chord fires with the caret inside the editor', async () => {
    await userEvent.keyboard(CHORD);
    await wait();

    expect(window.__copiedLinks).toHaveLength(1);
    expect(window.__copiedLinks![0]).toContain(`${HOST_ORIGIN}/doc/`);
    expect(window.__copiedLinks![0]).toContain('mode=page');
    // A caret is not an anchor: an unsolicited keystroke must copy the
    // DOCUMENT, not whichever paragraph happened to be under the cursor.
    expect(window.__copiedLinks![0]).not.toContain('blockIds');
    expect(toasts).toEqual(['Link copied']);
  });

  test('a selected block anchors the link on it', async () => {
    const std = window.editor.std;
    std.selection.setGroup('note', [
      std.selection.create(BlockSelection, { blockId: paragraphId }),
    ]);
    await wait();

    await userEvent.keyboard(CHORD);
    await wait();

    expect(window.__copiedLinks).toHaveLength(1);
    expect(window.__copiedLinks![0]).toContain(
      `blockIds=${encodeURIComponent(paragraphId)}`
    );
  });
});
