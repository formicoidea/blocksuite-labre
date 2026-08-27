import { Container } from '@labre/global/di';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import {
  type InterchangeCapability,
  interchangeCapabilities,
  interchangeCapabilityId,
  InterchangeExtension,
  type InterchangeExporter,
  InterchangeIdentifier,
  type InterchangeImporter,
} from '../extensions/interchange.js';

/**
 * The interchange registry (`docs/adr/0012`, P1).
 *
 * Plain stubs and a bare DI container, because the registry is declaration data
 * and a `run` is a pure function: a capability that cannot be resolved and
 * called this way has broken P3, and this file is where that would show.
 */

/* ── Stubs ────────────────────────────────────────────────────────────── */

const exporter: InterchangeExporter = (elements, context) => ({
  text: `${context.name ?? 'untitled'}:${elements.length}`,
  filename: `${context.name ?? 'untitled'}.txt`,
  mime: 'text/plain',
});

const importer: InterchangeImporter = source => ({
  elements: source.split(',').map(type => ({ type })),
  report: {
    mapped: 1,
    carried: 2,
    quarantined: 1,
    notes: [
      {
        kind: 'quarantined',
        sourceId: 'Activity_1',
        element: 'subProcess',
        message: 'An expanded sub-process is drawn collapsed.',
      },
    ],
    sourceVersion: '2.0',
  },
});

function capability(
  framework: string,
  formatId: string,
  direction: 'import' | 'export',
  tier: 'semantic' | 'visual' = 'semantic'
): InterchangeCapability {
  const base = {
    id: interchangeCapabilityId(framework, formatId, direction),
    framework,
    format: { id: formatId, tier, extensions: [`.${formatId}`] as [string] },
  };
  return direction === 'export'
    ? { ...base, direction, run: exporter }
    : { ...base, direction, run: importer };
}

const BPMN_OUT = capability('bpmn', 'bpmn', 'export');
const WARDLEY_OUT = capability('wardley', 'owm', 'export');
const WARDLEY_IN = capability('wardley', 'owm', 'import');
const WARDLEY_SVG_IN = capability('wardley', 'svg', 'import', 'visual');

function mount(...capabilities: InterchangeCapability[]) {
  const container = new Container();
  InterchangeExtension(capabilities).setup!(container);
  return container.provider();
}

const ALL = [BPMN_OUT, WARDLEY_OUT, WARDLEY_IN, WARDLEY_SVG_IN];

const ids = (found: readonly InterchangeCapability[]) => found.map(c => c.id);

/* ── Tests ────────────────────────────────────────────────────────────── */

describe('registration and lookup', () => {
  it('resolves one capability by its id, which is its triple', () => {
    const provider = mount(...ALL);

    expect(provider.get(InterchangeIdentifier('wardley:owm:import'))).toBe(
      WARDLEY_IN
    );
    // …and the id really is the triple, spelled out rather than derived, so a
    // reader of this file can see what the DI key looks like.
    expect(BPMN_OUT.id).toBe('bpmn:bpmn:export');
  });

  it('lists every capability, sorted by id', () => {
    // Sorted, so a menu built from the registry is in the same order on every
    // boot whichever order the extensions happened to be registered in.
    expect(ids(interchangeCapabilities(mount(...[...ALL].reverse())))).toEqual([
      'bpmn:bpmn:export',
      'wardley:owm:export',
      'wardley:owm:import',
      'wardley:svg:import',
    ]);
  });

  it('narrows by framework', () => {
    const found = interchangeCapabilities(mount(...ALL), {
      framework: 'wardley',
    });
    expect(ids(found)).toEqual([
      'wardley:owm:export',
      'wardley:owm:import',
      'wardley:svg:import',
    ]);
  });

  it('narrows by direction, and a direction never implies its opposite', () => {
    const provider = mount(...ALL);

    // The load-bearing property of the whole registry: BPMN writes `.bpmn` and
    // cannot read one, and asking gives that answer rather than a symmetry.
    expect(
      ids(interchangeCapabilities(provider, { framework: 'bpmn' }))
    ).toEqual(['bpmn:bpmn:export']);
    expect(
      interchangeCapabilities(provider, {
        framework: 'bpmn',
        direction: 'import',
      })
    ).toEqual([]);

    expect(
      ids(interchangeCapabilities(provider, { direction: 'import' }))
    ).toEqual(['wardley:owm:import', 'wardley:svg:import']);
  });

  it('narrows by format id, across frameworks and directions', () => {
    const found = interchangeCapabilities(mount(...ALL), { format: 'owm' });
    expect(ids(found)).toEqual(['wardley:owm:export', 'wardley:owm:import']);
  });

  it('answers nothing, not undefined, for a framework that registered none', () => {
    expect(
      interchangeCapabilities(mount(BPMN_OUT), { framework: 'c4' })
    ).toEqual([]);
  });

  it('hands back exporters already typed when asked for exporters', () => {
    // No cast, no second narrowing: the overload is what makes a query useful
    // to a menu that intends to CALL what it found.
    const [found] = interchangeCapabilities(mount(...ALL), {
      direction: 'export',
      framework: 'bpmn',
    });

    expect(found.run([], { name: 'board' }).mime).toBe('text/plain');
  });
});

