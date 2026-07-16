import { TextFitMode } from '@labre/affine-model';
import type { BlockStdScope } from '@labre/std';
import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import {
  CD_SUBDOMAINS,
  CM_RELATIONSHIPS,
  ES_HOTSPOT,
  ES_STICKIES,
} from '../shared/consts';
import { addBubble, addSticky } from '../shared/prefabs';

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

describe('prefab text fit defaults', () => {
  const surfaceStub = () => {
    const added: Record<string, unknown>[] = [];
    let n = 0;
    return {
      added,
      surface: {
        addElement: vi.fn((props: Record<string, unknown>) => {
          added.push(props);
          return `el-${n++}`;
        }),
      } as never,
    };
  };
  const stdStub = () =>
    ({
      command: { exec: () => [null, { groupId: 'group-1' }] },
    }) as unknown as BlockStdScope;

  // A standalone Y.Text stays empty until integrated into a doc (in
  // production surface.addElement does it); integrate to read the content.
  const materialize = (text: Y.Text) => {
    new Y.Doc().getMap('m').set('t', text);
    return text.toString();
  };

  it('a sticky is shadow + face whose OWN text is contained (no third element)', () => {
    const { surface, added } = surfaceStub();
    addSticky(surface, stdStub(), 0, 0, {
      fill: '#fef08a',
      text: '#1f2328',
      label: 'Domain event',
    });

    expect(added).toHaveLength(2); // shadow + face only
    const face = added[1];
    expect(face.textFitMode).toBe(TextFitMode.Contained);
    expect(face.text).toBeInstanceOf(Y.Text);
    expect(materialize(face.text as Y.Text)).toBe('Domain event');
  });

  it('a context-map bubble owns its label in overflow mode', () => {
    const { surface, added } = surfaceStub();
    addBubble(surface, 0, 0, 'Bounded Context');

    expect(added).toHaveLength(1);
    expect(added[0].textFitMode).toBe(TextFitMode.Overflow);
    expect(materialize(added[0].text as Y.Text)).toBe('Bounded Context');
  });
});
