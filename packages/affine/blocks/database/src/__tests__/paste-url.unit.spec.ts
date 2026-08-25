import { describe, expect, it, vi } from 'vitest';

import {
  analyzeTextForUrlPaste,
  insertUrlTextSegments,
  splitTextByUrl,
} from '../properties/paste-url.js';

describe('splitTextByUrl', () => {
  it('leaves plain prose as one segment', () => {
    expect(splitTextByUrl('just some words')).toEqual([
      { text: 'just some words' },
    ]);
  });

  it('linkifies only the address inside a sentence', () => {
    expect(splitTextByUrl('see https://example.com now')).toEqual([
      { text: 'see ' },
      { text: 'https://example.com', link: 'https://example.com' },
      { text: ' now' },
    ]);
  });

  it('keeps a label glued to its url as text', () => {
    expect(splitTextByUrl('docs:https://example.com')).toEqual([
      { text: 'docs:' },
      { text: 'https://example.com', link: 'https://example.com' },
    ]);
  });

  it('excludes trailing punctuation from the link', () => {
    expect(splitTextByUrl('(https://example.com).')).toEqual([
      { text: '(' },
      { text: 'https://example.com', link: 'https://example.com' },
      { text: ').' },
    ]);
  });

  it('returns nothing for an empty paste', () => {
    expect(splitTextByUrl('')).toEqual([]);
  });
});

describe('analyzeTextForUrlPaste', () => {
  it('reports a single url when the paste is nothing else', () => {
    const { singleUrl } = analyzeTextForUrlPaste('https://example.com');
    expect(singleUrl).toBe('https://example.com');
  });

  it('reports no single url when the paste carries prose too', () => {
    const { singleUrl, segments } = analyzeTextForUrlPaste(
      'read https://example.com'
    );
    expect(singleUrl).toBeUndefined();
    expect(segments).toHaveLength(2);
  });
});

describe('insertUrlTextSegments', () => {
  it('replaces the selection once and links only the url segment', () => {
    const inlineEditor = {
      insertText: vi.fn(),
      setInlineRange: vi.fn(),
    };

    insertUrlTextSegments(
      inlineEditor,
      { index: 3, length: 4 },
      [
        { text: 'see ' },
        { text: 'https://example.com', link: 'https://example.com' },
      ]
    );

    expect(inlineEditor.insertText).toHaveBeenNthCalledWith(
      1,
      { index: 3, length: 4 },
      'see ',
      undefined
    );
    expect(inlineEditor.insertText).toHaveBeenNthCalledWith(
      2,
      { index: 7, length: 0 },
      'https://example.com',
      { link: 'https://example.com' }
    );
    expect(inlineEditor.setInlineRange).toHaveBeenCalledWith({
      index: 26,
      length: 0,
    });
  });
});
