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
  type InterchangeImportCapability,
  type InterchangeImporter,
  type InterchangeReport,
} from '../extensions/interchange.js';
import {
  importInterchangeFile,
  interchangeImportersByExtension,
  materializeInterchangeImport,
  reportInterchangeImport,
  runInterchangeImportFile,
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
 * The gesture is exercised end to end, dialog and all, through BPMN's delegate
 * (`gfx/bpmn/src/__tests__/import-command.unit.spec.ts`), where a real reader
 * and a real `.bpmn` file make it mean something. What is pinned HERE is the
 * step that is pure arithmetic over any format's output — the viewport fit —
 * because a regression in it would otherwise be caught only in the BPMN
 * package, and the next framework to call this code would inherit a bug
 * nobody's tests were watching.
 *
 * **Nothing is mocked, and that is deliberate.** This file is run by the
 * surface package's BROWSER project, which shares one chromium context across
 * every spec in it (`isolate: false`), so which module a `vi.mock` intercepts
 * depends on which spec imported it first — a test that passed alone here and
 * failed in CI. {@link importInterchangeFile} takes the file as an ARGUMENT
 * precisely so the pipeline can be proven without reaching for the bundler; the
 * picker in front of it is one line, and the filter it builds is pinned where
 * it can be observed for real, on the mounted input
 * (`affine-shared/src/__tests__/utils/filesys.unit.spec.ts`).
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
        // `[0, 0, 0, 0]`, and it is the POINT: a connector has no geometry of
        // its own, its bound comes off the path the connector manager routes
        // between its ends, and that path is computed on a later tick than the
        // `addElement` that made it. Read synchronously — which is the only
        // moment the pipeline has — a freshly imported connector really does
        // answer the origin with no size.
        elementBound: { value: new Bound(0, 0, 0, 0) },
        // The two the rewrite WRITES.
        source: { value: props.source, writable: true, enumerable: true },
        target: { value: props.target, writable: true, enumerable: true },
      });
      this.models.set(id, connector);
    } else {
      this.models.set(id, {
        ...props,
        id,
        elementBound: Bound.deserialize(String(props.xywh ?? '[0,0,10,10]')),
      });
    }
    return id;
  }

  getElementById(id: string): unknown {
    return this.models.get(id);
  }
}

function stubEditor(options: { notify?: boolean; readonly?: boolean } = {}) {
  const surface = new StubSurface();
  const notify = vi.fn();
  const setViewportByBound = vi.fn();
  const setTool = vi.fn();
  const captureSync = vi.fn();
  const std = {
    get: () => ({
      surface,
      viewport: { zoom: 1, centerX: 0, centerY: 0, setViewportByBound },
      tool: { setTool },
    }),
    // By IDENTIFIER, not blanket: `translateKey` reaches for the translation
    // seam through the same door, and a stub that answered every lookup with a
    // notification service would make every wording throw.
    getOptional: (identifier: unknown) =>
      identifier === NotificationProvider && options.notify !== false
        ? { notify }
        : undefined,
    store: { readonly: options.readonly === true, captureSync },
  } as unknown as BlockStdScope;

  return { std, surface, notify, setViewportByBound, setTool, captureSync };
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

/* ── The whole gesture, and the arithmetic in the middle of it ────────── */

describe('running an import from a file', () => {
  /** A reader that answers with a process drawn far from the origin. */
  const farFromOrigin: InterchangeImporter = () => ({
    elements: [
      { ...element('shape', 'owm', 'A'), xywh: '[99932,99940,36,36]' },
      { ...element('shape', 'owm', 'B'), xywh: '[100080,100020,100,80]' },
      edge('owm', 'L', 'A', 'B'),
    ],
    report: { mapped: 3, carried: 0, quarantined: 0, notes: [] },
  });

  const capabilityOf = (
    run: InterchangeImporter
  ): InterchangeImportCapability => ({
    id: interchangeCapabilityId('owm', 'owm', 'import'),
    framework: 'owm',
    format: { ...format('owm'), mime: 'text/plain' },
    direction: 'import',
    run,
  });

  /** A file the caller already holds — a drop, a paste, or a picker's answer. */
  const fileOf = (name = 'process.owm') =>
    ({ name, text: () => Promise.resolve('anything') }) as unknown as File;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fits the drawing, not the drawing plus the origin', async () => {
    // The regression, pinned at the level the code now lives at. A connector's
    // bound is not known on the tick that creates it and reads back as
    // `[0, 0, 0, 0]`, so a common bound that counted it stretched from the
    // origin to the far corner of the drawing — and a file drawn a hundred
    // thousand units out (one drag of a process across a canvas) landed as a
    // speck nobody could see.
    //
    // It has been proven in the BPMN package since #162, on a `.bpmn` file.
    // This is the same claim about the FUNCTION, so the next framework to call
    // it inherits the fix and not just the code.
    const { std, surface, setViewportByBound, setTool, captureSync } =
      stubEditor();

    await importInterchangeFile(std, capabilityOf(farFromOrigin), fileOf());

    // There has to BE a zero-area element, or the test proves nothing.
    expect(
      surface.added.filter(props => props.type === 'connector')
    ).toHaveLength(1);

    const [bound] = setViewportByBound.mock.calls[0];
    // Nowhere near the origin, and the size of a drawing rather than the size
    // of the distance to it.
    expect(bound.x).toBeGreaterThan(99_000);
    expect(bound.y).toBeGreaterThan(99_000);
    expect(bound.w).toBeLessThan(1_000);
    expect(bound.h).toBeLessThan(1_000);
    // …and it still HOLDS the drawing: nothing was cropped in the course of
    // not including the origin.
    expect(bound.x + bound.w).toBeGreaterThanOrEqual(100_180);
    expect(bound.y + bound.h).toBeGreaterThanOrEqual(100_100);
    // One undo step for the whole file, and the tool handed back.
    expect(captureSync).toHaveBeenCalledTimes(2);
    expect(setTool).toHaveBeenCalledTimes(1);
  });

  it('names what is wrong with a file it cannot read, and draws nothing', async () => {
    const { std, surface, notify, setViewportByBound } = stubEditor();
    const refused = () => {
      // A reader's own sentence, which knows which of its refusals this was.
      throw new Error('The root element is not a `definitions`.');
    };

    await importInterchangeFile(std, capabilityOf(refused), fileOf());

    expect(surface.added).toEqual([]);
    expect(setViewportByBound).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledTimes(1);
    const failure = notify.mock.calls[0][0];
    expect(failure.title).toBe('This file could not be imported');
    expect(failure.accent).toBe('error');
    // Shown as it is: a wording of ours would know less than the reader's.
    expect(failure.message).toBe('The root element is not a `definitions`.');
  });

  it('draws nothing on a read-only document, whichever door is used', async () => {
    const { std, surface } = stubEditor({ readonly: true });

    // The door a host uses, with the file already in hand.
    await importInterchangeFile(std, capabilityOf(farFromOrigin), fileOf());
    expect(surface.added).toEqual([]);

    // …and the door a command uses, which must not even OPEN a dialog a
    // read-only document could not honour. Asserted on the DOM rather than on
    // a mocked module: the fallback picker mounts `.affine-upload-input` and
    // waits, so its absence is the real evidence, in every environment this
    // file runs in.
    await runInterchangeImportFile(std, capabilityOf(farFromOrigin));
    expect(document.querySelector('.affine-upload-input')).toBeNull();
    expect(surface.added).toEqual([]);
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
