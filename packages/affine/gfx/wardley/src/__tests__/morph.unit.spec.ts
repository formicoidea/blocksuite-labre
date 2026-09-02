import {
  ConnectorElementModel,
  GroupElementModel,
  ShapeElementModel,
  TextElementModel,
  type WardleyNodeKind,
  WardleyNodeElementModel,
} from '@labre/affine-model';
import { deserializeXYWH } from '@labre/global/gfx';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import {
  createWardleyMarket,
  createWardleyNode,
  createWardleyPipeline,
} from '../actions';
import {
  WARDLEY_MORPH_FAMILIES,
  WARDLEY_MORPH_SPEC,
  type WardleyMorphKind,
  wardleyMorphComposite,
  wardleyMorphedLabel,
  wardleyNodeOfComponent,
} from '../morph';
import { HANDLE_SIZE, MARKET_DOT_SIZE } from '../node/consts';
import {
  type WardleyArtefactKind,
  WARDLEY_NODE_LABEL,
  WARDLEY_NODE_SIZE,
  wardleyMorphClears,
  wardleyMorphProps,
  wardleyNodeProps,
} from '../presets';
import { WARDLEY_ROLE } from '../roles';

/**
 * What a Wardley artefact may BECOME — the framework's half of the morph.
 *
 * The generic half (when the dropdown stands up, what one pick writes, that the
 * two hooks are honoured) is the surface package's; this file is about the DATA
 * and about the STRUCTURE: which kinds are reachable, that the patch is the
 * palette's own and not a second table, that a selected group resolves to the
 * one node the kind lives on, and — the half C4 and BPMN never needed — that
 * the glyph a kind IS follows the kind. A market without its three dots is not
 * a market, and a patch cannot create an element.
 */

const FAMILY = WARDLEY_MORPH_FAMILIES.flat();
const EVERY_KIND = Object.keys(WARDLEY_NODE_SIZE) as WardleyArtefactKind[];

describe('the declared family', () => {
  it('is the four ways of drawing one link in the value chain', () => {
    expect(WARDLEY_MORPH_FAMILIES).toEqual([
      // Declaration order is menu order, and it opens on the plain component:
      // the undecorated artefact is the honest first draft.
      ['component', 'market', 'ecosystem', 'pipeline'],
    ]);
  });

  it('never offers the anchor or the method, in either direction', () => {
    // The anchor is what the value chain HANGS FROM, not a link in it — a role
    // of its own in `roles.ts` for exactly that reason. The method is an
    // annotation ON a component whose fill encodes a decision, and morphing it
    // away would discard that decision silently.
    expect(FAMILY).not.toContain('anchor');
    expect(FAMILY).not.toContain('method');
    // …and the handle is not an artefact at all: nobody draws one, so it is not
    // in the model's own list of things this pack presets either.
    expect(FAMILY).not.toContain('handle');
    expect(EVERY_KIND).not.toContain('handle' as WardleyArtefactKind);
  });

  it('names only real kinds, each in at most one family', () => {
    for (const kind of FAMILY) expect(EVERY_KIND).toContain(kind);
    expect(new Set(FAMILY).size).toBe(FAMILY.length);
  });

  it('reports the node role of each member, which the notation nests', () => {
    for (const kind of FAMILY) {
      expect(WARDLEY_MORPH_SPEC.roleOf(kind)).toBe(WARDLEY_ROLE[kind]);
    }
    // Four kinds, four roles: unlike C4's `person`/`person-ext`, nothing
    // collapses here — a market IS a different claim from a component, and the
    // role tree says so by making one the parent of the other.
    expect(
      new Set(FAMILY.map(kind => WARDLEY_MORPH_SPEC.roleOf(kind))).size
    ).toBe(FAMILY.length);
  });

  it('names and draws every member from its own creation command', () => {
    // Reused rather than redrawn, so the dropdown says what the sub-menu entry
    // that draws one says.
    expect(WARDLEY_MORPH_SPEC.labelOf('market')).toEqual({
      key: 'com.labre.commands.wardley.addMarket',
      fallback: 'Market',
    });
    expect(WARDLEY_MORPH_SPEC.labelOf('pipeline').fallback).toBe('Pipeline');
    for (const kind of FAMILY) {
      expect(WARDLEY_MORPH_SPEC.iconOf(kind), kind).toBeTruthy();
    }
  });

  it('is declared on the GROUP, because that is what a click selects', () => {
    expect(WARDLEY_MORPH_SPEC.modelType).toBe(GroupElementModel);
    expect(WARDLEY_MORPH_SPEC.resolveTarget).toBe(wardleyNodeOfComponent);
    expect(WARDLEY_MORPH_SPEC.afterMorph).toBe(wardleyMorphComposite);
    // The wire value `reportCommandTelemetry` already sends for this
    // framework — `FrameworkElementMorphed` is emitted by the generic module.
    expect(WARDLEY_MORPH_SPEC.framework).toBe('wardley');
  });
});

