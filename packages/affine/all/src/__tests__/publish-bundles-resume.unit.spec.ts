import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

/**
 * The 0.56.0 release stopped halfway: `npm publish` of `labre-ddd-shared` got a
 * 503, while `labre-core` had been accepted but was not yet visible on the
 * registry (a ~15 MB tarball shows minutes after its PUT). A plain re-run would
 * have tried core again and died on "cannot publish over", leaving ten bundles
 * unpublished. npm can also answer a 5xx to a PUT it accepted (npm/cli#6103).
 *
 * This pins the two behaviours that let a release be resumed by re-running the
 * script: a 5xx is retried, and a publish conflict counts as already published.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
// …/packages/affine/all/src/__tests__ → repo root is 5 levels up.
const ROOT = join(HERE, '..', '..', '..', '..', '..');
const script = readFileSync(
  join(ROOT, 'scripts', 'publish-bundles.mjs'),
  'utf8'
);

describe('publish-bundles resumes a half-published release', () => {
  test('a version the registry already holds is skipped, not fatal', () => {
    expect(script).toContain('EPUBLISHCONFLICT|cannot publish over');
  });

  test('a registry 5xx is retried', () => {
    expect(script).toContain('\\bE5\\d\\d\\b');
  });
});
