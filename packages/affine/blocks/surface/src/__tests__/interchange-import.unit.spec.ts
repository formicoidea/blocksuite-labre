import { ConnectorElementModel } from '@labre/affine-model';
import { NotificationProvider } from '@labre/affine-shared/services';
import { Container } from '@labre/global/di';
import { Bound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type InterchangeCapability,
  interchangeCapabilityId,
  InterchangeExtension,
  type InterchangeFormat,
  type InterchangeImporter,
  type InterchangeReport,
} from '../extensions/interchange.js';
import {
  interchangeImportersByExtension,
  materializeInterchangeImport,
  reportInterchangeImport,
} from '../extensions/interchange-import.js';

/**
 * The framework-agnostic half of an import (`docs/adr/0012`).
 *
 * These four functions were BPMN's until a second format asked for them, and
 * every one of the behaviours pinned here was learned the expensive way on that
 * one: first-wins on a duplicated source id, an unresolvable end left verbatim,
 * a report that defers a crowd of remarks to the console. What this file proves
 * is that none of them was about BPMN — the format is a parameter, and the only
 * thing the materializer ever knew about a format was the key its payload rides
 * under.
 *
 * `runInterchangeImportFile` is exercised end to end through BPMN's delegate
 * (`gfx/bpmn/src/__tests__/import-command.unit.spec.ts`), where a real reader
 * and a real `.bpmn` file make the pipeline mean something. What is here is
 * everything a stub can answer honestly.
 */

/* ── The stubs ────────────────────────────────────────────────────────── */

type Props = Record<string, unknown> & { type: string };

/**
 * A surface that mints ids and hands models back — the two halves of
 * `addElement` the id remapping actually depends on.
 *
 * Connectors are prototype-grafted onto the real `ConnectorElementModel`,
 * because the rewrite is guarded by an `instanceof` and a stub that failed it
 * would pass this spec by doing nothing.
 */
class StubSurface {
  readonly added: Props[] = [];

  private readonly models = new Map<string, unknown>();

  private seq = 0;

  addElement(props: Props): string {
    const id = `minted-${++this.seq}`;
    this.added.push({ ...props });
    if (props.type === 'connector') {
      const connector = Object.create(ConnectorElementModel.prototype);
      Object.defineProperties(connector, {
        id: { value: id, enumerable: true },
        elementBound: { value: new Bound(0, 0, 0, 0) },
        // The two the rewrite WRITES.
        source: { value: props.source, writable: true, enumerable: true },
        target: { value: props.target, writable: true, enumerable: true },
      });
      this.models.set(id, connector);
    } else {
      this.models.set(id, { ...props, id });
    }
    return id;
  }

  getElementById(id: string): unknown {
    return this.models.get(id);
  }
}

function stubEditor(options: { notify?: boolean } = {}) {
  const surface = new StubSurface();
  const notify = vi.fn();
  const std = {
    get: () => ({ surface }),
    // By IDENTIFIER, not blanket: `translateKey` reaches for the translation
    // seam through the same door, and a stub that answered every lookup with a
    // notification service would make every wording throw.
    getOptional: (identifier: unknown) =>
      identifier === NotificationProvider && options.notify !== false
        ? { notify }
        : undefined,
  } as unknown as BlockStdScope;

  return { std, surface, notify };
}

const format = (
  id: string,
  extensions: [string, ...string[]] = [`.${id}`]
): InterchangeFormat => ({ id, tier: 'semantic', extensions });

/** An element as a reader hands it over: props, and its source id. */
const element = (type: string, formatId: string, sourceId: string): Props => ({
  type,
  interchange: { [formatId]: { id: sourceId } },
});

const edge = (
  formatId: string,
  sourceId: string,
  from: string,
  to: string
): Props => ({
  ...element('connector', formatId, sourceId),
  source: { id: from },
  target: { id: to },
});

/* ── Writing what a reader returned ───────────────────────────────────── */

