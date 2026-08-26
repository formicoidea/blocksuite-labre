/**
 * The per-universe tag-definition format and its cumulative, idempotent
 * registry (MF3 / ADR 0007 §§ 2 and 3).
 *
 * The single rule every assertion here serves: **a malformed seed must never
 * prevent a document from opening.** An invalid id, a cross-framework id, an
 * unrecognised `formatVersion` — each drops the offending def and records an
 * issue for a host diagnostics panel. Nothing throws, ever. That is the hard
 * boundary between "the app misconfigured a pack" and "the user lost their
 * board".
 */
import type { RoleDefs } from '@labre/std/gfx';
import { describe, expect, test } from 'vitest';

import {
  buildUniverseRegistry,
  tagAppliesToRole,
  type TagDef,
  type UniverseTagDefs,
} from '../../services/universe-tag-defs-service.js';

/** A three-role vocabulary with one specialisation, enough to exercise `roleIsA`. */
const ROLES: RoleDefs = {
  'wardley:component': { id: 'wardley:component', kind: 'node' },
  'wardley:market': {
    id: 'wardley:market',
    parent: 'wardley:component',
    kind: 'node',
  },
  'wardley:anchor': { id: 'wardley:anchor', kind: 'node' },
};

const nature = (overrides: Partial<TagDef> = {}): TagDef => ({
  id: 'wardley:nature',
  label: 'Nature',
  cardinality: 'single',
  appliesTo: ['wardley:component'],
  values: [
    { id: 'wardley:nature/data', label: 'Data' },
    { id: 'wardley:nature/activity', label: 'Activity' },
  ],
  ...overrides,
});

const pack = (overrides: Partial<UniverseTagDefs> = {}): UniverseTagDefs => ({
  formatVersion: 1,
  packId: 'wardley-core',
  framework: 'wardley',
  label: 'Wardley',
  tags: [nature()],
  ...overrides,
});

describe('a single well-formed pack', () => {
  test('its tags are readable, and there are no issues', () => {
    const registry = buildUniverseRegistry([pack()]);

    expect(registry.issues()).toEqual([]);
    expect(registry.frameworks()).toEqual(['wardley']);
    expect(registry.tag('wardley:nature')?.label).toBe('Nature');
    expect(registry.tags()).toHaveLength(1);
  });

  test('an unknown id is simply absent — never an error', () => {
    const registry = buildUniverseRegistry([pack()]);

    // Defs are runtime configuration and are NEVER persisted, so a document may
    // carry an id this deployment never seeded. Asking about it is a normal
    // question with a normal answer.
    expect(registry.tag('nowhere:seeded')).toBeUndefined();
    expect(registry.issues()).toEqual([]);
  });
});

describe('role scoping', () => {
  test('specialisation is resolved: a tag on the parent reaches the child', () => {
    const registry = buildUniverseRegistry([pack()]);

    expect(
      registry.tagsForRole('wardley:component', ROLES).map(t => t.id)
    ).toEqual(['wardley:nature']);
    // `market` specialises `component`, so it gets the tag for free. That is
    // the entire reason role hierarchy is DATA and not TS inheritance.
    expect(
      registry.tagsForRole('wardley:market', ROLES).map(t => t.id)
    ).toEqual(['wardley:nature']);
    // `anchor` is a role of its own — a user / need has no nature.
    expect(registry.tagsForRole('wardley:anchor', ROLES)).toEqual([]);
  });

  test("'*' covers the tag's own framework and stops there", () => {
    const registry = buildUniverseRegistry([
      pack({ tags: [nature({ appliesTo: '*' })] }),
    ]);

    expect(registry.tagsForRole('wardley:anchor', ROLES)).toHaveLength(1);
    // A wildcard that crossed framework boundaries would make two taxonomies
    // qualify each other's elements — precisely what namespacing exists to
    // prevent.
    expect(registry.tagsForRole('edgy:activity', ROLES)).toEqual([]);
  });

  test('a roleless element is qualified by nothing', () => {
    const registry = buildUniverseRegistry([
      pack({ tags: [nature({ appliesTo: '*' })] }),
    ]);

    expect(tagAppliesToRole(registry.tags()[0], undefined, ROLES)).toBe(false);
  });
});

