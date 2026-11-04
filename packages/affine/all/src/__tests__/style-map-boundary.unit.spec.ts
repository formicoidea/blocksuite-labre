import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import {
  ROOT,
  SCAN_DIRS,
  sourceFiles,
  toRepoRelative,
} from './translations/source-files.js';

/**
 * Shipped code takes `styleMap` from `@labre/global/lit`, never from Lit.
 *
 * Whether a value in a style comes from the document cannot be read from the
 * call site: it may be a colour resolved three calls away. So the rule is on the
 * import, for every call. The reason is in the docblock of
 * `framework/global/src/lit/style-map.ts`.
 *
 * **This spec would have caught** a new block importing Lit's directive and
 * handing it a stored colour, which is how every one of them was written before.
 * The behaviour itself is held by
 * `integration-test/src/__tests__/page/document-style-values.spec.ts`.
 */

const THE_ONE_MODULE = 'packages/framework/global/src/lit/style-map.ts';
// The module specifier of Lit's directive, in either package that exports it.
// Matches "'lit/directives/style-map.js'"; rejects "'lit/directives/class-map.js'".
// https://regex101.com/?regex=%5B%27%22%5D%28%3F%3Alit%7Clit-html%29%5C%2Fdirectives%5C%2Fstyle-map%5C.js%5B%27%22%5D&testString=%27lit%2Fdirectives%2Fstyle-map.js%27
const LIT_STYLE_MAP = /['"](?:lit|lit-html)\/directives\/style-map\.js['"]/;

describe('style-map boundary', () => {
  test('only the library module imports the directive of Lit', () => {
    const offenders = SCAN_DIRS.flatMap(dir =>
      sourceFiles(join(ROOT, dir)).map(toRepoRelative)
    ).filter(
      file =>
        file !== THE_ONE_MODULE &&
        LIT_STYLE_MAP.test(readFileSync(join(ROOT, file), 'utf8'))
    );
    expect(offenders).toEqual([]);
  }, 90_000);

  test('the module only takes a type from it', () => {
    const source = readFileSync(join(ROOT, THE_ONE_MODULE), 'utf8');
    const imports = source.split('\n').filter(line => LIT_STYLE_MAP.test(line));
    expect(imports.map(line => line.trim())).toEqual([
      "import type { StyleInfo } from 'lit/directives/style-map.js';",
    ]);
  });
});
