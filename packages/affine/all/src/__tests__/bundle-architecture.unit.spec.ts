import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

/**
 * The core bundle ships the architecture map under `architecture/` (ADR 0040
 * §5). Two scripts decide what the tarball holds: build-bundles writes the
 * directory and lists it in `files`, then compile-bundles rewrites `files`
 * when it swaps `src` for `dist`. That rewrite used to be a bare
 * `['dist']`, which would have dropped the map from every tarball while the
 * bundle directory still held it: nothing fails, the host just finds no map.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
// …/packages/affine/all/src/__tests__ → repo root is 5 levels up.
const ROOT = join(HERE, '..', '..', '..', '..', '..');
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');

describe('the core bundle ships the architecture map', () => {
  test('build-bundles copies it into core alone and lists it in files', () => {
    const script = read('scripts', 'build-bundles.mjs');
    expect(script).toContain('function copyArchitecture(');
    expect(script).toContain("'likec4.config.json'");
    expect(script.match(/^\s*copyArchitecture\(CORE_OUT\);/gm)).toHaveLength(1);
    expect(script).toContain("files: ['src', 'architecture']");
  });

  test('compile-bundles keeps every files entry but src', () => {
    const script = read('scripts', 'compile-bundles.mjs');
    expect(script).not.toMatch(/pkg\.files\s*=\s*\['dist'\];/);
    expect(script).toContain(
      "pkg.files = ['dist', ...(pkg.files ?? []).filter(f => f !== 'src')];"
    );
  });
});