describe('the triple is unique, and it is the id', () => {
  it('refuses a capability whose id is not its own three fields', () => {
    const lying: InterchangeCapability = { ...BPMN_OUT, id: 'bpmn-export' };

    expect(() => mount(lying)).toThrow(/not its triple/);
  });

  it('refuses a second capability under the same id', () => {
    // Same triple, different function: silently keeping one of the two would
    // make "what can Labre write" depend on registration order. The matcher is
    // the DI container's own words, so this cannot pass by hitting the id guard.
    //
    // Spelled out rather than spread from `BPMN_OUT`: the union is discriminated
    // now, so `{...capability, run}` is not a thing TypeScript will let anybody
    // write — which is M2 doing its job on this very file.
    const rival: InterchangeCapability = {
      id: BPMN_OUT.id,
      framework: BPMN_OUT.framework,
      format: BPMN_OUT.format,
      direction: 'export',
      run: () => ({ text: 'other', filename: 'other.bpmn', mime: 'text/xml' }),
    };

    expect(() => mount(BPMN_OUT, rival)).toThrow(/already exists/);
  });

  it('refuses a part that contains the separator', () => {
    // `('a', 'b:c')` and `('a:b', 'c')` mint one key, and each id agrees with
    // its own triple — so only this check can tell them apart, and without it
    // the two surface as an opaque DI collision.
    const sneaky = capability('wardley', 'owm:v2', 'export');
    expect(() => mount(sneaky)).toThrow(/separates the parts/);

    const sneakier = capability('wardley:owm', 'v2', 'export');
    expect(() => mount(sneakier)).toThrow(/separates the parts/);
  });

  it('accepts the same format twice when the framework or direction differs', () => {
    // `owm` in and out, and `svg` for wardley beside `bpmn` for bpmn: the unit
    // is the triple, so none of these three collide with the others.
    expect(ids(interchangeCapabilities(mount(...ALL)))).toHaveLength(4);
  });
});

describe('a resolved capability is a pure function', () => {
  it('runs an exporter off the container with plain element stubs', () => {
    const provider = mount(...ALL);
    const found = provider.get(InterchangeIdentifier('bpmn:bpmn:export'));
    const elements = [{ id: 'a' }, { id: 'b' }] as GfxPrimitiveElementModel[];

    // `direction` narrows the union, so `run` is an exporter with no cast.
    if (found.direction !== 'export') throw new Error('expected an exporter');
    const result = found.run(elements, { name: 'board' });

    expect(result).toEqual({
      text: 'board:2',
      filename: 'board.txt',
      mime: 'text/plain',
    });
    // Nothing was lost, so the channel is absent rather than empty — a caller
    // may ask `if (result.warnings)` and mean it.
    expect(result.warnings).toBeUndefined();
  });

  it('runs an importer off the container and gets serialized props back', () => {
    const provider = mount(...ALL);
    const found = provider.get(InterchangeIdentifier('wardley:owm:import'));

    if (found.direction !== 'import') throw new Error('expected an importer');
    const result = found.run('wardley,wardleyNode', {});

    // PROPS, not models — the caller does the writing (P3).
    expect(result.elements).toEqual([
      { type: 'wardley' },
      { type: 'wardleyNode' },
    ]);
  });
});

describe('the report says which, not only how many', () => {
  it('carries a note per item, naming the source element', () => {
    // D1's third column is a list. Counts are the headline a UI renders without
    // walking anything; the note is what a user can act on.
    const { report } = importer('a', {});

    expect([report.mapped, report.carried, report.quarantined]).toEqual([
      1, 2, 1,
    ]);
    expect(report.notes).toEqual([
      {
        kind: 'quarantined',
        sourceId: 'Activity_1',
        element: 'subProcess',
        message: 'An expanded sub-process is drawn collapsed.',
      },
    ]);
  });

  it('records the format version it read', () => {
    // P2 as amended: a capability may target a format still in motion, and the
    // report is where it says which version it actually understood.
    expect(importer('a', {}).report.sourceVersion).toBe('2.0');
  });

  it('does not derive the notes from the counts, or the counts from the notes', () => {
    // Two carried fragments and no note about either is a legal report: an
    // import may carry a hundred things and have three worth naming.
    const { report } = importer('a', {});
    expect(report.carried).toBe(2);
    expect(report.notes.filter(note => note.kind === 'carried')).toEqual([]);
  });
});

describe('the tier is declared, not inferred', () => {
  it('keeps a visual capability distinguishable from a semantic one', () => {
    // P2: what a user is entitled to expect differs between the two, and the
    // only thing that says which is this field.
    const provider = mount(...ALL);
    const svg = provider.get(InterchangeIdentifier('wardley:svg:import'));
    const owm = provider.get(InterchangeIdentifier('wardley:owm:import'));

    expect(svg.format.tier).toBe('visual');
    expect(owm.format.tier).toBe('semantic');
  });
});
