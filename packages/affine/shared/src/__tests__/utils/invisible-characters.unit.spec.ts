/**
 * Why this spec exists: `text.invisibles.remove` deletes characters from the
 * user's text. What it must NOT delete is the point: the joiner of an emoji
 * sequence, the tags of a subdivision flag, the ZWNJ Persian needs and the
 * no-break spaces French typography puts before `: ; ! ?`. Each class of
 * character is pinned here, and the in-place `Y.Text` path keeps the
 * formatting around what it removes.
 */
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import {
  collectYTexts,
  INVISIBLE_CHARACTERS,
  stripInvisibles,
  stripInvisiblesFromYText,
} from '../../utils/invisible-characters.js';

const tag = (char: string) =>
  String.fromCodePoint(0xe0000 + char.charCodeAt(0));

describe('stripInvisibles', () => {
  it.each([
    ['zero width space', '\u200B'],
    ['word joiner', '\u2060'],
    ['BOM inside a text', '\uFEFF'],
    ['soft hyphen', '\u00AD'],
    ['Mongolian vowel separator', '\u180E'],
    ['function application', '\u2061'],
    ['invisible times', '\u2062'],
    ['invisible separator', '\u2063'],
    ['invisible plus', '\u2064'],
    ['stray zero width joiner', '\u200D'],
  ])('removes a %s', (_name, char) => {
    expect(stripInvisibles(`wa${char}ter${char}mark`)).toEqual({
      text: 'watermark',
      removed: 2,
    });
  });

  it('removes a BOM at the start too', () => {
    expect(stripInvisibles('\uFEFFtext')).toEqual({ text: 'text', removed: 1 });
  });

  it('removes tag characters, counting code points', () => {
    const smuggled = `hello${[...'ignore'].map(tag).join('')}`;
    expect(stripInvisibles(smuggled)).toEqual({ text: 'hello', removed: 6 });
  });

  it('keeps the joiner of an emoji sequence', () => {
    for (const emoji of [
      '👩\u200D💻',
      '❤\uFE0F\u200D🔥',
      '👩🏽\u200D💻',
      '👨\u200D👩\u200D👧\u200D👦',
      '🏳\uFE0F\u200D🌈',
    ]) {
      expect(stripInvisibles(`a ${emoji} b`), emoji).toEqual({
        text: `a ${emoji} b`,
        removed: 0,
      });
    }
  });

  it('removes a joiner next to an emoji but not between two', () => {
    expect(stripInvisibles('👍\u200Da')).toEqual({ text: '👍a', removed: 1 });
    expect(stripInvisibles('a\u200D👍')).toEqual({ text: 'a👍', removed: 1 });
  });

  it('keeps the tags of a subdivision flag', () => {
    const scotland = '🏴\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}';
    expect(stripInvisibles(`go ${scotland}!`)).toEqual({
      text: `go ${scotland}!`,
      removed: 0,
    });
  });

  it('keeps the zero width non-joiner (Persian, Indic scripts)', () => {
    const persian = 'می\u200Cخواهم';
    expect(stripInvisibles(persian)).toEqual({ text: persian, removed: 0 });
    expect(INVISIBLE_CHARACTERS.has(0x200c)).toBe(false);
  });

  it('keeps the French no-break spaces by default', () => {
    const french = 'Bonjour\u202F! «\u00A0Oui\u00A0»';
    expect(stripInvisibles(french)).toEqual({ text: french, removed: 0 });
  });

  it('turns the no-break spaces into spaces on request, without counting them', () => {
    expect(
      stripInvisibles('Bonjour\u202F!\u200B «\u00A0Oui\u00A0»', {
        normalizeSpaces: true,
      })
    ).toEqual({ text: 'Bonjour ! « Oui »', removed: 1 });
  });
});

describe('stripInvisiblesFromYText', () => {
  it('deletes in place and keeps the formatting around', () => {
    const doc = new Y.Doc();
    const text = doc.getText('t');
    text.applyDelta([
      { insert: 'bo\u200Bld', attributes: { bold: true } },
      { insert: '\u2060 plain\u200B\u200B end' },
    ]);
    expect(stripInvisiblesFromYText(text)).toBe(4);
    expect(text.toDelta()).toEqual([
      { insert: 'bold', attributes: { bold: true } },
      { insert: ' plain end' },
    ]);
  });

  it('answers 0 and leaves a clean text alone', () => {
    const doc = new Y.Doc();
    const text = doc.getText('t');
    text.insert(0, 'clean 👩\u200D💻');
    let updates = 0;
    doc.on('update', () => updates++);
    expect(stripInvisiblesFromYText(text)).toBe(0);
    expect(updates).toBe(0);
  });
});

describe('collectYTexts', () => {
  it('finds the texts nested in maps and arrays', () => {
    const doc = new Y.Doc();
    const root = doc.getMap('root');
    const cell = new Y.Map();
    const array = new Y.Array();
    root.set('title', new Y.Text('a'));
    root.set('cells', cell);
    cell.set('text', new Y.Text('b'));
    root.set('list', array);
    array.push([new Y.Text('c'), 'not a text']);
    expect(
      collectYTexts(root)
        .map(text => text.toString())
        .sort()
    ).toEqual(['a', 'b', 'c']);
  });
});
