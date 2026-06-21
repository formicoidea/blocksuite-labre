import { describe, expect, it } from 'vitest';

import { contextMapTemplateCategory } from '../templates';

describe('context map template category', () => {
  it('catalogues its own components including the cloud / system', () => {
    expect(contextMapTemplateCategory.name).toBe('Context Map');
    const names = (contextMapTemplateCategory.templates as { name?: string }[]).map(
      t => t.name
    );
    expect(names).toContain('Context Map — Cloud / System');
  });
});
