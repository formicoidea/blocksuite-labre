import { readdirSync, readFileSync } from 'node:fs';
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

  test.each(FRAMEWORK_DESCRIPTORS)(
    '$id routes its senior-button tooltip through $labelKey',
    ({ dir, labelKey }) => {
      const toolbarDir = join(
        ROOT,
        'packages',
        ...dir.split('/'),
        'src',
        'toolbar'
      );
      const buttonFile = readdirSync(toolbarDir).find(f =>
        f.endsWith('senior-button.ts')
      );
      expect(buttonFile).toBeDefined();
      const source = readFileSync(join(toolbarDir, buttonFile!), 'utf8');
      // Either the button calls translateKey itself, or (DDD) it declares the
      // key on the shared base, which resolves it — no raw English tooltip.
      expect(source).toContain(`'${labelKey}'`);
    }
  );
});
