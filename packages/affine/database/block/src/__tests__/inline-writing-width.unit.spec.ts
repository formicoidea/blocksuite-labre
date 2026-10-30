/// <reference types="vite/client" />
/**
 * GUARD — an inline table or board scrolls within the text column.
 *
 * What it would have caught (labre recette of 2.1, 2026-10-30): the block
 * measured its distance to the editor's edge (minus 72px) into
 * `virtualPadding$` and bled its scroller into the page's gutters, so a wide
 * inline view showed a horizontal scrollbar across the whole editor rather
 * than the column the person writes in. The padding now stays 0.
 */
import { describe, expect, test } from 'vitest';

// Read as text, as the browser tests do (paint-predicate.unit.spec.ts).
const source =
  Object.values(
    import.meta.glob<string>('../database-block.ts', {
      query: '?raw',
      import: 'default',
      eager: true,
    })
  )[0] ?? '';

describe('an inline database', () => {
  test('never writes a side padding that bleeds into the gutters', () => {
    expect(source).not.toBe('');
    expect(source).toContain('private readonly virtualPadding$ = signal(0);');
    expect(source).not.toMatch(/virtualPadding\$\.value\s*=/);
    expect(source).not.toContain('listenFullWidthChange');
  });
});
