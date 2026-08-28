import { Bound } from '@labre/global/gfx';
import { describe, expect, it } from 'vitest';

import {
  exportWardleyOwm,
  exportWardleyOwmWithWarnings,
  OWM_DEFAULT_MAP_HEIGHT,
  OWM_DEFAULT_MAP_WIDTH,
  owmPointOf,
  WARDLEY_OWM_FORMAT_ID,
  type WardleyExportBoard,
} from '../export';
import { importWardleyOwm } from '../import';
import { WARDLEY_ROLE } from '../roles';
import { boardFromProps, PLOT, teaShopBoard } from './owm-board-stub';
import { KITCHEN_SINK_OWM, TEA_SHOP_OWM } from './owm-corpus';

/**
 * The OWM DSL, read (`docs/adr/0012`, D1–D6).
 *
 * Four properties, and they are the four the ADR asks every semantic capability
 * for: the **fixed point** (a file this library wrote comes back as itself), the
 * **empty report** on such a file, the **foreign corpus** (a file it did not
 * write loses nothing in silence), and **convergence** (a foreign file settles
 * after one cycle).
 *
 * Everything here runs on plain objects with no DI, no surface and no store,
 * which is P3 stated as a test.
 */

const NAME = 'Tea Shop';
/** No default: naming nothing is a CASE here, and `undefined` has to reach it. */
const write = (board: WardleyExportBoard, name?: string) =>
  exportWardleyOwm(board, name === undefined ? {} : { name });
const read = (text: string) => importWardleyOwm(text);
/** Read a file, then hand it back to the writer — the whole round trip. */
const reread = (text: string, name?: string) =>
  write(boardFromProps(read(text).elements), name);

/* ── The fixed point ──────────────────────────────────────────────────── */

describe('a file this library wrote comes back as itself', () => {
  it('is byte-identical after export → import → export', () => {
    const once = write(teaShopBoard(), NAME);

    // The property ADR 0012 names: `export(import(export(board)))` is the same
    // string as `export(board)`. It holds only because BOTH halves agree about
    // three things at once — the two-decimal coordinate, the order of the
    // sections and the order inside them, and where a name is written relative
    // to the circle it names. Break any one and this fails.
    expect(reread(once, NAME)).toBe(once);
  });

  it('is still a fixed point on the third pass', () => {
    const once = write(teaShopBoard(), NAME);
    expect(reread(reread(once, NAME), NAME)).toBe(once);
  });

  it('reports nothing at all — no carried line, no quarantine, no remark', () => {
    const report = read(write(teaShopBoard(), NAME)).report;

    expect(report.carried).toBe(0);
    expect(report.quarantined).toBe(0);
    expect(report.notes).toEqual([]);
    // One per component and anchor, one per link, one for the title.
    expect(report.mapped).toBe(5 + 4 + 1);
    // The honest form of "this is a file we wrote": the DSL declares no
    // version, so the reader states the DIALECT it read and marks a file that
    // held nothing this library does not itself write.
    expect(report.sourceVersion).toBe('DSL (Labre)');
  });

  it('writes a document a human would recognise', () => {
    expect(write(teaShopBoard(), NAME)).toBe(
      `title Tea Shop

anchor Business [0.93, 0.62]
component "Cup of Tea" [0.74, 0.62]
component Cup [0.70, 0.80]
component Tea [0.60, 0.83]
component Kettle [0.38, 0.36]

Business->"Cup of Tea"
"Cup of Tea"->Cup
"Cup of Tea"->Tea
"Cup of Tea"->Kettle
`
    );
  });

  it('never inverts a dependency: the source is the consumer', () => {
    // ADR 0010's whole subject. `Business->Cup of Tea` says the business NEEDS
    // a cup of tea, and a writer that flipped it would publish the opposite of
    // what the board states.
    const text = write(teaShopBoard(), NAME);
    expect(text).toContain('Business->"Cup of Tea"');
    expect(text).not.toContain('"Cup of Tea"->Business');

    const { elements } = read(text);
    const link = elements.find(
      props =>
        props.type === 'connector' && props.role === WARDLEY_ROLE.dependency
    );
    expect(link!.source).toEqual({ id: 'Business' });
    expect(link!.target).toEqual({ id: 'Cup of Tea' });
  });
});

/* ── A file we did not write ──────────────────────────────────────────── */

