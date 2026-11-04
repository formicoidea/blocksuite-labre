/**
 * An attachment file never runs on the app's origin, on a real editor. The unit
 * side is `blocks/attachment/src/__tests__/blob-type.unit.spec.ts`.
 *
 * What it would have caught: the file running with the reader's tokens, without
 * a click, once a collaborator writes `type: 'text/html'`, then
 * `type: 'application/pdf'` and `embed: true`. The pdf frame has no sandbox and
 * `credentialless` is no lock: the frame read `window.parent.localStorage` in
 * Chromium, and Firefox and WebKit ignore the attribute.
 */
import type { AttachmentBlockModel } from '@labre/affine/model';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { wait } from '../utils/common.js';
import { addNote } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

const MARK = 'labre-attachment-ran';
const FILE = `<!doctype html><script>window.parent.postMessage('${MARK}', '*');</script>`;
/** Long enough for a loaded frame to post its message. */
const FRAME_RUN_MS = 500;

type AttachmentElement = HTMLElement & { blobUrl: string | null };

async function add(type: string) {
  const doc = window.doc;
  const sourceId = await doc.blobSync.set(new Blob([FILE]));
  const id = doc.addBlock(
    'affine:attachment',
    { name: 'report.html', size: FILE.length, type, sourceId },
    addNote(doc)
  );
  const { element, blobUrl } = await vi.waitFor(() => {
    const element = document.querySelector<AttachmentElement>(
      `[data-block-id="${id}"]`
    );
    if (!element?.blobUrl) throw new Error('no blob url yet');
    return { element, blobUrl: element.blobUrl };
  });
  return { id, element, blobUrl };
}

describe('an attachment file and the origin of the app', () => {
  let ran = 0;
  const count = (event: MessageEvent) => {
    if (event.data === MARK) ran++;
  };
  beforeEach(async () => {
    const cleanup = await setupEditor('page');
    ran = 0;
    window.addEventListener('message', count);
    return () => {
      window.removeEventListener('message', count);
      cleanup();
    };
  });

  test.each(['text/html', 'image/svg+xml', 'application/xml'])(
    'a url for %s carries no type the browser would run',
    async type => {
      const { blobUrl } = await add(type);
      const blob = await (await fetch(blobUrl)).blob();
      expect(blob.type).toBe('application/octet-stream');
    }
  );

  test('a late write of pdf and embed does not run the file', async () => {
    const { id, element } = await add('text/html');
    const model = window.doc.getBlock(id)?.model as AttachmentBlockModel;

    window.doc.updateBlock(model, {
      type: 'application/pdf',
      style: 'pdf',
      embed: true,
    });

    // The frame must exist, or this test would pass for the wrong reason.
    const frame = await vi.waitFor(() => {
      const frame = element.querySelector('iframe');
      if (!frame) throw new Error('no frame yet');
      return frame;
    });
    expect(frame.src.startsWith('blob:')).toBe(true);
    await wait(FRAME_RUN_MS);
    expect(ran).toBe(0);
  });
});
