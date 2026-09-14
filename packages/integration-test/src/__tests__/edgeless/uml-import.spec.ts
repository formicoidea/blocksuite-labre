import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { importInterchangeFile } from '@labre/affine/blocks/surface';
import {
  decodeDrawio,
  UML_DRAWIO_IMPORT,
  UML_PLANTUML_IMPORT,
  UML_ROLE,
} from '@labre/affine-gfx-uml';
import {
  ConnectorElementModel,
  GroupElementModel,
  UmlNodeElementModel,
} from '@labre/affine/model';
import { getRegisteredCommands, isCommandAvailable } from '@labre/affine/std';
import { beforeEach, describe, expect, test } from 'vitest';

// The corpus, as a string: a browser-mode spec has no `node:fs`, and the unit
// suites next door read the SAME files with `readFileSync`. One corpus, two
// runtimes, no second copy to keep in step.
import DRAWIO_COMPRESSED from '../../../../affine/gfx/uml/src/__tests__/corpus/drawio-class-iwlayer.drawio.xml?raw';
import PLANTUML from '../../../../affine/gfx/uml/src/__tests__/corpus/labre-phase1-export.puml?raw';
import { wait } from '../utils/common.js';
import { getDocRootBlock, getSurface } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * The three UML imports, against a REAL store (`docs/adr/0019`).
 *
 * The unit suites own each reader and the command glue around it. What only a
 * live editor can answer is whether a file becomes a BOARD: whether the props a
 * pure function returned survive `addElement` and come back as element models
 * with their `Y.Text` labels, whether the connector endpoints land on the ids
 * the surface minted rather than the ones the file named, and whether a group
 * imported as a classifier is the same kind of group `uml.addClass` draws.
 *
 * The one step that cannot run here is the file DIALOG — no test drives an OS
 * picker — so what is proved is everything on either side of it, exactly as
 * `bpmn.spec.ts` does: the commands are registered and reachable with an empty
 * selection, and the SHIPPED pipeline (`importInterchangeFile`, with the
 * shipped `decodeDrawio` on its `decode` hook) puts a foreign file on a live
 * surface. The dialog itself, and the branches around it, are
 * `import-command.unit.spec.ts`'s.
 *
 * The draw.io file is the COMPRESSED one — the bytes draw.io writes — because
 * the split ADR 0019 is about only shows up when something actually inflates.
 */
