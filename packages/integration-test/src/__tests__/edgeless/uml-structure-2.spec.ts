import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import {
  applyMorph,
  ElementRendererIdentifier,
} from '@labre/affine/blocks/surface';
import type { ConnectorTool } from '@labre/affine/gfx/connector';
// Straight off the framework package, as the bpmn, wardley and c4 specs already
// reach for theirs: `@labre/affine` re-exports the blocks, not the framework
// modules.
import {
  UML_DIAGRAM_KIND_MENU,
  UML_MORPH_SPEC,
  UML_NAME_SEED,
  UML_ROLE,
  umlNodeOfGroup,
} from '@labre/affine-gfx-uml';
import {
  type ConnectorElementModel,
  GroupElementModel,
  PointStyle,
  StrokeStyle,
  TextElementModel,
  type UmlDiagramElementModel,
  UmlNodeElementModel,
} from '@labre/affine/model';
import { ToolbarContext } from '@labre/affine/shared/services';
import { getRegisteredCommands, runCommand } from '@labre/affine/std';
import { SeniorToolIdentifier } from '@labre/affine/widgets/edgeless-toolbar';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock, getSurface } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * UML phase 2 — components and deployment — on a REAL editor.
 *
 * `uml.spec.ts` owns the phase-1 gestures (the frame, a classifier, the heading
 * band under a real pointer) and this file owns the ones phase 2 added, on the
 * same harness. The unit suites already prove each half in isolation: what the
 * creation walk writes (`gfx/uml/src/__tests__/actions`), which kinds are
 * reachable from which (`morph`), what the eleven commands declare
 * (`affine/all`). What only a live editor can answer is whether the pieces MEET:
 *
 *  - that a command registered behind the flag draws the elements the palette
 *    recorded, for the eight artefacts that are not on the senior row and are
 *    therefore reached only through the catalogue;
 *  - that a `«deploy»` line armed from that catalogue is born wearing §19.2.4's
 *    drawing, through the tool rather than through the last-props store;
 *  - that morphing a node into a device rewrites the words INSIDE the cube, in
 *    the same transaction as the kind;
 *  - and ADR 0009's half that matters most on an append-only phase: a stored
 *    deployment diagram still paints with the tooling switched off.
 */
