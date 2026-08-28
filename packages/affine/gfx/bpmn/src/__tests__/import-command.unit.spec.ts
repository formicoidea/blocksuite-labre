import { ConnectorElementModel } from '@labre/affine-model';
import { NotificationProvider } from '@labre/affine-shared/services';
import { Bound } from '@labre/global/gfx';
import { type BlockStdScope, isCommandAvailable } from '@labre/std';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  exportBpmnXmlFile,
  importBpmnXmlFile,
  materializeBpmnImport,
  reportBpmnImport,
} from '../actions';
import { bpmnCommands } from '../commands';
import { exportBpmnXml } from '../export';
import { importBpmnXml } from '../import';
import { BPMN_ROLE } from '../roles';
import { collaborationBoard } from './board-stub';

/**
 * The `.bpmn` import COMMAND — the half of `docs/adr/0012` that has an editor
 * in it.
 *
 * The reader is pure and is proved pure next door (`import.unit.spec.ts`). What
 * is proved HERE is everything the reader deliberately refuses to do: pick a
 * file, mint surface ids, rewrite the endpoints that named the file's, bring
 * the result into view, and say what it cost. Three of those five are things a
 * user notices only when they are wrong.
 *
 * The picker is mocked and nothing else is: `openSingleFileWithSpec` is a
 * browser dialog, and there is no version of it that answers in a unit suite.
 * The capability, the reader, the id remapping, the generic pipeline these
 * three commands now delegate to (`affine-block-surface`,
 * `extensions/interchange-import.ts`) and the notification seam are all the
 * shipped ones.
 */

const picked = vi.hoisted(() => ({ file: vi.fn() }));

vi.mock('@labre/affine-shared/utils', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@labre/affine-shared/utils')>();
  return { ...actual, openSingleFileWithSpec: picked.file };
});

/* ── The stubs ────────────────────────────────────────────────────────── */

type Props = Record<string, unknown> & { type: string };

/**
 * A surface that mints ids and hands models back — the two halves of
 * `addElement` that the id remapping actually depends on.
 *
 * Connectors are prototype-grafted onto the real `ConnectorElementModel`,
 * because the rewrite is guarded by an `instanceof` and a stub that failed it
 * would pass this spec by doing nothing. Its own stub rather than
 * `board-stub`'s, because those leave `source` and `target` read-only and these
 * two are exactly the props the rewrite WRITES.
 */
class StubSurface {
  readonly added: Props[] = [];
  private readonly models = new Map<string, unknown>();
  private seq = 0;

