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
  UML_EDGE_MORPH_SPEC,
  UML_FRAGMENT_OPERATOR_MENU,
  UML_ROLE,
} from '@labre/affine-gfx-uml';
import {
  type ConnectorElementModel,
  GroupElementModel,
  PointStyle,
  StrokeStyle,
  TextElementModel,
  type UmlDiagramElementModel,
  type UmlFragmentElementModel,
  UmlNodeElementModel,
} from '@labre/affine/model';
import {
  ToolbarContext,
  ToolbarRegistryIdentifier,
} from '@labre/affine/shared/services';
import { getRegisteredCommands, runCommand } from '@labre/affine/std';
import { SeniorToolIdentifier } from '@labre/affine/widgets/edgeless-toolbar';
import {
  AFFINE_TOOLBAR_WIDGET,
  type AffineToolbarWidget,
} from '@labre/affine/widgets/toolbar';
import { render, type TemplateResult } from 'lit';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock, getSurface } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * UML phase 3 — sequence diagrams — on a REAL editor.
 *
 * `uml.spec.ts` owns the phase-1 gestures, `uml-structure-2.spec.ts` the
 * structural ones and `uml-behavior-2.spec.ts` the activity and state machine
 * ones; this file owns what §17 added, on the same harness. The unit suites
 * already prove each half apart: what a creation walk writes
 * (`gfx/uml/src/__tests__/actions`), what the line table says (`edge-styles`),
 * what the rules refuse (`rules`). What only a live editor can answer is
 * whether the pieces MEET:
 *
 *  - that a LIFELINE is a narrow column with a head across the top of it, and
 *    that a message really attaches to the column's own perimeter — which is
 *    the whole reason the element is the spine and not the head;
 *  - that a synchronous message armed from the catalogue is born wearing
 *    §17.4.4's FILLED arrowhead, through the tool rather than through the
 *    last-props store, and that the open head of an asynchronous one is one
 *    dropdown away without either endpoint moving;
 *  - that an execution bar and a destruction cross are marks with no words on
 *    them, which is what §17.2.4 draws;
 *  - that the COMBINED FRAGMENT's own row reaches the user: the button that
 *    divides it into operands, and the picker that rewrites the word in its
 *    pentagon;
 *  - and ADR 0009's half an append-only phase has to prove rather than assume:
 *    a stored sequence diagram still paints with the tooling switched off.
 */
