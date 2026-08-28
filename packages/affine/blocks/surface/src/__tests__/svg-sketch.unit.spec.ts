import { describe, expect, it } from 'vitest';

import {
  parseSvgSketch,
  SVG_SKETCH_EXTENSION,
  SVG_SKETCH_FORMAT_ID,
  SVG_SKETCH_MIME,
} from '../extensions/svg-sketch.js';

/**
 * The visual-tier importer (`docs/adr/0012`, P2).
 *
 * Plain strings in, plain objects out, and not one line of DI anywhere in this
 * file: P3's purity requirement stated as a test. The two properties worth
 * naming ahead of the list are the ones the ADR asks to be pinned rather than
 * reviewed — that a visual import writes NO `interchange` payload on any
 * element ever, and that its report's `carried` and `quarantined` are `0`
 * whatever it was handed. Both are asserted against every fixture in this file,
 * not against one.
 */

/* ── Helpers ──────────────────────────────────────────────────────────── */

const svg = (body: string, attrs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`;

const run = (source: string) => parseSvgSketch(source, {});

const typesOf = (source: string) => run(source).elements.map(e => e.type);

/** Every message in the report, so a test can ask "was this said?". */
const messages = (source: string) =>
  run(source).report.notes.map(note => note.message);

const boxOf = (props: Record<string, unknown>) =>
  JSON.parse(props.xywh as string) as [number, number, number, number];

/* ── The format's own constants ───────────────────────────────────────── */

describe('the format', () => {
  it('is `svg`, one extension, one mime', () => {
    // Declared here rather than in a framework, because several frameworks
    // declare a capability over this ONE parser and a second spelling of
    // `image/svg+xml` would be a picker filter that silently disagrees with a
    // sibling's (ADR 0012, P1: the unit is the triple, not the format).
    expect(SVG_SKETCH_FORMAT_ID).toBe('svg');
    expect(SVG_SKETCH_EXTENSION).toBe('.svg');
    expect(SVG_SKETCH_MIME).toBe('image/svg+xml');
  });
});

/* ── The two invariants that keep the tier honest ─────────────────────── */

describe('the visual tier writes nothing it cannot honour', () => {
  /**
   * ADR 0012's anti-decay test, named as such in its own "Test coverage this
   * implies" section: "every visual-tier capability asserts it writes NO
   * `interchange` key. That last one is the test that keeps P2 from decaying
   * into a preference."
   *
   * Deep, and not a top-level key check: the payload D2 describes is a nested
   * record, so a reader that started writing one under a shape's `props` or
   * inside a `vertices` bag would pass a shallow assertion. Nothing in these
   * props is allowed to be called `interchange`, at any depth.
   */
  const FIXTURES = [
    svg('<rect x="1" y="2" width="30" height="40" rx="4"/>'),
    svg('<circle cx="50" cy="50" r="10"/><text x="0" y="0">Label</text>'),
    svg('<path d="M0 0 L10 10 C 20 20 30 30 40 40 Z"/>'),
    svg('<g transform="scale(2)"><use href="#a"/><image href="x.png"/></g>'),
    svg(''),
  ];

  const hasInterchange = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(hasInterchange);
    if (value && typeof value === 'object') {
      return Object.entries(value as Record<string, unknown>).some(
        ([key, nested]) => key === 'interchange' || hasInterchange(nested)
      );
    }
    return false;
  };

  it('never writes an `interchange` key on any element', () => {
    for (const source of FIXTURES) {
      for (const props of run(source).elements) {
        expect(hasInterchange(props), JSON.stringify(props)).toBe(false);
      }
    }
  });

  it('reports `carried` and `quarantined` as zero, always', () => {
    for (const source of FIXTURES) {
      const { report } = run(source);
      expect([report.carried, report.quarantined]).toEqual([0, 0]);
      // `mapped` is the only count with anything to say, and it counts what
      // landed on the canvas.
      expect(report.mapped).toBe(run(source).elements.length);
    }
  });

  it('claims no source version', () => {
    // An SVG declares a version of the SVG spec, not of a vocabulary this
    // reader translates. Claiming one would dress a fact about the file up as
    // a fact about the import (ADR 0012, P2 as amended).
    expect(
      run(svg('<rect width="1" height="1"/>')).report.sourceVersion
    ).toBeUndefined();
  });
});

/* ── The mappings ─────────────────────────────────────────────────────── */

describe('what each element becomes', () => {
  it('maps `<rect>` to a rectangle, keeping its corner radius', () => {
    const [props] = run(
      svg('<rect x="10" y="20" width="120" height="60" rx="8"/>')
    ).elements;
    expect(props.type).toBe('shape');
    expect(props.shapeType).toBe('rect');
    expect(props.radius).toBe(8);
    expect(boxOf(props)).toEqual([10, 20, 120, 60]);
  });

  it('drops a sub-pixel corner radius rather than reading it as a ratio', () => {
    // The shape model reads a `radius` below 1 as a RATIO of the shorter side,
    // so passing `rx="0.5"` through would round a 200-wide box over by 100px.
    const [props] = run(
      svg('<rect width="200" height="100" rx="0.5"/>')
    ).elements;
    expect(props.radius).toBe(0);
  });

  it('maps `<circle>` and `<ellipse>` to an ellipse on their bounding box', () => {
    const [circle] = run(svg('<circle cx="50" cy="40" r="10"/>')).elements;
    expect(circle.shapeType).toBe('ellipse');
    expect(boxOf(circle)).toEqual([40, 30, 20, 20]);

    const [ellipse] = run(
      svg('<ellipse cx="50" cy="40" rx="20" ry="5"/>')
    ).elements;
    expect(boxOf(ellipse)).toEqual([30, 35, 40, 10]);
  });

  it('maps `<polygon>` to a polygon, with its outline normalized', () => {
    // The model stores polygon vertices in [0, 1] of the bounding box, which is
    // how EDGY's activity chevron is already declared — so this diamond keeps
    // its shape and stays resizable.
    const [props] = run(
      svg('<polygon points="50,0 100,50 50,100 0,50"/>')
    ).elements;
    expect(props.shapeType).toBe('polygon');
    expect(props.isClosed).toBe(true);
    expect(props.vertices).toEqual([
      [0.5, 0],
      [1, 0.5],
      [0.5, 1],
      [0, 0.5],
    ]);
    expect(boxOf(props)).toEqual([0, 0, 100, 100]);
  });

  it('falls back to a bounding rectangle for a polygon it cannot normalize', () => {
    // Flat on one axis: the normalization would divide by zero, so it arrives
    // as its box and says so.
    const result = run(svg('<polygon points="0,10 50,10 100,10"/>'));
    expect(result.elements[0].shapeType).toBe('rect');
    expect(result.report.notes.map(n => n.message).join(' ')).toContain(
      'bounding rectangle'
    );
  });

  it('maps `<line>` and `<polyline>` to brush strokes through their points', () => {
    const [line] = run(
      svg('<line x1="0" y1="0" x2="30" y2="40" stroke="#f00"/>')
    ).elements;
    expect(line.type).toBe('brush');
    expect(line.points).toEqual([
      [0, 0],
      [30, 40],
    ]);
    // The colour is the file's, passed through verbatim: the shape model takes
    // a raw CSS colour, so the picture keeps its own palette.
    expect(line.color).toBe('#f00');

    const [polyline] = run(
      svg('<polyline points="0,0 10,0 10,10" stroke="black"/>')
    ).elements;
    expect(polyline.points).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
    ]);
  });

  it('hands brush points over ABSOLUTE, the way the brush tool does', () => {
    // The model's own `@convert` re-bases them onto the bound it derives and
    // inflates by the line width. An importer that pre-computed `xywh` would do
    // that arithmetic twice and disagree with the model about the inflation, so
    // the props deliberately carry no box at all.
    const [props] = run(
      svg('<line x1="100" y1="100" x2="200" y2="100"/>')
    ).elements;
    expect(props.xywh).toBeUndefined();
    expect(props.points).toEqual([
      [100, 100],
      [200, 100],
    ]);
  });

  it('carries stroke width onto a brush and onto a shape', () => {
    const [brush] = run(
      svg('<line x1="0" y1="0" x2="1" y2="1" stroke-width="3"/>')
    ).elements;
    expect(brush.lineWidth).toBe(3);

    const [shape] = run(
      svg('<rect width="10" height="10" stroke="#000" stroke-width="2.5"/>')
    ).elements;
    expect(shape.strokeWidth).toBe(2.5);
  });

  it('reads `fill="none"` as an unfilled shape', () => {
    const [filled] = run(
      svg('<rect width="10" height="10" fill="#eef"/>')
    ).elements;
    expect(filled.filled).toBe(true);
    expect(filled.fillColor).toBe('#eef');

    const [hollow] = run(
      svg('<rect width="10" height="10" fill="none" stroke="none"/>')
    ).elements;
    expect(hollow.filled).toBe(false);
    expect(hollow.fillColor).toBe('transparent');
    expect(hollow.strokeStyle).toBe('none');
  });

  it('reads presentation out of a `style` attribute too', () => {
    // mermaid and Illustrator write `style="fill:…"`; bpmn.io writes the
    // attribute. A reader that knew only one of the two imports half the files
    // in the wild in the wrong colours.
    const [props] = run(
      svg('<rect width="10" height="10" style="fill:#123456;stroke-width:4"/>')
    ).elements;
    expect(props.fillColor).toBe('#123456');
    expect(props.strokeWidth).toBe(4);
  });
});

/* ── Text: the PO-critical path ───────────────────────────────────────── */

describe('`<text>` becomes an editable free-text element', () => {
  it('is a `text` element carrying a PLAIN STRING', () => {
    // The one promise this tier makes without qualification. `propsToY` turns
    // the string into the `Y.Text` the editor binds to, so the first
    // double-click puts a caret in the label — rather than in a picture of one.
    const [props] = run(
      svg('<text x="10" y="30">Order received</text>')
    ).elements;
    expect(props.type).toBe('text');
    expect(props.text).toBe('Order received');
    expect(typeof props.text).toBe('string');
  });

  it('lifts the box off the baseline and sizes it from the font', () => {
    const [props] = run(
      svg('<text x="10" y="30" font-size="20">Hi</text>')
    ).elements;
    expect(props.fontSize).toBe(20);
    const [x, y, , h] = boxOf(props);
    // SVG's `y` is a BASELINE and the model's box is a top edge.
    expect([x, y]).toEqual([10, 10]);
    expect(h).toBeCloseTo(24);
  });

  it('defaults to 16 when the file declares no font size', () => {
    const [props] = run(svg('<text x="0" y="0">x</text>')).elements;
    expect(props.fontSize).toBe(16);
  });

  it('joins several `<tspan>`s into one multi-line label', () => {
    const [props] = run(
      svg(
        '<text x="0" y="0"><tspan x="0">Check the</tspan><tspan x="0">order</tspan></text>'
      )
    ).elements;
    expect(props.text).toBe('Check the\norder');
  });

  it('honours `text-anchor`, so a centred label stays centred', () => {
    const middle = run(
      svg(
        '<text x="100" y="20" font-size="10" text-anchor="middle">abcd</text>'
      )
    ).elements[0];
    const start = run(svg('<text x="100" y="20" font-size="10">abcd</text>'))
      .elements[0];
    const [mx, , mw] = boxOf(middle);
    const [sx] = boxOf(start);
    expect(middle.textAlign).toBe('center');
    expect(start.textAlign).toBe('left');
    // The anchored box is shifted left by half its own width, so its centre is
    // where the file put `x`.
    expect(mx + mw / 2).toBeCloseTo(sx);
  });

  it('skips an empty `<text>` and says it did', () => {
    const result = run(svg('<text x="0" y="0">   </text>'));
    expect(result.elements).toEqual([]);
    expect(result.report.notes.map(n => n.message).join(' ')).toContain(
      'Empty text'
    );
  });
});

/* ── Coordinates ──────────────────────────────────────────────────────── */

describe('coordinates', () => {
  it('honours the `viewBox` origin', () => {
    // User units map 1:1 onto canvas units — no scaling gymnastics in v1 — but
    // the origin the file drew against is subtracted, so a drawing authored at
    // (-100, -50) does not land in the negative quadrant.
    const [props] = run(
      svg(
        '<rect x="-100" y="-50" width="10" height="10"/>',
        'viewBox="-100 -50 400 300"'
      )
    ).elements;
    expect(boxOf(props)).toEqual([0, 0, 10, 10]);
  });

  it('accumulates `translate` down nested groups', () => {
    const [props] = run(
      svg(
        '<g transform="translate(10,20)"><g transform="translate(5,5)">' +
          '<rect x="1" y="2" width="4" height="4"/></g></g>'
      )
    ).elements;
    expect(boxOf(props)).toEqual([16, 27, 4, 4]);
  });

  it('recurses into a nested `<svg>`, offset by its own x/y', () => {
    const [props] = run(
      svg('<svg x="30" y="40"><rect x="1" y="1" width="2" height="2"/></svg>')
    ).elements;
    expect(boxOf(props)).toEqual([31, 41, 2, 2]);
  });

  it('inherits paint down a group, the way CSS does', () => {
    const [props] = run(
      svg('<g fill="#abc" stroke="#def"><rect width="5" height="5"/></g>')
    ).elements;
    expect(props.fillColor).toBe('#abc');
    expect(props.strokeColor).toBe('#def');
  });
});

/* ── What it refuses to guess, and says so ────────────────────────────── */

describe('nothing is ignored silently', () => {
  it('imports an element under a `scale` at its untransformed position, with ONE note', () => {
    const result = run(
      svg(
        '<g transform="scale(2)"><rect x="10" y="10" width="4" height="4"/>' +
          '<rect x="20" y="20" width="4" height="4"/></g>'
      )
    );
    // Both shapes are there, unscaled: a sketch missing a shape is worse than a
    // sketch with a shape in the wrong place, and the author is about to move
    // things anyway.
    expect(result.elements).toHaveLength(2);
    expect(boxOf(result.elements[0])).toEqual([10, 10, 4, 4]);

    // ONE note for the KIND, not one per element that carried one.
    const scale = result.report.notes.filter(n => n.message.includes('scale'));
    expect(scale).toHaveLength(1);
    expect(scale[0].kind).toBe('warning');
  });

  it('names each ignored transform kind exactly once', () => {
    const said = messages(
      svg(
        '<g transform="rotate(45)"><rect width="1" height="1"/></g>' +
          '<g transform="rotate(90)"><rect width="1" height="1"/></g>' +
          '<g transform="matrix(1,0,0,1,0,0)"><rect width="1" height="1"/></g>'
      )
    );
    expect(said.filter(m => m.includes('`rotate`'))).toHaveLength(1);
    expect(said.filter(m => m.includes('`matrix`'))).toHaveLength(1);
  });

  it('still translates when a transform list mixes translate with the rest', () => {
    const result = run(
      svg(
        '<g transform="translate(10,10) rotate(30)">' +
          '<rect x="0" y="0" width="2" height="2"/></g>'
      )
    );
    // The translate is spent, the rotate is refused — and only the refusal is
    // reported, because only the refusal cost the drawing anything.
    expect(boxOf(result.elements[0])).toEqual([10, 10, 2, 2]);
    expect(result.report.notes).toHaveLength(1);
    expect(result.report.notes[0].message).toContain('`rotate`');
  });

  it('names each skipped construct kind once, whatever the instance count', () => {
    const said = messages(
      svg(
        '<defs><marker id="m"/><linearGradient id="g"/></defs>' +
          '<use href="#a"/><use href="#b"/><use href="#c"/>' +
          '<image href="x.png"/><foreignObject/>'
      )
    );
    // `<defs>` is skipped whole, so its children are never reached — which is
    // why `marker` and `linearGradient` are not in this list, and why `defs`
    // is: a reader that said nothing about a drawing built out of symbol
    // instances would leave its author to guess why the canvas is empty.
    expect(said.filter(m => m.includes('`<defs>`'))).toHaveLength(1);
    expect(said.filter(m => m.includes('`<image>`'))).toHaveLength(1);
    // …and `<use>` and `<foreignObject>` are the two the SANITIZER took, before
    // the walk could see them. One note each all the same — which is the point:
    // the report is about what the file lost, not about which of our two stages
    // lost it. Three `<use>` instances, one remark.
    expect(said.filter(m => m.includes('`<use>`'))).toHaveLength(1);
    expect(said.filter(m => m.includes('`<foreignObject>`'))).toHaveLength(1);
    expect(
      said.filter(m => m.includes('removed while sanitizing'))
    ).toHaveLength(2);
  });

  it('says which unsafe attributes went, without naming each one', () => {
    const said = messages(
      svg('<rect width="10" height="10" onload="alert(1)" onclick="alert(2)"/>')
    );
    expect(said.filter(m => m.includes('Unsafe attributes'))).toHaveLength(1);
  });

  it('falls back to a neutral for a paint served by a gradient, and says so', () => {
    const result = run(
      svg('<rect width="10" height="10" fill="url(#gradient)"/>')
    );
    expect(result.elements[0].filled).toBe(true);
    expect(result.report.notes.map(n => n.message).join(' ')).toContain(
      'Gradients and patterns'
    );
  });
});

/* ── Paths ────────────────────────────────────────────────────────────── */

describe('`<path>`', () => {
  it('samples M / L / H / V / Z, absolute and relative', () => {
    const [props] = run(
      svg('<path d="M 10 10 L 20 10 H 30 V 20 Z"/>')
    ).elements;
    expect(props.points).toEqual([
      [10, 10],
      [20, 10],
      [30, 10],
      [30, 20],
      [10, 10],
    ]);

    const [relative] = run(svg('<path d="m 5 5 l 10 0 v 10 z"/>')).elements;
    expect(relative.points).toEqual([
      [5, 5],
      [15, 5],
      [15, 15],
      [5, 5],
    ]);
  });

  it('reads a repeated argument group as an implicit lineto', () => {
    const [props] = run(svg('<path d="M0 0 L 1 1 2 2 3 3"/>')).elements;
    expect(props.points).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 3],
    ]);
  });

  it('emits one brush per subpath, never a line across the drawing', () => {
    const result = run(svg('<path d="M0 0 L10 0 M100 100 L110 100"/>'));
    expect(result.elements).toHaveLength(2);
    expect(result.elements[0].points).toEqual([
      [0, 0],
      [10, 0],
    ]);
    expect(result.elements[1].points).toEqual([
      [100, 100],
      [110, 100],
    ]);
  });

  it('approximates a curve by its endpoint, and says so once', () => {
    const result = run(
      svg('<path d="M0 0 C 5 5 10 5 15 0 Q 20 -5 25 0 A 5 5 0 0 1 30 0"/>')
    );
    expect(result.elements[0].points).toEqual([
      [0, 0],
      [15, 0],
      [25, 0],
      [30, 0],
    ]);
    const curve = result.report.notes.filter(n =>
      n.message.includes('Curves are approximated')
    );
    expect(curve).toHaveLength(1);
  });

  it('drops a subpath with fewer than two points', () => {
    expect(run(svg('<path d="M10 10"/>')).elements).toEqual([]);
  });
});

/* ── The edges of a file ──────────────────────────────────────────────── */

describe('an empty or a broken file', () => {
  it('reads a blank SVG as zero elements and a remark, not a throw', () => {
    const result = run(svg(''));
    expect(result.elements).toEqual([]);
    expect(result.report.mapped).toBe(0);
    expect(result.report.notes.map(n => n.message).join(' ')).toContain(
      'No shape or text was recognised'
    );
  });

  it('throws on malformed XML, naming what is wrong', () => {
    // A reader THROWS on a file it cannot read at all, because a report of
    // three zeroes would claim an empty drawing where there was none — and the
    // generic pipeline turns the sentence into the error toast.
    expect(() => run('<svg><rect width="1"</svg>')).toThrow(
      /not well-formed XML/
    );
  });

  it('throws on a document that is not an SVG', () => {
    expect(() =>
      run('<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"/>')
    ).toThrow(/opens on <svg>/);
  });

  it('strips a script rather than importing beside it', () => {
    // An `.svg` is an executable document handed over by whoever sent the file.
    // The same `USE_PROFILES: { svg: true }` guard the edgeless clipboard puts
    // in front of a pasted SVG.
    const result = run(
      svg(
        '<script>alert(1)</script><rect width="10" height="10" onload="alert(2)"/>'
      )
    );
    expect(result.elements).toHaveLength(1);
    expect(JSON.stringify(result.elements)).not.toContain('alert');
  });
});

/* ── Realistic fixtures ───────────────────────────────────────────────── */

describe('a bpmn.io-shaped export fragment', () => {
  /**
   * The shape a real `.svg` off bpmn.io has: one translated group per shape,
   * rounded rectangles for the tasks, a diamond drawn as a `<path>` for the
   * gateway, a circle for the event, and a label `<text>` beside each. Nothing
   * in it says "BPMN" — which is the whole reason ADR 0012 refuses to infer a
   * framework from a `.svg`.
   */
  const FRAGMENT = svg(
    `<g transform="translate(180,80)">
       <rect x="0" y="0" width="100" height="80" rx="10" fill="#ffffff" stroke="#22242a" stroke-width="2"/>
       <text x="50" y="45" font-size="12" text-anchor="middle">Check order</text>
     </g>
     <g transform="translate(340,95)">
       <path d="M 25 0 L 50 25 L 25 50 L 0 25 Z" fill="#ffffff" stroke="#22242a" stroke-width="2"/>
       <text x="25" y="70" font-size="11" text-anchor="middle">In stock?</text>
     </g>
     <g transform="translate(80,102)">
       <circle cx="18" cy="18" r="18" fill="#ffffff" stroke="#22242a" stroke-width="2"/>
       <text x="18" y="52" font-size="11" text-anchor="middle">Order received</text>
     </g>
     <path d="M 116 120 L 180 120" fill="none" stroke="#22242a" stroke-width="2"/>`,
    'viewBox="0 0 600 300"'
  );

  it('recognises the shapes, the arrow and every label', () => {
    const result = run(FRAGMENT);
    expect(typesOf(FRAGMENT)).toEqual([
      'shape',
      'text',
      'brush',
      'text',
      'shape',
      'text',
      'brush',
    ]);
    expect(result.report.mapped).toBe(7);
    expect([result.report.carried, result.report.quarantined]).toEqual([0, 0]);
  });

  it('brings the labels back as editable text, verbatim', () => {
    const labels = run(FRAGMENT)
      .elements.filter(props => props.type === 'text')
      .map(props => props.text);
    expect(labels).toEqual(['Check order', 'In stock?', 'Order received']);
  });

  it('places the task where the group translate put it', () => {
    const [task] = run(FRAGMENT).elements;
    expect(boxOf(task)).toEqual([180, 80, 100, 80]);
    expect(task.radius).toBe(10);
  });

  it('reads the gateway diamond as a closed stroke through its corners', () => {
    const diamond = run(FRAGMENT).elements[2];
    expect(diamond.type).toBe('brush');
    expect(diamond.points).toEqual([
      [365, 95],
      [390, 120],
      [365, 145],
      [340, 120],
      [365, 95],
    ]);
  });
});

describe('a wardley-shaped map', () => {
  const MAP = svg(
    `<g stroke="#5b6472" stroke-width="1">
       <line x1="40" y1="20" x2="40" y2="380"/>
       <line x1="40" y1="380" x2="560" y2="380"/>
     </g>
     <circle cx="180" cy="90" r="6" fill="#ffffff" stroke="#000000"/>
     <text x="192" y="88" font-size="12">Customer</text>
     <circle cx="300" cy="200" r="6" fill="#ffffff" stroke="#000000"/>
     <text x="312" y="198" font-size="12">Checkout</text>
     <line x1="180" y1="90" x2="300" y2="200" stroke="#9aa3ad"/>`,
    'viewBox="0 0 600 400"'
  );

  it('recognises the axes, the components and their labels', () => {
    expect(typesOf(MAP)).toEqual([
      'brush',
      'brush',
      'shape',
      'text',
      'shape',
      'text',
      'brush',
    ]);
    const names = run(MAP)
      .elements.filter(props => props.type === 'text')
      .map(props => props.text);
    expect(names).toEqual(['Customer', 'Checkout']);
  });

  it('gives every component an ellipse on its own bounding box', () => {
    const circles = run(MAP).elements.filter(
      props => props.shapeType === 'ellipse'
    );
    expect(circles).toHaveLength(2);
    expect(boxOf(circles[0])).toEqual([174, 84, 12, 12]);
  });

  it('carries the axes stroke inherited from the group', () => {
    const [axis] = run(MAP).elements;
    expect(axis.color).toBe('#5b6472');
    expect(axis.lineWidth).toBe(1);
  });
});
