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
import type { BlockStdScope } from '@labre/std';
import type { RoleDefs } from '@labre/std/gfx';
import { describe, expect, test } from 'vitest';

import {
  buildUniverseRegistry,
  tagAppliesToRole,
  tagDefsTranslationEntries,
  type TagDef,
  translateTagDescription,
  translateTagLabel,
  type UniverseTagDefs,
} from '../../services/universe-tag-defs-service.js';

/** No host: every `translateKey` call falls through to its own fallback. */
const NO_HOST_STD = {
  getOptional: () => undefined,
} as unknown as BlockStdScope;

/** A host whose catalogue answers `entries` and nothing else. */
const stdWith = (entries: Record<string, string>): BlockStdScope =>
  ({
    getOptional: () => ({ t: (key: string) => entries[key] }),
  }) as unknown as BlockStdScope;

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

describe('translateTagLabel', () => {
  test('with no `labelKey`, is exactly `label` — a host pack needs no change', () => {
    expect(
      translateTagLabel(NO_HOST_STD, {
        label: 'Criticité',
        labelKey: undefined,
      })
    ).toBe('Criticité');
  });

  test('with no host, renders the fallback letter for letter', () => {
    expect(
      translateTagLabel(NO_HOST_STD, {
        label: 'Nature',
        labelKey: 'com.labre.wardley.tag.nature',
      })
    ).toBe('Nature');
  });

  test("prefers the host's catalogue entry over the baked fallback", () => {
    const std = stdWith({ 'com.labre.wardley.tag.nature': 'Nature (FR)' });
    expect(
      translateTagLabel(std, {
        label: 'Nature',
        labelKey: 'com.labre.wardley.tag.nature',
      })
    ).toBe('Nature (FR)');
  });
});

describe('tagDefsTranslationEntries', () => {
  test('one entry per `labelKey`, the tag AND its values, fallback from `label`', () => {
    const entries = tagDefsTranslationEntries(
      pack({
        tags: [
          nature({
            labelKey: 'com.labre.wardley.tag.nature',
            values: [
              {
                id: 'wardley:nature/data',
                label: 'Data',
                labelKey: 'com.labre.wardley.tag.nature.data',
              },
              // No `labelKey`: no entry, same as a host pack that never sets one.
              { id: 'wardley:nature/activity', label: 'Activity' },
            ],
          }),
        ],
      })
    );

    expect(entries).toEqual([
      {
        key: 'com.labre.wardley.tag.nature',
        fallback: 'Nature',
        source: 'tag',
      },
      {
        key: 'com.labre.wardley.tag.nature.data',
        fallback: 'Data',
        source: 'tag',
      },
    ]);
  });

  test('a host pack with no `labelKey` at all contributes nothing', () => {
    expect(tagDefsTranslationEntries(pack())).toEqual([]);
  });

  test('an `open` tag has no values to walk', () => {
    expect(
      tagDefsTranslationEntries(
        pack({
          tags: [
            nature({
              labelKey: 'com.labre.wardley.tag.nature',
              values: 'open',
            }),
          ],
        })
      )
    ).toEqual([
      {
        key: 'com.labre.wardley.tag.nature',
        fallback: 'Nature',
        source: 'tag',
      },
    ]);
  });
});

describe('merging `labelKey` across packs', () => {
  test('is cosmetic — the last pack to declare it wins, like `label`', () => {
    const registry = buildUniverseRegistry([
      pack({ tags: [nature({ labelKey: 'com.labre.wardley.tag.nature' })] }),
      pack({
        packId: 'wardley-client',
        tags: [nature({ labelKey: undefined })],
      }),
    ]);

    // The second pack said nothing about `labelKey` (left `undefined`), so the
    // first pack's still stands — absent never blanks what an earlier pack said.
    expect(registry.tag('wardley:nature')?.labelKey).toBe(
      'com.labre.wardley.tag.nature'
    );
  });
});

