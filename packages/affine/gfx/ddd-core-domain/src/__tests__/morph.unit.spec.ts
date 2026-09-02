import {
  addDot,
  addMarker,
  CD_SUBDOMAINS,
  TEAM_TOPOLOGIES,
} from '@labre/affine-gfx-ddd-shared';
import {
  GroupElementModel,
  ShapeElementModel,
  TextElementModel,
} from '@labre/affine-model';
import type { BlockStdScope } from '@labre/std';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import {
  type CdMorphKind,
  CORE_DOMAIN_MORPH_FAMILIES,
  CORE_DOMAIN_MORPH_SPEC,
  coreDomainArtefactOf,
  coreDomainMorphClears,
  coreDomainMorphedCaption,
  coreDomainMorphProps,
} from '../morph';
import { CORE_DOMAIN_ROLE } from '../roles';

/**
 * What a Core Domain artefact may BECOME — the framework's half of the morph.
 *
 * The generic half (when the dropdown stands up, what one pick writes, that the
 * two hooks are honoured) is the surface package's; this file is about the
 * DATA: which kinds are reachable from which, that the patch is the palette's
 * own and not a second table, that a selected group resolves to the one shape
 * the role lives on, and that the words the composite owes the change follow the
 * two rules the notation gives them.
 */

const SUBDOMAINS = CD_SUBDOMAINS.map(preset => preset.kind);
const MARKERS = TEAM_TOPOLOGIES.map(preset => preset.kind);
const EVERY_KIND: CdMorphKind[] = [...SUBDOMAINS, ...MARKERS];

describe('the two declared families', () => {
  it('are the five dots and the three markers, in the shared tables order', () => {
    // Declaration order is menu order, and both are DERIVED from the preset
    // tables the sub-menu itself reads: a sixth dot added there arrives in the
    // dropdown, in the same place, with no edit to `morph.ts`.
    expect(CORE_DOMAIN_MORPH_FAMILIES).toEqual([SUBDOMAINS, MARKERS]);
    expect(SUBDOMAINS).toEqual([
      'bigBet',
      'platform',
      'outsourced',
      'bcCurrent',
      'bcFuture',
    ]);
    expect(MARKERS).toEqual(['collaboration', 'xaas', 'facilitating']);
  });

  it('never let a dot reach a marker, nor a marker a dot', () => {
    // The disjunction `roles.ts` draws: a sub-domain is plotted ON the chart, a
    // marker is an annotation ABOUT it, and the two families are the whole
    // reachable set — so the generic module has no family containing both and
    // offers nothing for a mixed selection.
    const members = CORE_DOMAIN_MORPH_FAMILIES.flat();
    expect(new Set(members).size).toBe(members.length);
    expect(CORE_DOMAIN_MORPH_FAMILIES).toHaveLength(2);
    for (const family of CORE_DOMAIN_MORPH_FAMILIES) {
      const roots = new Set(
        family.map(kind =>
          MARKERS.includes(kind as never) ? 'marker' : 'subdomain'
        )
      );
      expect(roots.size).toBe(1);
    }
  });

  it('leaves the chart and the movement out of every family', () => {
    // The chart is the frame of reference the artefacts are measured against,
    // and the movement is an edge: neither is another drawing of a dot.
    const members: string[] = [...CORE_DOMAIN_MORPH_FAMILIES.flat()];
    expect(members).not.toContain('chart');
    expect(members).not.toContain('movement');
    expect(members).not.toContain('subdomain');
    expect(members).not.toContain('marker');
  });
});