describe('the UML phase-2 toolbox draws what it declares', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    return cleanup;
  });

  /**
   * Run one registered command.
   *
   * `'catalogue'` rather than `'senior-menu'`, and it is the point: every phase-2
   * command declines the senior row (`gfx/uml/src/commands.ts`), so the catalogue
   * is the surface a user actually reaches them through — and the registry's
   * invariant is that it is the TOTAL one.
   */
  const run = async (commandId: string) => {
    const command = getRegisteredCommands(edgeless.std).find(
      c => c.id === commandId
    );
    expect(command, commandId).toBeDefined();
    runCommand(edgeless.std, command!, {
      surface: 'catalogue',
      source: 'toolbar:general',
    });
    await wait();
  };

  const surfaceModel = () => getSurface(window.doc, window.editor).model;

  /** The last group the surface gained — the artefact just drawn. */
  const lastGroup = () => {
    const groups = surfaceModel().elementModels.filter(
      (model): model is GroupElementModel => model instanceof GroupElementModel
    );
    return groups[groups.length - 1];
  };

  /** Draw one artefact and hand back the group and the shape inside it. */
  const draw = async (commandId: string) => {
    await run(commandId);
    const group = lastGroup();
    const node = umlNodeOfGroup(group);
    expect(node, commandId).toBeDefined();
    return { group, node: node as UmlNodeElementModel };
  };

  /** One tier of an artefact, by the role it carries. */
  const tierOf = (group: GroupElementModel, role: string) =>
    group.childElements.find(
      (child): child is TextElementModel =>
        child instanceof TextElementModel && child.role === role
    );

  const lastDiagram = () => {
    const frames = surfaceModel().elementModels.filter(
      (model): model is UmlDiagramElementModel => model.type === 'umlDiagram'
    );
    return frames[frames.length - 1];
  };

  /* ── The sheet a component diagram is drawn on ───────────────────────── */

  test('the kind picker offers cmp and dep, and the heading says so', async () => {
    // The picker is DATA (`kinds.ts`), and the two entries phase 2 appended are
    // Annex A frame kinds with Annex A's own abbreviations. Asserted against the
    // shipped table rather than against a literal, so a renamed option fails
    // here rather than in a screenshot.
    const kinds = UML_DIAGRAM_KIND_MENU.options.map(option => option.kind);
    expect(kinds).toContain('cmp');
    expect(kinds).toContain('dep');

    await run('uml.addDiagram');
    const diagram = lastDiagram();
    expect(diagram.kind).toBe('class');

    // What the picker writes: ONE field. Annex A's heading is `<kind> <name>`,
    // so switching the kind rewrites the tag rather than adding a second one,
    // and the author's own name is untouched.
    const name = diagram.name;
    diagram.kind = 'cmp';
    await wait();
    expect(diagram.heading).toBe(`cmp ${name}`);

    diagram.kind = 'dep';
    await wait();
    expect(diagram.heading).toBe(`dep ${name}`);
  });

  /* ── A component, its port and the interface it offers ───────────────── */

  test('addComponent draws the classifier box with its ONE body tier', async () => {
    await run('uml.addDiagram');
    const diagram = lastDiagram();
    diagram.kind = 'cmp';
    await wait();

    const { group, node } = await draw('uml.addComponent');
    expect(node.kind).toBe('component');
    expect(node.role).toBe(UML_ROLE.component);

    // §11.6.4 draws a component as a name over ONE body compartment, the two-tab
    // icon in the corner doing the work a keyword does elsewhere — so it is four
    // elements, not the class's five.
    expect(group.childElements).toHaveLength(3);
    const texts = group.childElements.filter(
      (child): child is TextElementModel => child instanceof TextElementModel
    );
    expect(texts.map(text => text.role).sort()).toEqual(
      [UML_ROLE.name, UML_ROLE.attributes].sort()
    );
    expect(tierOf(group, UML_ROLE.name)!.text.toString()).toBe(
      UML_NAME_SEED.component
    );

    // The sheet stays UNDER what is drawn on it.
    expect(
      diagram.index < group.index,
      `${diagram.index} < ${group.index}`
    ).toBe(true);
  });

  test('a port and a lollipop are a shape and ONE label, and nothing else', async () => {
    const port = await draw('uml.addPort');
    expect(port.node.kind).toBe('port');
    // A 16-unit square has no inside to write in (§11.3.4), so its word is a
    // `uml:label` placed beside it — the one tier in the pack that makes the
    // GROUP bigger than the shape it belongs to.
    expect(port.group.childElements).toHaveLength(2);
    expect(tierOf(port.group, UML_ROLE.label)).toBeDefined();
    expect(tierOf(port.group, UML_ROLE.name)).toBeUndefined();

    const provided = await draw('uml.addProvidedInterface');
    expect(provided.node.kind).toBe('provided-interface');
    expect(provided.node.role).toBe(UML_ROLE['provided-interface']);
    expect(provided.group.childElements).toHaveLength(2);
    expect(tierOf(provided.group, UML_ROLE.label)!.text.toString()).toBe(
      UML_NAME_SEED['provided-interface']
    );
    // A ball is drawn by its GLYPH, never by the shape layer: the body and the
    // outline are painted by the renderer, reading the colours off the model.
    expect(provided.node.strokeStyle).toBe(StrokeStyle.None);
    expect(provided.node.filled).toBe(false);
    // R16 everywhere, whatever the picture: no words ON a shape.
    expect(provided.node.text).toBeUndefined();
  });

  /* ── A node, the artifact on it, and the line between them ───────────── */

  test('a deploy connector is born wearing §19.2.4 drawing', async () => {
    await run('uml.addDiagram');
    const diagram = lastDiagram();
    diagram.kind = 'dep';
    await wait();

    const node = await draw('uml.addNode');
    expect(node.node.kind).toBe('node');
    const artifact = await draw('uml.addArtifact');
    expect(artifact.node.kind).toBe('artifact');
    // §19.3.4 seeds a file name under the keyword that says it is one.
    expect(tierOf(artifact.group, UML_ROLE.name)!.text.toString()).toBe(
      UML_NAME_SEED.artifact
    );

    await run('uml.deployTool');
    // The look rides on the TOOL and never through `EditPropsStore` (#144 M1):
    // `connector-style-scope.spec.ts` owns the other half of that contract.
    const armed = edgeless.gfx.tool.currentTool$.peek() as ConnectorTool;
    const style = armed.activatedOption.style ?? {};
    expect(style.strokeStyle).toBe(StrokeStyle.Dash);
    expect(style.frontEndpointStyle).toBe(PointStyle.None);
    expect(style.rearEndpointStyle).toBe(PointStyle.Arrow);
    // A TYPED edge (`docs/adr/0010`): the role travels in the tool's options, so
    // the connector is born with it rather than acquiring one afterwards.
    expect(armed.activatedOption.role).toBe(UML_ROLE.deploy);

    const surface = surfaceModel();
    const id = surface.addElement({
      type: 'connector',
      mode: armed.activatedOption.mode,
      role: armed.activatedOption.role,
      ...style,
      // The artifact is the SOURCE: `uml:deploy` reads "is deployed on".
      source: { id: artifact.node.id, position: [0.5, 0.5] },
      target: { id: node.node.id, position: [0.5, 0.5] },
    });
    await wait(200);

    const edge = surface.getElementById(id) as ConnectorElementModel;
    expect(edge.role).toBe(UML_ROLE.deploy);
    expect(edge.strokeStyle).toBe(StrokeStyle.Dash);
    expect(edge.rearEndpointStyle).toBe(PointStyle.Arrow);
    expect(edge.frontEndpointStyle).toBe(PointStyle.None);
    // …and the line really routes between the two artefacts it was dropped on.
    expect(edge.source.id).toBe(artifact.node.id);
    expect(edge.target.id).toBe(node.node.id);
    expect(edge.path.length).toBeGreaterThan(0);
  });

  /* ── The cube family, retyped ────────────────────────────────────────── */

  test('a node becomes a device, and the keyword lands in the front face', async () => {
    const { group, node } = await draw('uml.addNode');
    const name = tierOf(group, UML_ROLE.name)!;
    expect(name.text.toString()).toBe(UML_NAME_SEED.node);

    // The name a modeller typed, so the case proves the rule and not the seed:
    // the notation's own line follows the shape, and the author's does not.
    window.doc.transact(() => {
      name.text.delete(0, name.text.length);
      name.text.insert(0, ':AppServer');
    });
    await wait();

    const box = group.xywh;
    const shapeBox = node.xywh;
    const nameBox = name.xywh;

    // The selection made the way the real toolbar makes it, so the gesture goes
    // through the same context the dropdown hands `applyMorph`.
    edgeless.gfx.selection.set({ elements: [group.id], editing: false });
    applyMorph(new ToolbarContext(edgeless.std), UML_MORPH_SPEC, 'device');
    await wait(200);

    // §19.4.4's whole visual difference, on the tier the reader looks at.
    expect(node.kind).toBe('device');
    expect(node.role).toBe(UML_ROLE.device);
    expect(name.text.toString().split('\n')).toEqual([
      '«device»',
      ':AppServer',
    ]);

    // …and nothing else a user could point at: the cube family shares one
    // footprint, so a swap inside it moves nothing.
    expect(node.xywh).toBe(shapeBox);
    expect(group.xywh).toBe(box);
    expect(name.xywh).toBe(nameBox);
    expect(group.childElements).toHaveLength(2);
  });
});

