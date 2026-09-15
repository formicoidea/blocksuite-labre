import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ConnectorElementModel } from '@labre/affine-model';
import { NotificationProvider } from '@labre/affine-shared/services';
import { Bound } from '@labre/global/gfx';
import { type BlockStdScope, isCommandAvailable } from '@labre/std';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  importUmlDrawioFile,
  importUmlPlantumlFile,
  importUmlXmiFile,
} from '../actions';
import { umlCommands } from '../commands';

/**
 * The three import COMMANDS — the half of `docs/adr/0012` that has an editor in
 * it (`docs/adr/0019`).
 *
 * The three readers are pure and are proved pure next door
 * (`plantuml-import.unit.spec.ts`, `xmi-import.unit.spec.ts`,
 * `drawio-import.unit.spec.ts`). What is proved HERE is everything a reader
 * deliberately refuses to do: pick a file, decode a container that is not the
 * document, mint surface ids, rewrite the ends that named the file's, bring the
 * result into view, and say what it cost.
 *
 * The picker is mocked and nothing else is: `openSingleFileWithSpec` is a
 * browser dialog and there is no version of it that answers in a unit suite.
 * The capabilities, the readers, the materializer, the generic pipeline the
 * three commands delegate to (`affine-block-surface`,
 * `extensions/interchange-import.ts`) and the notification seam are the shipped
 * ones. The draw.io DECODER is shipped too, which is the point of running the
 * compressed corpus through this rather than the decoded one.
 */

const picked = vi.hoisted(() => ({ file: vi.fn() }));

vi.mock('@labre/affine-shared/utils', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@labre/affine-shared/utils')>();
  return { ...actual, openSingleFileWithSpec: picked.file };
});

/* ── The corpus ───────────────────────────────────────────────────────── */

const HERE = dirname(fileURLToPath(import.meta.url));
const corpus = (name: string) =>
  readFileSync(join(HERE, 'corpus', name), 'utf8');

/** draw.io's own UML class example, exactly as draw.io writes it: compressed. */
const DRAWIO = corpus('drawio-class-iwlayer.drawio.xml');
/** A file this library wrote — the phase-1 export, re-read. */
const PLANTUML = corpus('labre-phase1-export.puml');
const XMI = corpus('labre-phase1-export.xmi');

/* ── The stubs ────────────────────────────────────────────────────────── */

type Props = Record<string, unknown> & { type: string };

/**
 * A surface that mints ids and hands models back — the two halves of
 * `addElement` the id remapping depends on.
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
        role: { value: props.role, enumerable: true },
        // `[0, 0, 0, 0]` and it is the POINT: a connector's bound comes off a
        // path routed on a later tick than the `addElement` that made it.
        elementBound: { value: new Bound(0, 0, 0, 0) },
        source: { value: props.source, writable: true, enumerable: true },
        target: { value: props.target, writable: true, enumerable: true },
      });
      this.models.set(id, connector);
    } else {
      const bound = Bound.deserialize(String(props.xywh ?? '[0,0,10,10]'));
      this.models.set(id, { ...props, id, elementBound: bound });
    }
    return id;
  }

  getElementById(id: string): unknown {
    return this.models.get(id);
  }

  /**
   * What is already drawn — read by the pipeline to land an import BESIDE an
   * existing board rather than on top of it.
   *
   * Empty on the first import, which is every case in this file, so nothing
   * here moves: the offset is computed once before the writes, and a surface
   * with nothing on it keeps the file's own coordinates. Present all the same,
   * because a real surface answers it and a stub that did not made the shipped
   * function throw.
   */
  get elementModels(): unknown[] {
    return [...this.models.values()];
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
    // seam through the same door.
    getOptional: (identifier: unknown) =>
      identifier === NotificationProvider && options.notify !== false
        ? { notify }
        : undefined,
    store: {
      readonly: options.readonly === true,
      captureSync,
      id: 'doc-1',
      workspace: { meta: { getDocMeta: () => ({ title: 'Domain' }) } },
    },
  } as unknown as BlockStdScope;

  return { std, surface, notify, setViewportByBound, setTool, captureSync };
}

const asFile = (text: string, name: string) =>
  ({ name, text: () => Promise.resolve(text) }) as unknown as File;

beforeEach(() => {
  picked.file.mockReset();
  vi.restoreAllMocks();
});

const descriptor = (id: string) =>
  umlCommands.find(command => command.id === id);

/* ── The descriptors ──────────────────────────────────────────────────── */

