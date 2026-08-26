import { ES_HOTSPOT, ES_STICKIES } from '@labre/affine-gfx-ddd-shared';
import { roleIsA } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import { ES_ROLE, ES_STICKY_ROLE, EVENT_STORMING_ROLES } from '../roles';

describe('event storming role vocabulary', () => {
  it('declares a role for each of the nine sticky kinds, plus board / sticky / flow', () => {
    // Eight in the shared palette + the hotspot, which lives in its own preset.
    expect(ES_STICKIES).toHaveLength(8);
    expect(Object.keys(EVENT_STORMING_ROLES)).toHaveLength(3 + 9);
    expect(EVENT_STORMING_ROLES[ES_ROLE.board].kind).toBe('node');
    expect(EVENT_STORMING_ROLES[ES_ROLE.sticky].kind).toBe('node');
    expect(EVENT_STORMING_ROLES[ES_ROLE.flow].kind).toBe('edge');
  });

  it('namespaces every role and kebab-cases the ids', () => {
    for (const def of Object.values(EVENT_STORMING_ROLES)) {
      expect(def.id.startsWith('es:')).toBe(true);
      expect(def.id).toBe(def.id.toLowerCase());
      expect(def.labelKey).toMatch(/^com\.labre\./);
      expect(def.labelFallback).toBeTruthy();
    }
    expect(ES_STICKY_ROLE.domainEvent).toBe('es:domain-event');
    expect(ES_STICKY_ROLE.readModel).toBe('es:read-model');
    expect(ES_STICKY_ROLE.aggregate).toBe('es:aggregate');
    expect(ES_STICKY_ROLE.hotspot).toBe('es:hotspot');
  });

  it('renames the external system in the ROLE and nowhere else', () => {
    // `system` is the kind the palette and its telemetry have always used;
    // `external-system` is the word the notation says and a rule has to read.
    // See the header of `roles.ts` for why both survive.
    expect(ES_STICKY_ROLE.system).toBe('es:external-system');
    expect(ES_STICKIES.some(preset => preset.kind === 'system')).toBe(true);
  });

  it('takes its labels from the same presets the palette renders', () => {
    for (const preset of ES_STICKIES) {
      expect(
        EVENT_STORMING_ROLES[ES_STICKY_ROLE[preset.kind]].labelFallback
      ).toBe(preset.label);
    }
    expect(EVENT_STORMING_ROLES[ES_STICKY_ROLE.hotspot].labelFallback).toBe(
      ES_HOTSPOT.label
    );
  });

  it('makes every kind a specialisation of the sticky parent', () => {
    for (const kind of [...ES_STICKIES.map(p => p.kind), 'hotspot'] as const) {
      const id = ES_STICKY_ROLE[kind];
      expect(roleIsA(id, ES_ROLE.sticky, EVENT_STORMING_ROLES), id).toBe(true);
    }
    // ...and nothing else is. A rule written on the parent must never fall on
    // the board its subjects are stuck to, nor on the arcs between them.
    expect(roleIsA(ES_ROLE.board, ES_ROLE.sticky, EVENT_STORMING_ROLES)).toBe(
      false
    );
    expect(roleIsA(ES_ROLE.flow, ES_ROLE.sticky, EVENT_STORMING_ROLES)).toBe(
      false
    );
    expect(roleIsA(ES_ROLE.sticky, ES_ROLE.board, EVENT_STORMING_ROLES)).toBe(
      false
    );
  });

  it('declares the flow verb and the gesture it announces', () => {
    const flow = EVENT_STORMING_ROLES[ES_ROLE.flow];
    expect(flow.direction?.verbFallback).toBe('leads to');
    expect(flow.direction?.verbKey).toMatch(/^com\.labre\./);
    expect(flow.direction?.gestureHintFallback).toBe(
      'Drag from what happens first to what follows.'
    );
  });

  it('gives no verb to anything that is not an edge', () => {
    for (const def of Object.values(EVENT_STORMING_ROLES)) {
      if (def.kind === 'edge') continue;
      expect(def.direction, def.id).toBeUndefined();
    }
  });

  it('is a null-prototype lookup table', () => {
    expect(Object.getPrototypeOf(EVENT_STORMING_ROLES)).toBeNull();
    expect(
      (EVENT_STORMING_ROLES as Record<string, unknown>)['toString']
    ).toBeUndefined();
  });
});