describe('materializing an import', () => {
  it('adds every element in order and mints an id for each', () => {
    const { std, surface } = stubEditor();

    const created = materializeInterchangeImport(std, 'owm', [
      element('shape', 'owm', 'A'),
      element('shape', 'owm', 'B'),
      edge('owm', 'L', 'A', 'B'),
    ]);

    expect(created).toHaveLength(3);
    expect(new Set(created).size).toBe(3);
    expect(surface.added.map(props => props.type)).toEqual([
      'shape',
      'shape',
      'connector',
    ]);
  });

  it('rewrites both ends onto the ids the surface minted, not the file’s', () => {
    const { std, surface } = stubEditor();

    const [from, to, link] = materializeInterchangeImport(std, 'owm', [
      element('shape', 'owm', 'A'),
      element('shape', 'owm', 'B'),
      edge('owm', 'L', 'A', 'B'),
    ]);

    const connector = surface.getElementById(link) as ConnectorElementModel;
    expect(connector.source?.id).toBe(from);
    expect(connector.target?.id).toBe(to);
  });

  it('reads the source ids out of the payload of THIS format, not another', () => {
    // The one thing the materializer ever knew about BPMN, now a parameter. An
    // element carrying a `bpmn` payload is invisible to an `owm` import: its id
    // never enters the map, so an edge naming it is left alone rather than
    // pointed at whatever happened to be first.
    const { std, surface } = stubEditor();

    const [, link] = materializeInterchangeImport(std, 'owm', [
      element('shape', 'bpmn', 'A'),
      edge('owm', 'L', 'A', 'A'),
    ]);

    const connector = surface.getElementById(link) as ConnectorElementModel;
    expect(connector.source?.id).toBe('A');
  });

  it('sends both ends onto ONE element when the file reused an id', () => {
    // FIRST wins, matching a reader's own answer to a duplicated id: it imports
    // both and records a `substituted-id` note saying the SECOND will be
    // written back under an id Labre mints. Pinned so nobody turns the fold
    // into last-wins and quietly moves an arrow onto a different artefact.
    const { std, surface } = stubEditor();

    const [first, second, link] = materializeInterchangeImport(std, 'owm', [
      element('shape', 'owm', 'A'),
      element('shape', 'owm', 'A'),
      edge('owm', 'L', 'A', 'A'),
    ]);

    // Both were imported — nothing is dropped for sharing a name.
    expect(second).not.toBe(first);
    const connector = surface.getElementById(link) as ConnectorElementModel;
    expect(connector.source?.id).toBe(first);
    expect(connector.target?.id).toBe(first);
  });

  it('leaves an end it cannot resolve exactly as the file wrote it', () => {
    // An unresolvable name a reader can go and look up in the source file beats
    // one this function quietly invented: the connector routes to an empty path
    // and is invisible, and the DOCUMENT still says what the file said.
    const { std, surface } = stubEditor();

    const [, link] = materializeInterchangeImport(std, 'owm', [
      element('shape', 'owm', 'A'),
      edge('owm', 'L', 'A', 'Gone_1'),
    ]);

    const connector = surface.getElementById(link) as ConnectorElementModel;
    expect(connector.target?.id).toBe('Gone_1');
  });

  it('does nothing at all when there is no surface', () => {
    const std = { get: () => ({ surface: null }) } as unknown as BlockStdScope;
    expect(
      materializeInterchangeImport(std, 'owm', [{ type: 'shape' }])
    ).toEqual([]);
  });
});

/* ── The report ───────────────────────────────────────────────────────── */

describe('reporting an import', () => {
  const report = (overrides: Partial<InterchangeReport> = {}) => ({
    mapped: 4,
    carried: 1,
    quarantined: 0,
    notes: [],
    ...overrides,
  });

  const note = (index: number) => ({
    kind: 'carried' as const,
    sourceId: `Node_${index}`,
    element: 'boundaryEvent',
    message: 'Kept verbatim.',
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('names the format in the headline and beside the version it read', () => {
    const { std, notify } = stubEditor();

    reportInterchangeImport(std, format('owm'), report({ sourceVersion: '2' }));

    expect(notify).toHaveBeenCalledTimes(1);
    const first = notify.mock.calls[0][0];
    // The format's own name, upper-cased out of its declared id: one wording
    // for every format, and no second name to keep in step with the payload
    // key.
    expect(first.title).toBe('OWM file imported');
    expect(first.message).toBe('4 drawn · 1 carried · 0 quarantined — OWM 2');
    expect(first.accent).toBe('info');
  });

  it('says the counts alone when the file declared no version', () => {
    const { std, notify } = stubEditor();
    reportInterchangeImport(std, format('owm'), report());
    expect(notify.mock.calls[0][0].message).toBe(
      '4 drawn · 1 carried · 0 quarantined'
    );
  });

  it('spells out a handful of remarks, and defers a crowd to the console', () => {
    const table = vi.spyOn(console, 'table').mockImplementation(() => {});
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});

    const few = stubEditor();
    reportInterchangeImport(
      few.std,
      format('owm'),
      report({ notes: [note(1), note(2)] })
    );
    expect(few.notify).toHaveBeenCalledTimes(2);
    const remarks = few.notify.mock.calls[1][0];
    expect(remarks.title).toBe('What the import could not keep as it was');
    expect(remarks.message).toBe(
      'Node_1: Kept verbatim.\nNode_2: Kept verbatim.'
    );
    // Nothing FAILED — every one of these is something the document kept — but
    // each is a difference between the file handed over and the board drawn.
    expect(remarks.accent).toBe('warning');
    // ALWAYS, not only when the toast defers to it: the console line is the one
    // still there in ten minutes, and it names the format it is about.
    expect(table).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0][0]).toContain('[owm] import report');

    // The BOUNDARY, both sides of it. Five is the last count spelled out and
    // six is the first deferred.
    const five = stubEditor();
    reportInterchangeImport(
      five.std,
      format('owm'),
      report({ notes: [1, 2, 3, 4, 5].map(note) })
    );
    expect(five.notify.mock.calls[1][0].message.split('\n')).toHaveLength(5);

    const six = stubEditor();
    table.mockClear();
    reportInterchangeImport(
      six.std,
      format('owm'),
      report({ notes: [1, 2, 3, 4, 5, 6].map(note) })
    );
    expect(six.notify.mock.calls[1][0].message).toBe(
      '6 remarks — the full report is in the browser console.'
    );
    // The console gets ALL of them, which is what makes the deferral honest.
    expect(table.mock.calls[0][0]).toHaveLength(6);
  });

  it('says nothing twice when there is nothing to remark on', () => {
    const { std, notify } = stubEditor();
    const table = vi.spyOn(console, 'table').mockImplementation(() => {});
    reportInterchangeImport(std, format('owm'), report({ carried: 0 }));
    expect(notify).toHaveBeenCalledTimes(1);
    expect(table).not.toHaveBeenCalled();
  });

  it('degrades to silence when the host injected no notification service', () => {
    // The standalone playground, which registers no `NotificationProvider`.
    // The elements are on the surface either way.
    const { std } = stubEditor({ notify: false });
    expect(() =>
      reportInterchangeImport(std, format('owm'), report())
    ).not.toThrow();
  });
});

