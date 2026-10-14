import { Container } from '@labre/global/di';
import type {
  GfxBlockElementModel,
  GfxPrimitiveElementModel,
} from '@labre/std/gfx';
import { describe, expect, test } from 'vitest';

import {
  CANVAS_DRAWIO_EXPORT,
  CANVAS_INTERCHANGE,
  exportCanvasDrawio,
} from '../extensions/drawio-export/index.js';
import {
  InterchangeExtension,
  interchangeCapabilities,
} from '../extensions/interchange.js';

/**
 * `canvas:drawio:export` — the canvas as a draw.io drawing (ADR 0019,
 * amendment of 2026-10-14).
 *
 * Why this spec exists: the writer is a pure function that hands a file to
 * somebody else's tool, so the four things it owes are checked on the bytes,
 * read back with the browser's own XML parser:
 *
 * - **the drawing**: a cell per element, the element's id as the cell's id
 *   (ADR 0012 D3), its geometry, a group's children in the group's
 *   coordinates, a connector's ends by id, its markers as draw.io arrows, its
 *   end labels where draw.io pins them, colours as VALUES;
 * - **no injection**: a label is text, twice escaped, and nothing in the file
 *   is a script, a link or an address;
 * - **determinism**: the same canvas writes the same bytes, whatever order the
 *   caller handed it in;
 * - **the registry**: the capability is the canvas's, not a framework's.
 *
 * The round trip through UML's reader lives with the reader
 * (`gfx/uml/src/__tests__/drawio-export-roundtrip.unit.spec.ts`).
 */

type Rec = Record<string, unknown>;
const el = (records: Rec[]) =>
  records as unknown as readonly GfxPrimitiveElementModel[];
const blk = (records: Rec[]) =>
  records as unknown as readonly GfxBlockElementModel[];

function parse(text: string): Document {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
  return doc;
}

/** The `<object>` (or bare `<mxCell>`) carrying `id`, and its inner cell. */
function cell(doc: Document, id: string) {
  const wrapper = [...doc.querySelectorAll('object, mxCell')].find(
    node => node.getAttribute('id') === id
  );
  if (!wrapper) throw new Error(`no cell ${id}`);
  const inner =
    wrapper.tagName === 'object' ? wrapper.querySelector('mxCell')! : wrapper;
  const geometry = inner.querySelector(':scope > mxGeometry');
  return { wrapper, inner, geometry };
}

const shape = (id: string, xywh: string, extra: Rec = {}): Rec => ({
  id,
  type: 'shape',
  index: 'a0',
  xywh,
  shapeType: 'rect',
  filled: true,
  fillColor: '#ffeeaa',
  strokeColor: { light: '#112233', dark: '#ffffff' },
  strokeWidth: 2,
  strokeStyle: 'solid',
  ...extra,
});