describe('the three import commands', () => {
  it('declare themselves as document-level actions that need no selection', () => {
    for (const id of [
      'uml.importXmi',
      'uml.importPlantuml',
      'uml.importDrawio',
    ]) {
      const command = descriptor(id);
      expect(command, id).toBeDefined();
      expect(command!.kind, id).toBe('action');
      expect(command!.owner, id).toBe('uml');
      expect(command!.scope, id).toBe('edgeless');
      // Filed with the exports they are the other half of: the two directions
      // of one format are one subject, and `diagrams` is the section the frame
      // and its files already share in this pack.
      expect(command!.category, id).toBe('diagrams');
      // Nothing has to be SELECTED — the mirror image of the exports, which are
      // `'selection'` — and there is no `when` to narrow it. It WRITES, so a
      // read-only document is one it cannot run on and the declaration says so
      // rather than lighting a clickable no-op.
      expect(command!.availability, id).toBe('editable');
      expect(command!.when, id).toBeUndefined();
      expect(command!.defaultKeys, id).toEqual({ mac: [], other: [] });
    }
  });

  it('carry a label, a description and an icon through the i18n seam', () => {
    expect(descriptor('uml.importXmi')).toMatchObject({
      labelKey: 'com.labre.commands.uml.importXmi',
      labelFallback: 'Import XMI',
      descriptionKey: 'com.labre.commands.uml.importXmi.description',
      iconKey: 'uml.import-xmi',
      telemetry: { framework: 'uml', element: 'board:import-xmi' },
    });
    expect(descriptor('uml.importPlantuml')).toMatchObject({
      iconKey: 'uml.import-plantuml',
      telemetry: { framework: 'uml', element: 'board:import-plantuml' },
    });
    expect(descriptor('uml.importDrawio')).toMatchObject({
      iconKey: 'uml.import-drawio',
      telemetry: { framework: 'uml', element: 'board:import-drawio' },
    });
    for (const id of [
      'uml.importXmi',
      'uml.importPlantuml',
      'uml.importDrawio',
    ]) {
      expect(descriptor(id)!.descriptionFallback, id).toBeTruthy();
    }
  });

  it('nominates ONE of the three, and it is XMI', () => {
    // R5 puts an import in the senior sub-menu, and the budget is
    // `SENIOR_MENU_CAP` nominations plus the single over-nomination the PO
    // authorized on 2026-08-28 — which BPMN has spent. So exactly one of the
    // three takes a seat: XMI, the OMG's own interchange format and the one
    // that re-reads what this pack exports.
    expect(descriptor('uml.importXmi')!.surfaces).toEqual([
      'senior-menu',
      'catalogue',
      'palette',
      'agent',
    ]);
    for (const id of ['uml.importPlantuml', 'uml.importDrawio']) {
      expect(descriptor(id)!.surfaces, id).toEqual([
        'catalogue',
        'palette',
        'agent',
      ]);
    }
  });

  it('keeps the pack at exactly SENIOR_MENU_CAP nominations, note demoted', () => {
    const nominated = umlCommands.filter(command =>
      command.surfaces.includes('senior-menu')
    );
    expect(nominated).toHaveLength(14);
    // The seat `uml.importXmi` took. Still in the catalogue, one click away
    // behind "More artefacts…" — a demotion, never a removal.
    expect(nominated.map(command => command.id)).not.toContain('uml.addNote');
    expect(descriptor('uml.addNote')!.surfaces).toEqual([
      'catalogue',
      'palette',
      'agent',
    ]);
  });

  it('withdraws from every surface on a read-only document', () => {
    for (const id of [
      'uml.importXmi',
      'uml.importPlantuml',
      'uml.importDrawio',
    ]) {
      expect(isCommandAvailable(stubEditor().std, descriptor(id)!), id).toBe(
        true
      );
      expect(
        isCommandAvailable(stubEditor({ readonly: true }).std, descriptor(id)!),
        id
      ).toBe(false);
    }
  });
});

/* ── The draw.io command, end to end (minus the dialog) ───────────────── */