describe('the UML sequence toolbox draws what it declares', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    return cleanup;
  });

  /**
   * Run one registered command.
   *
   * `'catalogue'` rather than `'senior-menu'`: phase 3 nominates nothing to the
   * senior row (the fourteen nominations are phase 1's, with tranche G's
   * one-for-one swap), so the catalogue is the surface a user actually reaches
   * these through.
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

  /** The last element of a surface TYPE — the artefact just drawn. */
  const lastOfType = <T>(type: string): T => {
    const all = surfaceModel().elementModels.filter(
      model => model.type === type
    );
    expect(all.length, type).toBeGreaterThan(0);
    return all[all.length - 1] as unknown as T;
  };

  const lastDiagram = () => lastOfType<UmlDiagramElementModel>('umlDiagram');
  const lastFragment = () => lastOfType<UmlFragmentElementModel>('umlFragment');
  const lastNode = () => lastOfType<UmlNodeElementModel>('umlNode');

  /** The group a node was put in, or undefined when the mark carries no words. */
  const groupOf = (node: UmlNodeElementModel) =>
    surfaceModel().elementModels.find(
      (model): model is GroupElementModel =>
        model instanceof GroupElementModel && model.childIds.includes(node.id)
    );

  /** Put an element exactly where the case needs it. */
  const place = async (
    model: { xywh: string },
    box: [number, number, number, number]
  ) => {
    model.xywh = `[${box.join(',')}]`;
    await wait();
  };

  /** Draw a sequence sheet, the way the picker declares one. */
  const sheet = async () => {
    await run('uml.addDiagram');
    const diagram = lastDiagram();
    diagram.kind = 'sd';
    await wait();
    return diagram;
  };

  /**
   * The selection made the way the real toolbar makes it: the widget derives
   * the flavour itself, so a case that goes through it proves the module is
   * registered on a key the editor actually asks for.
   */
  const select = (...models: { id: string }[]) => {
    edgeless.gfx.selection.set({
      elements: models.map(model => model.id),
      editing: false,
    });
    const widget = edgeless.widgetComponents[
      AFFINE_TOOLBAR_WIDGET
    ] as AffineToolbarWidget;
    expect(widget).toBeDefined();

    const ctx = new ToolbarContext(edgeless.std);
    widget.updateWithSurface(
      ctx,
      true,
      models.map(model => model.id)
    );
    return ctx;
  };

  /**
   * One entry of a REGISTERED toolbar module, by flavour and id.
   *
   * Through the registry rather than by importing the config object, and that
   * is the half of the case worth having: an entry declared in a module nobody
   * registered — or registered under a flavour the widget never derives — is an
   * entry no user can press, and a spec that imported the config would pass
   * against exactly that.
   */
  const entryOn = (flavour: string, id: string) => {
    const modules = edgeless.std
      .get(ToolbarRegistryIdentifier)
      .modulesFor(flavour);
    for (const module of modules) {
      const found = module.config.actions.find(action => action.id === id);
      if (found) return found;
    }
    return undefined;
  };

  /* ── The sheet ───────────────────────────────────────────────────────── */

  test('the kind picker offers sd, and the heading says so', async () => {
    // The picker is DATA (`kinds.ts`), asserted against the shipped table
    // rather than a literal, so a renamed option fails here and not in a
    // screenshot.
    expect(UML_DIAGRAM_KIND_MENU.options.map(option => option.kind)).toContain(
      'sd'
    );

    const diagram = await sheet();
    // Annex A's heading is `<kind> <name>`: the kind is written once, in front
    // of the author's own word.
    expect(diagram.heading).toBe(`sd ${diagram.name}`);
  });

  /* ── The participants, and the line between them ─────────────────────── */

  test('two lifelines take a synchronous message on their columns', async () => {
    await sheet();

    await run('uml.addLifeline');
    const caller = lastNode();
    expect(caller.kind).toBe('lifeline');
    expect(caller.role).toBe(UML_ROLE.lifeline);

    // §17.3.4 writes `<name> : <Type>` in the HEAD, and R16 puts it on a text
    // element grouped with the shape rather than on the shape. The tier carries
    // `uml:lifeline-ident` and not the actor's `uml:label`: the clause prints a
    // BNF for a head and none for an actor's word, so the two spelling and
    // naming rules written on it reach no use case (`roles.ts`).
    const group = groupOf(caller);
    expect(group).toBeDefined();
    const tiers = group!.childElements.filter(
      (child): child is TextElementModel => child instanceof TextElementModel
    );
    expect(tiers).toHaveLength(1);
    expect(tiers[0].role).toBe(UML_ROLE['lifeline-ident']);
    expect(tiers[0].text.toString()).toContain(':');
    expect(caller.text).toBeUndefined();

    // The element is the SPINE — narrow and tall — which is what lets a message
    // attach at the height it happens at. The head is painted across the top of
    // it and overflows it, which is why the label box is wider than the column.
    const [, , columnW, columnH] = caller.deserializedXYWH;
    expect(columnH).toBeGreaterThan(columnW * 4);
    expect(tiers[0].deserializedXYWH[2]).toBeGreaterThan(columnW);

    await run('uml.addLifeline');
    const callee = lastNode();
    expect(callee.id).not.toBe(caller.id);
    // The second participant beside the first, at the spacing a sequence
    // diagram is laid out on. Nothing else is moved: a lifeline is a shape and
    // its head in a group, and dragging the shape alone would be a document no
    // gesture makes — so the group goes with it.
    const calleeGroup = groupOf(callee);
    expect(calleeGroup).toBeDefined();
    const [cx, cy, cw, ch] = callee.deserializedXYWH;
    await place(callee, [cx + 260, cy, cw, ch]);

    await run('uml.messageSyncTool');
    // The look rides on the TOOL and never through `EditPropsStore` (#144 M1):
    // `connector-style-scope.spec.ts` owns the other half of that contract.
    const armed = edgeless.gfx.tool.currentTool$.peek() as ConnectorTool;
    const style = armed.activatedOption.style ?? {};
    // §17.4.4's one visual distinction: the caller WAITS, and the filled
    // triangle is the whole of what says so.
    expect(style.strokeStyle).toBe(StrokeStyle.Solid);
    expect(style.frontEndpointStyle).toBe(PointStyle.None);
    expect(style.rearEndpointStyle).toBe(PointStyle.Triangle);
    // A TYPED edge (`docs/adr/0010`): the role travels in the tool's options,
    // so the connector is born with it rather than acquiring one afterwards.
    expect(armed.activatedOption.role).toBe(UML_ROLE['message-sync']);

    const surface = surfaceModel();
    const id = surface.addElement({
      type: 'connector',
      mode: armed.activatedOption.mode,
      role: armed.activatedOption.role,
      ...style,
      // ON THE COLUMNS, at the same height: a message happens at a moment, and
      // the moment is the y it is drawn at (§17.4.4). The right edge of the
      // caller's spine to the left edge of the callee's.
      source: { id: caller.id, position: [1, 0.2] },
      target: { id: callee.id, position: [0, 0.2] },
    });
    await wait(200);

    const edge = surface.getElementById(id) as ConnectorElementModel;
    expect(edge.role).toBe(UML_ROLE['message-sync']);
    expect(edge.rearEndpointStyle).toBe(PointStyle.Triangle);
    expect(edge.source.id).toBe(caller.id);
    expect(edge.target.id).toBe(callee.id);
    expect(edge.path.length).toBeGreaterThan(0);
    // §17.4.4: "every line fragment is either horizontal or downwards". Both
    // ends were attached at the same fraction of two columns of one height, so
    // the line the router produced is level — the geometric fact the
    // `uml.message-not-upward` audit is written about.
    const first = edge.absolutePath[0];
    const last = edge.absolutePath[edge.absolutePath.length - 1];
    expect(last[1]).toBeGreaterThanOrEqual(first[1] - 0.001);
  });

  test('a message retyped as asynchronous keeps both of its ends', async () => {
    await sheet();
    await run('uml.addLifeline');
    const caller = lastNode();
    await run('uml.addLifeline');
    const callee = lastNode();
    const [cx, cy, cw, ch] = callee.deserializedXYWH;
    await place(callee, [cx + 260, cy, cw, ch]);

    const surface = surfaceModel();
    const id = surface.addElement({
      type: 'connector',
      role: UML_ROLE['message-sync'],
      strokeStyle: StrokeStyle.Solid,
      frontEndpointStyle: PointStyle.None,
      rearEndpointStyle: PointStyle.Triangle,
      source: { id: caller.id, position: [1, 0.3] },
      target: { id: callee.id, position: [0, 0.3] },
    });
    await wait(200);
    const edge = surface.getElementById(id) as ConnectorElementModel;

    applyMorph(select(edge), UML_EDGE_MORPH_SPEC, 'message-async');
    await wait(200);

    // The correction a modeller actually makes halfway through laying out a
    // conversation: the caller does NOT wait after all. The drawing follows the
    // meaning — an open stick head where the filled triangle was — which is the
    // whole reason `umlEdgeProps` writes six props and not just the role.
    expect(edge.role).toBe(UML_ROLE['message-async']);
    expect(edge.rearEndpointStyle).toBe(PointStyle.Arrow);
    expect(edge.strokeStyle).toBe(StrokeStyle.Solid);
    // …and the two ENDPOINTS are untouched, which is what makes the dropdown
    // worth having: on a sequence diagram an endpoint carries the HEIGHT the
    // message happens at as well as which participant it lands on.
    expect(edge.source.id).toBe(caller.id);
    expect(edge.source.position).toEqual([1, 0.3]);
    expect(edge.target.id).toBe(callee.id);
    expect(edge.target.position).toEqual([0, 0.3]);
  });

  /* ── The two marks on a spine ────────────────────────────────────────── */

  test('an execution bar and a destruction cross carry no words', async () => {
    await sheet();

    for (const [command, kind, role] of [
      ['uml.addExecution', 'execution', UML_ROLE.execution],
      ['uml.addDestruction', 'destruction', UML_ROLE.destruction],
    ] as const) {
      await run(command);
      const node = lastNode();
      expect(node.kind, command).toBe(kind);
      expect(node.role, command).toBe(role);
      // §17.2.4 names neither: what a bar and a cross tell the reader is WHERE
      // they sit on a spine. A seed under either would be a word to delete off
      // a 12-unit mark, so creation stops at the shape and there is no group.
      expect(groupOf(node), command).toBeUndefined();
      // R16 all the same: no words ON a shape either.
      expect(node.text, command).toBeUndefined();
    }
  });

  /* ── The combined fragment's own row ─────────────────────────────────── */

  test('a fresh fragment is an alt with no operands written', async () => {
    await sheet();
    await run('uml.addFragment');
    const fragment = lastFragment();

    expect(fragment.role).toBe(UML_ROLE.fragment);
    // §17.6.4 opens on the alternative, and the model makes the operator
    // required for the reason the diagram's kind is: a pentagon with nothing in
    // it is a rectangle with a bitten corner.
    expect(fragment.operator).toBe('alt');
    // A one-operand fragment is the picture §17.6.4 draws, so nothing is
    // written until a second band is asked for — the same byte-for-byte promise
    // a BPMN pool makes about its lanes.
    expect(fragment.operands).toBeUndefined();
    // …and no guard is invented: §17.6.4 writes a condition only where there is
    // one, and `[condition]` under the tag would be a condition nobody wrote.
    expect(fragment.name).toBe('');
  });

  test('the fragment row divides it, and the picker rewrites its tag', async () => {
    await sheet();
    await run('uml.addFragment');
    const fragment = lastFragment();
    await place(fragment, [0, 0, 600, 260]);

    // The ALWAYS-ON half of the row — the gesture a stored fragment keeps with
    // the framework switched off.
    expect(
      entryOn('affine:surface:umlFragment', 'a.toggle-resize')
    ).toBeDefined();

    const ctx = select(fragment);
    const addOperand = entryOn(
      'custom:affine:surface:umlFragment',
      'b.add-operand'
    ) as { run?: (ctx: ToolbarContext) => void } | undefined;
    expect(addOperand?.run).toBeDefined();

    addOperand!.run!(ctx);
    await wait();

    // TWO, not one: what an author presses this for is the SECOND branch of an
    // `alt`, with §17.6.4's dashed separator between it and the first. Writing
    // one zone would divide the fragment into a single band and draw nothing.
    expect(fragment.operands).toHaveLength(2);
    const [first, second] = fragment.operands!;
    expect(first.id).not.toBe(second.id);
    expect(first.size).toBeGreaterThan(0);
    expect(second.size).toBeCloseTo(first.size);
    // Nothing is invented on the way in: neither band arrives guarded.
    expect(second.name ?? '').toBe('');

    // …and a second press appends a single band to the two that are there.
    addOperand!.run!(ctx);
    await wait();
    expect(fragment.operands).toHaveLength(3);

    // The OPERATOR picker, driven through the very template the row renders:
    // the entry is data until somebody clicks an option, and clicking one is
    // the gesture under test.
    const picker = entryOn(
      'custom:affine:surface:umlFragment',
      'c.operator'
    ) as
      | { content?: (ctx: ToolbarContext) => TemplateResult | null }
      | undefined;
    expect(picker?.content).toBeDefined();
    const template = picker!.content!(select(fragment));
    expect(template).not.toBeNull();

    const host = document.createElement('div');
    document.body.append(host);
    try {
      render(template!, host);
      await wait();

      const options = Array.from(
        host.querySelectorAll('[data-testid="uml-operator-option"]')
      );
      // The shipped table, in the order it declares — asserted against the data
      // rather than a literal, so a reworded entry fails in `operators.ts`.
      expect(options.map(el => el.getAttribute('data-operator'))).toEqual(
        UML_FRAGMENT_OPERATOR_MENU.options.map(option => option.operator)
      );
      // One tick, on the operator in force.
      expect(
        options.filter(el => el.getAttribute('data-selected') === 'true')
      ).toHaveLength(1);

      const loop = options.find(
        el => el.getAttribute('data-operator') === 'loop'
      );
      expect(loop).toBeDefined();
      (loop as HTMLElement).click();
      await wait();
    } finally {
      host.remove();
    }

    // The same rectangle, saying something else entirely — which is the whole
    // of §17.6.4's notation, and the reason this is a field and not a morph.
    expect(fragment.operator).toBe('loop');
    // The bands the author asked for are untouched: the operator is one
    // statement about the whole box, and a picker that dropped the operands
    // would be throwing away a division somebody made.
    expect(fragment.operands).toHaveLength(3);
  });
});