/**
 * ADR 0009's two halves on a phase-2 document: the flag takes the BUTTON away
 * and leaves the DRAWING alone.
 *
 * Its own `describe` because `setupEditor` with flags builds a second view
 * manager, and mounting one on top of the default all-on editor would leave two
 * editors in one page (the note `template-insertion.spec.ts` carries).
 *
 * This is the case an append-only phase has to prove rather than assume: the
 * eight new kinds are new VALUES of a field the schema already had, registered
 * unconditionally, so a deployment diagram drawn while the flag was on must open
 * and paint on an editor where it is off.
 */
describe('a deployment diagram on an editor with the framework switched off', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless', undefined, {
      flags: { uml: false },
    });
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    return cleanup;
  });

  test('a stored cube and its artifact still paint, and still take a click', async () => {
    // Written straight onto the surface, the way a document created while the
    // flag was on arrives: no command runs here, because there is none to run.
    expect(
      getRegisteredCommands(edgeless.std).filter(c => c.owner === 'uml')
    ).toEqual([]);
    expect([
      ...edgeless.std.provider.getAll(SeniorToolIdentifier).keys(),
    ]).not.toContain('uml');

    const surface = getSurface(window.doc, window.editor).model;
    surface.addElement({
      type: 'umlDiagram',
      role: UML_ROLE.diagram,
      kind: 'dep',
      name: 'Production',
      xywh: '[0,0,1400,900]',
    });
    const cube = surface.addElement({
      type: 'umlNode',
      kind: 'device',
      role: UML_ROLE.device,
      shapeType: 'rect',
      filled: false,
      strokeStyle: StrokeStyle.None,
      xywh: '[200,200,220,140]',
    });
    await wait();

    // The renderers are registered from the ALWAYS-ON half, so both the sheet
    // and the cube on it paint — the flag gates TOOLING, never content.
    for (const type of ['umlDiagram', 'umlNode']) {
      expect(
        edgeless.std.provider.getOptional(ElementRendererIdentifier(type)),
        type
      ).toBeDefined();
    }
    // …and the cube is still the element under its own middle: selection,
    // resizing and the contextual row are content affordances, not tooling.
    expect(edgeless.gfx.getElementByPoint(310, 270)?.id).toBe(cube);
  });
});
