import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  drawioCompartments,
  importDrawio,
  isCompressedDrawio,
} from '../drawio-import';

/**
 * The draw.io reader, against draw.io's OWN UML class example.
 *
 * The corpus is `drawio-class-iwlayer.drawio.xml` — the file draw.io ships as
 * its UML class template, compressed exactly as the application writes it — and
 * `…decoded.xml` beside it, which is the `<mxGraphModel>` inside it. The
 * decoded one is what this spec reads, because this reader is pure and
 * synchronous and the inflating is the command's (`drawio-decode.unit.spec.ts`,
 * `docs/adr/0019`).
 *
 * Nothing here is hand-written, and that is the point: a heuristic reader
 * proved against a fixture its own author wrote proves that the author agreed
 * with themselves. What this asserts is that eight boxes a stranger drew in
 * 2013 come back as eight classifiers with their members, and that the four
 * hollow diamonds, the two `«use»` arrows and the one hollow triangle come back
 * as the four relationships UML calls them.
 */

/**
 * A corpus file, as the bytes on disk.
 *
 * `dirname(fileURLToPath(import.meta.url))` and `join`, which is how every
 * other spec in this repo finds a file beside itself. Resolving with
 * `new URL(relative, import.meta.url)` instead looks tidier and is wrong here:
 * this project runs under happy-dom, whose `URL` is the DOM one, and the path
 * that comes out has lost its drive letter.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const corpus = (name: string) =>
  readFileSync(join(HERE, 'corpus', name), 'utf8');

const DECODED = corpus('drawio-class-iwlayer.decoded.xml');
const COMPRESSED = corpus('drawio-class-iwlayer.drawio.xml');

describe('the label HTML', () => {
  it('splits draw.io’s class template into its three compartments', () => {
    const value =
      '<p style="margin: 0px;"><strong>Payable</strong></p><hr /><p>+amount : int<br />-paid : Boolean</p><hr /><p>+pay() : void</p>';

    expect(drawioCompartments(value)).toEqual([
      ['Payable'],
      ['+amount : int', '-paid : Boolean'],
      ['+pay() : void'],
    ]);
  });

  it('decodes what the markup was hiding, and drops the elision marker', () => {
    // Two decodes in the pipeline, one each: the XML reader takes the attribute
    // apart (`&amp;lt;` → `&lt;`) and this takes the HTML apart (`&lt;` → `<`).
    // So a `<` the author typed survives both escapings, and §9.2.4's elision
    // marker is dropped rather than imported as a member called `...`.
    expect(
      drawioCompartments('<p>A &lt; B</p><hr /><p>...<br />+x</p>')
    ).toEqual([['A < B'], ['+x']]);
  });

  it('rescues Annex C’s ASCII guillemets from the markup strip', () => {
    // `<<use>>` comes off the XML attribute as those six characters, and a
    // blind tag strip reads `<use>` as an element and throws the keyword away —
    // which is a `«use»` dependency silently becoming an association.
    expect(drawioCompartments('<p><<interface>><br/>Payable</p>')).toEqual([
      ['«interface»', 'Payable'],
    ]);
  });

  it('answers nothing for a box with no label', () => {
    expect(drawioCompartments(undefined)).toEqual([]);
    expect(drawioCompartments('   ')).toEqual([]);
  });
});

describe('a compressed payload', () => {
  it('is recognised as one, and refused with a remark rather than a throw', () => {
    expect(isCompressedDrawio(COMPRESSED)).toBe(true);
    expect(isCompressedDrawio(DECODED)).toBe(false);

    const { model, notes } = importDrawio(COMPRESSED);
    expect(model.classifiers).toEqual([]);
    expect(notes).toHaveLength(1);
    expect(notes[0].kind).toBe('warning');
    expect(notes[0].message).toContain('compressed payload');
  });

  it('says so for anything that is not a drawing at all, and draws nothing', () => {
    for (const rubbish of ['', 'not xml', '<html><body>hi</body></html>']) {
      const { model, notes } = importDrawio(rubbish);
      expect(model.classifiers).toEqual([]);
      expect(model.relations).toEqual([]);
      expect(notes.some(note => note.kind === 'warning')).toBe(true);
    }
  });
});

describe('draw.io’s own UML class example', () => {
  const read = importDrawio(DECODED, { name: 'IWLayer' });

  it('reads every compartmented box as a classifier', () => {
    // Eight, and the name list is the file's own — including the two boxes its
    // author called `IWRequestLayer`. A reader that deduplicated them would be
    // inventing a fact about a drawing somebody else made.
    expect(read.model.classifiers.map(entry => entry.name)).toEqual([
      'IWLayerInfoEvent',
      'IWRequestLayerEvent',
      'IWRequestLayer',
      'IWLayerInfoManager',
      'IWLayer',
      'IWRequestLayer',
      'IWShape',
      'IWLayerInterface',
    ]);
    // No `«interface»` and no `«enumeration»` anywhere in this file, so every
    // one of them is a plain class.
    expect(new Set(read.model.classifiers.map(entry => entry.kind))).toEqual(
      new Set(['class'])
    );
  });

  it('keeps each member line as the author typed it, in the right compartment', () => {
    const event = read.model.classifiers.find(
      entry => entry.name === 'IWLayerInfoEvent'
    );
    expect(event?.lines.attributes).toEqual([
      '+requestedid : int',
      '+requestedEvent : String',
      '+json : Object',
      '+mouseCoordinate : IWCoordinate',
      '+records : int',
    ]);
    expect(event?.lines.operations).toEqual(['+toString() : String']);

    // …and the lines are PARSED as well as kept, which is what the XMI writer
    // needs: a visibility, a name and a type off one string.
    expect(event?.attributes[0]).toMatchObject({
      visibility: 'public',
      name: 'requestedid',
      type: 'int',
    });
    expect(event?.operations[0]).toMatchObject({
      visibility: 'public',
      name: 'toString',
    });

    // The biggest box in the file: five attributes, twelve operations.
    const manager = read.model.classifiers.find(
      entry => entry.name === 'IWLayerInfoManager'
    );
    expect(manager?.lines.attributes).toHaveLength(5);
    expect(manager?.lines.operations).toHaveLength(12);
  });

  it('reads the arrow ends as the relationships UML calls them', () => {
    const kinds = read.model.relations.map(relation => relation.kind).sort();
    expect(kinds).toEqual([
      'aggregation',
      'aggregation',
      'aggregation',
      'aggregation',
      'dependency',
      'dependency',
      'generalization',
    ]);
  });

  it('puts the WHOLE at the diamond end of every aggregation', () => {
    const byId = new Map(
      read.model.classifiers.map(entry => [entry.id, entry.name])
    );
    const aggregations = read.model.relations
      .filter(relation => relation.kind === 'aggregation')
      .map(relation => [
        byId.get(relation.sourceId),
        byId.get(relation.targetId),
      ]);

    // `startArrow=diamond` is drawn on the source end in this file, so the
    // source is the whole: the manager holds request layers, a request layer
    // holds a layer, a layer holds the interface and the shapes.
    expect(aggregations).toEqual([
      ['IWLayerInfoManager', 'IWRequestLayer'],
      ['IWRequestLayer', 'IWLayer'],
      ['IWLayer', 'IWLayerInterface'],
      ['IWLayer', 'IWShape'],
    ]);
  });

  it('reads a generalization from the specific end, and a `«use»` as a dependency', () => {
    const byId = new Map(
      read.model.classifiers.map(entry => [entry.id, entry.name])
    );
    const general = read.model.relations.find(
      relation => relation.kind === 'generalization'
    );
    // The hollow triangle points at the GENERAL classifier, and the relation
    // records the SPECIFIC one as its source (`model.ts`, `UmlRelation`).
    expect(byId.get(general!.sourceId)).toBe('IWLayerInterface');
    expect(byId.get(general!.targetId)).toBe('IWRequestLayer');

    const dependencies = read.model.relations.filter(
      relation => relation.kind === 'dependency'
    );
    // The `«use»` keyword CHOSE the kind, so it is not left over as a label: a
    // connector labelled `<<use>>` on the canvas would be the keyword written
    // twice.
    expect(dependencies.map(relation => relation.label)).toEqual([
      undefined,
      undefined,
    ]);
    expect(dependencies.map(relation => byId.get(relation.sourceId))).toEqual([
      'IWRequestLayer',
      'IWRequestLayer',
    ]);
  });

  it('keeps an edge’s own label, and carries the per-end multiplicities', () => {
    const labelled = read.model.relations.find(
      relation => relation.label !== undefined
    );
    expect(labelled).toMatchObject({ kind: 'aggregation', label: 'request' });

    // Five `1`s hang off the four aggregations, each pinned to an end by its
    // relative geometry. The IR has nowhere to put an end label until
    // `docs/adr/0018` lands, so each one is CARRIED and named.
    const ends = read.notes.filter(note => note.element === 'edgeLabel');
    expect(ends).toHaveLength(5);
    expect(ends.every(note => note.kind === 'carried')).toBe(true);
    expect(ends.map(note => note.message.includes('"1"'))).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(
      ends.filter(note => note.message.includes('source end'))
    ).toHaveLength(4);
    expect(
      ends.filter(note => note.message.includes('target end'))
    ).toHaveLength(1);
  });

  it('keeps the geometry, translated to the drawing’s own corner', () => {
    const boxes = read.layout.boxes;
    expect(Object.keys(boxes)).toHaveLength(8);
    // The file's top-left shape sits at (40, 40); every box is translated by
    // that, so the drawing starts at the origin and the materializer adds the
    // frame's plot origin and its own margin.
    expect(Math.min(...Object.values(boxes).map(box => box.x))).toBe(0);
    expect(Math.min(...Object.values(boxes).map(box => box.y))).toBe(0);
    // One draw.io unit is one model unit: the first class is 280 × 150 there
    // and 280 × 150 here.
    expect(boxes['45']).toEqual({ x: 0, y: 0, w: 280, h: 150 });
    expect(boxes['46']).toEqual({ x: 360, y: 65, w: 160, h: 85 });
    // …and the bounds ride on the classifier as well, which is what an
    // attribution pass (packages, subjects) reads.
    const event = read.model.classifiers.find(
      entry => entry.name === 'IWLayerInfoEvent'
    );
    expect(event?.bounds).toEqual({ x: 40, y: 40, w: 280, h: 150 });
  });

  it('names the sheet after the file, and files it as a class diagram', () => {
    expect(read.model.diagram.kind).toBe('class');
    expect(read.model.diagram.name).toBe('IWLayer');
    expect(read.model.diagram.heading).toBe('class IWLayer');
  });

  it('recognises everything in this file — no carried shapes', () => {
    expect(read.notes.filter(note => note.element === 'mxCell')).toEqual([]);
    expect(read.notes.filter(note => note.kind === 'warning')).toEqual([]);
  });
});

describe('the shapes a class diagram is not made of', () => {
  const graph = (cells: string) =>
    `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells}</root></mxGraphModel>`;

  it('reads the four UML shapes draw.io names in its style', () => {
    const read = importDrawio(
      graph(
        [
          '<mxCell id="a" value="Customer" style="shape=umlActor;html=1;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="30" height="60" as="geometry"/></mxCell>',
          '<mxCell id="u" value="Place an order" style="ellipse;html=1;" vertex="1" parent="1"><mxGeometry x="100" y="0" width="140" height="70" as="geometry"/></mxCell>',
          '<mxCell id="n" value="a remark&lt;br/&gt;on two lines" style="shape=note;html=1;" vertex="1" parent="1"><mxGeometry x="300" y="0" width="160" height="80" as="geometry"/></mxCell>',
          '<mxCell id="p" value="Billing" style="shape=folder;html=1;" vertex="1" parent="1"><mxGeometry x="500" y="0" width="200" height="120" as="geometry"/></mxCell>',
        ].join('')
      )
    );

    expect(read.model.actors.map(entry => entry.name)).toEqual(['Customer']);
    expect(read.model.useCases.map(entry => entry.name)).toEqual([
      'Place an order',
    ]);
    expect(read.model.packages.map(entry => entry.name)).toEqual(['Billing']);
    // A note is prose and keeps its line break; its `name` is empty, because a
    // note has no name compartment to read one out of.
    expect(read.model.notes[0]).toMatchObject({
      name: '',
      body: 'a remark\non two lines',
    });
  });

  it('reads a keyword on a bare rectangle, and the two stereotyped classifiers', () => {
    const read = importDrawio(
      graph(
        [
          '<mxCell id="i" value="&lt;p&gt;&amp;lt;&amp;lt;interface&amp;gt;&amp;gt;&lt;br/&gt;Payable&lt;/p&gt;&lt;hr/&gt;&lt;p&gt;+pay() : void&lt;/p&gt;" style="html=1;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="200" height="100" as="geometry"/></mxCell>',
          '<mxCell id="e" value="&lt;p&gt;«enumeration»&lt;br/&gt;Colour&lt;/p&gt;&lt;hr/&gt;&lt;p&gt;RED&lt;br/&gt;GREEN&lt;/p&gt;" style="html=1;" vertex="1" parent="1"><mxGeometry x="250" y="0" width="200" height="100" as="geometry"/></mxCell>',
          '<mxCell id="s" value="«entity» Order" style="rounded=0;html=1;" vertex="1" parent="1"><mxGeometry x="500" y="0" width="200" height="60" as="geometry"/></mxCell>',
        ].join('')
      )
    );

    expect(
      read.model.classifiers.map(entry => [entry.kind, entry.name])
    ).toEqual([
      ['interface', 'Payable'],
      ['enumeration', 'Colour'],
      ['class', 'Order'],
    ]);
    // `<<interface>>` and `«interface»` are the same keyword, which is what
    // `stereotypesOf` already promises for a compartment typed on the canvas.
    expect(read.model.classifiers[0].keywords).toEqual(['interface']);
    expect(read.model.classifiers[2].keywords).toEqual(['entity']);
  });

  it('reads a stack-laid swimlane as a class whose rows are its members', () => {
    const read = importDrawio(
      graph(
        [
          '<mxCell id="c" value="Account" style="swimlane;childLayout=stackLayout;horizontal=1;startSize=26;html=1;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="160" height="110" as="geometry"/></mxCell>',
          '<mxCell id="c1" value="+ balance : int" style="text;html=1;" vertex="1" parent="c"><mxGeometry y="26" width="160" height="26" as="geometry"/></mxCell>',
          '<mxCell id="c2" value="+ deposit(x : int) : void" style="text;html=1;" vertex="1" parent="c"><mxGeometry y="52" width="160" height="26" as="geometry"/></mxCell>',
        ].join('')
      )
    );

    // One classifier, not three: the rows belong to the lane and are never
    // shapes of the sheet.
    expect(read.model.classifiers).toHaveLength(1);
    expect(read.model.classifiers[0]).toMatchObject({
      name: 'Account',
      lines: {
        attributes: ['+ balance : int'],
        operations: ['+ deposit(x : int) : void'],
      },
    });
  });

  it('carries a shape it has no artefact for, naming the style that defeated it', () => {
    const read = importDrawio(
      graph(
        '<mxCell id="z" value="" style="shape=cloud;html=1;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="120" height="80" as="geometry"/></mxCell>'
      )
    );

    expect(read.model.classifiers).toEqual([]);
    expect(read.notes).toHaveLength(1);
    expect(read.notes[0]).toMatchObject({ kind: 'carried', sourceId: 'z' });
    expect(read.notes[0].message).toContain('shape=cloud');
    // …and its geometry is kept all the same, so a later build that learns the
    // shape can draw it where it was.
    expect(read.layout.boxes['z']).toEqual({ x: 0, y: 0, w: 120, h: 80 });
  });

  it('carries an edge whose ends it did not draw, rather than dangling it', () => {
    const read = importDrawio(
      graph(
        [
          '<mxCell id="z" value="" style="shape=cloud;html=1;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="120" height="80" as="geometry"/></mxCell>',
          '<mxCell id="k" value="«k» A" style="html=1;" vertex="1" parent="1"><mxGeometry x="200" y="0" width="120" height="80" as="geometry"/></mxCell>',
          '<mxCell id="e1" style="endArrow=open;html=1;" edge="1" parent="1" source="z" target="k"><mxGeometry as="geometry"/></mxCell>',
        ].join('')
      )
    );

    expect(read.model.relations).toEqual([]);
    const dangling = read.notes.find(note => note.sourceId === 'e1');
    expect(dangling?.kind).toBe('carried');
    expect(dangling?.message).toContain('z → k');
  });

  it('reads the four remaining arrow ends', () => {
    const read = importDrawio(
      graph(
        [
          '<mxCell id="a" value="«k» A" style="html=1;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="80" height="40" as="geometry"/></mxCell>',
          '<mxCell id="b" value="«k» B" style="html=1;" vertex="1" parent="1"><mxGeometry x="200" y="0" width="80" height="40" as="geometry"/></mxCell>',
          // A filled diamond is a composition, whichever end it is drawn on…
          '<mxCell id="e1" style="startArrow=diamond;startFill=1;endArrow=open;html=1;" edge="1" parent="1" source="a" target="b"><mxGeometry as="geometry"/></mxCell>',
          // …and a diamond at the TARGET end puts the whole there, so the ends
          // are flipped and the relation still records the whole as its source.
          '<mxCell id="e2" style="endArrow=diamond;endFill=0;html=1;" edge="1" parent="1" source="a" target="b"><mxGeometry as="geometry"/></mxCell>',
          // Dashed plus a hollow triangle is a realization (§10.4.4).
          '<mxCell id="e3" style="endArrow=block;endFill=0;dashed=1;html=1;" edge="1" parent="1" source="a" target="b"><mxGeometry as="geometry"/></mxCell>',
          // A solid open arrow with no keyword is a plain association.
          '<mxCell id="e4" value="owns" style="endArrow=open;html=1;" edge="1" parent="1" source="a" target="b"><mxGeometry as="geometry"/></mxCell>',
          // …and the two use-case keywords choose their own kinds.
          '<mxCell id="e5" value="&amp;lt;&amp;lt;include&amp;gt;&amp;gt;" style="endArrow=open;dashed=1;html=1;" edge="1" parent="1" source="a" target="b"><mxGeometry as="geometry"/></mxCell>',
          '<mxCell id="e6" value="«extend»" style="endArrow=open;dashed=1;html=1;" edge="1" parent="1" source="a" target="b"><mxGeometry as="geometry"/></mxCell>',
        ].join('')
      )
    );

    expect(
      read.model.relations.map(relation => [
        relation.kind,
        relation.sourceId,
        relation.targetId,
      ])
    ).toEqual([
      ['composition', 'a', 'b'],
      ['aggregation', 'b', 'a'],
      ['realization', 'a', 'b'],
      ['association', 'a', 'b'],
      ['include', 'a', 'b'],
      ['extend', 'a', 'b'],
    ]);
    expect(read.model.relations[3].label).toBe('owns');
  });
});

describe('an mxfile whose diagram was saved uncompressed', () => {
  it('is read through the wrapper, and takes its name from the page', () => {
    const read = importDrawio(
      `<mxfile host="app.diagrams.net"><diagram id="x" name="Domain"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="k" value="«k» A" style="html=1;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="80" height="40" as="geometry"/></mxCell></root></mxGraphModel></diagram></mxfile>`
    );

    expect(read.model.diagram.name).toBe('Domain');
    expect(read.model.diagram.heading).toBe('class Domain');
    expect(read.model.classifiers.map(entry => entry.name)).toEqual(['A']);
  });
});
