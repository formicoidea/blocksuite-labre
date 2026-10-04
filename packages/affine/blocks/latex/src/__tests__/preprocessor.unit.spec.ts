import { describe, expect, test } from 'vitest';

import { preprocessLatex } from '../adapters/markdown/preprocessor.js';

/**
 * The Markdown preprocessor escapes currency dollars (`$4`) so remark does not
 * read them as math, and must leave real math and deliberate escapes alone
 * (issue #414, upstream AFFiNE #15596, #15602, consolidated in #15622).
 *
 * It used to protect only `$$…$$`, `\[…\]` and `\(…\)`: single-dollar inline
 * math starting with a digit had its opening `$` escaped (the expression
 * stopped being math), and the currency pass ignored what preceded the `$`, so
 * an already-escaped `\$4` became `\\$4` (a literal backslash, then a bare
 * dollar). It runs at block, slice and doc level: paste, slice import and
 * whole-document import all go through it.
 */
describe('preprocessLatex', () => {
  // Rows are named: vitest reads `$…` in a test title as a placeholder.
  test.each([
    {
      name: 'inline math starting with a digit stays math',
      input: '$4\\vee 6=12$',
      expected: '$4\\vee 6=12$',
    },
    {
      name: 'inline math starting with a digit inside a sentence stays math',
      input: 'let $2x+1$ be odd',
      expected: 'let $2x+1$ be odd',
    },
    {
      name: 'an already-escaped dollar is not escaped twice',
      input: 'costs \\$4 today',
      expected: 'costs \\$4 today',
    },
    {
      name: 'a currency dollar is still escaped',
      input: 'costs $4 today',
      expected: 'costs \\$4 today',
    },
    {
      name: 'display math starting with a digit stays math',
      input: '$$4\\vee 6$$',
      expected: '$$4\\vee 6$$',
    },
    {
      // The sentence of the markdown adapter spec (`packages/affine/all`): the
      // first amount is currency, and `$ 8` cannot close a math span.
      name: 'two amounts in one sentence are not read as a math span',
      input:
        'The price of the T-shirt is $9.15 and the price of the hat is $ 8',
      expected:
        'The price of the T-shirt is \\$9.15 and the price of the hat is $ 8',
    },
  ])('$name', ({ input, expected }) => {
    expect(preprocessLatex(input)).toBe(expected);
  });
});