describe('the patch one kind is worth', () => {
  it('is the creation builder, minus identity, geometry and words', () => {
    for (const kind of EVERY_KIND) {
      const created: Record<string, unknown> = {
        ...wardleyNodeProps(kind, { xywh: '[1,2,3,4]' }),
      };
      delete created.type;
      delete created.xywh;
      // Derived, not restated: the palette and the morph cannot drift.
      expect(wardleyMorphProps(kind), kind).toEqual(created);
    }
  });

  it('never carries type, xywh or text', () => {
    for (const kind of EVERY_KIND) {
      const props = wardleyMorphProps(kind);
      expect(props).not.toHaveProperty('type');
      expect(props).not.toHaveProperty('xywh');
      expect(props).not.toHaveProperty('text');
      expect(props).toMatchObject({ kind, role: WARDLEY_ROLE[kind] });
    }
  });

  it('flips the shape itself between the pipeline and the three circles', () => {
    // The whole reason a `{kind, role}` patch is not enough on this pack: a
    // pipeline is a square-cornered RECT with a semi-transparent fill and the
    // rest of the family are opaque white ellipses. Two keys would leave a
    // "pipeline" still drawn as a circle.
    expect(wardleyMorphProps('pipeline').shapeType).toBe('rect');
    for (const kind of ['component', 'market', 'ecosystem'] as const) {
      expect(wardleyMorphProps(kind).shapeType, kind).toBe('ellipse');
    }
    expect(wardleyMorphProps('pipeline').fillColor).not.toBe(
      wardleyMorphProps('component').fillColor
    );
  });

  it('clears the one key only the pipeline writes', () => {
    // A patch cannot express absence: a pipeline morphed back to a component
    // would otherwise keep `radius: 0` in the Y.Map, silently in force on an
    // ellipse. Derived from the presets, never listed.
    expect(wardleyMorphClears('pipeline')).toEqual([]);
    for (const kind of ['component', 'market', 'ecosystem'] as const) {
      expect(wardleyMorphClears(kind), kind).toEqual(['radius']);
    }
  });

  it('keeps the canonical sizes distinct, because they ARE the notation', () => {
    // A market is bigger than a component so a reader can tell them apart at a
    // glance, and an ecosystem bigger again. This table is what the morph
    // re-centres on, and the reason it re-centres at all.
    const { component, market, ecosystem, pipeline } = WARDLEY_NODE_SIZE;
    expect(component.w).toBeLessThan(market.w);
    expect(market.w).toBeLessThan(ecosystem.w);
    // …and the pipeline is not a circle at all: a wide, thin bar.
    expect(pipeline.w).toBeGreaterThan(pipeline.h * 4);
  });
});

/* ── The name, when the artefact becomes something else ────────────────── */

describe('wardleyMorphedLabel — the name follows the shape, or does not', () => {
  it('carries an untouched prompt across to the target own name', () => {
    expect(wardleyMorphedLabel('component', 'market', 'Component')).toBe(
      'Market'
    );
    expect(wardleyMorphedLabel('market', 'pipeline', 'Market')).toBe(
      'Pipeline'
    );
    expect(wardleyMorphedLabel('pipeline', 'ecosystem', 'Pipeline')).toBe(
      'Ecosystem'
    );
    // Padding is not content: the prompt is read trimmed, as it is stored.
    expect(wardleyMorphedLabel('component', 'ecosystem', '  Component ')).toBe(
      'Ecosystem'
    );
  });

  it('leaves every name a human could have written', () => {
    // The PO's "the label is intact", stated as the cases that must survive: a
    // real name, the prompt with a word added, another kind's prompt, an
    // emptied label.
    for (const raw of [
      'Kettle',
      'Component of record',
      'Market',
      'component',
      '',
      '   ',
      null,
      undefined,
    ]) {
      expect(wardleyMorphedLabel('component', 'market', raw)).toBeNull();
    }
  });
});

