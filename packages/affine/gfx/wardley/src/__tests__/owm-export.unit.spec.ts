import { describe, expect, it } from 'vitest';

import {
  exportWardleyOwmWithWarnings,
  owmName,
  owmNumber,
  wardleyBoardFrom,
  wardleySafeFilename,
} from '../export';
import { LABEL_GAP, MARKET_SIZE, NODE_SIZE } from '../node/consts';
import { WARDLEY_ROLE } from '../roles';
import {
  board,
  drawNode,
  fakeConnector,
  fakeMap,
  fakeNode,
  fakeText,
  flatten,
  PLOT,
  teaShopBoard,
} from './owm-board-stub';
import { owmPointOf } from '../export';

/**
 * The OWM DSL, written — the pure serializer P3 asks for, and the one that
 * replaces labre-mcp's own (`docs/adr/0012`, and its recorded violation of P3).
 *
 * What the reader's spec pins is the ROUND TRIP. What is pinned here is
 * everything the writer decides on its own: which map it measures against,
 * which text is a name and which is a remark, and the losses the person who
 * clicked Export is entitled to hear about.
 */

const write = (parts: Parameters<typeof flatten>[0], name?: string) =>
  exportWardleyOwmWithWarnings(
    wardleyBoardFrom(flatten(parts) as never),
    name === undefined ? {} : { name }
  );

/* ── The spelling of the format ───────────────────────────────────────── */

describe('the two numbers and the one name', () => {
  it('writes a coordinate to exactly two decimals, always', () => {
    // Stability, not tidiness: the fixed point holds because a value that
    // survives one rounding survives every one after it.
    expect(owmNumber(0.9)).toBe('0.90');
    expect(owmNumber(0.86123)).toBe('0.86');
    expect(owmNumber(1)).toBe('1.00');
  });

  it('never writes `-0.00`', () => {
    // A node dropped one pixel above the plot's top edge lands on `-0` after
    // the projection, and a file whose bytes depend on which side of zero a
    // float came down would not be a fixed point.
    expect(owmNumber(-0)).toBe('0.00');
    expect(owmNumber(-0.001)).toBe('0.00');
    // …and a shape with no geometry at all is written as a number, not `NaN`.
    expect(owmNumber(Number.NaN)).toBe('0.00');
  });

  it('leaves a plain name bare and quotes everything else', () => {
    expect(owmName('Kettle')).toBe('Kettle');
    expect(owmName('Power-2.0')).toBe('Power-2.0');
    expect(owmName('Cup of Tea')).toBe('"Cup of Tea"');
    expect(owmName('Vente retail thés, accessoires')).toBe(
      '"Vente retail thés, accessoires"'
    );
    // Brackets, quotes and backslashes are escaped exactly as OWM's own
    // `escapeComponentNameForMapText` escapes them, which is what makes the
    // reader's `unescape` its inverse.
    expect(owmName('a "b" [c]')).toBe(String.raw`"a \"b\" \[c\]"`);
  });

  it('quotes a name that IS a keyword, or it would stop being linkable', () => {
    // `style->X` is not a link to OWM's reader: it refuses a line opening on
    // any keyword. Quoting is what keeps a component somebody called `style`
    // reachable.
    expect(owmName('style')).toBe('"style"');
    expect(owmName('component')).toBe('"component"');
  });

  it('makes a board’s title safe to write to disk', () => {
    expect(wardleySafeFilename('Order/to:cash. ')).toBe('Order-to-cash');
    expect(wardleySafeFilename(undefined)).toBe('map');
    expect(wardleySafeFilename('   ')).toBe('map');
  });
});

/* ── Which elements the writer speaks about ───────────────────────────── */

describe('picking the map out of a surface', () => {
  it('ignores everything that is not a Wardley artefact', () => {
    const parts = teaShopBoard();
    const clean = write(parts, 'Tea Shop');
    const noisy = exportWardleyOwmWithWarnings(
      wardleyBoardFrom([
        ...(flatten(parts) as never[]),
        { id: 'brush-1', type: 'brush' },
        { id: 'shape-1', type: 'shape' },
      ] as never),
      { name: 'Tea Shop' }
    );
    expect(noisy.text).toBe(clean.text);
  });

  it('says so when there is no map to measure against', () => {
    // A Wardley node has no `visibility` prop — its position on the plot IS
    // its coordinate — so with no plot there is nothing to invert. The writer
    // uses the reference map at the origin and names the assumption.
    const { warnings } = write(
      board({ nodes: [fakeNode('n', 'component', [100, 100, 18, 18])] })
    );
    expect(warnings.join('\n')).toContain('No Wardley map background');
  });

  it('warns that an OWM file holds one map, and writes the first', () => {
    const parts = teaShopBoard();
    parts.maps.push(fakeMap([2000, 0, 1600, 900]));
    expect(write(parts, 'Tea Shop').warnings.join('\n')).toContain(
      'holds 2 Wardley maps'
    );
  });
});

