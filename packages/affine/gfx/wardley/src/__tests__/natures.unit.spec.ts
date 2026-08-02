/**
 * The Wardley **nature** pack — the framework's type-3 qualification (MF3,
 * ADR 0007), and the fact it makes readable.
 *
 * Two things are asserted here and nowhere else:
 *
 * 1. The library's own pack is a WELL-FORMED pack on the host's mechanism. It
 *    gets no privilege: it goes through `buildUniverseRegistry` like a client's
 *    private taxonomy, and it must come out with zero issues. A pack the
 *    library ships that would be rejected from a host is a broken example.
 * 2. **The nature is readable by the rules engine**, off any element, with no
 *    registry, no container and no allocation of the definitions. That is what
 *    lets a wave-3 rule be written about it — the preparation this slice owes
 *    Q6 and MF3 without implementing either.
 */
import {
  buildUniverseRegistry,
  tagAppliesToRole,
} from '@labre/affine-shared/services';
import {
  elementTagValues,
  hasElementTagValue,
  readElementTags,
  type GfxPrimitiveElementModel,
} from '@labre/std/gfx';
import { describe, expect, test } from 'vitest';
import * as Y from 'yjs';

import {
  WARDLEY_NATURE,
  WARDLEY_NATURE_TAG_ID,
  WARDLEY_TAG_DEFS,
} from '../natures';
import { WARDLEY_ROLE, WARDLEY_ROLES } from '../roles';

const registry = buildUniverseRegistry([WARDLEY_TAG_DEFS]);

describe('the pack the library ships', () => {
  test('merges with no issue at all', () => {
    // Same mechanism, same validation, no privilege: an id typo here would be
    // reported exactly as a host's would.
    expect(registry.issues()).toEqual([]);
    expect(registry.frameworks()).toEqual(['wardley']);
  });

  test('declares the four natures, single-valued', () => {
    const nature = registry.tag(WARDLEY_NATURE_TAG_ID)!;

    expect(nature).toBeTruthy();
    // A component is ONE of the four. Where practitioners disagree, the
    // disagreement is the finding — a multi-valued nature would let the
    // ambiguity hide inside the element.
    expect(nature.cardinality).toBe('single');
    expect((nature.values as { id: string }[]).map(v => v.id)).toEqual([
      WARDLEY_NATURE.activity,
      WARDLEY_NATURE.data,
      WARDLEY_NATURE.practice,
      WARDLEY_NATURE.knowledge,
    ]);
  });

  test('qualifies components and their specialisations, and nothing else', () => {
    const nature = registry.tag(WARDLEY_NATURE_TAG_ID)!;

    for (const role of [
      WARDLEY_ROLE.component,
      // Free, through `roleIsA` — the entire reason role hierarchy is data.
      WARDLEY_ROLE.market,
      WARDLEY_ROLE.ecosystem,
    ]) {
      expect(tagAppliesToRole(nature, role, WARDLEY_ROLES), role).toBe(true);
    }

    for (const role of [
      // A user / need has no nature, it has a demand — which is why `anchor` is
      // deliberately not a child of `component`.
      WARDLEY_ROLE.anchor,
      // The map frames the artefacts; it is not one of them.
      WARDLEY_ROLE.map,
      // Annotations and chrome.
      WARDLEY_ROLE.changeArrow,
      WARDLEY_ROLE.inertia,
      WARDLEY_ROLE.label,
      WARDLEY_ROLE.dependency,
    ]) {
      expect(tagAppliesToRole(nature, role, WARDLEY_ROLES), role).toBe(false);
    }
  });

  test("a client's private pack extends it without a library release", () => {
    const merged = buildUniverseRegistry([
      WARDLEY_TAG_DEFS,
      {
        formatVersion: 1,
        packId: 'acme-private',
        framework: 'wardley',
        label: 'ACME',
        tags: [
          {
            id: 'wardley:criticality',
            label: 'Criticality',
            cardinality: 'single',
            appliesTo: [WARDLEY_ROLE.component],
            values: [{ id: 'wardley:criticality/high', label: 'High' }],
          },
        ],
      },
    ]);

    expect(merged.issues()).toEqual([]);
    expect(
      merged.tagsForRole(WARDLEY_ROLE.component, WARDLEY_ROLES).map(t => t.id)
    ).toEqual([WARDLEY_NATURE_TAG_ID, 'wardley:criticality']);
  });
});

/**
 * A stand-in for a wave-3 rule reading the fact off an element. Deliberately
 * shaped like one: it takes the element and nothing else — no registry, no
 * container, no definitions.
 */
function natureOf(element: GfxPrimitiveElementModel): string | undefined {
  return elementTagValues(element, WARDLEY_NATURE_TAG_ID)[0];
}

/**
 * An element carrying a qualification, without a surface.
 *
 * The map is attached to a real `Y.Doc` on purpose: a `Y.Map` that has not been
 * integrated holds its content in `_prelimContent`, so `get`, `entries` and
 * `size` all read empty. A test built on a detached map would assert nothing.
 */
function qualified(tags?: Record<string, string[]>): GfxPrimitiveElementModel {
  let map: Y.Map<string[]> | undefined;
  if (tags) {
    const doc = new Y.Doc();
    map = doc.getMap('element') as Y.Map<string[]>;
    doc.transact(() => {
      for (const [k, v] of Object.entries(tags)) map!.set(k, v);
    });
  }
  return {
    id: 'el',
    role: WARDLEY_ROLE.component,
    tags: map,
  } as unknown as GfxPrimitiveElementModel;
}

describe('the nature is a fact the engine can read', () => {
  test('off a qualified element, with no registry in the way', () => {
    const el = qualified({ [WARDLEY_NATURE_TAG_ID]: [WARDLEY_NATURE.data] });

    expect(natureOf(el)).toBe(WARDLEY_NATURE.data);
    expect(hasElementTagValue(el, WARDLEY_NATURE_TAG_ID, WARDLEY_NATURE.data)).toBe(
      true
    );
    expect(readElementTags(el)).toEqual({
      [WARDLEY_NATURE_TAG_ID]: [WARDLEY_NATURE.data],
    });
  });

  test('off an UNqualified element, without a guard at every call site', () => {
    // A rule runs per element per evaluation, over boards where most elements
    // carry nothing. "Absent" has to be a normal answer, not a special case.
    expect(natureOf(qualified())).toBeUndefined();
    expect(readElementTags(qualified())).toEqual({});
  });

  test('a value whose def has vanished is still readable', () => {
    // Defs are runtime configuration and are never persisted. A rule reads what
    // the DOCUMENT says, not what the registry currently admits — otherwise a
    // removed pack would silently change every verdict on old boards.
    const el = qualified({ [WARDLEY_NATURE_TAG_ID]: ['wardley:nature/retired'] });

    expect(natureOf(el)).toBe('wardley:nature/retired');
    expect(registry.tag('wardley:nature/retired')).toBeUndefined();
  });
});
