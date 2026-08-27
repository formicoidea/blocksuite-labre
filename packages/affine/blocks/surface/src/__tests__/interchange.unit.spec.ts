import { Container } from '@labre/global/di';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import {
  type InterchangeCapability,
  interchangeCapabilities,
  interchangeCapabilityId,
  InterchangeExtension,
  type InterchangeExportContext,
  type InterchangeExportResult,
  InterchangeIdentifier,
  type InterchangeImportContext,
  type InterchangeImportResult,
} from '../extensions/interchange.js';

/**
 * The interchange registry (`docs/adr/0012`, P1).
 *
 * Plain stubs and a bare DI container, because the registry is declaration data
 * and a `run` is a pure function: a capability that cannot be resolved and
 * called this way has broken P3, and this file is where that would show.
 */

/* ── Stubs ────────────────────────────────────────────────────────────── */

const exporter = (
  elements: readonly GfxPrimitiveElementModel[],
  context: InterchangeExportContext
): InterchangeExportResult => ({
  text: `${context.name ?? 'untitled'}:${elements.length}`,
  filename: `${context.name ?? 'untitled'}.txt`,
  mime: 'text/plain',
});

const importer = (
  source: string,
  _context: InterchangeImportContext
): InterchangeImportResult => ({
  elements: source.split(',').map(type => ({ type })),
  report: { mapped: 1, carried: 0, quarantined: 0, warnings: [] },
});

function capability(
  framework: string,
  formatId: string,
  direction: 'import' | 'export',
  tier: 'semantic' | 'visual' = 'semantic'
): InterchangeCapability {
  return {
    id: interchangeCapabilityId(framework, formatId, direction),
    framework,
    format: { id: formatId, tier, extensions: [`.${formatId}`] },
    direction,
    run: direction === 'export' ? exporter : importer,
  };
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
});

describe('the triple is unique, and it is the id', () => {
  it('refuses a capability whose id is not its own three fields', () => {
    const lying: InterchangeCapability = { ...BPMN_OUT, id: 'bpmn-export' };

    expect(() => mount(lying)).toThrow(/not its triple/);
  });

  it('refuses a second capability under the same id', () => {
    // Same triple, different function: silently keeping one of the two would
    // make "what can Labre write" depend on registration order.
    const rival: InterchangeCapability = {
      ...BPMN_OUT,
      run: () => ({ text: 'other', filename: 'other.bpmn', mime: 'text/xml' }),
    };

    expect(() => mount(BPMN_OUT, rival)).toThrow();
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

    const result = (found.run as typeof exporter)(elements, { name: 'board' });

    expect(result).toEqual({
      text: 'board:2',
      filename: 'board.txt',
      mime: 'text/plain',
    });
  });

  it('runs an importer off the container and gets serialized props back', () => {
    const provider = mount(...ALL);
    const found = provider.get(InterchangeIdentifier('wardley:owm:import'));

    const result = (found.run as typeof importer)('wardley,wardleyNode', {});

    // PROPS, not models — the caller does the writing (P3).
    expect(result.elements).toEqual([
      { type: 'wardley' },
      { type: 'wardleyNode' },
    ]);
    expect(result.report.mapped).toBe(1);
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