describe('the patch one kind is worth', () => {
  /** A surface that records what it is asked to write, as the shared suite has. */
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

  /** What the palette actually writes for one kind, as its shape props. */
  const created = (kind: CdMorphKind): Record<string, unknown> => {
    const { surface, added } = surfaceStub();
    const dot = CD_SUBDOMAINS.find(preset => preset.kind === kind);
    if (dot) {
      addDot(
        surface,
        stdStub(),
        0,
        0,
        dot.fill,
        dot.label,
        CORE_DOMAIN_ROLE[dot.kind]
      );
    } else {
      const marker = TEAM_TOPOLOGIES.find(preset => preset.kind === kind)!;
      addMarker(surface, stdStub(), 0, 0, {
        fill: marker.fill,
        letter: marker.letter,
        label: marker.label,
        role: CORE_DOMAIN_ROLE[marker.kind],
      });
    }
    // The artefact is the first element written: the ellipse / the square, the
    // one the role rides on. The caption and the glyph follow it.
    const props = { ...added[0] };
    delete props.type;
    delete props.xywh;
    delete props.text;
    return props;
  };

  it('is the creation preset, minus identity, geometry and words', () => {
    // Derived, not restated: the palette and the morph cannot drift.
    for (const kind of EVERY_KIND) {
      expect(coreDomainMorphProps(kind)).toEqual(created(kind));
    }
  });

  it('never carries type, xywh or text', () => {
    for (const kind of EVERY_KIND) {
      const props = coreDomainMorphProps(kind);
      expect(props).not.toHaveProperty('type');
      expect(props).not.toHaveProperty('xywh');
      expect(props).not.toHaveProperty('text');
    }
  });

  it('writes the role and the colour a reader reads the chart by', () => {
    for (const preset of CD_SUBDOMAINS) {
      expect(coreDomainMorphProps(preset.kind)).toMatchObject({
        role: CORE_DOMAIN_ROLE[preset.kind],
        fillColor: preset.fill,
        shapeType: 'ellipse',
      });
    }
    for (const preset of TEAM_TOPOLOGIES) {
      expect(coreDomainMorphProps(preset.kind)).toMatchObject({
        role: CORE_DOMAIN_ROLE[preset.kind],
        fillColor: preset.fill,
        shapeType: 'rect',
        radius: 4,
      });
    }
  });

  it('carries the whole preset even where a family agrees on it', () => {
    // Inert on today's table and shipped anyway: a family grows by DECLARATION,
    // and nobody would be prompted to check the presets on the day one gains a
    // member that outlines itself differently. Asserted so the claim is visible.
    const bigBet = coreDomainMorphProps('bigBet');
    const platform = coreDomainMorphProps('platform');
    expect(bigBet.strokeColor).toBe(platform.strokeColor);
    expect(bigBet.strokeWidth).toBe(platform.strokeWidth);
    expect(bigBet.fillColor).not.toBe(platform.fillColor);
  });

  it('has nothing to clear on this table, and says so by deriving it', () => {
    // `dddShapeProps` writes one fixed key set whatever the options say. The day
    // one preset stops writing a key, this stops being empty.
    for (const kind of EVERY_KIND) {
      expect(coreDomainMorphClears(kind)).toEqual([]);
    }
  });
});

/* ── Resolving the composite ───────────────────────────────────────────── */

/**
 * A model built detached, the way `c4/morph.unit.spec.ts` builds one: the
 * `instanceof` gates the resolution runs are the shipped ones, and the accessors
 * it reads are defined as plain values rather than driven through a Yjs document
 * that no unit test has.
 */
function detached<T>(
  Ctor: abstract new (...args: never[]) => T,
  props: Record<string, unknown>
): T {
  const element = Object.create(Ctor.prototype) as object;
  for (const [key, value] of Object.entries(props)) {
    Object.defineProperty(element, key, { value, configurable: true });
  }
  return element as T;
}

/** A shape at a box, carrying whatever role the case is about. */
const shape = (
  role: string | undefined,
  box: [number, number, number, number]
) =>
  detached(ShapeElementModel, {
    role,
    x: box[0],
    y: box[1],
    w: box[2],
    h: box[3],
  }) as unknown as GfxPrimitiveElementModel;

const group = (children: unknown[]) =>
  detached(GroupElementModel, {
    childElements: children,
  }) as unknown as GfxPrimitiveElementModel;

/** The ellipse of a dot placed at the origin, as `addDot` lays it out. */
const dotShape = (kind: CdMorphKind) =>
  shape(CORE_DOMAIN_ROLE[kind as never], [-13, -13, 26, 26]);

/** The square of a marker placed at the origin, as `addMarker` lays it out. */
const markerShape = (kind: CdMorphKind) =>
  shape(CORE_DOMAIN_ROLE[kind as never], [-15, -15, 30, 30]);

