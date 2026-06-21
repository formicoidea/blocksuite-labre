import { describe, expect, it } from 'vitest';

import {
  CD_SUBDOMAINS,
  CM_RELATIONSHIPS,
  ES_HOTSPOT,
  ES_STICKIES,
} from '../shared/consts';

const HEX = /^#([0-9a-f]{6}|[0-9a-f]{8})$/i;

describe('ddd shared presets', () => {
  it('every Event Storming sticky has hex fill + text colours', () => {
    for (const s of ES_STICKIES) {
      expect(s.fill).toMatch(HEX);
      expect(s.text).toMatch(HEX);
      expect(s.label.length).toBeGreaterThan(0);
    }
    expect(ES_HOTSPOT.fill).toMatch(HEX);
  });

  it('exposes the nine context-map relationship patterns', () => {
    expect(CM_RELATIONSHIPS).toHaveLength(9);
    const kinds = CM_RELATIONSHIPS.map(r => r.kind);
    expect(new Set(kinds).size).toBe(9); // no duplicate units across the menu
    expect(kinds).toContain('acl');
    expect(kinds).toContain('bbom');
  });

  it('every Core Domain sub-domain has a hex fill', () => {
    for (const d of CD_SUBDOMAINS) expect(d.fill).toMatch(HEX);
  });
});