/* ── Which text is a name ─────────────────────────────────────────────── */

describe('matching a name to the artefact it names', () => {
  it('gives a label to its own node and not to the one that sits nearest', () => {
    // THE regression this heuristic exists for. Two components 61 units apart
    // on evolution and 17 on the value chain — nothing at all on a 1530-wide
    // plot, and exactly what the tea-shop corpus holds — put the lower one's
    // CENTRE inside the upper one's label box. A nearest-box rule hands the
    // upper one's name to the lower one by a distance of half a unit.
    const upper = drawNode('n-upper', 'component', 'Packaging', 0.43, 0.64);
    const lower = drawNode('n-lower', 'component', 'Stock', 0.41, 0.68);
    const { text } = write(
      board({
        maps: [fakeMap()],
        nodes: [upper.node, lower.node],
        labels: [upper.label, lower.label],
      })
    );
    expect(text).toContain('component Packaging [0.43, 0.64]');
    expect(text).toContain('component Stock [0.41, 0.68]');
  });

  it('reads a name written to the LEFT of its circle', () => {
    // `templates/maps.ts` writes some names left, some centred above, and the
    // toolbox writes them right. All three are the node's own half-size plus
    // the label gap, so the prediction is computed rather than tabulated.
    const [cx, cy] = owmPointOf(PLOT, 0.5, 0.5);
    const { text } = write(
      board({
        maps: [fakeMap()],
        nodes: [fakeNode('n', 'component', [cx - 9, cy - 9, 18, 18])],
        labels: [
          fakeText(
            'l',
            'Kettle',
            [cx - 9 - LABEL_GAP - 200, cy - 13, 200, 26],
            {
              role: WARDLEY_ROLE.label,
            }
          ),
        ],
      })
    );
    expect(text).toContain('component Kettle [0.50, 0.50]');
  });

  it('sizes the prediction off the node, so a market keeps its name', () => {
    const market = drawNode(
      'n-market',
      'market',
      'Suppliers',
      0.3,
      0.7,
      MARKET_SIZE
    );
    const { text } = write(
      board({
        maps: [fakeMap()],
        nodes: [market.node],
        labels: [market.label],
      })
    );
    expect(text).toContain('market Suppliers [0.30, 0.70]');
  });

  it('never lets a pipeline handle steal the body’s name', () => {
    // The handle sits on the body's top edge, directly under the name the body
    // owns, and is the closest node to it by a wide margin.
    const [left, y] = owmPointOf(PLOT, 0.5, 0.3);
    const [right] = owmPointOf(PLOT, 0.5, 0.7);
    const top = y + NODE_SIZE;
    const centre = (left + right) / 2;
    const { text } = write(
      board({
        maps: [fakeMap()],
        nodes: [
          fakeNode('body', 'pipeline', [left, top, right - left, 25]),
          fakeNode('handle', 'handle', [centre - 9, top - 9, 18, 18]),
        ],
        labels: [
          fakeText(
            'l',
            'Kettle',
            [centre - 100, top - LABEL_GAP - 26, 200, 26],
            {
              role: WARDLEY_ROLE.label,
            }
          ),
        ],
      })
    );
    expect(text).toContain('pipeline Kettle [0.30, 0.70]');
  });

  it('christens an artefact with no name, once, and says how many', () => {
    // MEMOIZED: a node is asked for its name on its own line and again on every
    // link that ends on it, and an unnamed one christened twice would leave
    // under two names with the links disagreeing with the components.
    const { text, warnings } = write(
      board({
        maps: [fakeMap()],
        nodes: [
          fakeNode('a', 'component', [500, 400, 18, 18]),
          fakeNode('b', 'component', [700, 400, 18, 18]),
        ],
        connectors: [
          fakeConnector('c', WARDLEY_ROLE.dependency, {
            source: 'a',
            target: 'b',
          }),
        ],
      })
    );
    expect(text).toContain('component "Component 1"');
    expect(text).toContain('component "Component 2"');
    expect(text).toContain('"Component 1"->"Component 2"');
    expect(warnings.join('\n')).toContain('2 artefacts have no name');
  });

  it('warns when two artefacts answer to one name', () => {
    const first = drawNode('a', 'component', 'Twin', 0.6, 0.4);
    const second = drawNode('b', 'component', 'Twin', 0.3, 0.2);
    const { warnings } = write(
      board({
        maps: [fakeMap()],
        nodes: [first.node, second.node],
        labels: [first.label, second.label],
      })
    );
    expect(warnings.join('\n')).toContain('more than one artefact');
  });
});