describe('the drawing', () => {
  test('a shape is a vertex with its id, geometry, label and resolved colours', () => {
    const { text, filename, mime } = exportCanvasDrawio(
      el([shape('s1', '[10,20,100,50]', { text: 'Order', role: 'x:thing' })]),
      { name: 'Order/to cash' }
    );
    expect(filename).toBe('Order-to cash.drawio');
    expect(mime).toBe('application/xml');

    const doc = parse(text);
    expect(doc.documentElement.tagName).toBe('mxfile');
    expect(doc.querySelector('diagram')!.getAttribute('name')).toBe(
      'Order/to cash'
    );
    const { wrapper, inner, geometry } = cell(doc, 's1');
    expect(wrapper.getAttribute('label')).toBe('Order');
    expect(wrapper.getAttribute('labre-type')).toBe('shape');
    expect(wrapper.getAttribute('labre-role')).toBe('x:thing');
    expect(inner.getAttribute('vertex')).toBe('1');
    expect(inner.getAttribute('parent')).toBe('1');
    const style = inner.getAttribute('style')!;
    expect(style).toContain('rounded=0;');
    // Values, not variables: the light side of a pair, upper-cased hex.
    expect(style).toContain('fillColor=#FFEEAA;');
    expect(style).toContain('strokeColor=#112233;');
    expect(
      ['x', 'y', 'width', 'height'].map(key => geometry!.getAttribute(key))
    ).toEqual(['10', '20', '100', '50']);
  });

  test('shape types map onto draw.io shapes, and a legacy palette name resolves', () => {
    const { text } = exportCanvasDrawio(
      el([
        shape('e', '[0,0,10,10]', { shapeType: 'ellipse' }),
        shape('d', '[0,0,10,10]', { shapeType: 'diamond' }),
        shape('t', '[0,0,10,10]', { shapeType: 'triangle' }),
        shape('r', '[0,0,100,40]', { radius: 0.1 }),
        shape('y', '[0,0,10,10]', {
          fillColor: '--affine-palette-shape-yellow',
          strokeColor: 'rgba(0, 0, 0, 0.5)',
        }),
        shape('n', '[0,0,10,10]', { filled: false, strokeStyle: 'none' }),
      ])
    );
    const doc = parse(text);
    const style = (id: string) => cell(doc, id).inner.getAttribute('style')!;
    expect(style('e')).toMatch(/^ellipse;/);
    expect(style('d')).toMatch(/^rhombus;/);
    expect(style('t')).toMatch(/^triangle;/);
    expect(style('t')).toContain('direction=north;');
    // 10% of the short side, as a draw.io absolute arc (a diameter).
    expect(style('r')).toContain('rounded=1;');
    expect(style('r')).toContain('arcSize=8;');
    expect(style('y')).toContain('fillColor=#FFDF6B;');
    expect(style('y')).toContain('strokeColor=#000000;strokeOpacity=50;');
    expect(style('n')).toContain('fillColor=none;');
    expect(style('n')).toContain('strokeColor=none;');
  });

  test('a group holds its children, in its own coordinates', () => {
    const { text } = exportCanvasDrawio(
      el([
        {
          id: 'g',
          type: 'group',
          index: 'a0',
          xywh: '[100,100,300,200]',
          childIds: ['in', 'missing'],
        },
        shape('in', '[150,130,50,40]', { index: 'a1' }),
        shape('out', '[0,0,10,10]', { index: 'a2' }),
      ])
    );
    const doc = parse(text);
    const group = cell(doc, 'g');
    expect(group.inner.getAttribute('style')).toMatch(/^group;/);
    expect(group.inner.getAttribute('connectable')).toBe('0');

    const inside = cell(doc, 'in');
    expect(inside.inner.getAttribute('parent')).toBe('g');
    expect(inside.geometry!.getAttribute('x')).toBe('50');
    expect(inside.geometry!.getAttribute('y')).toBe('30');
    expect(cell(doc, 'out').inner.getAttribute('parent')).toBe('1');
  });

  test('a connector names its ends, draws its markers and pins its end labels', () => {
    const { text } = exportCanvasDrawio(
      el([
        shape('a', '[0,0,100,50]'),
        shape('b', '[300,0,100,50]', { index: 'a1' }),
        {
          id: 'c',
          type: 'connector',
          index: 'a2',
          xywh: '[100,25,200,0]',
          mode: 1,
          source: { id: 'a', position: [1, 0.5] },
          target: { id: 'b' },
          absolutePath: [
            [100, 25],
            [200, 25],
            [200, 30],
            [300, 30],
          ],
          frontEndpointStyle: 'DiamondHollow',
          rearEndpointStyle: 'TriangleHollow',
          stroke: '#336699',
          strokeWidth: 2,
          strokeStyle: 'dash',
          text: 'owns',
          sourceLabel: '1',
          targetLabel: '0..*',
        },
        {
          id: 'loose',
          type: 'connector',
          index: 'a3',
          mode: 0,
          source: { position: [5, 6] },
          target: { id: 'gone' },
          absolutePath: [
            [5, 6],
            [70, 80],
          ],
        },
      ])
    );
    const doc = parse(text);
    const edge = cell(doc, 'c');
    expect(edge.wrapper.getAttribute('label')).toBe('owns');
    expect(edge.inner.getAttribute('edge')).toBe('1');
    expect(edge.inner.getAttribute('source')).toBe('a');
    expect(edge.inner.getAttribute('target')).toBe('b');
    const style = edge.inner.getAttribute('style')!;
    expect(style).toContain('edgeStyle=orthogonalEdgeStyle;');
    expect(style).toContain('startArrow=diamond;startFill=0;');
    expect(style).toContain('endArrow=block;endFill=0;');
    expect(style).toContain('dashed=1;');
    expect(style).toContain('strokeColor=#336699;');
    expect(style).toContain('exitX=1;exitY=0.5;');
    // The elbow's two corners, and only those.
    const points = [...edge.geometry!.querySelectorAll('Array > mxPoint')].map(
      point => [point.getAttribute('x'), point.getAttribute('y')]
    );
    expect(points).toEqual([
      ['200', '25'],
      ['200', '30'],
    ]);
    // draw.io's own end-label cells: children of the edge, at -1 and +1.
    const sourceLabel = cell(doc, 'c-source-label');
    expect(sourceLabel.inner.getAttribute('parent')).toBe('c');
    expect(sourceLabel.inner.getAttribute('value')).toBe('1');
    expect(sourceLabel.geometry!.getAttribute('x')).toBe('-1');
    expect(cell(doc, 'c-target-label').geometry!.getAttribute('x')).toBe('1');

    // A free end is a point; an end on an element left out is a point too.
    const loose = cell(doc, 'loose');
    expect(loose.inner.hasAttribute('source')).toBe(false);
    expect(loose.inner.hasAttribute('target')).toBe(false);
    const ends = [...loose.geometry!.querySelectorAll(':scope > mxPoint')].map(
      point => [
        point.getAttribute('as'),
        point.getAttribute('x'),
        point.getAttribute('y'),
      ]
    );
    expect(ends).toEqual([
      ['sourcePoint', '5', '6'],
      ['targetPoint', '70', '80'],
    ]);
  });

  test('the canvas blocks a reader needs: note, frame, edgeless text, image', () => {
    const { text, warnings } = exportCanvasDrawio(el([]), {
      blocks: blk([
        {
          id: 'note',
          flavour: 'affine:note',
          props: { xywh: '[0,0,200,100]', index: 'a1', background: '#ccddee' },
          children: [
            { props: { text: 'First line' }, children: [] },
            { props: { text: 'Second' }, children: [] },
          ],
        },
        {
          id: 'page-only',
          flavour: 'affine:note',
          props: { xywh: '[0,0,1,1]', index: 'a2', displayMode: 'doc' },
          children: [],
        },
        {
          id: 'frame',
          flavour: 'affine:frame',
          // A frame is the floor, whatever its index says.
          props: { xywh: '[-50,-50,500,400]', index: 'z9', title: 'Slide 1' },
          children: [],
        },
        {
          id: 'words',
          flavour: 'affine:edgeless-text',
          props: { xywh: '[300,0,100,30]', index: 'a3', textAlign: 'right' },
          children: [{ props: { text: 'Free words' }, children: [] }],
        },
        {
          id: 'img',
          flavour: 'affine:image',
          props: {
            xywh: '[0,200,80,60]',
            index: 'a4',
            sourceId: 'sha256-abc',
            caption: 'Logo',
          },
          children: [],
        },
        {
          id: 'embed',
          flavour: 'affine:embed-youtube',
          props: { xywh: '[0,0,1,1]', index: 'a5' },
          children: [],
        },
      ]),
    });
    const doc = parse(text);
    expect(cell(doc, 'note').wrapper.getAttribute('label')).toBe(
      'First line<br>Second'
    );
    expect(cell(doc, 'note').inner.getAttribute('style')).toContain(
      'fillColor=#CCDDEE;'
    );
    expect(() => cell(doc, 'page-only')).toThrow();
    expect(cell(doc, 'frame').wrapper.getAttribute('label')).toBe('Slide 1');
    expect(cell(doc, 'words').wrapper.getAttribute('label')).toBe('Free words');
    expect(cell(doc, 'words').inner.getAttribute('style')).toContain(
      'align=right;'
    );
    const image = cell(doc, 'img');
    expect(image.wrapper.getAttribute('label')).toBe('Logo');
    expect(image.wrapper.getAttribute('labre-image')).toBe('sha256-abc');

    // z-order: the frame first, then by index.
    const order = [...doc.querySelectorAll('root > object')].map(node =>
      node.getAttribute('id')
    );
    expect(order).toEqual(['frame', 'note', 'words', 'img']);
    expect(warnings).toEqual([
      'Left out 1 × affine:embed-youtube: draw.io has no shape for it.',
    ]);
  });

  test('what draw.io cannot draw is named once per kind', () => {
    const { warnings } = exportCanvasDrawio(
      el([
        { id: 'b1', type: 'brush', index: 'a0', xywh: '[0,0,1,1]' },
        { id: 'b2', type: 'brush', index: 'a1', xywh: '[0,0,1,1]' },
        shape('p', '[0,0,10,10]', { shapeType: 'polygon' }),
      ])
    );
    expect(warnings).toEqual([
      'Left out 2 × brush: draw.io has no shape for it.',
      'Drew 1 × polygon as its bounding box: draw.io has no free polygon.',
    ]);
    expect(
      exportCanvasDrawio(el([shape('s', '[0,0,1,1]')]))
    ).not.toHaveProperty('warnings');
  });
});

