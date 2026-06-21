import { describe, expect, it } from 'vitest';

import { aggregateTemplateCategory } from '../templates';

describe('aggregate template category', () => {
  it('exposes a single Aggregate Design Canvas template', () => {
    expect(aggregateTemplateCategory.name).toBe('Aggregate Design Canvas');
    const names = (aggregateTemplateCategory.templates as { name?: string }[]).map(
      t => t.name
    );
    expect(names).toEqual(['Aggregate Design Canvas']);
  });
});
