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
 * The corpus is not hand-written, and that is the point: a heuristic reader
 * proved against a fixture its own author wrote proves only that the author
 * agreed with themselves. What this asserts is that eight boxes a stranger drew
 * in 2013 come back as eight classifiers with their members, and that the four
 * hollow diamonds, the two `«use»` arrows and the one triangle come back as the
 * relationships UML calls them.
 *
 * Its inheritance arrow is the interesting one, and it is why a real file beats
 * an invented one: the author drew it as `endArrow=block` with no `endFill`, so
 * draw.io paints a FILLED triangle where UML wants a hollow one. It imports as
 * the generalization it is — `block` is the UML stencil's head — with a remark
 * about the drawing. See `names the generalization…` below, and ADR 0019 §2.
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

  it('names the generalization the file drew with a filled triangle', () => {
    // The corpus is a 2013 file and spells its generalization
    // `dashed=0;endArrow=block` — no fill, and mxGraph defaults the fill to 1,
    // so draw.io paints a SOLID triangle where UML wants a hollow one. `block`
    // is the UML stencil's head (ordinary draw.io arrows are `classic` or
    // `open`), so the relationship is read as what it plainly is and the
    // DRAWING is what gets remarked on — the board is right, the file is not,
    // and only the author can fix that.
    const ambiguous = read.notes.filter(
      note => note.kind === 'warning' && note.sourceId === '44'
    );
    expect(ambiguous).toHaveLength(1);
    expect(ambiguous[0].message).toContain('generalization');
    expect(ambiguous[0].message).toContain('drawn filled');
    expect(ambiguous[0].message).toContain('endFill=0');
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
    // The triangle points at the GENERAL classifier, and the relation records
    // the SPECIFIC one as its source (`model.ts`, `UmlRelation`).
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

  it('keeps an edge’s own label, and reads the per-end multiplicities', () => {
    const labelled = read.model.relations.find(
      relation => relation.label !== undefined
    );
    expect(labelled).toMatchObject({ kind: 'aggregation', label: 'request' });

    // Five `1`s hang off the four aggregations, each pinned to an end by its
    // relative geometry (`mxGeometry@x`: `-1` at the source, `+1` at the
    // target). ADR 0020 gave the connector two end labels, so each one is now
    // READ onto the relation end it was drawn at, and nothing is carried.
    const adorned = read.model.relations.filter(
      relation => relation.sourceEnd || relation.targetEnd
    );
    expect(adorned).toHaveLength(4);
    expect(adorned.every(relation => relation.kind === 'aggregation')).toBe(
      true
    );
    expect(
      adorned.filter(relation => relation.sourceEnd !== undefined)
    ).toHaveLength(4);
    expect(
      adorned.filter(relation => relation.targetEnd !== undefined)
    ).toHaveLength(1);
    // `1` is §7.5.4's exact-one, read as a multiplicity rather than a name.
    expect(adorned[0].sourceEnd).toEqual({
      multiplicity: { lower: 1, upper: 1 },
      raw: '1',
    });
    expect(
      read.notes.filter(note => note.element === 'edgeLabel')
    ).toHaveLength(0);
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

  it('recognises every SHAPE in this file — nothing carried, one remark', () => {
    // No `carried` cell: every box in the file became an artefact. The one
    // remark is the filled block head, which is a reading this reader had to
    // demote rather than a shape it could not place.
    expect(
      read.notes.filter(
        note => note.kind === 'carried' && note.element === 'mxCell'
      )
    ).toEqual([]);
    expect(read.notes.filter(note => note.kind === 'warning')).toHaveLength(1);
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
          // Dashed plus a HOLLOW triangle is a realization (§10.4.4).
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

  it('takes a block head at its word, and reads a diamond’s fill', () => {
    // The asymmetry the whole rule turns on, both ends of it in one fixture.
    //
    // A BLOCK head means one UML relationship whatever its fill — `block` is
    // the UML stencil's head, ordinary draw.io arrows are `classic`/`open` — so
    // all four below are a generalization or a realization, and the fill only
    // decides whether a remark is raised.
    //
    // A DIAMOND's fill picks between two UML relationships, so it is READ, with
    // mxGraph's own default of 1 (filled = composite) for an absent one. A rule
    // that defaulted it the other way passed every test that wrote the fill out
    // explicitly, which every hand-written fixture does.
    const read = importDrawio(
      graph(
        [
          '<mxCell id="a" value="«k» A" style="html=1;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="80" height="40" as="geometry"/></mxCell>',
          '<mxCell id="b" value="«k» B" style="html=1;" vertex="1" parent="1"><mxGeometry x="200" y="0" width="80" height="40" as="geometry"/></mxCell>',
          // HOLLOW, explicit — draw.io's UML stencil. No remark: nothing to say.
          '<mxCell id="g1" style="endArrow=block;endFill=0;html=1;" edge="1" parent="1" source="a" target="b"><mxGeometry as="geometry"/></mxCell>',
          // FILLED, explicit — still a generalization, and remarked on.
          '<mxCell id="g2" style="endArrow=block;endFill=1;html=1;" edge="1" parent="1" source="a" target="b"><mxGeometry as="geometry"/></mxCell>',
          // UNSPECIFIED — mxGraph paints it filled. This is the corpus's case.
          '<mxCell id="g3" style="endArrow=block;html=1;" edge="1" parent="1" source="a" target="b"><mxGeometry as="geometry"/></mxCell>',
          // …and the same, dashed: §10.4.4's realization.
          '<mxCell id="g4" style="endArrow=block;dashed=1;html=1;" edge="1" parent="1" source="a" target="b"><mxGeometry as="geometry"/></mxCell>',
          // The source end, both ways: hollow is the SHARED aggregation,
          // unspecified is the composite one.
          '<mxCell id="d1" style="startArrow=diamond;startFill=0;endArrow=open;html=1;" edge="1" parent="1" source="a" target="b"><mxGeometry as="geometry"/></mxCell>',
          '<mxCell id="d2" style="startArrow=diamond;endArrow=open;html=1;" edge="1" parent="1" source="a" target="b"><mxGeometry as="geometry"/></mxCell>',
        ].join('')
      )
    );

    expect(read.model.relations.map(relation => relation.kind)).toEqual([
      'generalization',
      'generalization',
      'generalization',
      'realization',
      'aggregation',
      'composition',
    ]);
    // Three heads drawn filled, three remarks — and none for the hollow one,
    // which is what makes the remark mean something.
    const remarks = read.notes.filter(note => note.kind === 'warning');
    expect(remarks.map(note => note.sourceId)).toEqual(['g2', 'g3', 'g4']);
    expect(remarks[2].message).toContain('realization');
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

/* ── §17 — draw.io's sequence stencil, best effort (ADR 0019) ─────────── */

/**
 * A sequence drawing in draw.io's own shapes, read as far as a STYLE STRING can
 * be read.
 *
 * Hand-written rather than corpus, and it is the one fixture in this file that
 * is: draw.io ships no sequence template, and its sequence shapes are drawn by
 * hand out of the UML stencil. What the reader has to go on is
 * `shape=umlLifeline`, `shape=umlDestroy`, a `shape=umlFrame` whose label opens
 * with an operator, a narrow box parented to a participant, and the two things
 * §17.4.4 says tell its arrows apart — the dash and the head.
 */
const SEQUENCE = `<mxGraphModel dx="800" dy="600" grid="0">
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    <mxCell id="ll1" value="customer : Customer" style="shape=umlLifeline;perimeter=lifelinePerimeter;container=1;collapsible=0;" vertex="1" parent="1">
      <mxGeometry x="40" y="40" width="100" height="400" as="geometry"/>
    </mxCell>
    <mxCell id="ll2" value="web" style="shape=umlLifeline;perimeter=lifelinePerimeter;container=1;collapsible=0;" vertex="1" parent="1">
      <mxGeometry x="240" y="40" width="100" height="400" as="geometry"/>
    </mxCell>
    <mxCell id="x1" value="" style="html=1;points=[];perimeter=orthogonalPerimeter;" vertex="1" parent="ll2">
      <mxGeometry x="45" y="100" width="10" height="120" as="geometry"/>
    </mxCell>
    <mxCell id="f1" value="alt [signed in]" style="shape=umlFrame;html=1;" vertex="1" parent="1">
      <mxGeometry x="20" y="140" width="340" height="180" as="geometry"/>
    </mxCell>
    <mxCell id="d1" value="" style="shape=umlDestroy;html=1;" vertex="1" parent="1">
      <mxGeometry x="275" y="380" width="30" height="30" as="geometry"/>
    </mxCell>
    <mxCell id="m1" value="browse()" style="html=1;verticalAlign=bottom;endArrow=block;" edge="1" parent="1" source="ll1" target="ll2">
      <mxGeometry relative="1" as="geometry">
        <mxPoint x="90" y="120" as="sourcePoint"/>
        <mxPoint x="290" y="120" as="targetPoint"/>
      </mxGeometry>
    </mxCell>
    <mxCell id="m2" value="ok" style="html=1;endArrow=open;dashed=1;" edge="1" parent="1" source="ll2" target="ll1">
      <mxGeometry relative="1" as="geometry">
        <mxPoint x="290" y="200" as="sourcePoint"/>
        <mxPoint x="90" y="200" as="targetPoint"/>
      </mxGeometry>
    </mxCell>
    <mxCell id="m3" value="ping()" style="html=1;endArrow=open;" edge="1" parent="1" source="ll1" target="ll2">
      <mxGeometry relative="1" as="geometry">
        <mxPoint x="90" y="260" as="sourcePoint"/>
        <mxPoint x="290" y="260" as="targetPoint"/>
      </mxGeometry>
    </mxCell>
  </root>
</mxGraphModel>`;

describe('a sequence drawing', () => {
  const { model } = importDrawio(SEQUENCE, { name: 'Checkout' });
  const [interaction] = model.interactions;

  it('is read as a sequence sheet, not as a class one', () => {
    expect(model.diagram.kind).toBe('sd');
    expect(model.classifiers).toEqual([]);
  });

  it('reads `shape=umlLifeline` as a participant, head grammar and all', () => {
    expect(interaction.lifelines).toEqual([
      expect.objectContaining({
        id: 'll1',
        name: 'customer',
        type: 'Customer',
      }),
      expect.objectContaining({ id: 'll2', name: 'web' }),
    ]);
  });

  it('turns the drawn box into the narrow column our element is', () => {
    // draw.io draws the head and the spine as one 100-wide box; the element is
    // the spine, centred on it, and that is where a message attaches.
    const [, web] = interaction.lifelines;
    expect(web.bounds).toEqual({ x: 282, y: 40, w: 16, h: 400 });
  });

  it('reads a narrow box parented to a participant as §17.2.4 bar', () => {
    expect(interaction.executions).toEqual([
      expect.objectContaining({
        id: 'x1',
        lifelineId: 'll2',
        // Relative to the CELL draw.io drew, not to the column we made of it.
        y0: 140,
        y1: 260,
      }),
    ]);
  });

  it('reads `shape=umlDestroy` as the cross, on the spine it sits on', () => {
    expect(interaction.destructions).toEqual([
      expect.objectContaining({ id: 'd1', lifelineId: 'll2', y: 395 }),
    ]);
  });

  it('reads a frame whose label opens with an operator as a fragment', () => {
    expect(interaction.fragments).toEqual([
      expect.objectContaining({
        id: 'f1',
        operator: 'alt',
        name: 'signed in',
        coveredLifelineIds: ['ll1', 'll2'],
      }),
    ]);
    // …and a frame whose label does NOT is still §12.2.4's folder.
    expect(model.packages).toEqual([]);
  });

  it('tells the arrows apart by the dash and the head (§17.4.4)', () => {
    expect(
      interaction.messages.map(each => [each.kind, each.label, each.y])
    ).toEqual([
      ['message-sync', 'browse()', 120],
      ['message-reply', 'ok', 200],
      ['message-async', 'ping()', 260],
    ]);
  });
});
