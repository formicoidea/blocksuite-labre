/**
 * One filename rule, five names for it: a parity table.
 *
 * Every export that writes a file names it through a sanitiser: the generic
 * board SVG export through `safeFilename` (`@labre/affine-shared/utils`), and
 * the four framework interchanges through their own exported one —
 * `wardleySafeFilename` (`map`), `c4SafeFilename` (`diagram`),
 * `bpmnSafeFilename` (`process`) and `umlSafeFilename` (its format's word).
 * They were written as four verbatim copies of the shared rule, then made to
 * call it; this table is what allowed that, and what keeps it true: a
 * framework that needs another rule must break a row here, on purpose,
 * because what a user's downloaded file is called is visible behaviour.
 *
 * The rows are the cases the rule exists for — reserved characters, runs of
 * whitespace, the 120-character cap and the Windows tail of dots and spaces
 * trimmed AFTER it — plus the ones a hostile or careless name brings: nothing
 * at all, only reserved characters, unicode, Windows device names and the
 * prototype keys.
 */
import { bpmnSafeFilename } from '@labre/affine-gfx-bpmn';
import { c4SafeFilename } from '@labre/affine-gfx-c4';
import { umlSafeFilename } from '@labre/affine-gfx-uml';
import { wardleySafeFilename } from '@labre/affine-gfx-wardley';
import { safeFilename } from '@labre/affine-shared/utils';
import { describe, expect, test } from 'vitest';

const INPUTS: readonly (string | undefined)[] = [
  undefined,
  '',
  '   ',
  'Order to cash',
  '  spaced    out  ',
  'tab\tnew\nline',
  'a/b\\c:d*e?f"g<h>i|j',
  '/\\:*?"<>|',
  'Order to cash.',
  'Order to cash. . ',
  '...',
  '. .',
  '.hidden',
  'v1.2.final',
  'café — carte des flux 地図 🗺️',
  'x'.repeat(200),
  `${'y'.repeat(119)}.z`,
  `${'w'.repeat(118)} .tail`,
  'CON',
  'nul',
  'COM1.txt',
  '__proto__',
  'constructor',
];

const FRAMEWORKS: readonly [
  string,
  (raw: string | undefined) => string,
  string,
][] = [
  ['wardleySafeFilename', wardleySafeFilename, 'map'],
  ['c4SafeFilename', c4SafeFilename, 'diagram'],
  ['bpmnSafeFilename', bpmnSafeFilename, 'process'],
  ['umlSafeFilename', raw => umlSafeFilename(raw), 'diagram'],
  [
    'umlSafeFilename, a format word',
    raw => umlSafeFilename(raw, 'model'),
    'model',
  ],
];

describe('every framework names a file as safeFilename does', () => {
  test.each(FRAMEWORKS)('%s', (_, sanitise, fallback) => {
    for (const raw of INPUTS) {
      expect(sanitise(raw), JSON.stringify(raw)).toBe(
        safeFilename(raw, fallback)
      );
    }
  });

  test('the table reaches every branch of the rule', () => {
    const out = INPUTS.map(raw => safeFilename(raw, 'fallback'));
    expect(out).toContain('fallback');
    expect(out).toContain('a-b-c-d-e-f-g-h-i-j');
    expect(out).toContain('Order to cash');
    expect(out).toContain('spaced out');
    expect(Math.max(...out.map(name => name.length))).toBe(120);
    expect(out.every(name => !/[. ]$/.test(name))).toBe(true);
  });
});
