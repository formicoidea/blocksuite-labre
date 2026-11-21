import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'vitest';

import { allSourceFiles, toRepoRelative } from './translations/source-files.js';

/**
 * #679, third review: the discrete `affine-slider` became an ARIA slider and a
 * Tab stop everywhere it is drawn, and the note's corner radius drew one with
 * no name — "slider, 8" to a screen reader, of nothing (WCAG 4.1.2).
 *
 * Every `<affine-slider` the library renders passes `.label` (a translated
 * wording): this would have caught that one, and catches the next.
 */
describe('every affine-slider is named', () => {
  test('each <affine-slider ...> tag binds .label', () => {
    const unnamed = allSourceFiles().flatMap(file => {
      const source = readFileSync(file, 'utf8');
      // A whole element, to its closing tag: a binding's arrow function
      // (`@select=${(e) => ...}`) holds a `>`.
      const tags =
        source.match(/<affine-slider\b[\s\S]*?<\/affine-slider>/g) ?? [];
      return tags
        .filter(tag => !/\s\.label=/.test(tag))
        .map(() => toRepoRelative(file));
    });
    expect(unnamed).toEqual([]);
  });
});