describe('resolving a selected group to its artefact', () => {
  it('finds the one shape a dot is built round', () => {
    const dot = dotShape('bigBet');
    const resolved = coreDomainArtefactOf(group([dot, {}]));
    expect(resolved).toBe(dot);
    expect(CORE_DOMAIN_MORPH_SPEC.kindOf(resolved!)).toBe('bigBet');
  });

  it('finds the square of a marker past its letter and its caption', () => {
    const square = markerShape('xaas');
    expect(coreDomainArtefactOf(group([square, {}, {}]))).toBe(square);
  });

  it('refuses anything that is not a group', () => {
    expect(coreDomainArtefactOf(dotShape('platform'))).toBeUndefined();
  });

  it('refuses a group holding no Core Domain artefact at all', () => {
    // A plain lasso round two rectangles, and a group of somebody else's:
    // neither shape carries a role this framework wrote.
    expect(
      coreDomainArtefactOf(
        group([
          shape(undefined, [0, 0, 10, 10]),
          shape('c4:container', [0, 0, 10, 10]),
        ])
      )
    ).toBeUndefined();
    expect(coreDomainArtefactOf(group([]))).toBeUndefined();
  });

  it('refuses a dot drawn before the roles existed', () => {
    // No backfill, ever (#71): an element with no role has no kind, and the
    // colour is never read back to invent one. It opens and paints exactly as
    // it always did; it is simply not offered a menu.
    expect(
      coreDomainArtefactOf(group([shape(undefined, [-13, -13, 26, 26])]))
    ).toBeUndefined();
  });

  it('refuses a group holding two of them', () => {
    // Morphing "it" would mean picking one by document order, and the honest
    // answer to an ambiguous selection is nothing.
    expect(
      coreDomainArtefactOf(group([dotShape('bigBet'), dotShape('platform')]))
    ).toBeUndefined();
    // …including one of each family, which the generic module would refuse a
    // second time for having no common family.
    expect(
      coreDomainArtefactOf(group([dotShape('bigBet'), markerShape('xaas')]))
    ).toBeUndefined();
  });

  it('reads the kind back out of the role, for all eight', () => {
    for (const kind of EVERY_KIND) {
      expect(
        CORE_DOMAIN_MORPH_SPEC.kindOf(
          shape(CORE_DOMAIN_ROLE[kind], [0, 0, 1, 1])
        )
      ).toBe(kind);
    }
    // The roles that are NOT a kind: the abstract parents, the chart, the edge.
    for (const role of [
      CORE_DOMAIN_ROLE.subdomain,
      CORE_DOMAIN_ROLE.marker,
      CORE_DOMAIN_ROLE.chart,
      CORE_DOMAIN_ROLE.movement,
      'wardley:component',
      'toString',
    ]) {
      expect(
        CORE_DOMAIN_MORPH_SPEC.kindOf(shape(role, [0, 0, 1, 1]))
      ).toBeUndefined();
    }
  });
});

/* ── The words the composite owes the change ───────────────────────────── */

describe('the caption follows the artefact, or does not', () => {
  it('carries an untouched prompt across to the target own name', () => {
    expect(
      coreDomainMorphedCaption('bigBet', 'platform', 'Big-bet sub-domain')
    ).toBe('Platform sub-domain');
    expect(
      coreDomainMorphedCaption('collaboration', 'xaas', 'Collaboration')
    ).toBe('X-as-a-Service');
    // Padding is not content: the prompt is read trimmed, as it is stored.
    expect(
      coreDomainMorphedCaption('bcCurrent', 'bcFuture', '  Bounded context  ')
    ).toBe('Future position');
  });

  it('leaves every name a human could have written', () => {
    for (const raw of [
      'Billing',
      'Big-bet sub-domain (2027)',
      'Platform sub-domain',
      'big-bet sub-domain',
      '',
      '   ',
      null,
      undefined,
    ]) {
      expect(coreDomainMorphedCaption('bigBet', 'platform', raw)).toBeNull();
    }
  });

  it('is a no-op wherever the two kinds are named the same', () => {
    for (const kind of EVERY_KIND) {
      const label = coreDomainMorphedCaption(kind, kind, null);
      expect(label).toBeNull();
    }
  });
});

