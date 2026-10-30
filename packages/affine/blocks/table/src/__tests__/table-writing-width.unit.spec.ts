/// <reference types="vite/client" />
/**
 * GUARD — a wide table scrolls within the text column.
 *
 * What it would have caught (labre recette of 2.1, 2026-10-30): the block
 * read `VirtualPaddingController` (its distance to the editor's edge, minus
 * 72px) and bled its scroller into the page's gutters, so a wide table
 * showed a horizontal scrollbar across the whole editor. Only the 10px of
 * the row handles still hang into the gutter.
 */
import { describe, expect, test } from 'vitest';

// Read as text (paint-predicate.unit.spec.ts does the same).
const source =
  Object.values(
    import.meta.glob<string>('../table-block.ts', {
      query: '?raw',
      import: 'default',
      eager: true,
    })
  )[0] ?? '';

describe('a table block', () => {
  test('bleeds no further than its row handles', () => {
    expect(source).not.toBe('');
    expect(source).not.toContain('VirtualPaddingController');
    expect(source).not.toContain('virtualPadding');
    expect(source).toContain("marginLeft: '-10px'");
  });
});
