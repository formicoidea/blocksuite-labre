import { describe, expect, it } from 'vitest';

import { Clipboard } from '../clipboard/clipboard.js';
import type {
  ClipboardAdapterConfig,
  ClipboardItemReader,
} from '../clipboard/clipboard-adapter.js';

/**
 * `ClipboardAdapterConfig.defer` lets an adapter step aside for one paste so
 * the next one by priority reads it (labre P4-11). The paste takes the first
 * adapter that returns a slice, and an adapter sees only its own flavour, so
 * without this seam a flat `text/html` copy of a Markdown table always beat
 * the `text/plain` one and pasted paragraphs of pipes.
 *
 * Would have caught: the loop ignoring `defer` (the HTML adapter still
 * winning), `defer` reading only its own flavour, or an adapter without
 * `defer` being skipped.
 */
const HTML_PRIORITY = 90;
const PLAIN_PRIORITY = 70;

const adapterReturning = (name: string) =>
  class {
    toSlice() {
      return Promise.resolve(name);
    }
  } as unknown as ClipboardAdapterConfig['adapter'];

const htmlConfig = (
  defer?: ClipboardAdapterConfig['defer']
): ClipboardAdapterConfig => ({
  mimeType: 'text/html',
  priority: HTML_PRIORITY,
  adapter: adapterReturning('html'),
  defer,
});

const plainConfig: ClipboardAdapterConfig = {
  mimeType: 'text/plain',
  priority: PLAIN_PRIORITY,
  adapter: adapterReturning('plain'),
};

const clipboardWith = (configs: ClipboardAdapterConfig[]) =>
  new Clipboard({
    provider: { getAll: () => new Map(configs.map(c => [c.mimeType, c])) },
    store: { getTransformer: () => ({}), provider: {} },
  } as never);

const pasteEvent = () => {
  const data = new DataTransfer();
  data.setData('text/html', '<div>html</div>');
  data.setData('text/plain', 'plain');
  return new ClipboardEvent('paste', { clipboardData: data });
};

const doc = { id: 'doc', workspace: { id: 'ws' } } as never;

describe('clipboard adapter defer', () => {
  it('without defer, the higher priority reads the paste', async () => {
    const clipboard = clipboardWith([htmlConfig(), plainConfig]);
    expect(await clipboard.paste(pasteEvent(), doc)).toBe('html');
  });

  it('a deferring adapter hands the paste to the next one', async () => {
    const seen: string[] = [];
    const defer = (read: ClipboardItemReader) => {
      seen.push(String(read('text/plain')));
      return true;
    };
    const clipboard = clipboardWith([htmlConfig(defer), plainConfig]);
    expect(await clipboard.paste(pasteEvent(), doc)).toBe('plain');
    expect(seen, 'defer reads the other flavours').toEqual(['plain']);
  });

  it('a defer that declines keeps the priority order', async () => {
    const clipboard = clipboardWith([htmlConfig(() => false), plainConfig]);
    expect(await clipboard.paste(pasteEvent(), doc)).toBe('html');
  });
});