describe('a UML file becomes a board', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    return cleanup;
  });

  const asFile = (text: string, name: string) =>
    ({ name, text: () => Promise.resolve(text) }) as unknown as File;

  const surfaceModel = () => getSurface(window.doc, window.editor).model;

  const elementsOf = () => surfaceModel().elementModels;

  const groups = () =>
    elementsOf().filter(
      (model): model is GroupElementModel => model instanceof GroupElementModel
    );

  const connectorsBy = (role: string) =>
    elementsOf().filter(
      (model): model is ConnectorElementModel =>
        model instanceof ConnectorElementModel && model.role === role
    );

  /* ── The declarations ───────────────────────────────────────────────── */

  test('the three imports are registered, and need no selection', () => {
    const registered = getRegisteredCommands(edgeless.std);
    edgeless.gfx.selection.clear();

    for (const id of [
      'uml.importXmi',
      'uml.importPlantuml',
      'uml.importDrawio',
    ]) {
      const command = registered.find(entry => entry.id === id);
      expect(command, `${id} is not registered`).toBeDefined();
      // The mirror image of the exports' guard: nothing selected is exactly
      // when an import is wanted. It still declares a precondition, and it is
      // the honest one — an import WRITES.
      expect(command!.availability, id).toBe('editable');
      expect(command!.when, id).toBeUndefined();
      expect(isCommandAvailable(edgeless.std, command!), id).toBe(true);
    }
  });

  test('the sub-menu seat went to XMI, and the note stood down for it', () => {
    const registered = getRegisteredCommands(edgeless.std).filter(
      command => command.owner === 'uml'
    );
    const nominated = registered
      .filter(command => command.surfaces.includes('senior-menu'))
      .map(command => command.id);

    expect(nominated).toContain('uml.importXmi');
    expect(nominated).not.toContain('uml.importPlantuml');
    expect(nominated).not.toContain('uml.importDrawio');
    // The trade ADR 0019 §7 records, seen from the registry a surface actually
    // renders from — and the budget it had to stay inside.
    expect(nominated).not.toContain('uml.addNote');
    expect(nominated).toHaveLength(14);
    // Demoted, never removed: still reachable behind "More artefacts…".
    expect(
      registered.find(command => command.id === 'uml.addNote')!.surfaces
    ).toContain('catalogue');
  });

  /* ── draw.io, end to end ────────────────────────────────────────────── */

  test('draw.io’s own UML class example lands on the surface as UML', async () => {
    await importInterchangeFile(
      edgeless.std,
      UML_DRAWIO_IMPORT,
      asFile(DRAWIO_COMPRESSED, 'iwlayer.drawio'),
      { decode: decodeDrawio }
    );
    await wait(200);

    // One sheet for one drawing (ADR 0017).
    const frames = elementsOf().filter(model => model.type === 'umlDiagram');
    expect(frames).toHaveLength(1);
    expect((frames[0] as { kind?: string }).kind).toBe('class');

    // Eight classifiers, each a shape and its compartments inside one group —
    // the same shape `uml.addClass` draws, which is what makes an imported box
    // editable rather than a picture of one.
    expect(groups()).toHaveLength(8);
    const nodes = elementsOf().filter(
      (model): model is UmlNodeElementModel =>
        model instanceof UmlNodeElementModel
    );
    expect(nodes).toHaveLength(8);
    expect(new Set(nodes.map(node => node.kind))).toEqual(new Set(['class']));

    // The compartments, read off a real `Y.Text` written by the store.
    const names = elementsOf()
      .filter(model => (model as { role?: string }).role === UML_ROLE.name)
      .map(model => String((model as { text?: unknown }).text));
    expect(names).toContain('IWLayerInfoEvent');
    expect(names).toContain('IWLayerInterface');
    const attributes = elementsOf()
      .filter(
        model => (model as { role?: string }).role === UML_ROLE.attributes
      )
      .map(model => String((model as { text?: unknown }).text));
    expect(attributes.join('\n')).toContain('+requestedEvent : String');

    // The relationships, by the role each connector carries — which is what the
    // renderer paints the arrowhead from and what the exporter reads back.
    expect(connectorsBy(UML_ROLE.aggregation)).toHaveLength(4);
    expect(connectorsBy(UML_ROLE.dependency)).toHaveLength(2);
    expect(connectorsBy(UML_ROLE.generalization)).toHaveLength(1);
  });

  test('every imported connector ends on an element this surface holds', async () => {
    await importInterchangeFile(
      edgeless.std,
      UML_DRAWIO_IMPORT,
      asFile(DRAWIO_COMPRESSED, 'iwlayer.drawio'),
      { decode: decodeDrawio }
    );
    await wait(200);

    const surface = surfaceModel();
    const connectors = elementsOf().filter(
      (model): model is ConnectorElementModel =>
        model instanceof ConnectorElementModel
    );
    expect(connectors).toHaveLength(7);

    for (const connector of connectors) {
      for (const side of ['source', 'target'] as const) {
        const id = connector[side]?.id;
        expect(id, `${connector.role} ${side}`).toBeTruthy();
        // A MINTED id: the file said `47`, the reader said `uml-import-12`, and
        // what the document holds is neither (`docs/adr/0012` D3).
        expect(
          surface.getElementById(id!),
          `${connector.role} ${side}`
        ).toBeTruthy();
      }
    }
  });

  test('the whole drawing lands on the sheet it was drawn on', async () => {
    await importInterchangeFile(
      edgeless.std,
      UML_DRAWIO_IMPORT,
      asFile(DRAWIO_COMPRESSED, 'iwlayer.drawio'),
      { decode: decodeDrawio }
    );
    await wait(200);

    const frame = elementsOf().find(model => model.type === 'umlDiagram')!;
    const sheet = frame.elementBound;
    // Every classifier's centre inside the frame, which is the ONE property the
    // exporter's attribution depends on: a box outside it would export nowhere
    // and read back as a class nobody drew.
    for (const group of groups()) {
      const box = group.elementBound;
      expect(box.x + box.w / 2).toBeGreaterThan(sheet.x);
      expect(box.x + box.w / 2).toBeLessThan(sheet.x + sheet.w);
      expect(box.y + box.h / 2).toBeGreaterThan(sheet.y);
      expect(box.y + box.h / 2).toBeLessThan(sheet.y + sheet.h);
    }
  });

  /* ── PlantUML, the semantic tier ────────────────────────────────────── */

  test('a PlantUML source this library wrote comes back as a diagram', async () => {
    await importInterchangeFile(
      edgeless.std,
      UML_PLANTUML_IMPORT,
      asFile(PLANTUML, 'domain.puml'),
      {}
    );
    await wait(200);

    expect(
      elementsOf().filter(model => model.type === 'umlDiagram').length
    ).toBeGreaterThan(0);
    expect(groups().length).toBeGreaterThan(0);
    // PlantUML carries no coordinates, so the layout is ours — and it is a
    // layout, not a pile: no two classifiers share a top-left corner.
    const corners = groups().map(
      group => `${group.elementBound.x},${group.elementBound.y}`
    );
    expect(new Set(corners).size).toBe(corners.length);
  });
});