/**
 * ADR 0009's two halves on a phase-3 document: the flag takes the BUTTON away
 * and leaves the DRAWING alone.
 *
 * Its own `describe` because `setupEditor` with flags builds a second view
 * manager, and mounting one on top of the default all-on editor would leave two
 * editors in one page (the note `template-insertion.spec.ts` carries).
 *
 * The sequence diagram makes the case as sharply as the swimlane did: a message
 * is attached to a LIFELINE, and an execution bar means what it means because
 * of where it sits on one. Lose the element and the document does not lose a
 * decoration, it loses the participant every line on the sheet was drawn
 * between. So every element type is registered unconditionally — schema, store
 * extension, renderer, view and interaction alike — and only the commands that
 * CREATE them sit behind the flag.
 */
describe('a sequence diagram on an editor with the framework switched off', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless', undefined, {
      flags: { uml: false },
    });
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    return cleanup;
  });

  test('a stored lifeline, its message and an alt still paint', async () => {
    // No command runs here, because there is none to run.
    expect(
      getRegisteredCommands(edgeless.std).filter(c => c.owner === 'uml')
    ).toEqual([]);
    expect([
      ...edgeless.std.provider.getAll(SeniorToolIdentifier).keys(),
    ]).not.toContain('uml');

    // Written straight onto the surface, the way a document created while the
    // flag was on arrives.
    const surface = getSurface(window.doc, window.editor).model;
    surface.addElement({
      type: 'umlDiagram',
      role: UML_ROLE.diagram,
      kind: 'sd',
      name: 'Checkout',
      xywh: '[0,0,1400,900]',
    });
    const caller = surface.addElement({
      type: 'umlNode',
      kind: 'lifeline',
      role: UML_ROLE.lifeline,
      shapeType: 'rect',
      filled: false,
      strokeStyle: StrokeStyle.None,
      xywh: '[200,100,16,600]',
    });
    const callee = surface.addElement({
      type: 'umlNode',
      kind: 'lifeline',
      role: UML_ROLE.lifeline,
      shapeType: 'rect',
      filled: false,
      strokeStyle: StrokeStyle.None,
      xywh: '[460,100,16,600]',
    });
    surface.addElement({
      type: 'umlNode',
      kind: 'execution',
      role: UML_ROLE.execution,
      shapeType: 'rect',
      filled: true,
      strokeStyle: StrokeStyle.Solid,
      xywh: '[462,220,12,80]',
    });
    const fragment = surface.addElement({
      type: 'umlFragment',
      role: UML_ROLE.fragment,
      operator: 'alt',
      name: '[in stock]',
      operands: [
        { id: 'op-1', name: '[in stock]', size: 1 },
        { id: 'op-2', name: '[else]', size: 1 },
      ],
      xywh: '[150,180,420,260]',
    });
    const message = surface.addElement({
      type: 'connector',
      role: UML_ROLE['message-sync'],
      strokeStyle: StrokeStyle.Solid,
      frontEndpointStyle: PointStyle.None,
      rearEndpointStyle: PointStyle.Triangle,
      source: { id: caller, position: [1, 0.2] },
      target: { id: callee, position: [0, 0.2] },
    });
    await wait(200);

    // Every renderer comes from the ALWAYS-ON half, so the sheet, the frame,
    // the two participants and the mark on one of them all paint — the flag
    // gates TOOLING, never content (`docs/adr/0009`).
    for (const type of ['umlDiagram', 'umlFragment', 'umlNode']) {
      expect(
        edgeless.std.provider.getOptional(ElementRendererIdentifier(type)),
        type
      ).toBeDefined();
    }

    // The stored fragment keeps its operator, its guard and both of the bands
    // somebody divided it into — a document that lost them would lose which
    // branch every message inside it belongs to.
    const stored = surface.getElementById(
      fragment
    ) as unknown as UmlFragmentElementModel;
    expect(stored.operator).toBe('alt');
    expect(stored.operands).toHaveLength(2);

    // …and the message still runs between the two participants it was drawn
    // between, wearing §17.4.4's filled head.
    const edge = surface.getElementById(message) as ConnectorElementModel;
    expect(edge.role).toBe(UML_ROLE['message-sync']);
    expect(edge.rearEndpointStyle).toBe(PointStyle.Triangle);
    expect(edge.path.length).toBeGreaterThan(0);

    // The participant is still the element under its own spine: selection and
    // resizing are content affordances, not tooling.
    expect(edgeless.gfx.getElementByPoint(208, 500)?.id).toBe(caller);
  });
});
