import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  InterchangeImportError,
  isSafeSvgValue,
  parseSvgSketch,
  readXml,
  sanitizeSvgNode,
  serializeXmlNode,
  XML_MAX_CHARACTERS,
  XML_MAX_NODES,
  XML_READ_TOO_LARGE,
  XmlElement,
  type XmlNode,
} from '@labre/affine-block-surface/interchange';
import { BPMN_XML_IMPORT } from '@labre/affine-gfx-bpmn/interchange';
import {
  drawioCompartments,
  stereotypesOf,
  UML_XMI_ERRORS,
  umlElementsWithForeign,
  XMI_MAX_DEPTH,
} from '@labre/affine-gfx-uml';
import {
  decodeDrawio,
  UML_DRAWIO_DECODE_ERRORS,
  UML_DRAWIO_IMPORT,
  UML_PLANTUML_IMPORT,
  UML_XMI_IMPORT,
} from '@labre/affine-gfx-uml/interchange';
import { WARDLEY_SVG_IMPORT } from '@labre/affine-gfx-wardley/interchange';
import { describe, expect, it, vi } from 'vitest';

import { ROOT } from './translations/source-files.js';

/**
 * GUARD — the denials of service two security reviews found in the
 * `./interchange` readers stay fixed (ADR 0012, P3 amendment "bounded").
 *
 * A server runs these readers on a stranger's file: the labre import function
 * has 256 MiB and two seconds of CPU. The review of 394219550 found no
 * execution flaw and nine faults, the counter-review of 49aa247ce eight more in
 * the UML readers; each case below is one of them, with what it cost BEFORE the
 * fix (Node 22) in its comment. **What it would catch**: that fault coming
 * back — a copy per entry where a push did, a search of the stack or of the
 * rest of the line per token, a cap checked after the tree is built, a table
 * read by a name the file chose that has a prototype, a spread over the file's
 * values, a recursion the file can make deep.
 *
 * What it does NOT prove: that every reader is linear on every input. It holds
 * the cases found, no more. The XMI reader's recursions are bounded by a depth
 * cap ({@link XMI_MAX_DEPTH}), not removed; a 200 000-node SVG still reads in
 * about two seconds and 340 MiB of heap on an idle machine; the node and
 * character caps are what bound the rest.
 *
 * The time budget is the import function's own 1.5 s
 * (`import-linear-time.test.ts`): generous, because the suite runs under load,
 * and the inputs are sized so that the quadratic version took several times
 * that. Where a timing would not separate before from after, the case counts
 * what the reader did instead.
 */

const BUDGET_MS = 1_500;

const BPMN_NS = 'http://www.omg.org/spec/BPMN/20100524/MODEL';
const SVG_NS = 'http://www.w3.org/2000/svg';

function timed<T>(run: () => T): [T, number] {
  const started = performance.now();
  const value = run();
  return [value, performance.now() - started];
}

function keyOf(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    return error instanceof InterchangeImportError
      ? error.messageKey
      : String(error);
  }
  return undefined;
}

const manyPrefixes = Array.from(
  { length: 1_000 },
  (_, index) => ` xmlns:p${index}="urn:p${index}"`
).join('');