describe('the tea-shop corpus, which came out of a real session', () => {
  const result = read(TEA_SHOP_OWM);
  const nodes = result.elements.filter(props => props.type === 'wardleyNode');
  const links = result.elements.filter(props => props.type === 'connector');

  it('draws every artefact the file declares', () => {
    // 26 components and one anchor, every one of them on the canvas.
    expect(nodes.filter(props => props.kind === 'component')).toHaveLength(26);
    expect(nodes.filter(props => props.kind === 'anchor')).toHaveLength(1);
    // …and the map they are laid out on, first in the array.
    expect(result.elements[0].type).toBe('wardley');
    expect(result.elements[0].role).toBe(WARDLEY_ROLE.map);
  });

  it('draws every link, and no more', () => {
    expect(links).toHaveLength(30);
    expect(links.every(props => props.role === WARDLEY_ROLE.dependency)).toBe(
      true
    );
  });

  it('loses nothing: 58 statements mapped, none carried, none quarantined', () => {
    // The title, 27 artefacts and 30 links. Blank lines are structure, not
    // statements — the loss table says so, and it is why an untouched file
    // reports no carried line rather than one per paragraph break.
    expect(result.report).toMatchObject({
      mapped: 58,
      carried: 0,
      quarantined: 0,
    });
  });

  it('keeps a quoted name exactly, accents, commas, slashes and all', () => {
    const named = nodes.map(
      props =>
        (props.interchange as Record<string, { id?: string }>)[
          WARDLEY_OWM_FORMAT_ID
        ].id
    );
    expect(named).toContain('Vente retail thés, accessoires, coffrets');
    expect(named).toContain('Preparation barista / tea master');
    expect(named).toContain('Traçabilite, certifications, allergenes');

    // …and the label beside the circle reads the same, because on this canvas
    // the name IS a separate text element.
    const labels = result.elements
      .filter(props => props.role === WARDLEY_ROLE.label)
      .map(props => props.text);
    expect(labels).toContain('Vente retail thés, accessoires, coffrets');
  });

  it('says out loud that it invented the anchor’s position (D4)', () => {
    // `anchor Client`, with no coordinate pair — half the maps in the wild are
    // written this way. The reader lays it out and NAMES the fact: an invented
    // axis is never presented as read from the file.
    const invented = result.report.notes.filter(
      note => note.kind === 'invented-layout'
    );
    expect(invented).toHaveLength(1);
    expect(invented[0]).toMatchObject({
      sourceId: 'Client',
      element: 'anchor',
    });
    expect(invented[0].message).toContain('no coordinates');
  });

  it('reads the file’s own title rather than the caller’s', () => {
    const named = importWardleyOwm(TEA_SHOP_OWM, { name: 'something else' });
    const map = named.elements[0];
    expect(
      (
        map.interchange as Record<
          string,
          { attrs?: Record<string, Record<string, string>> }
        >
      )[WARDLEY_OWM_FORMAT_ID].attrs!['@document'].title
    ).toBe('Tea Shop moderne 2026 - chaine de valeur');
  });

  it('falls back to the caller’s name only when the file names nothing', () => {
    const untitled = TEA_SHOP_OWM.split('\n').slice(1).join('\n');
    const named = importWardleyOwm(untitled, { name: 'tea-shop.owm' });
    expect(write(boardFromProps(named.elements))).toContain('title tea-shop\n');
  });

  it('converges: the second reading of it is the last one', () => {
    // The first cycle settles what the file left unsaid — the anchor's
    // position, and the quoting of every name. From there it is a fixed point,
    // which is the strongest claim a reader can make about a file it did not
    // write.
    const once = reread(TEA_SHOP_OWM);
    expect(reread(once)).toBe(once);
  });
});

/* ── The carried column ───────────────────────────────────────────────── */

