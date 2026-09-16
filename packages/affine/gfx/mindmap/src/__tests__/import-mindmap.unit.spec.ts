import { TranslationProvider } from '@labre/affine-shared/services';
import { Bound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import { describe, expect, it, vi } from 'vitest';

import { importMindmap } from '../toolbar/utils/import-mindmap.js';

const fakeFile = (name: string, content: string) =>
  ({
    name,
    text: () => Promise.resolve(content),
  }) as unknown as File;

let nextFile: File | null = null;

// Hoisted above the imports above by vitest, so `importMindmap` already sees
// the fake by the time this file's tests run. Everything else this shared
// barrel exports (used transitively elsewhere) passes through untouched.
vi.mock('@labre/affine-shared/utils', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  openSingleFileWith: () => Promise.resolve(nextFile),
}));

/**
 * A `.mm` / `.opml` node with no text of its own is a SEED
 * (`com.labre.mindmap.seed.imported-node`): resolved at PLACEMENT — the
 * moment the import lands, ADR 0016 — and never again.
 */
describe('an imported node with no text speaks the inserting editor’s language', () => {
  const hostWith = (t?: (key: string) => string | undefined) =>
    ({
      getOptional: (id: unknown) =>
        id === TranslationProvider && t ? { t } : undefined,
    }) as unknown as BlockStdScope;

  const MM =
    '<map><node TEXT="Root"><node POSITION="right"></node></node></map>';

  it('without a provider, an untitled node reads "MINDMAP"', async () => {
    nextFile = fakeFile('doc.mm', MM);
    const result = await importMindmap(new Bound(0, 0, 1, 1), hostWith());
    expect(result.children[0]!.text).toBe('MINDMAP');
  });

  it('with a fake provider, an untitled node is translated', async () => {
    nextFile = fakeFile('doc.mm', MM);
    const std = hostWith(key =>
      key === 'com.labre.mindmap.seed.imported-node'
        ? 'CARTE MENTALE'
        : undefined
    );
    const result = await importMindmap(new Bound(0, 0, 1, 1), std);
    expect(result.children[0]!.text).toBe('CARTE MENTALE');
  });
});