describe('the interchange readers stay linear on hostile files', () => {
  // 1. A copied scope per declaring element: SVG 28.6 s / 284 MiB, BPMN 9.1 s.
  it('resolves namespaces in one lookup per name, however many are declared', () => {
    const svg = `<svg xmlns="${SVG_NS}"${manyPrefixes}>${'<g xmlns:q="x"/>'.repeat(2_500)}</svg>`;
    const [, svgMs] = timed(() => parseSvgSketch(svg, {}));
    expect(svgMs).toBeLessThan(BUDGET_MS);

    const bpmn = `<definitions xmlns="${BPMN_NS}"${manyPrefixes} id="D"><process id="P">${'<task xmlns:q="x"/>'.repeat(2_500)}</process></definitions>`;
    const [, bpmnMs] = timed(() => BPMN_XML_IMPORT.run(bpmn, {}));
    expect(bpmnMs).toBeLessThan(BUDGET_MS);
  });

  // 2. `findLastIndex` per orphan close tag: 4.3 s for 68 KiB.
  it('answers an orphan close tag without searching the stack', () => {
    const source = '<a>'.repeat(10_000) + '</b>'.repeat(10_000);
    const [document, ms] = timed(() => readXml(source));
    expect(document.notes.length).toBeGreaterThan(100);
    expect(ms).toBeLessThan(BUDGET_MS);
  });

  // 3. No cap: 1 MiB of `<a/>` was 2.9 s / 140 MiB, 2.3 MiB of text filled the
  // heap.
  it('refuses past its node and character caps, while reading', () => {
    expect([XML_MAX_NODES, XML_MAX_CHARACTERS]).toEqual([200_000, 2 * 2 ** 20]);
    const key = XML_READ_TOO_LARGE[0];

    const nodes = `<mxGraphModel><root>${'<a/>'.repeat(XML_MAX_NODES)}</root></mxGraphModel>`;
    expect(keyOf(() => UML_DRAWIO_IMPORT.run(nodes, {}))).toBe(key);
    const text = `<a>${'x'.repeat(XML_MAX_CHARACTERS + 1)}</a>`;
    expect(keyOf(() => readXml(text))).toBe(key);

    // During the read: a million nodes would take seconds to build first.
    const huge = '<r>' + '<a/>'.repeat(1_000_000) + '</r>';
    const [refused, ms] = timed(() =>
      keyOf(() => readXml(huge, { maxNodes: 10 }))
    );
    expect(refused).toBe(key);
    expect(ms).toBeLessThan(BUDGET_MS);
  });

  // 4. A lazy `[\s\S]*?` per unclosed `<diagram>`: 15 s for 352 KiB.
  it('finds a draw.io payload with two linear searches', async () => {
    const source = '<mxfile>' + '<diagram>x'.repeat(35_000);
    const started = performance.now();
    await expect(decodeDrawio(source)).rejects.toMatchObject({
      messageKey: UML_DRAWIO_DECODE_ERRORS.emptyDiagram[0],
    });
    expect(performance.now() - started).toBeLessThan(BUDGET_MS);
  });

  // 5. A copy of the bag per kept entry: 20 000 children 13.8 s, 20 000
  // unknown attributes past two minutes.
  it('keeps foreign children and attributes in place', () => {
    const children = `<definitions xmlns="${BPMN_NS}" xmlns:x="urn:x" id="D"><process id="P"><task id="T">${'<x:foo/>'.repeat(10_000)}</task></process></definitions>`;
    const [, childrenMs] = timed(() => BPMN_XML_IMPORT.run(children, {}));
    expect(childrenMs).toBeLessThan(BUDGET_MS);

    const attrs = Array.from({ length: 10_000 }, (_, i) => ` a${i}="v"`).join(
      ''
    );
    const attributes = `<definitions xmlns="${BPMN_NS}" id="D"><process id="P"><task id="T"${attrs}/></process></definitions>`;
    const [, attrsMs] = timed(() => BPMN_XML_IMPORT.run(attributes, {}));
    expect(attrsMs).toBeLessThan(BUDGET_MS);
  });

  // 6. `READ_ATTRS.constructor` was `Object`: an untyped TypeError.
  it('reads an element named after an Object.prototype member', async () => {
    const source = `<definitions xmlns="${BPMN_NS}" id="D"><process id="P"><task id="A"/><task id="B"/><constructor id="C" sourceRef="A" targetRef="B"/><toString id="E"/></process></definitions>`;
    const result = await BPMN_XML_IMPORT.run(source, {});
    expect(result.elements.length).toBeGreaterThan(0);
  });

  // 7a. Conformant mode kept reading after its first note: 20 000 notes, 0.9 s.
  it('stops a conformant read at its first note', () => {
    const source = `<definitions xmlns="${BPMN_NS}" id="D">${'<a b>'.repeat(20_000)}</definitions>`;
    const [document, ms] = timed(() => readXml(source, { conformant: true }));
    expect(document.notes).toHaveLength(1);
    expect(ms).toBeLessThan(BUDGET_MS);
  });

  // 7b. The sanitizer built a view of the WHOLE tree, then cut at the depth.
  it('never reads what lies below the depth cut or a removed element', () => {
    const poisoned = (): XmlNode =>
      ({
        name: 'g',
        prefix: '',
        local: 'g',
        get attrs(): never {
          throw new Error('read past the cut');
        },
        children: [],
        range: [0, 0],
      }) as XmlNode;
    const node = (name: string, children: XmlNode[]): XmlNode => ({
      name,
      prefix: '',
      local: name,
      attrs: Object.create(null),
      children,
      range: [0, 0],
    });
    let deep = node('g', [poisoned()]);
    for (let depth = 0; depth < 300; depth += 1) deep = node('g', [deep]);
    const root = node('svg', [deep, node('script', [poisoned()])]);
    root.attrs.xmlns = SVG_NS;

    const { report } = sanitizeSvgNode(root);
    expect(report.tooDeep).toBe(true);
    expect(report.removed).toEqual([{ element: 'script' }]);
  });

  // 8. `image-set("…")` names a URL without `url(`.
  it('refuses image-set like url()', () => {
    expect(
      isSafeSvgValue('background:image-set("https://x.test/a.png" 1x)')
    ).toBe(false);
    expect(isSafeSvgValue('background:-webkit-image-set("a.png" 1x)')).toBe(
      false
    );
  });

  // 9. `Math.min(...xs)` and a recursive serializer: RangeError past ~100 000.
  it('bounds a polygon and serializes a deep tree without the call stack', () => {
    const polygon = `<svg xmlns="${SVG_NS}"><polygon points="${'0 0 9 9 '.repeat(100_000)}"/></svg>`;
    expect(parseSvgSketch(polygon, {}).elements).toHaveLength(1);

    const depth = 100_000;
    const deep = readXml('<a>'.repeat(depth) + '</a>'.repeat(depth));
    // `<a/>` innermost, `<a>…</a>` around it.
    expect(serializeXmlNode(deep.root!)).toHaveLength((depth - 1) * 7 + 4);
  });

  /* ── Counter-review of 49aa247ce: the UML readers ─────────────────── */

  // U1. `<<([^>]*)>>` re-scanned the line per unclosed `<<`: 80 KiB 6.5 s
  // (PlantUML) and 40 KiB 1.3 s (`stereotypesOf`). Then a size cap.
  it('reads unclosed guillemets in linear time, and caps PlantUML', async () => {
    const started = performance.now();
    await UML_PLANTUML_IMPORT.run('class A ' + '<'.repeat(80_000), {});
    expect(performance.now() - started).toBeLessThan(BUDGET_MS);
    const [, ms] = timed(() => stereotypesOf('<'.repeat(80_000)));
    expect(ms).toBeLessThan(BUDGET_MS);

    expect(
      keyOf(() => UML_PLANTUML_IMPORT.run('x'.repeat(2 ** 20 + 1), {}))
    ).toBe('com.labre.uml.import.plantuml.too-large');
  });

  // U2. `/<[^>]*>/g` on a label of repeated `<`: 40 KiB 1.2 s.
  it("strips a draw.io label's tags in linear time", () => {
    const [lines, ms] = timed(() => drawioCompartments('<'.repeat(80_000)));
    expect(lines).toHaveLength(1);
    expect(ms).toBeLessThan(BUDGET_MS);
    expect(drawioCompartments('a<b>c<d')).toEqual([['ac<d']]);
  });

  // U3. Each note copied a name the file chose: a 20 000-character name and
  // 20 000 valueless attributes were 20 000 notes, 400 MB of JSON, 2.5 s.
  it('quotes a name to 64 characters and lists 100 notes at most', () => {
    const source = `<${'a'.repeat(20_000)}${' b'.repeat(20_000)}/>`;
    const { notes } = readXml(source);
    expect(notes).toHaveLength(101);
    expect(notes.at(-1)).toMatch(/^\+19900 more/);
    expect(JSON.stringify(notes).length).toBeLessThan(20_000);
  });

  // U4. `readPackage`, `consumeSubtree` and `sweep` recurse: 5 000 nested
  // packages were a bare RangeError.
  it('refuses an XMI file nested past its depth cap, keyed', () => {
    const depth = 5_000;
    const source =
      '<xmi:XMI xmlns:xmi="http://www.omg.org/spec/XMI/20131001" xmlns:uml="http://www.omg.org/spec/UML/20131001"><uml:Model xmi:id="m" name="M">' +
      '<packagedElement xmi:type="uml:Package" name="p">'.repeat(depth) +
      '</packagedElement>'.repeat(depth) +
      '</uml:Model></xmi:XMI>';
    expect(keyOf(() => UML_XMI_IMPORT.run(source, {}))).toBe(
      UML_XMI_ERRORS.tooDeep[0]
    );
    expect(XMI_MAX_DEPTH).toBe(1_000);
  });

  // U5. `Math.min(...)` / `Math.max(...)` over a file's values: 130 000 UML
  // classes were a RangeError. Held on the source of every package with an
  // `./interchange` entry, because a runtime case needs 3 s of layout.
  it('spreads no file-sized array into Math.min or Math.max', () => {
    const offenders: string[] = [];
    for (const pkg of [
      'blocks/surface/src/extensions',
      'gfx/bpmn/src',
      'gfx/c4/src',
      'gfx/uml/src',
      'gfx/wardley/src',
    ]) {
      const dir = join(ROOT, 'packages/affine', pkg);
      for (const file of readdirSync(dir, {
        recursive: true,
        encoding: 'utf8',
      })) {
        if (!file.endsWith('.ts') || file.includes('__tests__')) continue;
        const text = readFileSync(join(dir, file), 'utf8');
        if (/Math\.(?:min|max)\(\s*\.\.\./.test(text)) {
          offenders.push(`${pkg}/${file}`);
        }
      }
    }
    // Fixed-size arrays the file cannot grow: the legend's four Porter
    // arrows, a label's anchor candidates.
    expect(offenders.sort()).toEqual([
      'gfx/wardley/src/export.ts',
      'gfx/wardley/src/legend.ts',
    ]);
  });

  // U6. A `querySelector('tspan')` per `<text>` rebuilt its subtree each time.
  it("finds each Wardley text's first span in one pass", async () => {
    const texts = '<text x="1" y="1"><tspan>a</tspan></text>'.repeat(200);
    const descendants = vi.spyOn(XmlElement.prototype, 'descendants');
    try {
      await WARDLEY_SVG_IMPORT.run(`<svg xmlns="${SVG_NS}">${texts}</svg>`, {});
      expect(descendants.mock.calls.length).toBeLessThan(50);
    } finally {
      descendants.mockRestore();
    }
  });

  // U7. `Object.assign({...}, …)` set the residue's prototype when a scope
  // was the id `__proto__`, and its attributes were lost in silence.
  it('keeps residue attributes filed under the id __proto__', () => {
    const foreign = {
      orphan: { id: 'orphan', attrs: { ['__proto__']: { a: '1' } } },
    };
    const [first] = umlElementsWithForeign(
      [{ type: 'shape', interchange: { xmi: { id: 'frame' } } }],
      foreign,
      'xmi'
    );
    const attrs = (
      first!.interchange as Record<string, { attrs: Record<string, unknown> }>
    ).xmi.attrs;
    expect(Object.hasOwn(attrs, '__proto__')).toBe(true);
  });

  // U8. `STATE_KIND_OF_STEREOTYPE['constructor']` was `Object`: the
  // stereotype was taken for a glyph and dropped.
  it('keeps a <<constructor>> stereotype on a PlantUML state', async () => {
    const { elements } = await UML_PLANTUML_IMPORT.run(
      '@startuml\nstate S <<constructor>>\nstate T\nS --> T\n@enduml',
      {}
    );
    expect(JSON.stringify(elements)).toContain('«constructor»');
  });
});