/* ── Resolving the composite ───────────────────────────────────────────── */

/**
 * A model built detached, the way the C4 morph spec builds one: the
 * `instanceof` gates the resolution runs are the shipped ones, and the
 * accessors it reads are plain values rather than a Yjs document no unit test
 * has.
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

const node = (kind: WardleyNodeKind, role?: string) =>
  detached(WardleyNodeElementModel, {
    kind,
    role: role === undefined ? WARDLEY_ROLE[kind] : role,
  }) as unknown as GfxPrimitiveElementModel;

const grouped = (children: unknown[]) =>
  detached(GroupElementModel, {
    childElements: children,
  }) as unknown as GfxPrimitiveElementModel;

describe('resolving a selected group to the node the kind lives on', () => {
  it('finds the one circle a component is built round', () => {
    const circle = node('component');
    const resolved = wardleyNodeOfComponent(grouped([circle, {}]));
    expect(resolved).toBe(circle);
    expect(WARDLEY_MORPH_SPEC.kindOf(resolved!)).toBe('component');
  });

  it('finds a market by its circle, never by its three dots', () => {
    // The dots are the GLYPH's wiring and carry no role by construction, which
    // is exactly what excludes them here — the same property that stops every
    // market reporting an overlap with itself (W3).
    const circle = node('market');
    const neutral = [0, 1, 2].map(() =>
      detached(WardleyNodeElementModel, { kind: 'component', role: undefined })
    );
    expect(wardleyNodeOfComponent(grouped([circle, ...neutral]))).toBe(circle);
  });

  it('finds a pipeline body through the nested group, never its handle', () => {
    // A drawn pipeline is (body + (handle + label)): a flat pass over
    // `childElements` would find neither, and a pass that ignored `kind` would
    // find two.
    const body = node('pipeline');
    const handle = node('handle');
    const inner = grouped([handle, {}]);
    expect(wardleyNodeOfComponent(grouped([body, inner]))).toBe(body);
  });

  it('refuses anything that is not a group', () => {
    expect(wardleyNodeOfComponent(node('component'))).toBeUndefined();
  });

  it('refuses a group holding no Wardley artefact at all', () => {
    // A plain lasso round two rectangles, and a group of things this family
    // does not name — an anchor and a method are both real Wardley nodes and
    // neither is morphable.
    const alien = detached(ShapeElementModel, {}) as unknown;
    expect(wardleyNodeOfComponent(grouped([alien, {}]))).toBeUndefined();
    expect(wardleyNodeOfComponent(grouped([]))).toBeUndefined();
    expect(wardleyNodeOfComponent(grouped([node('anchor')]))).toBeUndefined();
    expect(wardleyNodeOfComponent(grouped([node('method')]))).toBeUndefined();
  });

  it('refuses a group holding two of them', () => {
    // Morphing "it" would mean picking one by document order, and the honest
    // answer to an ambiguous selection is nothing.
    expect(
      wardleyNodeOfComponent(grouped([node('component'), node('market')]))
    ).toBeUndefined();
  });

  it('answers no kind for the pieces that are not artefacts', () => {
    for (const kind of ['anchor', 'method', 'handle'] as const) {
      expect(WARDLEY_MORPH_SPEC.kindOf(node(kind)), kind).toBeUndefined();
    }
  });
});

/* ── The structural morph ──────────────────────────────────────────────── */

type Stub = Record<string, unknown>;

/**
 * A board the real creation actions can draw on, and the morph can rewrite.
 *
 * Prototype-grafted models over a Map, because everything under test here is a
 * handful of surface calls — `addElement`, `deleteElement`, `updateElement` —
 * plus a group's `children`. What it buys is the assertion the rest could not
 * make: the composites are built by the SHIPPED `createWardleyMarket` /
 * `createWardleyPipeline`, so "a morphed artefact is indistinguishable from a
 * drawn one" is a comparison between two real things rather than between the
 * morph and a second description of what it should have done.
 */