// L7-s2: `descriptionKey` (`TagDef` / `TagValueDef`) and the pack's own
// `labelKey` — the two seams `translateTagDescription` and
// `tagDefsTranslationEntries` gained to resolve them. Additive, on the same
// shape as `labelKey` above.
describe('translateTagDescription', () => {
  test('with no `descriptionKey`, is exactly `description` unresolved', () => {
    expect(
      translateTagDescription(NO_HOST_STD, {
        description: 'Ce que ce composant fait.',
        descriptionKey: undefined,
      })
    ).toBe('Ce que ce composant fait.');
  });

  test('with no `description` either, is `undefined` — never a placeholder', () => {
    expect(
      translateTagDescription(NO_HOST_STD, {
        description: undefined,
        descriptionKey: undefined,
      })
    ).toBeUndefined();
  });

  test('with no host, renders the fallback letter for letter', () => {
    expect(
      translateTagDescription(NO_HOST_STD, {
        description: 'What kind of thing this component is.',
        descriptionKey: 'com.labre.wardley.tag.nature.description',
      })
    ).toBe('What kind of thing this component is.');
  });

  test("prefers the host's catalogue entry over the baked fallback", () => {
    const std = stdWith({
      'com.labre.wardley.tag.nature.description': 'Ce que ce composant est.',
    });
    expect(
      translateTagDescription(std, {
        description: 'What kind of thing this component is.',
        descriptionKey: 'com.labre.wardley.tag.nature.description',
      })
    ).toBe('Ce que ce composant est.');
  });
});

describe("translateTagLabel resolves a PACK's own label too", () => {
  test('the pack shape (`{ label, labelKey }`) needs no dedicated function', () => {
    expect(
      translateTagLabel(NO_HOST_STD, {
        label: 'Wardley',
        labelKey: 'com.labre.wardley.tag-pack.label',
      })
    ).toBe('Wardley');

    const std = stdWith({ 'com.labre.wardley.tag-pack.label': 'Wardley (FR)' });
    expect(
      translateTagLabel(std, {
        label: 'Wardley',
        labelKey: 'com.labre.wardley.tag-pack.label',
      })
    ).toBe('Wardley (FR)');
  });
});

describe('tagDefsTranslationEntries: pack label and descriptions', () => {
  test("the pack's own `labelKey` contributes one entry, fallback from `label`", () => {
    const entries = tagDefsTranslationEntries(
      pack({ labelKey: 'com.labre.wardley.tag-pack.label' })
    );
    expect(entries).toEqual([
      {
        key: 'com.labre.wardley.tag-pack.label',
        fallback: 'Wardley',
        source: 'tag',
      },
    ]);
  });

  test('a pack with no `labelKey` contributes no pack-level entry — unchanged', () => {
    expect(tagDefsTranslationEntries(pack())).toEqual([]);
  });

  test('`descriptionKey` on the tag and on a value, fallback from `description`', () => {
    const entries = tagDefsTranslationEntries(
      pack({
        tags: [
          nature({
            description: 'What kind of thing this component is.',
            descriptionKey: 'com.labre.wardley.tag.nature.description',
            values: [
              {
                id: 'wardley:nature/data',
                label: 'Data',
                description: 'Something that is RECORDED.',
                descriptionKey: 'com.labre.wardley.tag.nature.data.description',
              },
              // No `descriptionKey`: no entry, same as a host pack that never
              // sets one.
              { id: 'wardley:nature/activity', label: 'Activity' },
            ],
          }),
        ],
      })
    );

    expect(entries).toEqual([
      {
        key: 'com.labre.wardley.tag.nature.description',
        fallback: 'What kind of thing this component is.',
        source: 'tag',
      },
      {
        key: 'com.labre.wardley.tag.nature.data.description',
        fallback: 'Something that is RECORDED.',
        source: 'tag',
      },
    ]);
  });
});