  addElement(props: Props): string {
    const id = `minted-${++this.seq}`;
    this.added.push({ ...props });
    const bound = Bound.deserialize(String(props.xywh ?? '[0,0,10,10]'));
    if (props.type === 'connector') {
      const connector = Object.create(ConnectorElementModel.prototype);
      Object.defineProperties(connector, {
        id: { value: id, enumerable: true },
        role: { value: props.role, enumerable: true },
        // `[0, 0, 0, 0]`, and it is the POINT: a connector has no geometry of
        // its own, its bound comes off the path the connector manager routes
        // between its ends, and that path is computed on a later tick than the
        // `addElement` that made it. Read synchronously — which is the only
        // moment the command has — a freshly imported connector really does
        // answer the origin with no size (confirmed by a chromium probe on
        // #162). A stub that answered anything else would hide the one bug
        // this file exists to keep fixed.
        elementBound: { value: new Bound(0, 0, 0, 0) },
        // The two the rewrite WRITES — `board-stub`'s fakes leave them
        // read-only, which is the whole reason this stub is not that one.
        source: { value: props.source, writable: true, enumerable: true },
        target: { value: props.target, writable: true, enumerable: true },
      });
      this.models.set(id, connector);
    } else {
      this.models.set(id, { ...props, id, elementBound: bound });
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
  const gfx = {
    surface,
    viewport: { zoom: 1, centerX: 0, centerY: 0, setViewportByBound },
    tool: { setTool },
    selection: { selectedElements: [], set: vi.fn(), clear: vi.fn() },
  };
  const std = {
    get: () => gfx,
    // By IDENTIFIER, not blanket: `translateKey` reaches for the translation
    // seam through the same door, and a stub that answered every lookup with a
    // notification service would make every wording throw.
    getOptional: (identifier: unknown) =>
      identifier === NotificationProvider && options.notify !== false
        ? { notify }
        : undefined,
    store: {
      readonly: options.readonly === true,
      captureSync,
      id: 'doc-1',
      workspace: { meta: { getDocMeta: () => ({ title: 'Order to cash' }) } },
    },
  } as unknown as BlockStdScope;

  return { std, surface, notify, setViewportByBound, setTool, captureSync };
}

/**
 * A file Labre did not write: a bare process, an Analytic node it has no
 * artefact for, and a vendor colour on a task.
 *
 * Hand-written rather than round-tripped, because a file this library produced
 * carries nothing foreign by construction — and "what happens to the parts we
 * cannot draw" is the whole subject of the report this command exists to show.
 */
const FOREIGN_FILE = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:bioc="http://bpmn.io/schema/bpmn/biocolor/1.0" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn" exporter="bpmn-js" exporterVersion="17.0.0">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="Start_1" name="Order received" />
    <bpmn:task id="Task_1" name="Check the stock" bioc:stroke="#ff0000" />
    <bpmn:boundaryEvent id="Boundary_1" attachedToRef="Task_1" />
    <bpmn:endEvent id="End_1" name="Order shipped" />
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Task_1" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="End_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_1">
    <bpmndi:BPMNPlane id="Plane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="Shape_Start" bpmnElement="Start_1"><dc:Bounds x="100" y="100" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Task" bpmnElement="Task_1"><dc:Bounds x="200" y="80" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_End" bpmnElement="End_1"><dc:Bounds x="360" y="100" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Edge_1" bpmnElement="Flow_1"><di:waypoint x="136" y="118" /><di:waypoint x="200" y="118" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_2" bpmnElement="Flow_2"><di:waypoint x="300" y="118" /><di:waypoint x="360" y="118" /></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
`;

/**
 * The same process, drawn a hundred thousand units from the origin.
 *
 * Not a pathological file: bpmn.io hands out coordinates like these the moment
 * somebody drags a whole process across its canvas, and BPMN DI coordinates are
 * relative to the plane with no bound on how large they get. The shapes tile a
 * 308 × 160 box at (99932, 99940), which is the reviewer's chromium probe —
 * the sync common bound was `[0, 0, 100240, 100100]`.
 */
const FAR_FROM_ORIGIN_FILE = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_2" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_2" isExecutable="false">
    <bpmn:startEvent id="Start_2" name="Order received" />
    <bpmn:task id="Task_2" name="Check the stock" />
    <bpmn:endEvent id="End_2" name="Order shipped" />
    <bpmn:sequenceFlow id="Flow_A" sourceRef="Start_2" targetRef="Task_2" />
    <bpmn:sequenceFlow id="Flow_B" sourceRef="Task_2" targetRef="End_2" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_2">
    <bpmndi:BPMNPlane id="Plane_2" bpmnElement="Process_2">
      <bpmndi:BPMNShape id="Shape_S" bpmnElement="Start_2"><dc:Bounds x="99932" y="99940" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_T" bpmnElement="Task_2"><dc:Bounds x="100080" y="100020" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_E" bpmnElement="End_2"><dc:Bounds x="100204" y="99940" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Edge_A" bpmnElement="Flow_A"><di:waypoint x="99968" y="99958" /><di:waypoint x="100080" y="100060" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_B" bpmnElement="Flow_B"><di:waypoint x="100180" y="100060" /><di:waypoint x="100204" y="99958" /></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
`;

const asFile = (text: string, name = 'process.bpmn') =>
  ({ name, text: () => Promise.resolve(text) }) as unknown as File;

beforeEach(() => {
  picked.file.mockReset();
  vi.restoreAllMocks();
});

/* ── The descriptor ───────────────────────────────────────────────────── */

describe('the import command', () => {
  const descriptor = bpmnCommands.find(c => c.id === 'bpmn.importXml');

  it('declares itself as a document-level action that needs no selection', () => {
    expect(descriptor).toBeDefined();
    expect(descriptor!.kind).toBe('action');
    expect(descriptor!.owner).toBe('bpmn');
    expect(descriptor!.scope).toBe('edgeless');
    // Filed with the export it is the other half of, not with the pool: the
    // two directions of one format are one subject.
    expect(descriptor!.category).toBe('interchange');
    // Nothing has to be SELECTED, and there is no `when` to narrow it — but it
    // writes, so a read-only document is one it cannot run on and the
    // declaration says so. `'always'` would light the entry on a read-only
    // board, do nothing when clicked, and put the same untruth in the
    // serializable manifest a host reads.
    expect(descriptor!.availability).toBe('editable');
    expect(descriptor!.when).toBeUndefined();
    expect(descriptor!.iconKey).toBe('bpmn.import-xml');
    expect(descriptor!.defaultKeys).toEqual({ mac: [], other: [] });
    expect(descriptor!.telemetry).toEqual({
      framework: 'bpmn',
      element: 'board:import-xml',
    });
  });

  it('withdraws from every surface on a read-only document', () => {
    // The half `'editable'` buys that the runtime guard cannot: a surface asks
    // the DECLARATION what to render, so with `'always'` the entry was listed,
    // clickable and silently dead on a document nothing can be written to.
    expect(isCommandAvailable(stubEditor().std, descriptor!)).toBe(true);
    expect(
      isCommandAvailable(stubEditor({ readonly: true }).std, descriptor!)
    ).toBe(false);
  });

  it('takes the sub-menu, the catalogue, the palette and the agent', () => {
    // `'senior-menu'` since the PO decision of 2026-08-28, which reverses the
    // earlier "the sub-menu is a row of things you DRAW" ruling for the IMPORT
    // only: an import is where a board comes FROM, and on an empty canvas the
    // sub-menu is the first thing a user opens. The export keeps the old
    // reading — it is what you do to a board you already have, reached from the
    // pool it is about (`export.unit.spec.ts`).
    //
    // Still not the contextual toolbar: a contextual toolbar is a statement
    // about a SELECTION, and the moment this is most wanted is on an empty
    // board.
    expect(descriptor!.surfaces).toEqual([
      'senior-menu',
      'catalogue',
      'palette',
      'agent',
    ]);
  });

  it('carries a label and a description through the i18n seam', () => {
    expect(descriptor!.labelKey).toBe('com.labre.commands.bpmn.importXml');
    expect(descriptor!.labelFallback).toBe('Import BPMN XML');
    expect(descriptor!.descriptionKey).toBe(
      'com.labre.commands.bpmn.importXml.description'
    );
    expect(descriptor!.descriptionFallback).toBeTruthy();
  });
});

/* ── What the caller of a pure reader owes it ─────────────────────────── */

describe('materializing an imported board', () => {
  it('adds every element in the order the reader gave them', () => {
    const { std, surface } = stubEditor();
    const { elements } = importBpmnXml(
      exportBpmnXml(collaborationBoard().board, { name: 'Round' })
    );

    const created = materializeBpmnImport(std, elements);

    expect(created).toHaveLength(elements.length);
    expect(surface.added.map(props => props.type)).toEqual(
      elements.map(props => props.type)
    );
    // The roles ride in the props, so a pool imported from a file and a pool
    // drawn by hand are one element type in the document.
    expect(surface.added.find(props => props.type === 'bpmnPool')?.role).toBe(
      BPMN_ROLE.pool
    );
  });

  it('rewrites a connector onto the ids the surface minted, not the file’s', () => {
    const { std, surface } = stubEditor();
    const { elements } = importBpmnXml(FOREIGN_FILE);

    // Before: the two ends name the FILE's ids, which is exactly what the
    // reader's contract says it hands over.
    const edge = elements.find(props => props.type === 'connector');
    expect((edge?.source as { id: string }).id).toBe('Start_1');

    const created = materializeBpmnImport(std, elements);

    const bySource = new Map<string, string>();
    created.forEach((id, index) => {
      const carried = elements[index].interchange as
        | Record<string, { id?: string }>
        | undefined;
      const source = carried?.bpmn?.id;
      if (source !== undefined && !bySource.has(source)) {
        bySource.set(source, id);
      }
    });

    const connectors = created
      .map(id => surface.getElementById(id))
      .filter(
        (model): model is ConnectorElementModel =>
          model instanceof ConnectorElementModel
      );
    expect(connectors).toHaveLength(2);
    for (const connector of connectors) {
      for (const side of ['source', 'target'] as const) {
        const end = connector[side]?.id;
        // A MINTED id, and the one that belongs to the artefact the file
        // pointed at — not a passthrough, and not a fresh guess.
        expect(created).toContain(end);
        expect([...bySource.values()]).toContain(end);
      }
    }
    // …and the pair is the one the file drew: start → task → end.
    const task = bySource.get('Task_1');
    expect(connectors[0].target?.id).toBe(task);
    expect(connectors[1].source?.id).toBe(task);
  });

  it('writes the foreign payload as the one whole blob it arrived as', () => {
    const { std, surface } = stubEditor();
    const { elements } = importBpmnXml(FOREIGN_FILE);

    materializeBpmnImport(std, elements);

    // The pool minted for a file that named no participant: it carries the
    // process's own id, and it is where the document's residue rides (D6).
    const pool = surface.added.find(props => props.type === 'bpmnPool');
    expect((pool?.interchange as Record<string, { id?: string }>).bpmn.id).toBe(
      'Process_1'
    );
    // The boundary event Labre has no artefact for: kept verbatim, on the pool.
    const carried = JSON.stringify(pool?.interchange);
    expect(carried).toContain('boundaryEvent');
    // …and the vendor colour, kept and flagged never to be written back.
    const task = surface.added.find(props => props.kind === 'task');
    expect(
      (
        task?.interchange as Record<
          string,
          { quarantined?: { fragment: string }[] }
        >
      ).bpmn.quarantined?.[0].fragment
    ).toContain('bioc:stroke');
  });

  it('sends both ends of an edge onto ONE element when the file reused an id', () => {
    // BPMN requires ids to be unique across a document; a merged file, or an
    // import run twice into one file, breaks that. The reader imports both and
    // records a `substituted-id` note saying the SECOND will be written back
    // under an id Labre mints — so a flow naming that id means the FIRST of
    // them, and this is the fold that has to agree with that sentence.
    const duplicated = FOREIGN_FILE.replace(
      '<bpmn:endEvent id="End_1" name="Order shipped" />',
      '<bpmn:endEvent id="Start_1" name="Order shipped" />'
    ).replace(
      '<bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Task_1" />',
      '<bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Start_1" />'
    );

    const { std, surface } = stubEditor();
    const { elements, report } = importBpmnXml(duplicated);
    expect(report.notes.map(note => note.kind)).toContain('substituted-id');

    const created = materializeBpmnImport(std, elements);
    const startIds = created.filter((_, index) => {
      const carried = surface.added[index].interchange as
        | Record<string, { id?: string }>
        | undefined;
      return carried?.bpmn?.id === 'Start_1';
    });
    // Both elements were imported — nothing is dropped for sharing a name.
    expect(startIds).toHaveLength(2);

    const flow = created
      .map(id => surface.getElementById(id))
      .find(
        (model): model is ConnectorElementModel =>
          model instanceof ConnectorElementModel
      );
    // Both ends named the duplicated id, and both land on the FIRST element to
    // claim it — the only answer consistent with the `substituted-id` note the
    // user was just shown ("the second will be written back under an id Labre
    // mints"). Pinned so nobody turns the fold into last-wins and quietly moves
    // an arrow onto a different artefact.
    expect(flow?.source?.id).toBe(startIds[0]);
    expect(flow?.target?.id).toBe(startIds[0]);
  });

  it('does nothing at all when there is no surface', () => {
    const std = { get: () => ({ surface: null }) } as unknown as BlockStdScope;
    expect(materializeBpmnImport(std, [{ type: 'bpmnPool' }])).toEqual([]);
  });
});

/* ── The report (ADR 0012, open question 2 — v1) ──────────────────────── */

describe('the import report', () => {
  const report = (
    overrides: Partial<Parameters<typeof reportBpmnImport>[1]> = {}
  ) => ({
    mapped: 4,
    carried: 1,
    quarantined: 0,
    notes: [],
    ...overrides,
  });

  it('leads with the counts and the version the reader actually read', () => {
    const { std, notify } = stubEditor();
    reportBpmnImport(std, report({ sourceVersion: '2.0 (bpmn-js 17.0.0)' }));

    expect(notify).toHaveBeenCalledTimes(1);
    const first = notify.mock.calls[0][0];
    expect(first.title).toBe('BPMN file imported');
    expect(first.message).toBe(
      '4 drawn · 1 carried · 0 quarantined — BPMN 2.0 (bpmn-js 17.0.0)'
    );
    expect(first.accent).toBe('info');
  });

  it('says the counts alone when the file declared no version', () => {
    const { std, notify } = stubEditor();
    reportBpmnImport(std, report());
    expect(notify.mock.calls[0][0].message).toBe(
      '4 drawn · 1 carried · 0 quarantined'
    );
  });

  it('spells out a handful of remarks, and defers a crowd to the console', () => {
    const note = (index: number) => ({
      kind: 'carried' as const,
      sourceId: `Boundary_${index}`,
      element: 'boundaryEvent',
      message: 'Kept verbatim.',
    });

    const table = vi.spyOn(console, 'table').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});

    const few = stubEditor();
    reportBpmnImport(few.std, report({ notes: [note(1), note(2)] }));
    expect(few.notify).toHaveBeenCalledTimes(2);
    const remarks = few.notify.mock.calls[1][0];
    expect(remarks.title).toBe('What the import could not keep as it was');
    expect(remarks.message).toBe(
      'Boundary_1: Kept verbatim.\nBoundary_2: Kept verbatim.'
    );
    // Nothing FAILED — every one of these is something the document kept — but
    // each is a difference between the file handed over and the board drawn.
    expect(remarks.accent).toBe('warning');
    // ALWAYS, not only when the toast defers to it: the console line is the one
    // still there in ten minutes, and "always" is the interesting half of the
    // claim on the branch that does NOT need it.
    expect(table).toHaveBeenCalledTimes(1);
    expect(table.mock.calls[0][0]).toHaveLength(2);

    // The BOUNDARY, both sides of it. Five is the last count spelled out and
    // six is the first deferred; asserting 2 and 7 alone would let the
    // comparison slip by one in either direction without a test noticing.
    const five = stubEditor();
    reportBpmnImport(five.std, report({ notes: [1, 2, 3, 4, 5].map(note) }));
    expect(five.notify.mock.calls[1][0].message.split('\n')).toHaveLength(5);

    const six = stubEditor();
    reportBpmnImport(six.std, report({ notes: [1, 2, 3, 4, 5, 6].map(note) }));
    expect(six.notify.mock.calls[1][0].message).toBe(
      '6 remarks — the full report is in the browser console.'
    );

    const many = stubEditor();
    table.mockClear();
    reportBpmnImport(
      many.std,
      report({ notes: [1, 2, 3, 4, 5, 6, 7].map(note) })
    );
    expect(many.notify.mock.calls[1][0].message).toBe(
      '7 remarks — the full report is in the browser console.'
    );
    // The console gets ALL of them, which is what makes the deferral honest.
    expect(table).toHaveBeenCalledTimes(1);
    expect(table.mock.calls[0][0]).toHaveLength(7);
  });

  it('says nothing twice when there is nothing to remark on', () => {
    const { std, notify } = stubEditor();
    const table = vi.spyOn(console, 'table').mockImplementation(() => {});
    reportBpmnImport(std, report({ carried: 0 }));
    expect(notify).toHaveBeenCalledTimes(1);
    expect(table).not.toHaveBeenCalled();
  });

  it('degrades to silence when the host injected no notification service', () => {
    // The standalone playground, which registers no `NotificationProvider`.
    // The elements are on the surface either way; nothing here decides that an
    // import failed to happen because nobody was listening.
    const { std } = stubEditor({ notify: false });
    expect(() => reportBpmnImport(std, report())).not.toThrow();
  });
});

