import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Clipboard } from '../clipboard/clipboard.js';

/**
 * `writeToClipboard` / `readFromClipboard` are the two ends of the
 * cross-document copy/paste pipe. Neither touches `std`, so a bare instance is
 * enough to exercise the round trip in a real browser (DataTransfer, DOMParser
 * and DOMPurify are the real ones here).
 */
const createClipboard = () => new Clipboard({} as never);

/** Captures what would have been handed over to the system clipboard. */
const stubSystemClipboard = () => {
  const written: Record<string, Blob> = {};
  vi.spyOn(navigator.clipboard, 'write').mockImplementation(
    async (items: ClipboardItem[]) => {
      for (const item of items) {
        for (const type of item.types) {
          written[type] = await item.getType(type);
        }
      }
    }
  );
  return written;
};

/** Rebuilds the DataTransfer a paste event would carry in another document. */
const asPastedData = async (written: Record<string, Blob>) => {
  const data = new DataTransfer();
  for (const [type, blob] of Object.entries(written)) {
    if (type === 'text/plain' || type === 'text/html') {
      data.setData(type, await blob.text());
    }
  }
  return data;
};

describe('clipboard snapshot round trip', () => {
  let clipboard: Clipboard;

  beforeEach(() => {
    clipboard = createClipboard();
  });

  it('writes the snapshot when an adapter only produced plain text', async () => {
    const written = stubSystemClipboard();
    const payload = JSON.stringify({ rows: [{ title: 'a' }] });

    await clipboard.writeToClipboard(items => ({
      ...items,
      'text/plain': 'a\tb',
      'blocksuite/database/table': payload,
    }));

    expect(written['text/html']).toBeDefined();
    const json = clipboard.readFromClipboard(await asPastedData(written));
    expect(json['blocksuite/database/table']).toBe(payload);
  });

  it('keeps the plain text readable for external targets', async () => {
    const written = stubSystemClipboard();

    await clipboard.writeToClipboard(items => ({
      ...items,
      'text/plain': 'a < b & c',
      'blocksuite/database/table': '{}',
    }));

    expect(await written['text/plain']?.text()).toBe('a < b & c');
    expect(await written['text/html']?.text()).toContain('a &lt; b &amp; c');
  });

  it('preserves unknown element properties across documents', async () => {
    const written = stubSystemClipboard();
    // Labre adds properties the upstream schema knows nothing about: the
    // semantic role of a surface element and the element docId of ADR 0005.
    const surface = JSON.stringify({
      elements: [
        {
          type: 'shape',
          xywh: '[0,0,100,100]',
          role: 'capability',
          docId: 'doc-42',
        },
      ],
    });

    await clipboard.writeToClipboard(items => ({
      ...items,
      'blocksuite/surface': surface,
    }));

    const json = clipboard.readFromClipboard(await asPastedData(written));
    expect(JSON.parse(json['blocksuite/surface'])).toEqual({
      elements: [
        {
          type: 'shape',
          xywh: '[0,0,100,100]',
          role: 'capability',
          docId: 'doc-42',
        },
      ],
    });
  });

  it('survives the re-serialization the system clipboard performs', async () => {
    const written = stubSystemClipboard();
    const payload = JSON.stringify({ role: 'capability' });

    await clipboard.writeToClipboard(items => ({
      ...items,
      'text/html': '<p>hello</p>',
      'BLOCKSUITE/SNAPSHOT': payload,
    }));

    const html = await written['text/html']!.text();
    // The system clipboard hands the markup back re-parsed and re-serialized.
    const reserialized = new DOMParser().parseFromString(html, 'text/html').body
      .innerHTML;
    const data = new DataTransfer();
    data.setData('text/html', reserialized);

    expect(clipboard.readFromClipboard(data)['BLOCKSUITE/SNAPSHOT']).toBe(
      payload
    );
  });

  it('does not add an html flavour when there is nothing to preserve', async () => {
    const written = stubSystemClipboard();

    await clipboard.writeToClipboard(items => ({
      ...items,
      'text/plain': 'console.log(1)',
    }));

    expect(written['text/html']).toBeUndefined();
    expect(await written['text/plain']?.text()).toBe('console.log(1)');
  });
});