describe('cumulative seeding', () => {
  test('two packs extending one universe are merged, additively', () => {
    const extension = pack({
      packId: 'client-private',
      tags: [
        nature({
          // Same tag, extra values and an extra role: both union.
          values: [{ id: 'wardley:nature/practice', label: 'Practice' }],
          appliesTo: ['wardley:anchor'],
        }),
        {
          id: 'wardley:criticality',
          label: 'Criticality',
          cardinality: 'multi',
          appliesTo: ['wardley:component'],
          values: [{ id: 'wardley:criticality/high', label: 'High' }],
        },
      ],
    });

    const registry = buildUniverseRegistry([pack(), extension]);

    expect(registry.issues()).toEqual([]);
    const merged = registry.tag('wardley:nature')!;
    expect((merged.values as { id: string }[]).map(v => v.id)).toEqual([
      'wardley:nature/data',
      'wardley:nature/activity',
      'wardley:nature/practice',
    ]);
    expect(merged.appliesTo).toEqual(['wardley:component', 'wardley:anchor']);
    // A client's private taxonomy is addable with no library release: that is
    // the whole point of the split.
    expect(registry.tag('wardley:criticality')).toBeTruthy();
  });

  test('cosmetic fields: the last pack wins; absent stays absent', () => {
    const registry = buildUniverseRegistry([
      pack(),
      pack({
        packId: 'relabel',
        tags: [nature({ label: 'Type', order: 7 })],
      }),
    ]);

    expect(registry.tag('wardley:nature')!.label).toBe('Type');
    expect(registry.tag('wardley:nature')!.order).toBe(7);
    expect(registry.issues()).toEqual([]);
  });

  test('structural conflicts: the first pack wins, and it is REPORTED', () => {
    const registry = buildUniverseRegistry([
      pack(),
      pack({ packId: 'clash', tags: [nature({ cardinality: 'multi' })] }),
    ]);

    // Not a throw and not a guess: a host that needs a deterministic winner
    // should not declare the same structural field twice, and the registry says
    // so rather than picking silently.
    expect(registry.tag('wardley:nature')!.cardinality).toBe('single');
    const issues = registry.issues();
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      severity: 'error',
      code: 'duplicate-conflict',
      id: 'wardley:nature',
    });
  });

  test("'open' vs a closed list is a structural conflict too", () => {
    const registry = buildUniverseRegistry([
      pack(),
      pack({ packId: 'opened', tags: [nature({ values: 'open' })] }),
    ]);

    expect(registry.tag('wardley:nature')!.values).not.toBe('open');
    expect(registry.issues()[0].code).toBe('duplicate-conflict');
  });

  test('re-seeding the same pack is idempotent, by value', () => {
    const once = buildUniverseRegistry([pack()]);
    // What `di.override` on the `packId` variant guarantees at the DI level,
    // asserted at the merge level too: activating a universe twice yields the
    // same registry.
    const twice = buildUniverseRegistry([pack(), pack()]);

    expect(twice.tags()).toEqual(once.tags());
    expect(twice.issues()).toEqual([]);
  });
});

describe('a malformed pack degrades, and never throws', () => {
  test('an unrecognised formatVersion drops the WHOLE pack', () => {
    const registry = buildUniverseRegistry([
      pack(),
      { ...pack({ packId: 'future' }), formatVersion: 2 as 1 },
    ]);

    // A format we do not understand may mean anything, so nothing in it is
    // trusted. Documents still open; the tooling is simply unavailable.
    expect(registry.tags()).toHaveLength(1);
    expect(registry.issues()[0]).toMatchObject({
      code: 'unsupported-format-version',
      id: 'future',
    });
  });

  test('a malformed id drops that def only', () => {
    const registry = buildUniverseRegistry([
      pack({
        tags: [
          nature(),
          { ...nature(), id: 'Wardley:Nature' as never },
          { ...nature(), id: 'nodots.here' as never },
        ],
      }),
    ]);

    expect(registry.tags()).toHaveLength(1);
    expect(registry.issues().map(i => i.code)).toEqual([
      'invalid-id',
      'invalid-id',
    ]);
  });

  test('a cross-framework id is refused', () => {
    const registry = buildUniverseRegistry([
      pack({ tags: [nature({ id: 'edgy:nature' })] }),
    ]);

    // How one taxonomy would quietly start answering for another's roles.
    expect(registry.tags()).toEqual([]);
    expect(registry.issues()[0].code).toBe('cross-framework-id');
  });

  test('a value filed under the wrong tag is dropped, the tag survives', () => {
    const registry = buildUniverseRegistry([
      pack({
        tags: [
          nature({
            values: [
              { id: 'wardley:nature/data', label: 'Data' },
              { id: 'wardley:criticality/high', label: 'Not mine' },
              { id: 'not an id', label: 'Nor this' },
            ],
          }),
        ],
      }),
    ]);

    expect((registry.tag('wardley:nature')!.values as unknown[]).length).toBe(
      1
    );
    expect(registry.issues()).toHaveLength(2);
  });

  test('rubbish in, issues out — never an exception', () => {
    // Everything a bad host script could hand over at once.
    const registry = buildUniverseRegistry([
      undefined as unknown as UniverseTagDefs,
      { formatVersion: 1, packId: 'empty' } as unknown as UniverseTagDefs,
      pack({
        framework: 'not-a-framework' as never,
        tags: [null as unknown as TagDef],
      }),
      pack(),
    ]);

    expect(registry.tag('wardley:nature')).toBeTruthy();
    expect(registry.issues().length).toBeGreaterThan(0);
    expect(registry.tagsForRole('wardley:component', ROLES)).toHaveLength(1);
  });
});

describe('ordering', () => {
  test('by `order`, then by seed order, then by id', () => {
    const registry = buildUniverseRegistry([
      pack({
        tags: [
          { ...nature({ id: 'wardley:zeta' }), order: 2 },
          { ...nature({ id: 'wardley:beta' }), order: 1 },
          { ...nature({ id: 'wardley:alpha' }), order: 1 },
        ],
      }),
    ]);

    // `beta` is declared before `alpha` and shares its rank, so seed order
    // breaks the tie — which is what makes a pack's authored order visible.
    expect(registry.tags().map(t => t.id)).toEqual([
      'wardley:beta',
      'wardley:alpha',
      'wardley:zeta',
    ]);
  });
});
