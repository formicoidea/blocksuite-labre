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
import { COMMAND_USAGE_KEY } from '@labre/affine/shared/services';
import {
  type AnyCommandDescriptor,
  getCommandsForSurface,
  getRegisteredCommands,
  isCommandAvailable,
  SENIOR_MENU_RANKED_SLOTS,
} from '@labre/affine/std';
import { edgelessToolbarSlotsContext } from '@labre/affine/widgets/edgeless-toolbar';
import { ContextProvider } from '@lit/context';
import { Subject } from 'rxjs';
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
    // One generalization, painted with the role the renderer draws a hollow
    // triangle from — even though the FILE draws a filled one: this 2013 file
    // writes `endArrow=block` with no `endFill`, and `block` is the UML
    // stencil's head, so the relationship is read and the drawing is what the
    // report remarks on (ADR 0019 §2).
    expect(connectorsBy(UML_ROLE.generalization)).toHaveLength(1);
    expect(connectorsBy(UML_ROLE.association)).toHaveLength(0);
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

/**
 * The UML sub-menu popover. Not exported by the framework package — it is a
 * custom element `effects()` registers — so it is reached the way the senior
 * button reaches it, by tag name (`bpmn.spec.ts` does the same).
 */
type UmlMenuElement = HTMLElement & {
  edgeless: EdgelessRootBlockComponent;
  updateComplete: Promise<unknown>;
  requestUpdate: () => void;
  /** `EdgelessCommandMenu`'s own selection — what `render()` maps to buttons. */
  commands: AnyCommandDescriptor[];
};

/**
 * The RENDERED row, which is the only surface on which "nominated" means
 * anything (recette blocker G-1).
 *
 * `SENIOR_MENU_CAP` is 14 and is what an owner may nominate;
 * `SENIOR_MENU_RANKED_SLOTS` is 13 and is what an overflowed popover paints,
 * beside the permanent "More artefacts…" button. UML nominates exactly
 * fourteen, so one of them is invisible at cold start — and which one that is
 * is a product decision a unit test on a declaration cannot see. Since the PO's
 * recette of 2026-09-14 it is `uml.importXmi`: the same `order` field feeds the
 * sub-menu and the catalogue, and the seat it held cost the catalogue its
 * first section (O7). ADR 0014 § R3 is the rule that settles it — a cold row of
 * drawing tools, an import that surfaces through use.
 *
 * So this mounts the real popover twice: once with the usage store cleared,
 * which is a first contact, and once with a single import recorded, which is
 * what the nomination is FOR.
 */
describe('the UML sub-menu seats the import', () => {
  let edgeless!: EdgelessRootBlockComponent;
  let menu!: UmlMenuElement;
  let menuHost!: HTMLElement;

  beforeEach(async () => {
    // The usage measure is what the ranking reads and it persists across tests
    // in a file. Start from silence, so the row is the cold-start thirteen
    // rather than whatever an earlier scenario happened to click.
    localStorage.removeItem(COMMAND_USAGE_KEY);
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');

    // Mounted the way the senior button mounts it. Its inner slide menu
    // consumes the toolbar's resize slot through Lit context, which a
    // standalone mount has to provide.
    menu = document.createElement(
      'edgeless-uml-menu'
    ) as unknown as UmlMenuElement;
    menu.edgeless = edgeless;
    menuHost = document.createElement('div');
    new ContextProvider(menuHost, {
      context: edgelessToolbarSlotsContext,
      initialValue: { resize: new Subject<{ w: number; h: number }>() },
    });
    menuHost.append(menu);
    document.body.append(menuHost);
    await menu.updateComplete;
    await wait(0);

    return () => {
      menuHost.remove();
      cleanup();
    };
  });

  const buttons = () =>
    Array.from(
      menu.shadowRoot?.querySelectorAll<HTMLElement>(
        'edgeless-tool-icon-button'
      ) ?? []
    );

  test('overflows to thirteen ranked slots plus More artefacts', () => {
    expect(
      getCommandsForSurface(edgeless.std, 'uml', 'senior-menu')
    ).toHaveLength(14);
    expect(buttons()).toHaveLength(SENIOR_MENU_RANKED_SLOTS + 1);
  });

  test('the thirteen a first-time user meets are the drawing tools', () => {
    const ids = menu.commands.map(command => command.id);

    expect(ids).toHaveLength(SENIOR_MENU_RANKED_SLOTS);
    // Membership is what the ranking decides; POSITION is always the authored
    // order, so the row does not reshuffle under the cursor.
    expect(ids).toEqual([
      'uml.addDiagram',
      'uml.addClass',
      'uml.addInterface',
      'uml.addEnumeration',
      'uml.addPackage',
      'uml.addActor',
      'uml.addUseCase',
      'uml.addSubject',
      'uml.associationTool',
      'uml.generalizationTool',
      'uml.dependencyTool',
      'uml.includeTool',
      'uml.extendTool',
    ]);
    // The fourteenth nomination waits its turn, and since tranche J that is the
    // XMI import rather than the extend tool. The trade is the PO's recette of
    // 2026-09-14 (O7): one `order` serves the sub-menu AND the catalogue, and
    // the second seat this command held put it — with the four interchange
    // commands beside it — in the catalogue's first section, above every
    // artefact UML draws. ADR 0014 § R3 says which reading wins: "the
    // cold-start row favours drawing tools; import buttons surface through
    // use". The next test is the "through use" half.
    expect(ids).not.toContain('uml.importXmi');
  });

  /**
   * The nomination is not decoration: it is what lets usage seat the command.
   *
   * Exactly BPMN's test, on UML's import — an export declines the row and can
   * never be voted in, a nominated import is one use away from it. Without this
   * the fourteenth nomination would be a declaration nothing could ever
   * exercise, which is the objection tranche G raised and this pair answers.
   */
  test('one import seats it, and no number of exports seats an export', async () => {
    const exportCommand = getCommandsForSurface(
      edgeless.std,
      'uml',
      'catalogue'
    ).find(command => command.id === 'uml.exportXmi')!;
    expect(exportCommand.surfaces).not.toContain('senior-menu');

    localStorage.setItem(
      COMMAND_USAGE_KEY,
      JSON.stringify({
        'uml.exportXmi': { c: 100, t: Date.now() },
        'uml.importXmi': { c: 1, t: Date.now() },
      })
    );
    menu.requestUpdate();
    await menu.updateComplete;
    await wait(0);

    const ids = menu.commands.map(command => command.id);
    expect(ids).toContain('uml.importXmi');
    expect(ids).not.toContain('uml.exportXmi');
    // …and it lands in AUTHORED order, which is last: the row is re-sorted
    // after the ranking, so nothing a user reached for jumps to the front.
    expect(ids.at(-1)).toBe('uml.importXmi');
    expect(ids).toHaveLength(SENIOR_MENU_RANKED_SLOTS);
  });
});