function board() {
  const doc = new Y.Doc();
  const texts = doc.getMap<Y.Text>('texts');
  const elements = new Map<string, Stub>();
  let seq = 0;
  let selected = '';

  const define = (target: object, key: string, value: unknown) =>
    Object.defineProperty(target, key, {
      value,
      writable: true,
      configurable: true,
      enumerable: true,
    });

  const CTORS: Record<string, abstract new (...args: never[]) => unknown> = {
    wardleyNode: WardleyNodeElementModel,
    text: TextElementModel,
    connector: ConnectorElementModel,
    group: GroupElementModel,
  };

  const materialize = (id: string, props: Stub) => {
    const model = Object.create(CTORS[props.type as string].prototype) as Stub &
      object;

    for (const [key, value] of Object.entries(props)) {
      if (key !== 'type') define(model, key, value);
    }
    define(model, 'id', id);
    define(model, 'isLocked', () => false);
    // The real `clearField` removes the key from the Y.Map; a removed key reads
    // as `undefined`, which is what this leaves behind.
    define(model, 'clearField', (key: string) => define(model, key, undefined));
    Object.defineProperty(model, 'surface', {
      get: () => surface,
      configurable: true,
    });
    // The shipped getter memoizes through `this._local`, which only a mounted
    // model has; the arithmetic it does is `deserializeXYWH` and nothing else.
    Object.defineProperty(model, 'deserializedXYWH', {
      get: () => deserializeXYWH(String((model as Stub).xywh ?? '[0,0,0,0]')),
      configurable: true,
    });
    Object.defineProperty(model, 'group', {
      get: () =>
        [...elements.values()].find(
          candidate =>
            candidate instanceof GroupElementModel &&
            (candidate as unknown as { childIds: Set<string> }).childIds.has(id)
        ) ?? null,
      configurable: true,
    });

    if (props.type === 'text') {
      texts.set(id, new Y.Text());
      const live = texts.get(id)!;
      live.insert(0, String(props.text ?? ''));
      define(model, 'text', live);
    }

    if (props.type === 'group') {
      const childIds = new Set(
        Object.keys((props.children as Record<string, boolean>) ?? {})
      );
      define(model, 'childIds', childIds);
      define(model, 'addChild', (child: { id: string }) =>
        childIds.add(child.id)
      );
      define(model, 'removeChild', (child: { id: string }) =>
        childIds.delete(child.id)
      );
      Object.defineProperty(model, 'childElements', {
        get: () =>
          [...childIds].map(childId => elements.get(childId)).filter(Boolean),
        configurable: true,
      });
    }

    return model;
  };

  const surface = {
    store: { transact: (fn: () => void) => fn() },
    get elementModels() {
      return [...elements.values()];
    },
    // `unknown` on the way out, not `Stub`: every caller knows which model it
    // just asked for, and a stub map cannot prove it to the compiler.
    getElementById: (id: string): unknown => elements.get(id) ?? null,
    getElementsByType: () => [],
    addElement: (props: Stub) => {
      const id = `el-${++seq}`;
      elements.set(id, materialize(id, props));
      return id;
    },
    updateElement: (id: string, props: Stub) => {
      const model = elements.get(id);
      if (!model) return;
      for (const [key, value] of Object.entries(props)) {
        define(model as object, key, value);
      }
    },
    deleteElement: (id: string) => {
      const model = elements.get(id);
      if (!model) return;
      // Mirrors the shipped surface: leaving the board takes the child out of
      // whatever group held it.
      for (const candidate of elements.values()) {
        if (candidate instanceof GroupElementModel) {
          (
            candidate as Stub & { removeChild: (m: unknown) => void }
          ).removeChild(model);
        }
      }
      elements.delete(id);
    },
  };

  const gfx = {
    surface,
    viewport: { centerX: 0, centerY: 0 },
    doc: { captureSync: vi.fn() },
    tool: { setTool: vi.fn() },
    selection: {
      set: ({ elements: ids }: { elements: string[] }) => {
        selected = ids[0];
      },
    },
    std: {
      getOptional: () => undefined,
      get: () => ({ recordLastProps: vi.fn() }),
      command: {
        exec: (
          _command: unknown,
          { elements: ids }: { elements: string[] }
        ) => [
          {},
          {
            groupId: surface.addElement({
              type: 'group',
              children: Object.fromEntries(ids.map(id => [id, true])),
            }),
          },
        ],
      },
    },
  };

  return {
    gfx: gfx as never,
    surface,
    /** The group the last creation action selected — the whole artefact. */
    drawn: () => elements.get(selected) as unknown as GroupElementModel,
    all: () => [...elements.values()],
  };
}