const DRAWIO_TAGS = [
  'mxfile',
  'diagram',
  'mxGraphModel',
  'root',
  'object',
  'mxCell',
  'mxGeometry',
  'mxPoint',
  'Array',
];

describe('no injection', () => {
  test('a label is text, twice escaped, and nothing is a script or a link', () => {
    const hostile =
      '<script>alert(1)</script> & "quoted" <img src=x onerror=alert(1)>\njavascript:alert(2)';
    const { text } = exportCanvasDrawio(
      el([
        shape('s', '[0,0,10,10]', { text: hostile }),
        {
          id: 't"><script>',
          type: 'text',
          index: 'a1',
          xywh: '[0,0,10,10]',
          text: 'a\u0000b',
        },
      ]),
      { name: '</diagram><script>x</script>' }
    );

    expect(text).not.toMatch(/<script/i);
    expect(text).not.toMatch(/<img/i);
    const doc = parse(text);
    // Every element is one draw.io knows; no attribute is a link or a source.
    const known = new Set(DRAWIO_TAGS);
    for (const node of doc.querySelectorAll('*')) {
      expect(known.has(node.tagName), node.tagName).toBe(true);
    }
    for (const node of doc.querySelectorAll('*')) {
      for (const name of node.getAttributeNames()) {
        expect(['link', 'href', 'src', 'placeholders']).not.toContain(name);
      }
    }
    // The label, once the XML is read, is HTML that SHOWS the characters.
    const label = cell(doc, 's').wrapper.getAttribute('label')!;
    expect(label).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;quoted&quot; &lt;img src=x onerror=alert(1)&gt;<br>javascript:alert(2)'
    );
    const rendered = document.createElement('div');
    rendered.innerHTML = label;
    expect(rendered.querySelector('script, img')).toBeNull();
    // A hostile id is an id; a character XML forbids is dropped.
    expect(cell(doc, 't"><script>').wrapper.getAttribute('label')).toBe('ab');
  });
});

