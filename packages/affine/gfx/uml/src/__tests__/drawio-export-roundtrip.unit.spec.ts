import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { exportCanvasDrawio } from '@labre/affine-block-surface';
import type {
  GfxBlockElementModel,
  GfxPrimitiveElementModel,
} from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import { importDrawio } from '../drawio-import';
import { UML_ROLE } from '../roles';
import { readXml, type XmlNode, xmlDescendants } from '../xml-reader';

/**
 * The canvas's draw.io WRITER, read back by this pack's draw.io READER
 * (`docs/adr/0019`, amendment of 2026-10-14).
 *
 * Why this spec exists: `canvas:drawio:export` writes what the canvas paints,
 * generically, and stamps each cell with the role it had (`labre-role`). The
 * promise that buys is narrow and is pinned here, on a mixed canvas — a class
 * diagram drawn the way the pack's creation sites draw one (a group, a roled
 * shape, one roled text per compartment), a plain shape, free text, a note, a
 * frame and an image:
 *
 * - **through a plain XML reader**, every element is a cell under its own id,
 *   at its own geometry, and every connector names its two ends;
 * - **through `importDrawio`**, the UML artefacts come back as UML: the
 *   classifiers with their kind and members, the relationships with their kind
 *   and direction, the layout with the canvas's relative geometry — and the
 *   groups and compartment texts are absorbed, never carried as unknowns;
 * - **the bytes are pinned** in `corpus/labre-canvas-export.drawio`, so a
 *   change to the writer shows up as a diff a reviewer can read, and the file
 *   can be opened in draw.io by hand.
 *
 * What it does NOT promise, and this spec does not test: a round trip of the
 * MODEL. That is PlantUML's and XMI's job; this is the visual tier.
 */

const here = dirname(fileURLToPath(import.meta.url));

type Rec = Record<string, unknown>;

/** A UML component as the creation sites build it: group, shape, tiers. */
function component(
  id: string,
  role: string,
  [x, y, w, h]: [number, number, number, number],
  tiers: { name: string; attributes?: string; operations?: string },
  index: string
): Rec[] {
  const tier = (
    suffix: string,
    tierRole: string,
    text: string,
    dy: number
  ) => ({
    id: `${id}-${suffix}`,
    type: 'text',
    index,
    role: tierRole,
    text,
    xywh: `[${x + 8},${y + dy},${w - 16},24]`,
  });
  const children: Rec[] = [
    {
      id,
      type: 'umlNode',
      index,
      role,
      kind: role.slice('uml:'.length),
      shapeType: 'rect',
      filled: true,
      fillColor: '#ffffff',
      strokeColor: '#000000',
      strokeWidth: 2,
      xywh: `[${x},${y},${w},${h}]`,
    },
    tier('name', UML_ROLE.name, tiers.name, 8),
    ...(tiers.attributes === undefined
      ? []
      : [tier('attributes', UML_ROLE.attributes, tiers.attributes, 40)]),
    ...(tiers.operations === undefined
      ? []
      : [tier('operations', UML_ROLE.operations, tiers.operations, 80)]),
  ];
  return [
    {
      id: `${id}-group`,
      type: 'group',
      index,
      xywh: `[${x},${y},${w},${h}]`,
      childIds: children.map(child => child.id),
    },
    ...children,
  ];
}