type Board = ReturnType<typeof board>;

/** An own value only: a key the preset never wrote reads as absent, not as a crash. */
const own = (model: object, key: string) =>
  Object.prototype.hasOwnProperty.call(model, key)
    ? (model as Record<string, unknown>)[key]
    : undefined;

/** Everything under a group, flattened — the pipeline's nesting included. */
function flat(group: GroupElementModel): GfxPrimitiveElementModel[] {
  return group.childElements.flatMap(child =>
    child instanceof GroupElementModel
      ? [child as never, ...flat(child)]
      : [child as never]
  );
}

const nodesOf = (group: GroupElementModel) =>
  flat(group).filter(
    (child): child is WardleyNodeElementModel =>
      child instanceof WardleyNodeElementModel
  );

const linksOf = (group: GroupElementModel) =>
  flat(group).filter(
    (child): child is ConnectorElementModel =>
      child instanceof ConnectorElementModel
  );

const labelOf = (group: GroupElementModel) =>
  flat(group).find(
    (child): child is TextElementModel => child instanceof TextElementModel
  )!;

const centre = (model: GfxPrimitiveElementModel): [number, number] => {
  const [x, y, w, h] = model.deserializedXYWH;
  return [x + w / 2, y + h / 2];
};

/**
 * What a composite IS, with every id and every absolute position taken out.
 *
 * Nodes are described by their whole preset and by their box RELATIVE to the
 * artefact's centre; the triangle is described by the boxes at its two ends,
 * because a connector's identity is what it wires and not the nanoid it wires
 * it with. Sorted, because painting order is not part of the claim — and the
 * label's own position is deliberately absent: the morph leaves it where the
 * user put it (see the case that asserts exactly that).
 */
function shapeOf(group: GroupElementModel) {
  const carrier = wardleyNodeOfComponent(
    group as unknown as GfxPrimitiveElementModel
  )!;
  const [cx, cy] = centre(carrier);
  const boxOf = (model: GfxPrimitiveElementModel) => {
    const [x, y, w, h] = model.deserializedXYWH;
    return `${x - cx},${y - cy},${w},${h}`;
  };
  const byId = new Map(flat(group).map(child => [child.id, child]));

  return {
    nodes: nodesOf(group)
      .map(child =>
        [
          child.kind,
          child.role,
          own(child, 'shapeType'),
          own(child, 'fillColor'),
          own(child, 'strokeColor'),
          own(child, 'strokeWidth'),
          own(child, 'filled'),
          own(child, 'radius'),
          boxOf(child),
        ].join('|')
      )
      .sort(),
    links: linksOf(group)
      .map(link => {
        const from = byId.get(link.source?.id ?? '');
        const to = byId.get(link.target?.id ?? '');
        return [
          own(link, 'stroke'),
          own(link, 'strokeWidth'),
          from ? boxOf(from) : 'outside',
          to ? boxOf(to) : 'outside',
        ].join('|');
      })
      .sort(),
    label: labelOf(group).text.toString(),
  };
}

/**
 * The morph, exactly as `applyMorph` performs it: the props patch and the
 * clears on the resolved node, then `afterMorph` on the SELECTION — all of it
 * in the one gesture the generic module wraps in a single `captureSync`.
 */
function morph(group: GroupElementModel, to: WardleyMorphKind) {
  const selected = group as unknown as GfxPrimitiveElementModel;
  const carrier = wardleyNodeOfComponent(selected)!;
  const from = carrier.kind as WardleyMorphKind;

  carrier.surface.updateElement(carrier.id, wardleyMorphProps(to));
  for (const field of wardleyMorphClears(to)) carrier.clearField(field);
  wardleyMorphComposite(selected, from, to);
  return carrier;
}

/** A component drawn from the sub-menu, plus a dependency somebody attached. */
function drawnComponent(b: Board = board()) {
  createWardleyNode(b.gfx, 'component');
  return b.drawn();
}