describe('determinism', () => {
  test('the same canvas writes the same bytes, whatever order it came in', () => {
    const records: Rec[] = [
      shape('a', '[0.123456,1,2,3]', { index: 'a1' }),
      shape('b', '[4,5,6,7]', { index: 'a0' }),
      shape('c', '[8,9,10,11]', { index: 'a0' }),
    ];
    const first = exportCanvasDrawio(el(records), { name: 'Board' }).text;
    const again = exportCanvasDrawio(el([...records].reverse()), {
      name: 'Board',
    }).text;
    expect(again).toBe(first);
    // Index first, the id breaking the tie; two decimals.
    expect([...first.matchAll(/<object id="(\w)"/g)].map(m => m[1])).toEqual([
      'b',
      'c',
      'a',
    ]);
    expect(first).toContain('x="0.12"');
    expect(first).not.toMatch(/modified=|etag=|agent=/);
  });
});

describe('the registry', () => {
  test('the canvas owns it, it is visual, and `run` is the pure writer', () => {
    expect(CANVAS_DRAWIO_EXPORT.id).toBe('canvas:drawio:export');
    expect(CANVAS_DRAWIO_EXPORT.framework).toBe('canvas');
    expect(CANVAS_DRAWIO_EXPORT.format.tier).toBe('visual');
    expect(CANVAS_DRAWIO_EXPORT.run).toBe(exportCanvasDrawio);

    const container = new Container();
    InterchangeExtension(CANVAS_INTERCHANGE).setup(container);
    expect(
      interchangeCapabilities(container.provider(), {
        direction: 'export',
      }).map(capability => capability.id)
    ).toEqual(['canvas:drawio:export']);
  });
});
