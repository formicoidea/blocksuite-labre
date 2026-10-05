import { describe, expect, it } from 'vitest';

import {
  parseSvgSketch,
  sanitizeSvg,
  sketchSvgTree,
  svgFrameOf,
  SvgSketchNotebook,
} from '../extensions/svg-sketch.js';

/**
 * The two passes `parseSvgSketch` is made of, opened to a framework that wants
 * to claim part of a picture before the sketch reads the rest (ADR 0032 §2).
 *
 * Wardley's SVG import recognises the map a picture is a picture OF and hands
 * everything it did not consume back to the shared sketch walk. That needed
 * the sanitiser and the walk as separate functions, a `skip` set, a frame to
 * place the remainder with, and the frame of any one node so a recogniser
 * reads coordinates exactly the way the sketch would have. BPMN still calls
 * `parseSvgSketch` and must not see a single byte of difference — the first
 * block below is the guard that says so, recorded against the reader BEFORE it
 * was split.
 */

const svg = (body: string, attrs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`;

/**
 * One file exercising every branch of the walk: viewport scaling, nested
 * `<svg>`, translates, ignored transforms, inherited paint, every outline,
 * curves, text with spans and anchors, hidden subtrees, a `<switch>`,
 * opacity, paint servers, and the constructs the sanitiser removes.
 */
const EVERYTHING = svg(
  `<style>.a { fill: red }</style>
   <defs><linearGradient id="g"><stop offset="0"/></linearGradient></defs>
   <g fill="#ffeecc" stroke="#223344" stroke-width="2" transform="translate(10,20)">
     <rect x="1" y="2" width="30" height="40" rx="4"/>
     <rect x="1" y="2" width="30" height="40" rx="50%"/>
     <circle cx="50" cy="50" r="10" opacity="0.5"/>
     <ellipse cx="80" cy="40" rx="12" ry="6" fill="url(#g)"/>
     <polygon points="0,0 20,0 10,15"/>
     <polygon points="0,0 20,0"/>
     <line x1="0" y1="0" x2="40" y2="40"/>
     <polyline points="0,0 10,10 20,0" stroke="currentColor"/>
     <path d="M0 0 L10 10 C 20 20 30 30 40 40 Z M 50 50 l 5 5 h 10 v 10"/>
     <text x="5" y="90" font-size="12pt" text-anchor="middle">Hello <tspan>World</tspan></text>
     <text x="5" y="120" font-size="2em"><tspan>one</tspan><tspan display="none">two</tspan></text>
     <text x="5" y="140" font-size="50%">percent</text>
   </g>
   <g transform="scale(2) rotate(10)"><rect width="5" height="5"/></g>
   <g display="none"><rect width="99" height="99"/></g>
   <g visibility="hidden"><rect width="98" height="98"/></g>
   <switch><rect width="7" height="7"/><circle r="3"/></switch>
   <svg x="200" y="100" width="50" height="50" viewBox="0 0 100 100">
     <rect x="10" y="10" width="20" height="20"/>
   </svg>
   <use href="#g"/><image href="x.png"/>
   <foreignObject><div>x</div></foreignObject>
   <script>alert(1)</script>
   <rect width="0" height="5"/>
   <text x="0" y="0">   </text>
   <path d="M 5 5"/>`,
  'width="600" height="300" viewBox="0 0 1200 600" onload="alert(2)"'
);

/** The bpmn.io-shaped fragment BPMN's own spec reads, verbatim. */
const BPMN_FRAGMENT = svg(
  `<g transform="translate(180,80)">
     <rect x="0" y="0" width="100" height="80" rx="10" fill="#ffffff" stroke="#22242a" stroke-width="2"/>
     <text x="50" y="45" font-size="12" text-anchor="middle">Check order</text>
   </g>
   <g transform="translate(340,95)">
     <path d="M 25 0 L 50 25 L 25 50 L 0 25 Z" fill="#ffffff" stroke="#22242a" stroke-width="2"/>
     <text x="25" y="70" font-size="11" text-anchor="middle">In stock?</text>
   </g>
   <path d="M 116 120 L 180 120" fill="none" stroke="#22242a" stroke-width="2"/>`,
  'viewBox="0 0 600 300"'
);

describe('`parseSvgSketch` is byte-for-byte what it was before the split', () => {
  /**
   * GUARD. Recorded against the single-function reader, before
   * `sanitizeSvg` / `sketchSvgTree` existed. Would have caught: the split
   * changing what BPMN's `bpmn:svg:import` draws, the order it draws it in, or
   * a single note it says — BPMN keeps `run: parseSvgSketch` and ADR 0032 §8
   * promises it nothing changes.
   */
  it('reads the everything-fixture exactly as recorded', () => {
    expect(parseSvgSketch(EVERYTHING, {})).toMatchSnapshot();
  });

  it('reads the bpmn.io fragment exactly as recorded', () => {
    expect(parseSvgSketch(BPMN_FRAGMENT, {})).toMatchSnapshot();
  });
});

describe('the two passes, composed, are the reader', () => {
  it('sanitises once and walks everything when nothing is claimed', () => {
    const notes = new SvgSketchNotebook();
    const root = sanitizeSvg(EVERYTHING, notes);
    const elements = sketchSvgTree(root, notes);
    const whole = parseSvgSketch(EVERYTHING, {});
    expect(elements).toEqual(whole.elements);
    expect(notes.notes).toEqual(whole.report.notes);
  });

  it('leaves a claimed node and its whole subtree to the caller', () => {
    const source = svg(
      `<g id="claimed"><circle cx="5" cy="5" r="5"/><text x="0" y="20">mine</text></g>
       <rect id="left" x="40" y="0" width="10" height="10"/>`
    );
    const notes = new SvgSketchNotebook();
    const root = sanitizeSvg(source, notes);
    const claimed = root.querySelector('#claimed')!;
    const elements = sketchSvgTree(root, notes, { skip: new Set([claimed]) });
    expect(elements.map(props => props.shapeType ?? props.type)).toEqual([
      'rect',
    ]);
  });

  it('places the remainder through the frame it is handed', () => {
    // canvas = 2 · file + (100, 50): the frame a recogniser uses to land what
    // it did not consume beside the native board it drew.
    const source = svg('<rect x="10" y="20" width="30" height="40"/>');
    const notes = new SvgSketchNotebook();
    const root = sanitizeSvg(source, notes);
    const [rect] = sketchSvgTree(root, notes, {
      place: { ox: 100, oy: 50, s: 2 },
    });
    expect(rect.xywh).toBe('[120,90,60,80]');
    expect(rect.strokeWidth).toBe(2);
  });
});

describe('the frame of one node is the frame the walk would have used', () => {
  it('composes the viewport, every translate on the way down, and its own', () => {
    // width 600 over a viewBox 1200 wide: half scale. Translates add up in
    // the units of the frame they were written in.
    const source = svg(
      `<g transform="translate(100,40)"><g transform="translate(10, 10)">
         <circle id="dot" cx="20" cy="30" r="4" transform="translate(2,2)"/>
       </g></g>`,
      'width="600" height="300" viewBox="0 0 1200 600"'
    );
    const notes = new SvgSketchNotebook();
    const root = sanitizeSvg(source, notes);
    const dot = root.querySelector('#dot')!;
    const frame = svgFrameOf(dot);
    expect(frame).toEqual({ ox: 56, oy: 26, s: 0.5 });

    const [circle] = sketchSvgTree(root, notes);
    // The sketch's own placement of that circle: centre (20, 30) in the
    // circle's user space, radius 4.
    const [x, y, w] = JSON.parse(circle.xywh as string) as number[];
    expect(x + w / 2).toBe(frame.ox + 20 * frame.s);
    expect(y + w / 2).toBe(frame.oy + 30 * frame.s);
  });
});

describe('what the sanitiser keeps of a producer’s markers', () => {
  /**
   * GUARD for ADR 0032 §7, which flags this as unverified: a recogniser reads
   * `data-*` and `id` OFF THE SANITISED TREE, so a DOMPurify upgrade that
   * started stripping either would turn every recognised import into a plain
   * sketch without a single failing test elsewhere. Would have caught: that.
   */
  it('keeps `data-*` attributes and ordinary ids', () => {
    const source = svg(
      `<g data-layer="nodes" data-id="cup" data-kind="component"
          data-labre-id="abc" data-labre-role="wardley:component"
          data-labre-xywh="[0,0,10,10]" data-testid="map-anchor-2">
         <rect id="fillArea" width="5" height="5"/>
         <circle id="element_circle_3" r="5"/>
         <g id="modern_link_2_3"><line x2="5"/></g>
       </g>`,
      'data-labre-svg="1"'
    );
    const root = sanitizeSvg(source, new SvgSketchNotebook());
    expect(root.getAttribute('data-labre-svg')).toBe('1');
    const group = root.querySelector('g')!;
    for (const name of [
      'data-layer',
      'data-id',
      'data-kind',
      'data-labre-id',
      'data-labre-role',
      'data-labre-xywh',
      'data-testid',
    ]) {
      expect(group.hasAttribute(name), name).toBe(true);
    }
    for (const id of ['fillArea', 'element_circle_3', 'modern_link_2_3']) {
      expect(root.querySelector(`[id="${id}"]`), id).not.toBeNull();
    }
  });

  it('drops an id that names a property of `document` — and only that', () => {
    // DOMPurify's DOM-clobbering guard. Pinned so the recognisers' choice
    // never to rely on such an id (OnlineWardleyMaps writes `links` and
    // `anchors` on two of its containers) stays a documented fact.
    const source = svg(
      '<g id="links"><g id="anchors"/><g id="__proto__"/><g id="pipeline_box_9"/></g>'
    );
    const root = sanitizeSvg(source, new SvgSketchNotebook());
    const ids = Array.from(root.querySelectorAll('g')).map(g =>
      g.getAttribute('id')
    );
    expect(ids).toEqual([null, null, null, 'pipeline_box_9']);
  });
});
