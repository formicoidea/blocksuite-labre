import { readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, test } from 'vitest';

import { ROOT, sourceFiles } from './translations/source-files.js';

/**
 * No `/** *\/` comment on a property of a zod `z.object({...})` literal
 * anywhere in `affine/shared` or `affine/model` (docs/lessons.md 32).
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
 * The collision happened in `editor-setting-service.ts`, but any zod literal
 * whose inferred type is re-emitted in another declaration can hit it, and
 * which offsets collide depends on line endings and on what the other package
 * emitted. So the scan covers the two packages that define zod schemas and
 * re-emit each other's (`shared` and `model`, tests excluded), and reports
 * every offender as `file:line`.
 */

const SCANNED = ['packages/affine/shared/src', 'packages/affine/model/src'];

/** Every `z.object({...})` literal of `source`, braces balanced, with its offset. */
function zodObjectLiterals(source: string): { start: number; text: string }[] {
  const literals: { start: number; text: string }[] = [];
  const opening = /\bz\s*\.\s*object\s*\(\s*\{/g;
  for (let match; (match = opening.exec(source)); ) {
    let i = match.index + match[0].length;
    for (let depth = 1; i < source.length && depth > 0; i++) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') depth--;
    }
    literals.push({ start: match.index, text: source.slice(match.index, i) });
  }
  return literals;
}

function lineOf(source: string, offset: number): number {
  return source.slice(0, offset).split('\n').length;
}

describe('zod schema literals', () => {
  test('no property of a z.object literal carries a JSDoc block comment', () => {
    let schemas = 0;
    // A nested literal is found twice (alone and inside its parent): a set.
    const offenders = new Set<string>();

    for (const dir of SCANNED) {
      for (const path of sourceFiles(join(ROOT, dir))) {
        const source = readFileSync(path, 'utf8');
        const file = relative(ROOT, path).split(sep).join('/');
        for (const { start, text } of zodObjectLiterals(source)) {
          schemas++;
          for (
            let at = text.indexOf('/**');
            at !== -1;
            at = text.indexOf('/**', at + 3)
          ) {
            offenders.add(`${file}:${lineOf(source, start + at)}`);
          }
        }
      }
    }

    expect(schemas, 'the scan finds at least one schema').toBeGreaterThan(0);
    expect(
      [...offenders].sort(),
      'use `//` line comments inside a zod schema literal (lessons 32)'
    ).toEqual([]);
  });
});