describe('a component becomes a market, and back', () => {
  it('grows to the canonical size, in place, and gains the glyph', () => {
    const b = board();
    createWardleyNode(b.gfx, 'component');
    const group = b.drawn();
    const before = centre(nodesOf(group)[0]);

    morph(group, 'market');

    const circle = wardleyNodeOfComponent(
      group as unknown as GfxPrimitiveElementModel
    )!;
    expect(circle.kind).toBe('market');
    expect(circle.role).toBe(WARDLEY_ROLE.market);
    // The DEVIATION from BPMN and C4, and the reason for it: a market left at
    // a component's 18 pixels is an unreadable smudge with three dots crammed
    // into it. The size is the notation — and the artefact does not move.
    const [, , w, h] = circle.deserializedXYWH;
    expect([w, h]).toEqual([
      WARDLEY_NODE_SIZE.market.w,
      WARDLEY_NODE_SIZE.market.h,
    ]);
    expect(centre(circle)).toEqual(before);

    // The glyph a market IS: three role-less dots wired into a triangle.
    const dots = nodesOf(group).filter(child => child.role === undefined);
    expect(dots).toHaveLength(3);
    for (const dot of dots) {
      expect(dot.kind).toBe('component');
      expect(dot.deserializedXYWH[2]).toBe(MARKET_DOT_SIZE);
    }
    expect(linksOf(group)).toHaveLength(3);
    // …wired dot to dot, and every dot used twice: a closed triangle.
    const ends = linksOf(group).flatMap(link => [
      link.source?.id,
      link.target?.id,
    ]);
    expect(new Set(ends)).toEqual(new Set(dots.map(dot => dot.id)));
    expect(ends).toHaveLength(6);
  });

  it('is indistinguishable from a market drawn from the sub-menu', () => {
    const morphed = board();
    createWardleyNode(morphed.gfx, 'component');
    const group = morphed.drawn();
    morph(group, 'market');

    const created = board();
    createWardleyMarket(created.gfx);

    expect(shapeOf(group)).toEqual(shapeOf(created.drawn()));
  });

  it('takes the whole glyph away again on the way back', () => {
    const b = board();
    createWardleyMarket(b.gfx);
    const group = b.drawn();
    const before = b.all().length;
    expect(linksOf(group)).toHaveLength(3);

    morph(group, 'component');

    // The three dots and the three connectors are GONE from the board, not
    // merely orphaned out of the group.
    expect(nodesOf(group)).toHaveLength(1);
    expect(linksOf(group)).toHaveLength(0);
    expect(b.all().length).toBe(before - 6);
    expect(shapeOf(group)).toEqual(shapeOf(drawnComponent()));
  });

  it('survives the round trip a user would actually make', () => {
    const b = board();
    createWardleyNode(b.gfx, 'component');
    const group = b.drawn();
    const before = shapeOf(group);

    morph(group, 'market');
    morph(group, 'component');

    expect(shapeOf(group)).toEqual(before);
  });
});