/* ── What the format could not say ────────────────────────────────────── */

describe('the losses reach the person who clicked Export', () => {
  it('says nothing when the map came out whole', () => {
    // The pure writer always returns the array; it is the interchange ADAPTER
    // that omits the field entirely so a caller can ask `if (result.warnings)`
    // and mean it, and that omission is pinned next door in
    // `owm-interchange.unit.spec.ts`.
    expect(write(teaShopBoard(), 'Tea Shop').warnings).toEqual([]);
  });

  it('warns that a method is a decorator it cannot tell apart', () => {
    const method = drawNode('m', 'method', 'Kettle', 0.6, 0.4, 35);
    const { text, warnings } = write(
      board({ maps: [fakeMap()], nodes: [method.node], labels: [method.label] })
    );
    // Written as a component rather than dropped: OWM says a method with a
    // `(build)` / `(buy)` / `(outsource)` decorator, and which of the three
    // this node means is not on the canvas.
    expect(text).toContain('component Kettle [0.60, 0.40]');
    expect(warnings.join('\n')).toContain('carries a method');
  });

  it('warns about a link with an end it cannot name', () => {
    const kettle = drawNode('k', 'component', 'Kettle', 0.6, 0.4);
    const { text, warnings } = write(
      board({
        maps: [fakeMap()],
        nodes: [kettle.node],
        labels: [kettle.label],
        connectors: [
          fakeConnector('loose', WARDLEY_ROLE.dependency, { source: 'k' }),
          fakeConnector('foreign', WARDLEY_ROLE.dependency, {
            source: 'k',
            target: 'sticky-note-1',
          }),
        ],
      })
    );
    expect(text).not.toContain('->');
    expect(warnings.join('\n')).toContain('2 links have ends');
  });

  it('says nothing about a connector with no role, which lost nothing', () => {
    // A connector with no role states nothing (`docs/adr/0010`). It is absent
    // from the file because it is not a dependency — not because the format
    // refused it — and warning about it would teach the wrong lesson. The three
    // connectors inside a market composite are exactly this case.
    const parts = teaShopBoard();
    parts.connectors.push(
      fakeConnector('plain', undefined, {
        source: 'n-cup',
        target: 'n-tea',
      })
    );
    expect(write(parts, 'Tea Shop').warnings).toEqual([]);
  });

  it('warns when an evolution arrow also climbs the value chain', () => {
    // `evolve` moves a component along the evolution axis and says nothing
    // about the value chain, so a twin drawn higher up is a sentence the format
    // has no way to write down.
    const kettle = drawNode('k', 'component', 'Kettle', 0.6, 0.4);
    const twin = drawNode('t', 'component', 'Kettle', 0.8, 0.75);
    const { text, warnings } = write(
      board({
        maps: [fakeMap()],
        nodes: [kettle.node, twin.node],
        labels: [kettle.label, twin.label],
        connectors: [
          fakeConnector('a', WARDLEY_ROLE.changeArrow, {
            source: 'k',
            target: 't',
          }),
        ],
      })
    );
    expect(text).toContain('evolve Kettle 0.75');
    expect(warnings.join('\n')).toContain('different height');
  });

  it('keeps the file’s title over the board’s name, and says it did', () => {
    // D3's precedence: the file's title wins and the caller's name is the
    // fallback — the same rule `interchange.<fmt>.id` has on every element.
    // A browser recette caught this the other way round: an imported tea shop
    // left as "BlockSuite Playground", the host document's name.
    const parts = teaShopBoard();
    parts.maps[0] = fakeMap(undefined, {
      owm: { attrs: { '@document': { title: 'The old name' } } },
    });

    const { text, warnings } = write(parts, 'Tea Shop');
    expect(text).toContain('title The old name');
    expect(text).not.toContain('title Tea Shop');
    expect(warnings.join('\n')).toContain(
      'came from a file titled "The old name", and that is the title written out'
    );
  });

  it('writes the carried title back when the caller names nothing', () => {
    const parts = teaShopBoard();
    parts.maps[0] = fakeMap(undefined, {
      owm: { attrs: { '@document': { title: 'The old name' } } },
    });
    const { text, warnings } = write(parts);
    expect(text).toContain('title The old name');
    expect(warnings).toEqual([]);
  });
});
