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
  type XmlNode,
} from '@labre/affine-block-surface/interchange';
import { BPMN_XML_IMPORT } from '@labre/affine-gfx-bpmn/interchange';
import {
  decodeDrawio,
  UML_DRAWIO_DECODE_ERRORS,
  UML_DRAWIO_IMPORT,
} from '@labre/affine-gfx-uml/interchange';
import { describe, expect, it } from 'vitest';

/**
 * GUARD — every `./interchange` reader is linear in its input and bounded in
 * what it holds (ADR 0012, P3 as amended 2026-10-14, "Bounded").
 *
 * A server runs these readers on a stranger's file: the labre import function
 * has 256 MiB and two seconds of CPU. The independent security review of
 * 394219550 found no execution flaw and four denials of service, each one a
 * small file that costs seconds. Every case below is one of them, with the
 * time it took BEFORE the fix (Node 22, the machine the review ran on) and the
 * budget it must now hold. **What it would catch**: a copy per entry where a
 * push did, a search of the stack or of the rest of the file per tag, a cap
 * checked after the tree is built rather than while it grows, a table read by
 * a name the file chose that still has a prototype, a spread or a recursion
 * whose depth is the file's.
 *
 * The budget is generous on purpose (the same 1.5 s as the import function's
 * own `import-linear-time.test.ts`), and the inputs are half the review's
 * where it was quadratic: a quarter of the time quoted, still seconds, where
 * the fixed readers take a tenth of the budget on an idle machine.
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
    expect(document.notes.length).toBeGreaterThan(10_000);
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
});
