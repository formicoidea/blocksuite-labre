/**
 * A `blob:` url has the origin of the app, the origin of the reader's tokens,
 * and an attachment's `type` is a prop any collaborator writes. Measured in
 * Chromium, Firefox and WebKit before this guard: a collaborator wrote
 * `type: 'text/html'`, then `type: 'application/pdf'` and `embed: true`; the
 * pdf frame, which has no sandbox, loaded the url made for the first type and
 * ran the file on the app's origin, with no click from the reader.
 *
 * What it would have caught:
 * - a url whose type comes from the prop rather than from a list of what is
 *   inert, and an empty type falling through to the blob's own;
 * - `open()` navigating to a file the browser would run, instead of handing
 *   it over.
 *
 * The real browser path is `integration-test/.../attachment-blob-type.spec.ts`.
 */
import { signal } from '@preact/signals-core';
import { beforeAll, describe, expect, test, vi } from 'vitest';

import { AttachmentBlockComponent } from '../attachment-block.js';
import { attachmentBlobType, NEUTRAL_BLOB_TYPE } from '../blob-type.js';
import { refreshData } from '../utils.js';

describe('the type of an attachment url', () => {
  test.each([
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'video/mp4',
    'video/x-matroska',
    'audio/mpeg',
  ])('%s stays, so its preview keeps working', type => {
    expect(attachmentBlobType(type)).toBe(type);
  });

  test.each([
    'text/html',
    'TEXT/HTML',
    ' text/html ',
    'text/html;charset=utf-8',
    'image/svg+xml',
    'IMAGE/SVG+XML; charset=utf-8',
    'application/xhtml+xml',
    'application/xml',
    'text/xml',
    'video/x+xml',
    'audio/x+xml',
    'image/x+xml',
    'video/mp4, text/html',
    'application/pdf+xml',
    'multipart/x-mixed-replace',
    'application/octet-stream',
    'text/plain',
    '',
  ])('%j becomes neutral', type => {
    expect(attachmentBlobType(type)).toBe(NEUTRAL_BLOB_TYPE);
  });

  test('an absent type becomes neutral: a falsy one would keep the blob type', () => {
    expect(attachmentBlobType(undefined)).toBe(NEUTRAL_BLOB_TYPE);
    expect(attachmentBlobType(null)).toBe(NEUTRAL_BLOB_TYPE);
  });

  test('parameters do not survive', () => {
    expect(attachmentBlobType('video/mp4; codecs="avc1"')).toBe('video/mp4');
  });

  test('the resource url is made with the safe type, never the declared one', async () => {
    const refreshUrlWith = vi.fn(async () => {});
    await refreshData({
      model: { props: { type$: { peek: () => 'text/html' } } },
      resourceController: { refreshUrlWith },
    } as unknown as AttachmentBlockComponent);
    expect(refreshUrlWith).toHaveBeenCalledWith(NEUTRAL_BLOB_TYPE);
  });
});

describe('opening an attachment', () => {
  beforeAll(() => {
    customElements.define('test-attachment-open', AttachmentBlockComponent);
  });

  function mount(type: string) {
    const block = new AttachmentBlockComponent();
    Object.defineProperty(block, 'model', { value: { props: { type } } });
    Object.defineProperty(block, 'resourceController', {
      value: { blobUrl$: signal('blob:test') },
    });
    const download = vi.fn();
    Object.defineProperty(block, 'download', { value: download });
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    open.mockClear();
    block.open();
    return { download, open };
  }

  test.each(['text/html', 'image/svg+xml', 'application/xml', ''])(
    '%j is handed over, never opened',
    type => {
      const { download, open } = mount(type);
      expect(open).not.toHaveBeenCalled();
      expect(download).toHaveBeenCalledOnce();
    }
  );

  test('a pdf opens, cut from this page', () => {
    const { download, open } = mount('application/pdf');
    expect(download).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith('blob:test', '_blank', 'noopener');
  });
});