/* ── The command, end to end (minus the dialog) ───────────────────────── */

describe('running the import command', () => {
  it('reads the file, draws it, brings it into view and reports', async () => {
    const { std, surface, notify, setViewportByBound, setTool, captureSync } =
      stubEditor();
    picked.file.mockResolvedValue(
      asFile(exportBpmnXml(collaborationBoard().board, { name: 'Round' }))
    );

    await importBpmnXmlFile(std);

    // The dialog filter is built from the FORMAT's own declaration, not from a
    // name in the shared `FileTypes` table — which is what lets a framework add
    // a readable format without a second file agreeing to it. `.xml` rides
    // behind `.bpmn` because half the tools in the wild write a process under
    // the generic extension.
    expect(picked.file).toHaveBeenCalledWith({
      description: 'BPMN',
      accept: { 'application/xml': ['.bpmn', '.xml'] },
    });
    expect(surface.added.length).toBeGreaterThan(0);
    expect(surface.added.filter(p => p.type === 'bpmnPool')).toHaveLength(2);
    // One undo step for the whole file: a boundary before the writes and one
    // after, the way a lane gesture takes one step for several pools.
    expect(captureSync).toHaveBeenCalledTimes(2);
    // A board that landed off-screen looks like a command that did nothing.
    expect(setViewportByBound).toHaveBeenCalledTimes(1);
    expect(setTool).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][0].title).toBe('BPMN file imported');
  });

  it('fits the drawing, not the drawing plus the origin', async () => {
    // The regression. A connector's bound is not known on the tick that creates
    // it and reads back as `[0, 0, 0, 0]`, so a common bound that counted it
    // stretched from the origin to the far corner of the process. On a file
    // bpmn.io drew a hundred thousand units out — which is one drag of a whole
    // process across its canvas — the fit was a 100000-wide box and the import
    // landed as a speck nobody could see.
    //
    // The ARGUMENT is what is asserted, not the call: `toHaveBeenCalled` passed
    // happily throughout the bug.
    const { std, surface, setViewportByBound } = stubEditor();
    picked.file.mockResolvedValue(asFile(FAR_FROM_ORIGIN_FILE));

    await importBpmnXmlFile(std);

    // There has to BE a connector, or the test proves nothing.
    expect(
      surface.added.filter(props => props.type === 'connector')
    ).not.toHaveLength(0);

    const [bound] = setViewportByBound.mock.calls[0];
    // Nowhere near the origin, and the size of a process rather than the size
    // of the distance to it.
    expect(bound.x).toBeGreaterThan(99_000);
    expect(bound.y).toBeGreaterThan(99_000);
    expect(bound.w).toBeLessThan(1_000);
    expect(bound.h).toBeLessThan(1_000);
    // …and it still HOLDS the drawing: the far corner of the last shape is
    // inside the box, so nothing was cropped in the course of not including
    // the origin.
    expect(bound.x + bound.w).toBeGreaterThanOrEqual(100_240);
    expect(bound.y + bound.h).toBeGreaterThanOrEqual(100_100);
  });

  it('names what is wrong with a file it cannot read, and draws nothing', async () => {
    const { std, surface, notify } = stubEditor();
    picked.file.mockResolvedValue(asFile('<html><body>not bpmn</body></html>'));

    await importBpmnXmlFile(std);

    expect(surface.added).toEqual([]);
    expect(notify).toHaveBeenCalledTimes(1);
    const failure = notify.mock.calls[0][0];
    expect(failure.title).toBe('This file could not be imported');
    expect(failure.accent).toBe('error');
    // The reader's own sentence, which knows which of the refusals it was —
    // replacing it with a wording of ours would know less.
    expect(failure.message).toContain('definitions');
  });

  it('says nothing when the user closes the picker', async () => {
    const { std, surface, notify } = stubEditor();
    picked.file.mockResolvedValue(null);

    await importBpmnXmlFile(std);

    expect(surface.added).toEqual([]);
    expect(notify).not.toHaveBeenCalled();
  });

  it('never opens a picker on a read-only document', async () => {
    const { std } = stubEditor({ readonly: true });
    await importBpmnXmlFile(std);
    expect(picked.file).not.toHaveBeenCalled();
  });
});