describe('running the draw.io import', () => {
  it('offers the picker the filter the FORMAT declares', async () => {
    const { std } = stubEditor();
    picked.file.mockResolvedValue(asFile(DRAWIO, 'iwlayer.drawio'));

    await importUmlDrawioFile(std);

    expect(picked.file).toHaveBeenCalledWith({
      description: 'DRAWIO',
      accept: { 'application/xml': ['.drawio', '.drawio.xml', '.xml'] },
    });
  });

  it('inflates the container, draws the diagram, and brings it into view', async () => {
    const { std, surface, notify, setViewportByBound, setTool, captureSync } =
      stubEditor();
    // The COMPRESSED file, which is what draw.io writes and what a user picks.
    // A reader is pure and cannot inflate it (`docs/adr/0019`), so this only
    // passes if the command's `decode` hook ran.
    picked.file.mockResolvedValue(asFile(DRAWIO, 'iwlayer.drawio'));

    await importUmlDrawioFile(std);

    // Eight classes, each a shape plus its three compartment texts inside a
    // group, and the seven relationships between them.
    expect(surface.added.filter(props => props.type === 'group')).toHaveLength(
      8
    );
    expect(
      surface.added.filter(props => props.type === 'umlDiagram')
    ).toHaveLength(1);
    expect(
      surface.added.filter(props => props.type === 'connector')
    ).toHaveLength(7);
    // One undo step for the whole file: a boundary before the writes and one
    // after.
    expect(captureSync).toHaveBeenCalledTimes(2);
    // A board that landed off-screen looks like a command that did nothing.
    expect(setViewportByBound).toHaveBeenCalledTimes(1);
    expect(setTool).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][0].title).toBe('DRAWIO file imported');
  });

  it('rewrites every connector end onto an id the surface minted', async () => {
    const { std, surface } = stubEditor();
    picked.file.mockResolvedValue(asFile(DRAWIO, 'iwlayer.drawio'));

    await importUmlDrawioFile(std);

    // Read back off the models the surface handed out, which is where the
    // second pass wrote — not off the props, which still name what the reader
    // said.
    const minted = surface.added.map((_, index) => `minted-${index + 1}`);
    const connectors = minted
      .map(id => surface.getElementById(id))
      .filter(
        (model): model is ConnectorElementModel =>
          model instanceof ConnectorElementModel
      );
    expect(connectors).toHaveLength(7);

    for (const connector of connectors) {
      for (const side of ['source', 'target'] as const) {
        // A MINTED id, never the reader's provisional `uml-import-N` name and
        // never the file's `47`.
        expect(minted).toContain(connector[side]?.id);
      }
    }
  });

  it('names what is wrong with a container it cannot open, and draws nothing', async () => {
    const { std, surface, notify } = stubEditor();
    picked.file.mockResolvedValue(
      asFile('<mxfile><diagram id="x"></diagram></mxfile>', 'empty.drawio')
    );

    await importUmlDrawioFile(std);

    expect(surface.added).toEqual([]);
    expect(notify).toHaveBeenCalledTimes(1);
    const failure = notify.mock.calls[0][0];
    expect(failure.title).toBe('This file could not be imported');
    expect(failure.accent).toBe('error');
    // The decoder's own sentence: "this file could not be inflated" and "this
    // is not a UML document" are the same event to whoever picked the file.
    expect(failure.message).toContain('<diagram>');
  });

  it('says nothing when the user closes the picker', async () => {
    const { std, surface, notify } = stubEditor();
    picked.file.mockResolvedValue(null);

    await importUmlDrawioFile(std);

    expect(surface.added).toEqual([]);
    expect(notify).not.toHaveBeenCalled();
  });

  it('never opens a picker on a read-only document', async () => {
    const { std } = stubEditor({ readonly: true });
    await importUmlDrawioFile(std);
    expect(picked.file).not.toHaveBeenCalled();
  });
});

/* ── The two semantic commands ────────────────────────────────────────── */

describe('running the PlantUML and XMI imports', () => {
  it('reads back a PlantUML source this library wrote', async () => {
    const { std, surface, notify } = stubEditor();
    picked.file.mockResolvedValue(asFile(PLANTUML, 'domain.puml'));

    await importUmlPlantumlFile(std);

    expect(picked.file).toHaveBeenCalledWith({
      description: 'PLANTUML',
      accept: { 'text/plain': ['.puml', '.plantuml'] },
    });
    expect(
      surface.added.filter(props => props.type === 'umlDiagram').length
    ).toBeGreaterThan(0);
    expect(
      surface.added.filter(props => props.type === 'group').length
    ).toBeGreaterThan(0);
    expect(notify.mock.calls[0][0].title).toBe('PLANTUML file imported');
  });

  it('reads back an XMI document this library wrote', async () => {
    const { std, surface, notify } = stubEditor();
    picked.file.mockResolvedValue(asFile(XMI, 'domain.xmi'));

    await importUmlXmiFile(std);

    expect(picked.file).toHaveBeenCalledWith({
      description: 'XMI',
      accept: { 'application/xml': ['.xmi', '.uml'] },
    });
    expect(
      surface.added.filter(props => props.type === 'umlDiagram').length
    ).toBeGreaterThan(0);
    expect(notify.mock.calls[0][0].title).toBe('XMI file imported');
  });

  it('degrades to silence when the host injected no notification service', async () => {
    // The standalone playground, which registers no `NotificationProvider`.
    const { std, surface } = stubEditor({ notify: false });
    picked.file.mockResolvedValue(asFile(PLANTUML, 'domain.puml'));

    await expect(importUmlPlantumlFile(std)).resolves.toBeUndefined();
    expect(surface.added.length).toBeGreaterThan(0);
  });
});
