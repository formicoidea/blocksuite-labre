import type { TemplateCategory } from '@labre/affine-gfx-template';
import { roleIsA } from '@labre/std/gfx';
import { describe, expect, it, vi } from 'vitest';

import {
  createConstraintHexagon,
  createCynefin,
  createEstuarineMap,
} from '../actions';
import { ESTUARINE_NUDGES } from '../estuarine/nudges';
import { ESTUARINE_ROLE, ESTUARINE_ROLES } from '../estuarine/roles';
import {
  cynefinTemplateCategory,
  estuarineTemplateCategory,
} from '../templates';

type Added = Record<string, unknown>;

/**
 * Minimal GfxController stand-in: the creation actions only need a surface that
 * records the props they post, a viewport centre, and no-op selection.
 */
function fakeStd() {
  const added: Added[] = [];
  let n = 0;

  const gfx = {
    surface: {
      addElement: (props: Added) => {
        added.push(props);
        return `el-${n++}`;
      },
    },
    viewport: { centerX: 0, centerY: 0 },
    doc: { captureSync: vi.fn() },
    tool: { setTool: vi.fn() },
    selection: { set: vi.fn() },
  };

  return { std: { get: () => gfx } as never, added };
}

interface Snapshot {
  blocks: { children: { props: { elements: Record<string, Added> } }[] };
}

const elementsOf = (category: TemplateCategory) =>
  (category.templates as { content: unknown }[]).flatMap(template =>
    Object.values((template.content as Snapshot).blocks.children[0].props.elements)
  );

describe('estuarine role vocabulary', () => {
  it('indexes every declared role by its own id', () => {
    for (const id of Object.values(ESTUARINE_ROLE)) {
      expect(ESTUARINE_ROLES[id]?.id).toBe(id);
    }
    expect(Object.keys(ESTUARINE_ROLES)).toHaveLength(2);
  });

  it('declares both roles as nodes, measured by their bounds', () => {
    expect(ESTUARINE_ROLES[ESTUARINE_ROLE.map].kind).toBe('node');
    expect(ESTUARINE_ROLES[ESTUARINE_ROLE.constraint].kind).toBe('node');
  });

  it('keeps the map out of the constraint hierarchy', () => {
    // A frame is not one of the things it frames: a future rule written on
    // `estuarine:constraint` must never match the map it measures against.
    expect(
      roleIsA(ESTUARINE_ROLE.map, ESTUARINE_ROLE.constraint, ESTUARINE_ROLES)
    ).toBe(false);
    expect(
      roleIsA(ESTUARINE_ROLE.constraint, ESTUARINE_ROLE.map, ESTUARINE_ROLES)
    ).toBe(false);
    expect(
      roleIsA(ESTUARINE_ROLE.map, ESTUARINE_ROLE.map, ESTUARINE_ROLES)
    ).toBe(true);
  });

  it('is a null-prototype lookup table', () => {
    expect(Object.getPrototypeOf(ESTUARINE_ROLES)).toBeNull();
    expect(ESTUARINE_ROLES['toString']).toBeUndefined();
  });

  it('ships every nudge under the estuarine framework, ids namespaced', () => {
    expect(ESTUARINE_NUDGES).toHaveLength(4);
    for (const nudge of ESTUARINE_NUDGES) {
      expect(nudge.framework).toBe('estuarine');
      expect(nudge.id.startsWith('estuarine.')).toBe(true);
      expect(nudge.labelKey.startsWith('com.labre.estuarine.quality.')).toBe(
        true
      );
      // A host with no catalogue must still read the checklist.
      expect(nudge.fallback).toBeTruthy();
    }
    expect(new Set(ESTUARINE_NUDGES.map(nudge => nudge.id)).size).toBe(4);
  });
});

describe('role stamping — creation actions', () => {
  it('stamps the map role on a map created from the toolbox', () => {
    const { std, added } = fakeStd();
    createEstuarineMap(std);

    expect(added).toHaveLength(1);
    expect(added[0].type).toBe('estuarine');
    expect(added[0].role).toBe(ESTUARINE_ROLE.map);
  });

  it('stamps the constraint role on a hexagon', () => {
    const { std, added } = fakeStd();
    createConstraintHexagon(std);

    expect(added).toHaveLength(1);
    expect(added[0].type).toBe('shape');
    expect(added[0].shapeType).toBe('polygon');
    expect(added[0].role).toBe(ESTUARINE_ROLE.constraint);
  });

  it('leaves a Cynefin background neutral — no role, ever', () => {
    const { std, added } = fakeStd();
    createCynefin(std);

    expect(added).toHaveLength(1);
    expect(added[0].type).toBe('cynefin');
    expect(added[0].role).toBeUndefined();
  });
});

describe('role stamping — templates', () => {
  it('gives every template map and hexagon its role', () => {
    const elements = elementsOf(estuarineTemplateCategory);
    const maps = elements.filter(el => el.type === 'estuarine');
    const hexagons = elements.filter(el => el.shapeType === 'polygon');

    // Guard against the selectors silently matching nothing.
    expect(maps.length).toBeGreaterThan(0);
    expect(hexagons.length).toBeGreaterThan(0);
    for (const map of maps) expect(map.role).toBe(ESTUARINE_ROLE.map);
    for (const hexagon of hexagons) {
      expect(hexagon.role).toBe(ESTUARINE_ROLE.constraint);
    }
  });

  it('leaves the captions neutral — a name is nobody s artefact', () => {
    const captions = elementsOf(estuarineTemplateCategory).filter(
      el => el.type === 'text'
    );
    expect(captions.length).toBeGreaterThan(0);
    for (const caption of captions) expect(caption.role).toBeUndefined();
  });

  it('leaves every Cynefin template element neutral', () => {
    const elements = elementsOf(cynefinTemplateCategory);
    expect(elements.length).toBeGreaterThan(0);
    for (const element of elements) expect(element.role).toBeUndefined();
  });
});
