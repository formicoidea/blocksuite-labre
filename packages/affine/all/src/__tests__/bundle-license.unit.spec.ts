import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

/**
 * The published packages are the BUNDLES `scripts/build-bundles.mjs` generates,
 * not the workspace packages — so the repo's root LICENSE only reaches a
 * tarball if the script copies it into each bundle directory. It did not until
 * the 0.42.0 release, and MPL-2.0 is file-level copyleft: the text has to ship.
 *
 * This pins the copy at the three places a bundle directory is born, plus the
 * guard that refuses to publish one without it, so a missing licence shows up
 * in the unit suite instead of on npm.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
// …/packages/affine/all/src/__tests__ → repo root is 5 levels up.
const ROOT = join(HERE, '..', '..', '..', '..', '..');
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');

describe('every published bundle ships the licence', () => {
  test('the root LICENSE is the MPL-2.0 text', () => {
    const license = read('LICENSE');
    expect(license).toContain('Mozilla Public License Version 2.0');
    expect(license.length).toBeGreaterThan(10000);
  });

  test('build-bundles copies it into core, shared and framework bundles', () => {
    const script = read('scripts', 'build-bundles.mjs');
    expect(script).toContain('function copyLicense(');
    // one call per kind of bundle: buildCore, buildShared, buildFramework.
    expect(script.match(/^\s*copyLicense\(/gm)).toHaveLength(3);
  });

  test('publish-bundles refuses a bundle without one', () => {
    expect(read('scripts', 'publish-bundles.mjs')).toContain(
      "path.join(dir, 'LICENSE')"
    );
  });
});