/* ── The other half of the seam: what an export could not write ───────── */

describe('the export warnings reach the user', () => {
  it('raises one notification with the writer’s own lines', () => {
    const { std, notify } = stubEditor();
    // A message flow on a board with no pool: it runs between participants,
    // and there are none, so the writer leaves it out and SAYS so. Populated
    // and tested since #149, and dropped on the floor by the command glue
    // until now (a #159 review nit).
    const { board } = collaborationBoard();
    const orphan = { ...board, pools: [] };

    exportBpmnXmlFile({
      ...std,
      get: () => ({
        surface: { elementModels: [...orphan.nodes, ...orphan.connectors] },
        selection: { selectedElements: [] },
      }),
    } as unknown as BlockStdScope);

    expect(notify).toHaveBeenCalledTimes(1);
    const warning = notify.mock.calls[0][0];
    expect(warning.title).toBe('What this export could not write down');
    expect(warning.accent).toBe('warning');
    expect(warning.message).toContain('message flow');
  });

  it('stays quiet when the board came out whole', () => {
    const { std, notify } = stubEditor();
    const { board } = collaborationBoard();

    exportBpmnXmlFile({
      ...std,
      get: () => ({
        surface: {
          elementModels: [...board.pools, ...board.nodes, ...board.connectors],
        },
        selection: { selectedElements: [] },
      }),
    } as unknown as BlockStdScope);

    expect(notify).not.toHaveBeenCalled();
  });
});
