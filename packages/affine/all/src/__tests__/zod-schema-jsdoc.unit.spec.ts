import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import { ROOT } from './translations/source-files.js';

/**
 * No `/** *\/` comment on a property of a zod `z.object({...})` literal in
 * `editor-setting-service.ts` (docs/lessons.md 32).
 *
 * **This spec would have caught** the build that broke with about 35,000
 * TS1005 / TS1139 errors in a GENERATED file,
 * `packages/affine/shared/dist/services/editor-setting-service.d.ts`, while
 * every source file was valid. `GeneralSettingSchema` merges
 * `NodePropsSchema`, so its declaration re-emits the `affine:edgeless-text`
 * schema's `color: z.ZodUnion<[...]>` by reusing that type node from
 * `affine/model`'s own `.d.ts`. TypeScript 5.8 then looks up the reused
 * node's leading comments by ITS offset in the CURRENT file's text: in a CRLF
 * checkout, offset 472 of this file is the blank before the JSDoc on
 * `edgelessShowGrid`, and the comment was printed between `z.ZodUnion` and
 * its `<`. LF checkouts (CI) shift every offset by one byte per line and
 * never collided, which is why it reproduced on one machine and not another.
 * A line comment is not re-emitted into a declaration, so it cannot be
 * spliced; the words survive as `//` lines.
 *
 * Scoped to this one file on purpose: it is where the collision happened.
 * Other zod literals that carry a JSDoc property comment are listed in
 * lesson 32, not rewritten in passing.
 */

const FILE = 'packages/affine/shared/src/services/editor-setting-service.ts';

/** Every `z.object({...})` literal of `source`, braces balanced. */
function zodObjectLiterals(source: string): string[] {
  const literals: string[] = [];
  const opening = /\bz\s*\.\s*object\s*\(\s*\{/g;
  for (let match; (match = opening.exec(source)); ) {
    let i = match.index + match[0].length;
    for (let depth = 1; i < source.length && depth > 0; i++) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') depth--;
    }
    literals.push(source.slice(match.index, i));
  }
  return literals;
}

describe('editor settings zod schema', () => {
  test('no property of a z.object literal carries a JSDoc block comment', () => {
    const literals = zodObjectLiterals(readFileSync(join(ROOT, FILE), 'utf8'));

    expect(literals.length, 'the scan finds the schema').toBeGreaterThan(0);
    expect(
      literals.filter(literal => literal.includes('/**')),
      'use `//` line comments inside a zod schema literal (lessons 32)'
    ).toEqual([]);
  });
});
