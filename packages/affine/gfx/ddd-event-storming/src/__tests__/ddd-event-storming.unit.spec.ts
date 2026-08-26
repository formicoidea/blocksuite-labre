import { describe, expect, it } from 'vitest';

import { eventStormingTemplateCategory } from '../templates';

describe('event storming template category', () => {
  it('catalogues its own components including the hotspot', () => {
    expect(eventStormingTemplateCategory.name).toBe('Event Storming');
    const names = (
      eventStormingTemplateCategory.templates as { name?: string }[]
    ).map(t => t.name);
    expect(names).toContain('Event Storming — Hotspot');
  });
});
