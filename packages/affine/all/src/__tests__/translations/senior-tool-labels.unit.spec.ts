import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import { FRAMEWORK_DESCRIPTORS } from '../../frameworks.js';

/**
 * The senior button of every framework names itself through the translation
 * seam, with the key its own descriptor publishes.
 *
 * Scanned from the source rather than imported: a senior tool is registered
 * deep inside its gfx package (`src/toolbar/senior-tool.ts`, not re-exported),
 * and a gfx package cannot import `@labre/affine/all` — so the key is a string
 * literal there, and this is what stops it drifting from the descriptor.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
// …/packages/affine/all/src/__tests__/translations → repo root is 6 levels up.
const ROOT = join(HERE, '..', '..', '..', '..', '..', '..');

describe('senior-tool label keys', () => {
  test.each(FRAMEWORK_DESCRIPTORS)(
    '$id declares $labelKey on its senior tool',
    ({ dir, labelKey }) => {
      const source = readFileSync(
        join(ROOT, 'packages', ...dir.split('/'), 'src', 'toolbar', 'senior-tool.ts'),
        'utf8'
      );
      expect(source).toContain(`labelKey: '${labelKey}',`);
    }
  );
});
