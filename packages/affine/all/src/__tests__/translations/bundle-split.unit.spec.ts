import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import { AUXILIARY_BUNDLES, FRAMEWORK_DESCRIPTORS } from '../../frameworks.js';
import { HERE } from './source-files.js';

/**
 * `scripts/build-bundles.mjs` builds `@labre/core` from a COPY of
 * `translations.ts` with every framework's and auxiliary bundle's contribution
 * stripped: one `import { … } from '<pkg>'` statement and one
 * `{ owner: '<id>', … }` line each. Anything else naming a package that ships
 * as its own bundle makes core import it, and the release breaks — which is
 * how 0.38.0 failed to publish, found only at `ci:publish`.
 *
 * This pins the shape the bundler relies on, so the break shows up in the unit
 * suite instead of at release time.
 */
describe('translations.ts keeps the shape the bundle split strips', () => {
  const source = readFileSync(
    join(HERE, '..', '..', 'translations.ts'),
    'utf8'
  );
  const bundles = [
    ...FRAMEWORK_DESCRIPTORS.map(d => ({ pkg: d.pkg, id: d.id as string })),
    ...AUXILIARY_BUNDLES.map(b => ({ pkg: b.pkg, id: b.label })),
  ];

  test.each(bundles)(
    '$pkg is imported from its root only, with a group',
    ({ pkg, id }) => {
      const escaped = pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const anyImport = new RegExp(`from\\s*'${escaped}(/[^']*)?'`, 'g');
      const imports = [...source.matchAll(anyImport)];
      if (imports.length === 0) return;
      // A subpath (`<pkg>/translations`) is not stripped by the bundler.
      expect(
        imports.map(m => m[0]),
        `${pkg} must be imported from its root`
      ).toEqual([`from '${pkg}'`]);
      expect(
        source.match(new RegExp(`^\\s*\\{\\s*owner:\\s*'${id}',`, 'gm'))
          ?.length,
        `${pkg} needs exactly one one-line { owner: '${id}', … } group`
      ).toBe(1);
    }
  );
});
