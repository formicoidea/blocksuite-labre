import { describe, expect, it } from 'vitest';

import { coreDomainTemplateCategory } from '../templates';

/**
 * The renderer suite that used to live here is gone, and deliberately: it
 * asserted CALL COUNTS on a hand-rolled context stub ("fillRect was called four
 * times"), which says nothing about what the chart looks like and breaks on any
 * rewrite of the drawing code. `background.unit.spec.ts` replaces it with the
 * literal coordinates the old `consts.ts` shipped — a stronger statement, and
 * the one that proves the move onto the framework-background primitive changed
 * no pixel.
 */
describe('core domain template category', () => {
  it('catalogues the chart background', () => {
    expect(coreDomainTemplateCategory.name).toBe('Core Domain Chart');
    const names = (
      coreDomainTemplateCategory.templates as { name?: string }[]
    ).map(t => t.name);
    expect(names).toContain('Core Domain Chart');
  });
});