describe('a component becomes a pipeline, and back', () => {
  it('gains a handle astride its top edge, flat in the outer group', () => {
    const b = board();
    createWardleyNode(b.gfx, 'component');
    const group = b.drawn();
    const before = centre(nodesOf(group)[0]);

    morph(group, 'pipeline');

    const body = wardleyNodeOfComponent(
      group as unknown as GfxPrimitiveElementModel
    )!;
    expect(body.kind).toBe('pipeline');
    expect(body.deserializedXYWH.slice(2)).toEqual([
      WARDLEY_NODE_SIZE.pipeline.w,
      WARDLEY_NODE_SIZE.pipeline.h,
    ]);
    expect(centre(body)).toEqual(before);

    const handle = nodesOf(group).find(child => child.kind === 'handle')!;
    expect(handle.role).toBe(WARDLEY_ROLE.handle);
    // Astride the top edge, centred on the body: the only place a connector may
    // land on a pipeline.
    expect(centre(handle)).toEqual([
      before[0],
      before[1] - WARDLEY_NODE_SIZE.pipeline.h / 2,
    ]);
    expect(handle.deserializedXYWH[2]).toBe(HANDLE_SIZE);
    // The documented simplification: FLAT in the outer group, where a drawn
    // pipeline nests it with the label. Nothing reads the nesting — the handle
    // is found by kind and the label by role, both recursively.
    expect(group.childElements).toContain(handle as never);
  });

  it('moves the links the user drew onto the handle', () => {
    const b = board();
    createWardleyNode(b.gfx, 'component');
    const group = b.drawn();
    const body = nodesOf(group)[0];
    const other = b.surface.addElement({
      type: 'wardleyNode',
      kind: 'component',
      role: WARDLEY_ROLE.component,
      xywh: '[400,0,18,18]',
    });
    const link = b.surface.addElement({
      type: 'connector',
      role: WARDLEY_ROLE.dependency,
      source: { id: other },
      target: { id: body.id },
    });

    morph(group, 'pipeline');

    const connector = b.surface.getElementById(link) as ConnectorElementModel;
    const handle = nodesOf(group).find(child => child.kind === 'handle')!;
    // A pipeline BODY declares `connectable === false`, so a dependency left
    // pointing at it would point at something that no longer accepts it.
    expect(connector.target?.id).toBe(handle.id);
    // …and the other end, which this morph is none of its business, is intact.
    expect(connector.source?.id).toBe(other);
  });

  it('gives them back to the body on the way out, and unnests the label', () => {
    const b = board();
    createWardleyPipeline(b.gfx);
    const group = b.drawn();
    const body = wardleyNodeOfComponent(
      group as unknown as GfxPrimitiveElementModel
    )!;
    const handle = nodesOf(group).find(child => child.kind === 'handle')!;
    const label = labelOf(group);
    // What a DRAWN pipeline is: (body + (handle + label)).
    expect(group.childElements).not.toContain(label as never);

    const link = b.surface.addElement({
      type: 'connector',
      role: WARDLEY_ROLE.dependency,
      source: { id: handle.id },
      target: { id: handle.id },
    });

    morph(group, 'component');

    const connector = b.surface.getElementById(link) as ConnectorElementModel;
    expect(connector.source?.id).toBe(body.id);
    expect(connector.target?.id).toBe(body.id);
    // The handle is gone, the label came up into the outer group with it, and
    // the emptied wrapper went with the handle rather than being left behind.
    expect(nodesOf(group)).toHaveLength(1);
    expect(group.childElements).toContain(label as never);
    expect(
      b.all().filter(model => model instanceof GroupElementModel)
    ).toHaveLength(1);
    expect(shapeOf(group)).toEqual(shapeOf(drawnComponent()));
  });
});

describe('the words on the picture', () => {
  it('carries an untouched prompt from one kind to the next', () => {
    const b = board();
    createWardleyNode(b.gfx, 'component');
    const group = b.drawn();
    expect(labelOf(group).text.toString()).toBe(WARDLEY_NODE_LABEL.component);

    morph(group, 'ecosystem');
    expect(labelOf(group).text.toString()).toBe(WARDLEY_NODE_LABEL.ecosystem);
  });

  it('leaves a name the author wrote, and leaves it where they put it', () => {
    const b = board();
    createWardleyNode(b.gfx, 'component');
    const group = b.drawn();
    const label = labelOf(group);
    label.text.delete(0, label.text.length);
    label.text.insert(0, 'Kettle');
    const where = label.xywh;

    morph(group, 'market');

    expect(label.text.toString()).toBe('Kettle');
    // The placement is the user's whatever the artefact becomes — the circle
    // grew from 18 to 30 underneath it and the words did not move.
    expect(label.xywh).toBe(where);
  });
});

describe('what a morph refuses to touch', () => {
  it('does nothing at all to a group that resolves to nothing', () => {
    const b = board();
    const first = b.surface.addElement({
      type: 'wardleyNode',
      kind: 'component',
      role: WARDLEY_ROLE.component,
      xywh: '[0,0,18,18]',
    });
    const second = b.surface.addElement({
      type: 'wardleyNode',
      kind: 'component',
      role: WARDLEY_ROLE.component,
      xywh: '[100,0,18,18]',
    });
    const groupId = b.surface.addElement({
      type: 'group',
      children: { [first]: true, [second]: true },
    });
    const group = b.surface.getElementById(groupId) as GroupElementModel;
    const before = b.all().length;

    // Two candidates: the resolution refuses, and `afterMorph` — which
    // re-resolves rather than trusting the caller — writes nothing.
    wardleyMorphComposite(
      group as unknown as GfxPrimitiveElementModel,
      'component',
      'market'
    );

    expect(b.all().length).toBe(before);
    expect(
      (b.surface.getElementById(first) as WardleyNodeElementModel).kind
    ).toBe('component');
  });
});