function canvas() {
  const elements: Rec[] = [
    {
      id: 'sheet',
      type: 'umlDiagram',
      index: 'a0',
      role: UML_ROLE.diagram,
      name: 'Shop',
      xywh: '[0,0,1000,700]',
    },
    ...component(
      'order',
      UML_ROLE.class,
      [100, 100, 200, 120],
      {
        name: 'Order',
        attributes: '+ id : int\n+ total : float',
        operations: '+ pay() : void',
      },
      'a1'
    ),
    ...component(
      'payable',
      UML_ROLE.interface,
      [500, 100, 200, 120],
      { name: 'Payable', attributes: '', operations: '+ pay() : void' },
      'a2'
    ),
    ...component(
      'item',
      UML_ROLE.class,
      [100, 400, 200, 120],
      { name: 'Item', attributes: '+ sku : string' },
      'a3'
    ),
    {
      id: 'sticky',
      type: 'shape',
      index: 'a4',
      shapeType: 'rect',
      radius: 0.1,
      filled: true,
      fillColor: '--affine-palette-shape-yellow',
      strokeColor: '#000000',
      text: 'Ask the <b>team</b> & "legal"',
      xywh: '[700,400,160,80]',
    },
    {
      id: 'caption',
      type: 'text',
      index: 'a5',
      text: 'Draft, v2',
      color: '#333333',
      fontSize: 20,
      fontWeight: '700',
      xywh: '[40,620,200,30]',
    },
    {
      id: 'realizes',
      type: 'connector',
      index: 'a6',
      role: UML_ROLE.realization,
      mode: 0,
      source: { id: 'order' },
      target: { id: 'payable' },
      rearEndpointStyle: 'TriangleHollow',
      frontEndpointStyle: 'None',
      strokeStyle: 'dash',
      stroke: '#000000',
      strokeWidth: 2,
      absolutePath: [
        [300, 160],
        [500, 160],
      ],
    },
    {
      id: 'contains',
      type: 'connector',
      index: 'a7',
      role: UML_ROLE.composition,
      mode: 1,
      source: { id: 'order' },
      target: { id: 'item' },
      frontEndpointStyle: 'Diamond',
      rearEndpointStyle: 'None',
      stroke: '#000000',
      strokeWidth: 2,
      text: 'lines',
      sourceLabel: '1',
      targetLabel: '1..*',
      absolutePath: [
        [200, 220],
        [200, 310],
        [200, 400],
      ],
    },
    {
      id: 'pointer',
      type: 'connector',
      index: 'a8',
      mode: 2,
      source: { id: 'sticky' },
      target: { position: [900, 650] },
      absolutePath: [
        [780, 480],
        [900, 650],
      ],
    },
  ];
  const blocks: Rec[] = [
    {
      id: 'slide',
      flavour: 'affine:frame',
      props: { xywh: '[-20,-20,1040,740]', index: 'a0', title: 'Orders' },
      children: [],
    },
    {
      id: 'memo',
      flavour: 'affine:note',
      props: { xywh: '[700,100,240,120]', index: 'b0', background: '#fff4d8' },
      children: [
        { props: { text: 'Payment is async' }, children: [] },
        { props: { text: 'see ADR' }, children: [] },
      ],
    },
    {
      id: 'logo',
      flavour: 'affine:image',
      props: {
        xywh: '[700,560,80,60]',
        index: 'b1',
        sourceId: 'abc123',
        caption: 'Logo',
      },
      children: [],
    },
  ];
  return {
    elements: elements as unknown as readonly GfxPrimitiveElementModel[],
    blocks: blocks as unknown as readonly GfxBlockElementModel[],
  };
}

function exported() {
  const { elements, blocks } = canvas();
  return exportCanvasDrawio(elements, { name: 'Shop', blocks });
}

/** Every `<object>` by id: the wrapper, its cell and the cell's geometry. */
function objects(text: string) {
  const root = readXml(text).root;
  if (!root) throw new Error('no XML');
  const byId = new Map<string, { object: XmlNode; cell: XmlNode }>();
  for (const node of xmlDescendants(root)) {
    if (node.local !== 'object') continue;
    const cell = node.children.find(child => child.local === 'mxCell');
    if (cell) byId.set(node.attrs.id ?? '', { object: node, cell });
  }
  return byId;
}

const geometryOf = (cell: XmlNode) => {
  const geometry = cell.children.find(child => child.local === 'mxGeometry');
  return ['x', 'y', 'width', 'height'].map(key =>
    Number(geometry?.attrs[key] ?? 'NaN')
  );
};