/* ── What can read a file called this ─────────────────────────────────── */

describe('the importers indexed by extension', () => {
  const reader: InterchangeImporter = () => ({
    elements: [],
    report: { mapped: 0, carried: 0, quarantined: 0, notes: [] },
  });

  const importer = (
    framework: string,
    formatId: string,
    extensions: [string, ...string[]]
  ): InterchangeCapability => ({
    id: interchangeCapabilityId(framework, formatId, 'import'),
    framework,
    format: { ...format(formatId, extensions), tier: 'visual' },
    direction: 'import',
    run: reader,
  });

  const providerOf = (...capabilities: InterchangeCapability[]) => {
    const container = new Container();
    InterchangeExtension(capabilities).setup!(container);
    return container.provider();
  };

  it('answers with EVERY capability that reads that extension', () => {
    // ADR 0012's own example, and the reason the value is a list: an SVG is a
    // picture, and which framework's vocabulary it is a picture OF is not a
    // fact about the filename. Anything that picked one would be guessing on
    // the user's behalf about the one question only they can answer.
    const wardley = importer('wardley', 'svg', ['.svg']);
    const c4 = importer('c4', 'svg', ['.svg']);
    const map = interchangeImportersByExtension(providerOf(wardley, c4));

    expect(map.get('.svg')?.map(capability => capability.framework)).toEqual([
      'c4',
      'wardley',
    ]);
  });

  it('files one capability under each extension it declares', () => {
    const bpmn = importer('bpmn', 'bpmn', ['.bpmn', '.xml']);
    const map = interchangeImportersByExtension(providerOf(bpmn));

    expect([...map.keys()].sort()).toEqual(['.bpmn', '.xml']);
    expect(map.get('.bpmn')).toEqual([bpmn]);
    expect(map.get('.xml')).toEqual([bpmn]);
  });

  it('lower-cases its keys, dot included', () => {
    // `Order.BPMN` is the same kind of file as `order.bpmn`, and nobody should
    // have to know which. The dot stays: a key is what a filename ends with.
    const map = interchangeImportersByExtension(
      providerOf(importer('bpmn', 'bpmn', ['.BPMN']))
    );
    expect([...map.keys()]).toEqual(['.bpmn']);
  });

  it('leaves out the exporters, and answers empty on a bare container', () => {
    const exporterOnly: InterchangeCapability = {
      id: interchangeCapabilityId('bpmn', 'bpmn', 'export'),
      framework: 'bpmn',
      format: format('bpmn'),
      direction: 'export',
      run: () => ({ text: '', filename: 'b.bpmn', mime: 'application/xml' }),
    };

    expect(interchangeImportersByExtension(providerOf(exporterOnly)).size).toBe(
      0
    );
    expect(
      interchangeImportersByExtension(new Container().provider()).size
    ).toBe(0);
  });
});