describe('afterMorph — the caption is content, the letter is notation', () => {
  /**
   * A canvas text at a box, with a real `Y.Text` and a transacting surface.
   *
   * Attached to a `Y.Doc` rather than free-standing: a detached `Y.Text` keeps
   * its content in a pending buffer and reads back empty, so the rewrite this
   * suite is about would be invisible.
   */
  const text = (
    words: string,
    box: [number, number, number, number]
  ): TextElementModel => {
    const doc = new Y.Doc();
    const yText = doc.getText('words');
    yText.insert(0, words);
    return detached(TextElementModel, {
      text: yText,
      x: box[0],
      y: box[1],
      w: box[2],
      h: box[3],
      isLocked: () => false,
      surface: { store: { transact: (fn: () => void) => doc.transact(fn) } },
    });
  };

  /** A dot composite at the origin, laid out as `addDot` lays one out. */
  const dot = (kind: CdMorphKind, caption: string) => {
    const label = text(caption, [19, -7, 170, 24]);
    return {
      label,
      group: group([dotShape(kind), label]),
    };
  };

  /** A marker composite at the origin, laid out as `addMarker` lays one out. */
  const marker = (kind: CdMorphKind, caption: string, letter: string) => {
    // The glyph is CENTRED on the square and the caption stands beside it —
    // which is how `wordsOf` tells them apart, and it is the notation's own
    // arrangement rather than a detail of the builder.
    const glyph = text(letter, [-15, -9, 30, 25]);
    const label = text(caption, [21, -7, 150, 24]);
    return { glyph, label, group: group([markerShape(kind), glyph, label]) };
  };

  const morph = (
    model: GfxPrimitiveElementModel,
    from: CdMorphKind,
    to: CdMorphKind
  ) => CORE_DOMAIN_MORPH_SPEC.afterMorph?.(model, from, to);

  it('rewrites a dot caption that is still the creation prompt', () => {
    const { group: composite, label } = dot('bigBet', 'Big-bet sub-domain');
    morph(composite, 'bigBet', 'platform');
    expect(label.text.toString()).toBe('Platform sub-domain');
  });

  it('leaves a dot caption the author wrote', () => {
    const { group: composite, label } = dot('bigBet', 'Billing');
    morph(composite, 'bigBet', 'platform');
    expect(label.text.toString()).toBe('Billing');
  });

  it('always rewrites the marker letter, prompt or not', () => {
    // C, X and F are not words anybody wrote: they are Team Topologies own
    // glyphs, and a square that has become an X-as-a-Service while still
    // showing a C is the picture lying about itself.
    const fresh = marker('collaboration', 'Collaboration', 'C');
    morph(fresh.group, 'collaboration', 'xaas');
    expect(fresh.glyph.text.toString()).toBe('X');
    expect(fresh.label.text.toString()).toBe('X-as-a-Service');

    // …and it repairs a glyph a previous edit left wrong, where the caption a
    // human typed still survives untouched.
    const edited = marker('collaboration', 'Team Alpha ↔ Team Beta', 'Z');
    morph(edited.group, 'collaboration', 'facilitating');
    expect(edited.glyph.text.toString()).toBe('F');
    expect(edited.label.text.toString()).toBe('Team Alpha ↔ Team Beta');
  });

  it('touches no glyph on a dot, which has none', () => {
    // A dot's one text is beside the ellipse, so it is the caption and never
    // the letter — the geometry says so, and a dot morph would otherwise
    // overwrite the name with a character.
    const { group: composite, label } = dot('platform', 'Platform sub-domain');
    morph(composite, 'platform', 'bcFuture');
    expect(label.text.toString()).toBe('Future position');
  });

  it('leaves a group it cannot resolve entirely alone', () => {
    const orphan = text('Big-bet sub-domain', [19, -7, 170, 24]);
    morph(group([orphan]), 'bigBet', 'platform');
    expect(orphan.text.toString()).toBe('Big-bet sub-domain');
  });
});

describe('the spec handed to the generic module', () => {
  it('is declared on the GROUP, because that is what a click selects', () => {
    expect(CORE_DOMAIN_MORPH_SPEC.modelType).toBe(GroupElementModel);
    expect(CORE_DOMAIN_MORPH_SPEC.resolveTarget).toBe(coreDomainArtefactOf);
    expect(CORE_DOMAIN_MORPH_SPEC.framework).toBe('ddd-core-domain');
  });

  it('reports the artefact own role, one per kind', () => {
    for (const kind of EVERY_KIND) {
      expect(CORE_DOMAIN_MORPH_SPEC.roleOf(kind)).toBe(CORE_DOMAIN_ROLE[kind]);
    }
    // Eight kinds, eight distinct roles: nothing collapses here, unlike C4's
    // person / external person.
    expect(new Set(EVERY_KIND.map(CORE_DOMAIN_MORPH_SPEC.roleOf)).size).toBe(
      EVERY_KIND.length
    );
  });

  it('names and draws every kind from its own creation command', () => {
    // Reused rather than redrawn, so the dropdown says what the sub-menu entry
    // that places one says.
    expect(CORE_DOMAIN_MORPH_SPEC.labelOf('platform')).toEqual({
      key: 'com.labre.commands.ddd-core-domain.addPlatform',
      fallback: 'Platform sub-domain',
    });
    expect(CORE_DOMAIN_MORPH_SPEC.labelOf('xaas')).toEqual({
      key: 'com.labre.commands.ddd-core-domain.addXaas',
      fallback: 'X-as-a-Service',
    });
    for (const kind of EVERY_KIND) {
      expect(CORE_DOMAIN_MORPH_SPEC.iconOf(kind)).toBeTruthy();
    }
  });

  it('every swatch declares its own size', () => {
    // The senior sub-menu sizes icons with a container rule
    // (`.button-group-container svg`), so a swatch that carries no width of its
    // own renders there and collapses to nothing in the morph dropdown — which
    // is exactly how the five dots shipped invisible once (recette of
    // 02/09/2026). The picker owns no such rule, so the drawing must.
    for (const kind of EVERY_KIND) {
      const markup = CORE_DOMAIN_MORPH_SPEC.iconOf(kind).strings.join('');
      expect(markup, kind).toContain('width="24"');
      expect(markup, kind).toContain('height="24"');
    }
  });
});