describe('the file, through a plain XML reader', () => {
  it('holds every element under its own id, at its own geometry', () => {
    const { text } = exported();
    const cells = objects(text);
    const { elements, blocks } = canvas();
    const ids = [
      ...(elements as unknown as Rec[]),
      ...(blocks as unknown as Rec[]),
    ].map(record => record.id as string);
    expect([...cells.keys()].sort()).toEqual([...ids].sort());

    // Top level: absolute. Inside a group: relative to the group.
    expect(geometryOf(cells.get('order-group')!.cell)).toEqual([
      100, 100, 200, 120,
    ]);
    expect(geometryOf(cells.get('order')!.cell)).toEqual([0, 0, 200, 120]);
    expect(cells.get('order')!.cell.attrs.parent).toBe('order-group');
    expect(geometryOf(cells.get('order-attributes')!.cell)).toEqual([
      8, 40, 184, 24,
    ]);
    expect(geometryOf(cells.get('sticky')!.cell)).toEqual([700, 400, 160, 80]);
    expect(geometryOf(cells.get('slide')!.cell)).toEqual([-20, -20, 1040, 740]);

    // The roles ride along, for a reader that knows them.
    expect(cells.get('order')!.object.attrs['labre-role']).toBe(UML_ROLE.class);
    expect(cells.get('order-name')!.object.attrs['labre-role']).toBe(
      UML_ROLE.name
    );
    expect(cells.get('sticky')!.object.attrs['labre-role']).toBeUndefined();
  });

  it('names both ends of every connector that has them', () => {
    const cells = objects(exported().text);
    const ends = (id: string) => {
      const { attrs } = cells.get(id)!.cell;
      return [attrs.source, attrs.target];
    };
    expect(ends('realizes')).toEqual(['order', 'payable']);
    expect(ends('contains')).toEqual(['order', 'item']);
    // A free end is a point, never a dangling id.
    expect(ends('pointer')).toEqual(['sticky', undefined]);
  });

  it('is the pinned corpus file, byte for byte', () => {
    const pinned = readFileSync(
      join(here, 'corpus', 'labre-canvas-export.drawio'),
      'utf8'
    );
    expect(exported().text).toBe(pinned);
  });
});

describe('the file, through the UML draw.io reader', () => {
  it('recognises the classifiers, their kind and their members', () => {
    const { model, notes } = importDrawio(exported().text);
    const byName = new Map(model.classifiers.map(c => [c.name, c]));
    expect([...byName.keys()].sort()).toEqual(['Item', 'Order', 'Payable']);

    expect(byName.get('Order')!.kind).toBe('class');
    expect(byName.get('Order')!.lines).toEqual({
      attributes: ['+ id : int', '+ total : float'],
      operations: ['+ pay() : void'],
    });
    // The role says interface; the name carries no keyword, and needs none.
    expect(byName.get('Payable')!.kind).toBe('interface');
    expect(byName.get('Item')!.lines.attributes).toEqual(['+ sku : string']);

    // The groups and the compartment texts were absorbed into the artefact,
    // not carried as shapes nobody could read.
    const carried = notes
      .filter(note => note.kind === 'carried')
      .map(note => note.sourceId);
    for (const absorbed of [
      'order-group',
      'order-name',
      'payable-operations',
    ]) {
      expect(carried).not.toContain(absorbed);
    }
    // What is no UML artefact is carried, named: the sticky, the board.
    expect(carried).toContain('sticky');
    expect(carried).toContain('sheet');
  });

  it('reads the relationships as stated, in the canvas direction', () => {
    const { model } = importDrawio(exported().text);
    const relations = model.relations.map(relation => ({
      kind: relation.kind,
      from: relation.sourceId,
      to: relation.targetId,
    }));
    expect(relations).toContainEqual({
      kind: 'realization',
      from: 'order',
      to: 'payable',
    });
    // The diamond is at the SOURCE end, and the role says so: no flip.
    expect(relations).toContainEqual({
      kind: 'composition',
      from: 'order',
      to: 'item',
    });
    const contains = model.relations.find(r => r.kind === 'composition')!;
    expect(contains.label).toBe('lines');
    expect(contains.sourceEnd).toBeDefined();
    expect(contains.targetEnd).toBeDefined();
  });

  it('keeps the canvas geometry, translated to the drawing corner', () => {
    const { layout } = importDrawio(exported().text);
    const order = layout.boxes.order!;
    const payable = layout.boxes.payable!;
    const item = layout.boxes.item!;
    expect([order.w, order.h]).toEqual([200, 120]);
    expect([payable.x - order.x, payable.y - order.y]).toEqual([400, 0]);
    expect([item.x - order.x, item.y - order.y]).toEqual([0, 300]);
  });
});
