import { afterEach, describe, expect, it } from 'vitest';

import {
  UML_DRAWIO_IMPORT,
  UML_PLANTUML_IMPORT,
  UML_XMI_IMPORT,
} from '../interchange';

/**
 * A file whose ids are the names of `Object.prototype`.
 *
 * `__proto__`, `constructor`, `toString` and `hasOwnProperty` are all valid
 * `xmi:id`s, valid draw.io cell ids and valid PlantUML aliases — nothing in
 * any of the three formats forbids them, and a document carrying one arrives
 * from a stranger's modelling tool. On a plain object they are not keys: the
 * first writes through to the prototype every object in the process shares,
 * and the other three read a FUNCTION back out of a bag that only ever held
 * boxes. So the three readers key their id bags on `Object.create(null)`, and
 * the materializer asks `Object.hasOwn` before it believes a box.
 *
 * What is asserted, per reader and per id: nothing was added to
 * `Object.prototype` (or to the `Object` the `constructor` spelling reaches),
 * the read did not throw, and every element that came out has four finite
 * numbers for a box. A box read off `Object.prototype` has no `x`, which is
 * how the second failure shows up: `NaN` in the `xywh` of a shape.
 *
 * PlantUML keys its entries on a `Map` and has never had the defect; its rows
 * are here so the guard covers all three readers rather than the two that
 * needed the fix.
 */

/* ── The fixtures ─────────────────────────────────────────────────────── */

const HOSTILE = [
  '__proto__',
  'constructor',
  'toString',
  'hasOwnProperty',
] as const;

/**
 * A class under a hostile id, with an attribute the reader does not model.
 *
 * The stray attribute is what makes the payload bag be written to (`carried`
 * matter rides under the source id), and the second class is what puts a box
 * in the layout bag — a bag with something in it is the one a lookup on a
 * hostile id reaches past.
 */
const xmi = (id: string) =>
  `<uml:Model xmi:id="m" name="M">
     <packagedElement xmi:type="uml:Class" xmi:id="${id}" name="A" stray="1"/>
     <packagedElement xmi:type="uml:Class" xmi:id="c2" name="B"/>
     <umldi:UMLDiagram xmi:id="d" name="M">
       <umldi:UMLShape xmi:id="sh" modelElement="c2">
         <bounds x="10" y="20" width="160" height="80"/>
       </umldi:UMLShape>
     </umldi:UMLDiagram>
   </uml:Model>`;

/**
 * The same, as a drawing: a cell under a hostile id whose `mxGeometry` states
 * no size — so the reader files no box for it and the materializer has to
 * invent one, which is exactly the lookup that used to answer with a function.
 * The keyword is what makes a bare box a classifier in this stencil; the second
 * cell is what puts something in the bag the first one reads past.
 */
const drawio = (id: string) =>
  `<mxGraphModel><root>
     <mxCell id="0"/>
     <mxCell id="1" parent="0"/>
     <mxCell id="${id}" value="«k» A" style="html=1;" vertex="1" parent="1">
       <mxGeometry as="geometry"/>
     </mxCell>
     <mxCell id="c2" value="«k» B" style="html=1;" vertex="1" parent="1">
       <mxGeometry x="10" y="20" width="160" height="80" as="geometry"/>
     </mxCell>
   </root></mxGraphModel>`;

const plantuml = (id: string) =>
  `@startuml\nclass ${id}\nclass B\n${id} --> B\n@enduml\n`;

const READERS = [
  { format: 'xmi', capability: UML_XMI_IMPORT, source: xmi },
  { format: 'drawio', capability: UML_DRAWIO_IMPORT, source: drawio },
  { format: 'plantuml', capability: UML_PLANTUML_IMPORT, source: plantuml },
];

/* ── The probe ────────────────────────────────────────────────────────── */

/** The objects the four spellings reach, and what a payload would write. */
const VICTIMS: Record<string, unknown>[] = [
  Object.prototype as unknown as Record<string, unknown>,
  Object as unknown as Record<string, unknown>,
];
const CARRIED = ['id', 'attrs', 'quarantined'];

const polluted = () =>
  VICTIMS.flatMap(victim => CARRIED.filter(key => Object.hasOwn(victim, key)));

afterEach(() => {
  // A failed assertion must not leave the rest of the suite running against a
  // poisoned prototype.
  for (const victim of VICTIMS) for (const key of CARRIED) delete victim[key];
});

/** Every box an element states, as the four numbers it is. */
const boxesOf = (elements: readonly Record<string, unknown>[]) =>
  elements
    .map(element => element.xywh)
    .filter((xywh): xywh is string => typeof xywh === 'string')
    .map(xywh => JSON.parse(xywh) as number[]);

/* ── The guard ────────────────────────────────────────────────────────── */

describe.each(READERS)(
  '$format, read from a hostile file',
  ({ capability, source }) => {
    it.each(HOSTILE)('takes "%s" as an id and nothing more', id => {
      const result = capability.run(source(id), {});

      expect(polluted()).toEqual([]);
      expect(({} as Record<string, unknown>)['attrs']).toBeUndefined();

      const boxes = boxesOf(result.elements);
      expect(boxes.length).toBeGreaterThan(0);
      for (const box of boxes) {
        expect(box).toHaveLength(4);
        expect(box.every(number => Number.isFinite(number))).toBe(true);
      }
    });
  }
);