describe('what the pack does not draw is kept, not dropped', () => {
  const result = read(KITCHEN_SINK_OWM);
  const map = result.elements[0];
  const carried = (
    map.interchange as Record<string, { children?: Record<string, string[]> }>
  )[WARDLEY_OWM_FORMAT_ID].children!['@document'];

  it('files the document’s residue on the map, which is D6’s asymmetry', () => {
    // Nothing else on the canvas is what these lines are ABOUT, so they ride on
    // the framework's background element — where `profileId` already lives, and
    // with the stated consequence: delete the map and they go with it.
    expect(map.type).toBe('wardley');
    expect(carried).toContain('style wardley');
    expect(carried).toContain('size [1000, 800]');
    expect(carried).toContain('evolution Genesis->Custom->Product->Commodity');
    expect(carried).toContain('// a comment, which is also carried');
    expect(carried).toContain('accelerator Faster [0.30, 0.50]');
    expect(carried).toContain('Kettle+>Suppliers');
    expect(carried).toContain('User->Partners; because they asked');
    expect(carried).toContain('pipeline Kettle');
  });

  it('never reads a keyword line as a link, whatever arrows it holds', () => {
    // `evolution Genesis->Custom->…` renames the evolution axis. Read naively
    // it is three dependencies between components nobody declared — which is
    // exactly why OWM's own reader carries a refusal list, and why this one
    // does too.
    const links = result.elements.filter(props => props.type === 'connector');
    expect(
      links.filter(props => props.role === WARDLEY_ROLE.dependency)
    ).toHaveLength(1);
  });

  it('says WHICH constructs it carried, one note per kind and not per line', () => {
    const kinds = result.report.notes
      .filter(note => note.kind === 'carried')
      .map(note => note.element);
    expect(kinds).toEqual(
      expect.arrayContaining([
        'comment',
        'style',
        'size',
        'evolution',
        'annotation',
        'submap',
        'url',
        'accelerator',
        'flow link',
        'link with a context',
        'pipeline{}',
      ])
    );
    // One note each, never one per line: `annotation` and `annotations` are two
    // constructs and two notes, and neither is repeated.
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it('quarantines nothing, and that is a finding about the format', () => {
    // D5's quarantine exists where re-emitting a carried fragment would produce
    // a document that contradicts the drawing. Every statement this DSL writes
    // is a standalone sentence, so there is no such case — which is why the
    // count is zero rather than merely unimplemented.
    expect(result.report.quarantined).toBe(0);
  });

  it('gives every carried line back, in order, on the next export', () => {
    const written = write(
      boardFromProps(result.elements),
      'Everything at once'
    );
    for (const line of carried) expect(written).toContain(line);
  });

  it('keeps a MAPPED line’s own tail on the line it came off', () => {
    // `label [12, -8] (build) inertia` are modifiers this pack does not draw.
    // They ride on the component itself, not at the bottom of the file, so they
    // come back on the very line they were written on — which is what makes
    // this row of the loss table `carried` rather than `lost`.
    const written = write(
      boardFromProps(result.elements),
      'Everything at once'
    );
    expect(written).toContain(
      'component Kettle [0.60, 0.40] label [12, -8] (build) inertia'
    );
  });

  it('converges after one cycle', () => {
    const once = reread(KITCHEN_SINK_OWM, 'Everything at once');
    expect(reread(once, 'Everything at once')).toBe(once);
  });
});

/* ── The vocabulary, artefact by artefact ─────────────────────────────── */

describe('every drawn construct', () => {
  it('draws a market as the composite this canvas draws one as', () => {
    const { elements } = read('market Suppliers [0.30, 0.70]\n');
    const nodes = elements.filter(props => props.type === 'wardleyNode');
    // The outer circle, plus the three inner dots the glyph is made of. The
    // dots carry NO role — they are the glyph's own wiring, so no rule measures
    // them and the writer ignores them — and the three connectors that wire
    // them into a triangle carry none either.
    expect(
      nodes.filter(props => props.role === WARDLEY_ROLE.market)
    ).toHaveLength(1);
    expect(nodes.filter(props => props.role === undefined)).toHaveLength(3);
    expect(elements.filter(props => props.type === 'connector')).toHaveLength(
      3
    );

    // …and it leaves as one line again, not as four components.
    expect(write(boardFromProps(elements))).toBe(
      'market Suppliers [0.30, 0.70]\n'
    );
  });

  it('draws a pipeline as a body plus its handle, and writes the span back', () => {
    const { elements } = read(
      'component Kettle [0.60, 0.40]\npipeline Kettle [0.30, 0.70]\n'
    );
    const kinds = elements
      .filter(props => props.type === 'wardleyNode')
      .map(props => props.kind);
    expect(kinds).toEqual(['component', 'pipeline', 'handle']);

    const written = write(boardFromProps(elements));
    // The span comes back off the BODY's two edges — OWM derives a pipeline's
    // height from the component of the same name, so the reader puts the body
    // under that component and the writer does not write a height at all.
    expect(written).toContain('pipeline Kettle [0.30, 0.70]');
  });

  it('draws an `evolve` as a twin and the arrow that says it is moving', () => {
    const { elements } = read(
      'component Kettle [0.60, 0.40]\nevolve Kettle 0.75\n'
    );
    const arrow = elements.find(
      props => props.role === WARDLEY_ROLE.changeArrow
    );
    expect(arrow).toBeDefined();
    // The arrow runs from where the component stands today to where it is
    // heading, which is the verb `wardley:change-arrow` declares.
    expect(arrow!.source).toEqual({ id: 'Kettle' });

    // Two circles: the component, and the red twin at the new maturity.
    const circles = elements.filter(props => props.type === 'wardleyNode');
    expect(circles).toHaveLength(2);

    expect(write(boardFromProps(elements))).toBe(
      `component Kettle [0.60, 0.40]

evolve Kettle 0.75
`
    );
  });

  it('keeps an `evolve`’s renamed twin, and quotes BOTH names to do it', () => {
    const { elements } = read(
      'component Kettle [0.60, 0.40]\nevolve Kettle -> Electric kettle 0.75\n'
    );
    // `evolve Kettle -> "Electric kettle" 0.75` would be the obvious spelling
    // and it is the WRONG one: `setNameWithMaturity` only ever unquotes an
    // override in the branch it enters when the SOURCE name is quoted. Written
    // the obvious way, onlinewardleymaps draws a component called
    // `"Electric kettle"`, quote characters and all.
    expect(write(boardFromProps(elements))).toContain(
      'evolve "Kettle" -> "Electric kettle" 0.75'
    );
  });

  it('reads its own renamed `evolve` back, so the rename is a fixed point', () => {
    const once = write(
      boardFromProps(
        read(
          'component Kettle [0.60, 0.40]\nevolve Kettle -> Electric kettle 0.75\n'
        ).elements
      )
    );
    expect(reread(once)).toBe(once);
  });

  it('leaves both names bare when neither needs quoting', () => {
    // The pair is quoted TOGETHER or not at all; two bare names stay bare.
    const { elements } = read(
      'component Kettle [0.60, 0.40]\nevolve Kettle -> Thermos 0.75\n'
    );
    expect(write(boardFromProps(elements))).toContain(
      'evolve Kettle -> Thermos 0.75'
    );
  });

  it('draws a note as the free text it is', () => {
    const { elements } = read('note Watch this one [0.50, 0.30]\n');
    const note = elements.find(props => props.type === 'text');
    expect(note!.text).toBe('Watch this one');
    // No role: an OWM note is a remark somebody wrote on the map, not the NAME
    // of anything, and W3 must not measure it against a circle.
    expect(note!.role).toBeUndefined();
    expect(write(boardFromProps(elements))).toBe(
      'note "Watch this one" [0.50, 0.30]\n'
    );
  });
});

/* ── A statement that refers to one nobody made ───────────────────────── */

describe('a link that names nothing', () => {
  it('says so, per end, instead of drawing an invisible arrow in silence', () => {
    // M1, and it is D1's hole: a link is the only statement whose meaning
    // depends on OTHER statements. `materializeInterchangeImport` leaves an
    // unresolvable end exactly as the file wrote it, so the connector routes to
    // an empty path and is invisible — and before this the report said
    // `mapped: 2, notes: []`, which claims a whole arrow was drawn.
    const result = read('component Kettle [0.60, 0.40]\nKettle->Power\n');

    expect(result.report.mapped).toBe(2);
    const dangling = result.report.notes.filter(
      note => note.kind === 'warning' && note.element === 'link'
    );
    expect(dangling).toHaveLength(1);
    expect(dangling[0].sourceId).toBe('Power');
    expect(dangling[0].message).toContain('invisible on the canvas');
  });

  it('names BOTH ends when both dangle', () => {
    // One note per END, not per link: an architect fixing the file needs both
    // names, and a link with two typos has two problems.
    const result = read('Alpha->Beta\n');
    expect(
      result.report.notes
        .filter(note => note.element === 'link')
        .map(note => note.sourceId)
    ).toEqual(['Alpha', 'Beta']);
  });

  it('says so when an end names nothing at all', () => {
    const result = read('component Kettle [0.60, 0.40]\nKettle->\n');
    const dangling = result.report.notes.filter(
      note => note.element === 'link'
    );
    expect(dangling).toHaveLength(1);
    expect(dangling[0].message).toContain('names nothing on one of its ends');
  });

  it('stays silent when every end names something declared', () => {
    // The other half, and the one that keeps the note from becoming noise: a
    // whole map must not report a single dangling end.
    expect(
      read(TEA_SHOP_OWM).report.notes.filter(note => note.element === 'link')
    ).toEqual([]);
  });
});

/* ── A comment is a comment all the way to its close ──────────────────── */

describe('a `/* … *\/` block', () => {
  const BLOCKED = `component Kettle [0.60, 0.40]
/*
component Ghost [0.10, 0.90]
Kettle->Ghost
*/
component Power [0.20, 0.80]
`;

  it('draws nothing the author commented out', () => {
    // M2. The reference reader strips these in `Converter.stripComments` BEFORE
    // any strategy sees the text. Carrying only the opening line and parsing
    // the body put a component on the canvas that the file's author had
    // switched off — a drawing nobody made, which is worse than losing one.
    const result = read(BLOCKED);
    const names = result.elements
      .filter(props => props.type === 'wardleyNode')
      .map(
        props =>
          (props.interchange as Record<string, { id?: string }>)[
            WARDLEY_OWM_FORMAT_ID
          ].id
      );
    expect(names).toEqual(['Kettle', 'Power']);
    expect(result.elements.filter(props => props.type === 'connector')).toEqual(
      []
    );
  });

  it('carries every line of it, closing delimiter included', () => {
    const result = read(BLOCKED);
    const carried = (
      result.elements[0].interchange as Record<
        string,
        { children?: Record<string, string[]> }
      >
    )[WARDLEY_OWM_FORMAT_ID].children!['@document'];
    expect(carried).toEqual([
      '/*',
      'component Ghost [0.10, 0.90]',
      'Kettle->Ghost',
      '*/',
    ]);
    expect(result.report.carried).toBe(4);
  });

  it('closes a one-line block on its own line', () => {
    const result = read('/* aside */\ncomponent Kettle [0.60, 0.40]\n');
    expect(result.report.carried).toBe(1);
    expect(
      result.elements.filter(props => props.type === 'wardleyNode')
    ).toHaveLength(1);
  });
});

/* ── Carried lines are lines, not a set ───────────────────────────────── */

describe('two carried lines that happen to read the same', () => {
  it('both come back', () => {
    // M3. The reader counted two and the writer wrote one, so a carried line
    // was lost against a report that said it was kept. D1's promise has no
    // "unless it looked like another one" clause.
    const source = 'component Kettle [0.60, 0.40]\n// same\n// same\n';
    const result = read(source);
    expect(result.report.carried).toBe(2);

    const written = write(boardFromProps(result.elements));
    expect(written.split('\n').filter(line => line === '// same')).toHaveLength(
      2
    );
  });

  it('and the file is still a fixed point with them in it', () => {
    const once = write(
      boardFromProps(
        read('component Kettle [0.60, 0.40]\n// same\n// same\n').elements
      )
    );
    expect(reread(once)).toBe(once);
  });
});

/* ── A maturity always has a decimal point ────────────────────────────── */

describe('a component whose name ends in a digit', () => {
  it('keeps its name, and its evolution, through an `evolve`', () => {
    // M4. `[01]` looked like a harmless extra spelling for a maturity and was
    // not: `evolve Tier 1 0.75` took `1` as the maturity and `Tier` as the
    // name, so the line was about a component nobody declared — and the twin
    // and its arrow then vanished on the next export. The reference regex is
    // `/\s[0-9]?\.[0-9]+[0-9]?/`: a maturity always has a point.
    const { elements, report } = read(
      'component Tier 1 [0.60, 0.40]\nevolve Tier 1 0.75\n'
    );
    const names = elements
      .filter(props => props.type === 'wardleyNode')
      .map(
        props =>
          (props.interchange as Record<string, { id?: string }>)[
            WARDLEY_OWM_FORMAT_ID
          ].id
      );
    expect(names[0]).toBe('Tier 1');
    // The twin exists, and its arrow points at the component that was declared.
    expect(names).toHaveLength(2);
    expect(report.notes).toEqual([]);

    const written = write(boardFromProps(elements));
    expect(written).toContain('component "Tier 1" [0.60, 0.40]');
    expect(written).toContain('evolve "Tier 1" 0.75');
  });
});

/* ── What the reference reader accepts, this one accepts ──────────────── */

describe('the coordinate spellings OWM tolerates', () => {
  it('maps a bracket written with no space before it', () => {
    // `extractLocation` splits on a bare `[`, so the file IS positioned — only
    // `setName` mangles the name. Mapped at the coordinates it gave.
    const result = read('component Kettle[0.60, 0.40]\n');
    expect(result.report.mapped).toBe(1);
    expect(result.report.notes).toEqual([]);
    expect(write(boardFromProps(result.elements))).toBe(
      'component Kettle [0.60, 0.40]\n'
    );
  });

  it('maps a pair with one number, defaulting the other as OWM does', () => {
    // `[0.5]` → visibility 0.5, maturity 0.1 (`extractLocation`'s default).
    const result = read('component Kettle [0.60]\n');
    expect(result.report.mapped).toBe(1);
    expect(write(boardFromProps(result.elements))).toBe(
      'component Kettle [0.60, 0.10]\n'
    );
    // Mapped, and still declared: half a pair is half an invented axis, and D4
    // does not care which half.
    expect(result.report.notes.map(note => note.kind)).toEqual([
      'invented-layout',
    ]);
    expect(result.report.notes[0].message).toContain('value chain only');
  });

  it('maps the readable axis of a half-unreadable pair', () => {
    const result = read('component Kettle [nonsense, 0.40]\n');
    expect(write(boardFromProps(result.elements))).toBe(
      'component Kettle [0.90, 0.40]\n'
    );
    expect(result.report.notes[0].message).toContain('evolution axis only');
  });

  it('places a coordinate-less statement where OWM places one', () => {
    // m1: the reference default is `{visibility: 0.9, maturity: 0.1}`, so an
    // artefact this reader places without coordinates lands where the tool that
    // wrote the file would have drawn it — not on a layout of our own.
    const result = read('anchor Client\n');
    expect(write(boardFromProps(result.elements))).toBe(
      'anchor Client [0.90, 0.10]\n'
    );
  });
});

/* ── The two axes, absolutely ─────────────────────────────────────────── */

describe('the axes point the way Wardley draws them', () => {
  it('puts visibility 1.0 at the TOP of the plot and 0.0 at the bottom', () => {
    // G1. Every other assertion in this suite is a ROUND TRIP, and a round trip
    // is exactly the shape of test that survives a sign error: invert the y
    // axis in both directions and all of them still pass while every imported
    // map is drawn upside down. This one is absolute.
    const high = owmPointOf(PLOT, 1, 0)[1];
    const low = owmPointOf(PLOT, 0, 0)[1];
    expect(high).toBeLessThan(low);

    // …and evolution 1.0 is to the RIGHT of 0.0, which has no inversion but is
    // the same class of mistake.
    expect(owmPointOf(PLOT, 0, 1)[0]).toBeGreaterThan(
      owmPointOf(PLOT, 0, 0)[0]
    );
  });

  it('draws a high-visibility component in the upper half of the map', () => {
    // The same claim, made against a real import rather than the projection:
    // `[0.95, 0.05]` is near the top of the value chain and barely evolved, so
    // it belongs in the upper-left of a 1600 × 900 map at the origin.
    const { elements } = read('component Need [0.95, 0.05]\n');
    const circle = elements.find(props => props.type === 'wardleyNode');
    const [x, y] = Bound.deserialize(String(circle!.xywh)).toXYWH();
    expect(y).toBeLessThan(OWM_DEFAULT_MAP_HEIGHT / 2);
    expect(x).toBeLessThan(OWM_DEFAULT_MAP_WIDTH / 2);
  });
});

/* ── Degenerate files ─────────────────────────────────────────────────── */

describe('a file that is barely one', () => {
  it('reads an empty file as an empty map, and says nothing happened', () => {
    const result = read('');
    // The map, and nothing else. An empty `.owm` is a valid empty map, not an
    // unreadable file — there is nothing here for a reader to refuse.
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0].type).toBe('wardley');
    // …and the map carries no `interchange` key at all, because it carries
    // nothing: absent and empty are not the same thing (D2).
    expect(result.elements[0].interchange).toBeUndefined();
    expect(result.report).toMatchObject({
      mapped: 0,
      carried: 0,
      quarantined: 0,
    });
  });

  it('reads whitespace and comments as an empty map that kept its comments', () => {
    const result = read('\n\n   \n// nothing to see\n\n');
    expect(result.report).toMatchObject({ mapped: 0, carried: 1 });
  });

  it('carries prose it has no sentence for rather than dropping it', () => {
    const result = read('this is not a wardley map at all\n');
    expect(result.report.carried).toBe(1);
    expect(result.report.notes).toHaveLength(1);
    expect(result.report.notes[0].kind).toBe('carried');
  });

  it('warns about unreadable coordinates, and lays the artefact out anyway', () => {
    const result = read('component Broken [nope, nope]\n');
    const kinds = result.report.notes.map(note => note.kind);
    // BOTH: a warning, because the file said something this reader could not
    // read, AND an invented-layout note, because what it drew instead is a
    // position nobody wrote down. Either alone would be a half-truth.
    expect(kinds).toEqual(['warning', 'invented-layout']);
    expect(
      result.elements.filter(props => props.type === 'wardleyNode')
    ).toHaveLength(1);
  });

  it('places an out-of-range coordinate where the file put it, and warns on the way out', () => {
    // Not clamped: clamping would make the file the reader gives back disagree
    // with the one it was given, and the position IS what the file said. The
    // WRITER is where the user hears about it.
    const { elements } = read('component Far [1.80, -0.40]\n');
    const { text, warnings } = exportWardleyOwmWithWarnings(
      boardFromProps(elements)
    );
    expect(text).toContain('component Far [1.80, -0.40]');
    expect(warnings.join('\n')).toContain('outside the map');
  });

  it('imports a name declared twice, and says which one the links mean', () => {
    const result = read(
      'component Twin [0.60, 0.40]\ncomponent Twin [0.30, 0.20]\ncomponent User [0.9, 0.1]\nUser->Twin\n'
    );
    expect(
      result.elements.filter(props => props.type === 'wardleyNode')
    ).toHaveLength(3);
    const warning = result.report.notes.find(note => note.kind === 'warning');
    expect(warning).toMatchObject({ sourceId: 'Twin' });
    expect(warning!.message).toContain('means the first');
  });

  it('resolves a reference to a duplicated name at the FIRST declaration', () => {
    // G2. "First wins" is asserted for the materializer's link map; this is the
    // other half of it, and it is a different code path — a pipeline and an
    // `evolve` look their component's HEIGHT up by name, and a map that
    // silently used the last declaration would draw them somewhere nobody put
    // anything.
    const { elements } = read(
      'component Twin [0.80, 0.40]\ncomponent Twin [0.20, 0.40]\nevolve Twin 0.75\n'
    );
    const circles = elements.filter(props => props.type === 'wardleyNode');
    // Three: the two declarations, then the evolved twin.
    expect(circles).toHaveLength(3);
    const yOf = (props: (typeof circles)[number]) =>
      Bound.deserialize(String(props.xywh)).toXYWH()[1];
    // The evolved twin sits at the FIRST declaration's height (0.80), which is
    // above the second (0.20) rather than beside it.
    expect(yOf(circles[2])).toBeCloseTo(yOf(circles[0]), 6);
    expect(yOf(circles[2])).not.toBeCloseTo(yOf(circles[1]), 6);
  });

  it('never gives a minted handle back as if it were a name', () => {
    // G3. The reader mints `evolve Kettle` as the arrow's target handle,
    // because OWM has no id for a twin and D3 forbids inventing one that
    // pretends otherwise. `element: 'evolve'` is what marks it as a handle, and
    // this is the assertion that the writer honours the marker: delete the
    // twin's label and its name has to fall back to something, and that
    // something must not be the handle.
    const { elements } = read(
      'component Kettle [0.60, 0.40]\nevolve Kettle 0.75\n'
    );
    const board = boardFromProps(elements);
    // The twin's label is the LAST one the reader wrote; drop it.
    board.labels.pop();

    const written = write(board);
    expect(written).not.toContain('evolve Kettle');
    expect(written).not.toContain('"evolve Kettle"');
    // It comes out christened instead, which is the honest fallback — and the
    // export says so.
    expect(written).toContain('"Component 1"');
  });
});
