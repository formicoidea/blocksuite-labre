import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import {
  backgroundLabelHits,
  ElementRendererIdentifier,
} from '@labre/affine/blocks/surface';
import type { ConnectorTool } from '@labre/affine/gfx/connector';
// Straight off the framework package, as the bpmn, wardley and c4 specs already
// reach for theirs: `@labre/affine` re-exports the blocks, not the framework
// modules.
import {
  UML_DIAGRAM_KIND_MENU,
  UML_PARTITION_FRAME_V,
  UML_REGION_FRAME,
  UML_ROLE,
  umlPartitionFrame,
} from '@labre/affine-gfx-uml';
import {
  type ConnectorElementModel,
  GroupElementModel,
  PointStyle,
  StrokeStyle,
  TextElementModel,
  type UmlDiagramElementModel,
  UmlNodeElementModel,
  type UmlPartitionElementModel,
  type UmlRegionElementModel,
} from '@labre/affine/model';
import { getRegisteredCommands, runCommand } from '@labre/affine/std';
import { SeniorToolIdentifier } from '@labre/affine/widgets/edgeless-toolbar';
import { beforeEach, describe, expect, test } from 'vitest';

import { pointerdown, pointermove, pointerup, wait } from '../utils/common.js';
import { getDocRootBlock, getSurface } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * UML phase 2 — activity and state machine diagrams — on a REAL editor.
 *
 * `uml.spec.ts` owns the phase-1 gestures and `uml-structure-2.spec.ts` the
 * structural ones; this file owns what the BEHAVIOUR diagrams added, on the same
 * harness. The unit suites already prove each half apart: what a creation walk
 * writes (`gfx/uml/src/__tests__/actions`), what the partition's row writes
 * (`partition-toolbar`), what the rules refuse (`rules`). What only a live
 * editor can answer is whether the pieces MEET:
 *
 *  - that the two BACKGROUNDS phase 2 introduced — the activity partition and
 *    the composite state's region — really go under what is drawn on them,
 *    since a swimlane holds its actions by GEOMETRY and by nothing else;
 *  - that a control node is a mark with no words on it, which is the one shape
 *    in the pack whose creation walk skips the text tier entirely;
 *  - that a control flow armed from the catalogue is born wearing §15.2.4's
 *    drawing, through the tool rather than through the last-props store;
 *  - that a partition's band takes the pointer that renames it, and that the
 *    orientation it declares is what decides WHERE that band is;
 *  - and ADR 0009's half an append-only phase has to prove rather than assume:
 *    a stored activity diagram still paints with the tooling switched off.
 */
describe('the UML behaviour toolbox draws what it declares', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    return cleanup;
  });

  /**
   * Run one registered command.
   *
   * `'catalogue'` rather than `'senior-menu'`: phase 2 nominates nothing to the
   * senior row (the fourteen nominations are phase 1's), so the catalogue is the
   * surface a user actually reaches these through.
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
  const lastPartition = () =>
    lastOfType<UmlPartitionElementModel>('umlPartition');
  const lastRegion = () => lastOfType<UmlRegionElementModel>('umlRegion');
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

  /** Draw a sheet of the given kind, the way the picker declares one. */
  const sheet = async (kind: 'act' | 'stm') => {
    await run('uml.addDiagram');
    const diagram = lastDiagram();
    diagram.kind = kind;
    await wait();
    return diagram;
  };

  /* ── The sheet the behaviour diagrams are drawn on ───────────────────── */

  test('the kind picker offers act and stm, and the heading says so', async () => {
    // The picker is DATA (`kinds.ts`), asserted against the shipped table rather
    // than a literal, so a renamed option fails here and not in a screenshot.
    const kinds = UML_DIAGRAM_KIND_MENU.options.map(option => option.kind);
    expect(kinds).toContain('act');
    expect(kinds).toContain('stm');

    const diagram = await sheet('act');
    // Annex A's heading is `<kind> <name>`: the kind is written once, in front
    // of the author's own word, and switching it rewrites the tag.
    expect(diagram.heading).toBe(`act ${diagram.name}`);

    diagram.kind = 'stm';
    await wait();
    expect(diagram.heading).toBe(`stm ${diagram.name}`);
  });

  /* ── Swimlanes: a background that holds its contents by geometry ─────── */

  test('two partitions sit side by side, and an action drawn in one is IN it', async () => {
    await sheet('act');

    await run('uml.addPartition');
    const left = lastPartition();
    const [lx, ly, lw, lh] = left.deserializedXYWH;

    // The action is drawn where a creation command puts one — the middle of the
    // viewport, which is the middle of the lane just drawn there. NOTHING is
    // moved to make the case work: an artefact is a shape and its words in a
    // group, and dragging the shape alone would be a document no gesture makes.
    await run('uml.addAction');
    const action = lastNode();
    expect(action.kind).toBe('action');
    expect(action.role).toBe(UML_ROLE.action);

    // The second lane BESIDE the first, which is the one thing the case has to
    // arrange: a frame is a background with no children, so moving it moves
    // nothing but itself.
    await run('uml.addPartition');
    const right = lastPartition();
    // Two frames, not one re-used: a swimlane is an element, and the command
    // that draws one has to be able to draw a second beside it.
    expect(right.id).not.toBe(left.id);
    await place(right, [lx + lw, ly, lw, lh]);

    // §15.6.4's whole membership rule, and the reason the frame must stay a
    // BACKGROUND: an action belongs to the partition its CENTRE falls in, and
    // nothing in the document says so but the two boxes.
    const [ax, ay, aw, ah] = action.deserializedXYWH;
    const centre: [number, number] = [ax + aw / 2, ay + ah / 2];
    const holds = (frame: UmlPartitionElementModel) => {
      const [x, y, w, h] = frame.deserializedXYWH;
      return (
        centre[0] >= x &&
        centre[0] <= x + w &&
        centre[1] >= y &&
        centre[1] <= y + h
      );
    };
    expect(holds(left)).toBe(true);
    expect(holds(right)).toBe(false);

    // …and the band really is under the action: a frame painted over what it
    // holds hides every element it was drawn round.
    const group = groupOf(action);
    expect(group).toBeDefined();
    expect(left.index < group!.index, `${left.index} < ${group!.index}`).toBe(
      true
    );
  });

  /* ── The control nodes: marks with no words on them ──────────────────── */

  test('a control node is a shape and nothing else', async () => {
    await sheet('act');

    for (const [command, kind, role] of [
      ['uml.addInitial', 'initial', UML_ROLE.initial],
      ['uml.addDecision', 'decision', UML_ROLE.decision],
      ['uml.addFork', 'fork', UML_ROLE.fork],
    ] as const) {
      await run(command);
      const node = lastNode();
      expect(node.kind, command).toBe(kind);
      expect(node.role, command).toBe(role);
      // No group and no tier: §15.3.4 draws these as marks, and a seed under a
      // filled disc would be a word the notation never asked for. This is the
      // one family in the pack whose creation walk stops at the shape.
      expect(groupOf(node), command).toBeUndefined();
      // R16 all the same: no words ON a shape either.
      expect(node.text, command).toBeUndefined();
    }

    // An ACTION, by contrast, is a rounded rectangle with its name inside it.
    await run('uml.addAction');
    const action = lastNode();
    const group = groupOf(action);
    expect(group).toBeDefined();
    const texts = group!.childElements.filter(
      (child): child is TextElementModel => child instanceof TextElementModel
    );
    expect(texts).toHaveLength(1);
    expect(texts[0].role).toBe(UML_ROLE.label);
    expect(texts[0].text.toString().length).toBeGreaterThan(0);
  });

  /* ── The edges ───────────────────────────────────────────────────────── */

  test('a control flow is born wearing §15.2.4 drawing', async () => {
    await sheet('act');

    await run('uml.addInitial');
    const initial = lastNode();
    await run('uml.addAction');
    const action = lastNode();

    await run('uml.controlFlowTool');
    // The look rides on the TOOL and never through `EditPropsStore` (#144 M1):
    // `connector-style-scope.spec.ts` owns the other half of that contract.
    const armed = edgeless.gfx.tool.currentTool$.peek() as ConnectorTool;
    const style = armed.activatedOption.style ?? {};
    expect(style.strokeStyle).toBe(StrokeStyle.Solid);
    expect(style.frontEndpointStyle).toBe(PointStyle.None);
    expect(style.rearEndpointStyle).toBe(PointStyle.Arrow);
    // A TYPED edge (`docs/adr/0010`): the role travels in the tool's options, so
    // the connector is born with it rather than acquiring one afterwards.
    expect(armed.activatedOption.role).toBe(UML_ROLE['control-flow']);

    const surface = surfaceModel();
    const id = surface.addElement({
      type: 'connector',
      mode: armed.activatedOption.mode,
      role: armed.activatedOption.role,
      ...style,
      // The initial node is the SOURCE: `uml:control-flow` reads "flows to", and
      // §15.3.4 gives the initial node outgoing edges only.
      source: { id: initial.id, position: [0.5, 0.5] },
      target: { id: action.id, position: [0.5, 0.5] },
    });
    await wait(200);

    const edge = surface.getElementById(id) as ConnectorElementModel;
    expect(edge.role).toBe(UML_ROLE['control-flow']);
    expect(edge.strokeStyle).toBe(StrokeStyle.Solid);
    expect(edge.rearEndpointStyle).toBe(PointStyle.Arrow);
    expect(edge.frontEndpointStyle).toBe(PointStyle.None);
    // …and the line really routes between the two marks it was dropped on.
    expect(edge.source.id).toBe(initial.id);
    expect(edge.target.id).toBe(action.id);
    expect(edge.path.length).toBeGreaterThan(0);
  });

  /* ── The partition's band, under a real pointer ──────────────────────── */

  const host = () => window.editor.host as HTMLElement;

  /** A model point, as the position the pointer helpers take. */
  const at = (x: number, y: number) => {
    const [vx, vy] = edgeless.gfx.viewport.toViewCoord(x, y);
    return { x: vx, y: vy };
  };

  const tap = (p: { x: number; y: number }) => {
    pointerdown(host(), p);
    pointerup(host(), p);
  };

  const doubleClick = async (p: { x: number; y: number }) => {
    tap(p);
    tap(p);
    await wait();
  };

  /** The in-place `<input>` the view opens, or null. */
  const nameEditor = () =>
    (Array.from(document.body.children).findLast(
      el => el.tagName === 'INPUT'
    ) as HTMLInputElement | undefined) ?? null;

  /**
   * The depth of the band a VERTICAL lane reserves along its top — the default
   * orientation, and the one every case below but the last is drawn in.
   */
  const partitionBand = UML_PARTITION_FRAME_V.geometry.margin.top;

  test('the partition band picks the frame, and a double-click renames it', async () => {
    await sheet('act');
    await run('uml.addPartition');
    const partition = lastPartition();
    await place(partition, [0, 0, 400, 600]);
    expect(partitionBand).toBeGreaterThan(0);

    // The band is the frame's own strip: a click in it selects the swimlane…
    expect(edgeless.gfx.getElementByPoint(200, partitionBand / 2)?.id).toBe(
      partition.id
    );
    // …and the plot is where the actions go, so a click in the middle of the
    // lane belongs to whatever is drawn under the pointer, never to the frame.
    expect(edgeless.gfx.getElementByPoint(200, 400)?.id).not.toBe(partition.id);

    // The ordinary path a hand takes: move onto the band, then click twice.
    const point = at(200, partitionBand / 2);
    pointermove(host(), point);
    await wait();
    await doubleClick(point);

    const input = nameEditor();
    expect(input).not.toBeNull();
    // Opened on the words currently drawn, never on an empty box. A partition's
    // band writes the author's own word and nothing else — there is no derived
    // heading here, unlike the diagram frame.
    expect(input!.value).toBe(partition.name);
    expect(edgeless.gfx.selection.editing).toBe(true);

    input!.value = 'Customer';
    input!.dispatchEvent(new Event('blur'));
    await wait();
    expect(partition.name).toBe('Customer');
  });

  test('the orientation decides which edge the band is written along', async () => {
    await sheet('act');
    await run('uml.addPartition');
    const partition = lastPartition();
    await place(partition, [0, 0, 400, 600]);
    const [, , w, h] = partition.deserializedXYWH;

    /**
     * Where the name is written on THIS lane, in element-local units.
     *
     * Through `umlPartitionFrame` rather than against one declaration, because
     * that function is the whole mechanism under test: the orientation is a
     * stored field, and `background.ts` turns it into one of two declarations
     * that the renderer, the view and the hit test all resolve through this one
     * call. A spec naming a declaration directly would prove the geometry and
     * miss the lookup.
     */
    const nameBox = () => {
      const hits = backgroundLabelHits(
        umlPartitionFrame(partition),
        partition as unknown as Record<string, unknown>,
        w,
        h
      );
      const hit = hits.find(candidate => candidate.prop === 'name');
      expect(hit, 'the partition declares a name label').toBeDefined();
      return hit!;
    };

    // Vertical is the default and the one §15.6.4's figures draw: columns, with
    // the name written across the top of each.
    expect(partition.orientation).toBe('vertical');
    const vertical = nameBox();
    expect(vertical.minY).toBeLessThan(partitionBand);

    // The flip the toolbar's `b.orientation` writes — asserted here on the
    // FIELD, because what a live editor uniquely proves is that the picture
    // follows it: same frame, same box, band along the left edge instead of the
    // top. (What the toggle WRITES is `partition-toolbar.unit.spec.ts`'s.)
    partition.orientation = 'horizontal';
    await wait();
    const horizontal = nameBox();
    // Down from the top strip and into the left one: the two coordinates move
    // in opposite directions, which is the one thing a turned band must do.
    expect(horizontal.minY).toBeGreaterThan(vertical.minY);
    expect(horizontal.minX).toBeLessThan(vertical.minX);
    // …and the frame really is picked on its new edge, so the rename gesture
    // followed the words: a band drawn in one place and clicked in another is
    // exactly what the shared hit-test helper exists to prevent.
    const band = umlPartitionFrame(partition).geometry.margin.left;
    expect(edgeless.gfx.getElementByPoint(band / 2, 300)?.id).toBe(
      partition.id
    );
  });

  /* ── The state machine half ──────────────────────────────────────────── */

  test('a region holds its states, and a transition joins two of them', async () => {
    await sheet('stm');

    await run('uml.addRegion');
    const region = lastRegion();
    expect(region.role).toBe(UML_ROLE.region);

    // Drawn where the command puts them — the middle of the viewport, which is
    // the middle of the region just drawn there. A composite state holds its
    // sub-states the way a partition holds its actions: by geometry, so being
    // "in" it is a fact about two boxes and nothing else.
    await run('uml.addState');
    const state = lastNode();
    expect(state.kind).toBe('state');
    expect(state.role).toBe(UML_ROLE.state);

    const [rx, ry, rw, rh] = region.deserializedXYWH;
    const [sx, sy, sw, sh] = state.deserializedXYWH;
    const cx = sx + sw / 2;
    const cy = sy + sh / 2;
    expect(cx >= rx && cx <= rx + rw).toBe(true);
    expect(cy >= ry && cy <= ry + rh).toBe(true);

    await run('uml.addFinalState');
    const final = lastNode();
    expect(final.kind).toBe('final-state');
    expect(final.role).toBe(UML_ROLE['final-state']);
    // A bullseye is a mark: §14.2.4 writes nothing on it.
    expect(groupOf(final)).toBeUndefined();

    // The region is a background like the partition and the sheet: under what it
    // holds, whatever order the two were drawn in.
    const group = groupOf(state);
    expect(group).toBeDefined();

    // §14.2.4 draws a state as a DIVIDED box: a name compartment ruled off over
    // its internal activities. So it arrives with two tiers, not one — the
    // renderer draws that separator unconditionally, and `model.ts` reads
    // `entry / …`, `do / …`, `exit / …` off the second one. The behaviour tier
    // is seeded EMPTY, which is the compartment §14.2.4's own figures draw.
    const tiers = group!.childElements.filter(
      (child): child is TextElementModel => child instanceof TextElementModel
    );
    expect(tiers.map(tier => tier.role).sort()).toEqual(
      [UML_ROLE.name, UML_ROLE.attributes].sort()
    );
    const nameTier = tiers.find(tier => tier.role === UML_ROLE.name)!;
    const behaviourTier = tiers.find(
      tier => tier.role === UML_ROLE.attributes
    )!;
    expect(nameTier.text.toString().length).toBeGreaterThan(0);
    expect(behaviourTier.text.toString()).toBe('');
    expect(
      region.index < group!.index,
      `${region.index} < ${group!.index}`
    ).toBe(true);

    await run('uml.transitionTool');
    const armed = edgeless.gfx.tool.currentTool$.peek() as ConnectorTool;
    const style = armed.activatedOption.style ?? {};
    expect(style.strokeStyle).toBe(StrokeStyle.Solid);
    expect(style.frontEndpointStyle).toBe(PointStyle.None);
    expect(style.rearEndpointStyle).toBe(PointStyle.Arrow);
    expect(armed.activatedOption.role).toBe(UML_ROLE.transition);

    const surface = surfaceModel();
    const id = surface.addElement({
      type: 'connector',
      mode: armed.activatedOption.mode,
      role: armed.activatedOption.role,
      ...style,
      source: { id: state.id, position: [0.5, 0.5] },
      target: { id: final.id, position: [0.5, 0.5] },
    });
    await wait(200);

    const edge = surface.getElementById(id) as ConnectorElementModel;
    expect(edge.role).toBe(UML_ROLE.transition);
    expect(edge.source.id).toBe(state.id);
    expect(edge.target.id).toBe(final.id);
    expect(edge.path.length).toBeGreaterThan(0);
  });
});

/**
 * ADR 0009's two halves on a phase-2 behaviour document: the flag takes the
 * BUTTON away and leaves the DRAWING alone.
 *
 * Its own `describe` because `setupEditor` with flags builds a second view
 * manager, and mounting one on top of the default all-on editor would leave two
 * editors in one page (the note `template-insertion.spec.ts` carries).
 *
 * This is the case the two new BACKGROUNDS make sharper than any phase before
 * them. A partition holds its actions by geometry: lose the frame and the
 * document does not lose a decoration, it loses which swimlane every action was
 * in. So both element types are registered unconditionally — schema, store
 * extension, renderer, view and interaction alike — and only the commands that
 * CREATE them sit behind the flag.
 */
describe('an activity diagram on an editor with the framework switched off', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless', undefined, {
      flags: { uml: false },
    });
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    return cleanup;
  });

  test('a stored partition, its action and a region still paint and still take a click', async () => {
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
      kind: 'act',
      name: 'Checkout',
      xywh: '[0,0,1400,900]',
    });
    const partition = surface.addElement({
      type: 'umlPartition',
      role: UML_ROLE.partition,
      name: 'Customer',
      orientation: 'vertical',
      xywh: '[100,100,300,600]',
    });
    const action = surface.addElement({
      type: 'umlNode',
      kind: 'action',
      role: UML_ROLE.action,
      shapeType: 'rect',
      filled: true,
      strokeStyle: StrokeStyle.Solid,
      xywh: '[160,240,180,90]',
    });
    surface.addElement({
      type: 'umlRegion',
      role: UML_ROLE.region,
      name: 'Running',
      xywh: '[600,100,500,400]',
    });
    await wait();

    // Every renderer comes from the ALWAYS-ON half, so the sheet, the two
    // frames and the action on them all paint — the flag gates TOOLING, never
    // content (`docs/adr/0009`).
    for (const type of ['umlDiagram', 'umlPartition', 'umlRegion', 'umlNode']) {
      expect(
        edgeless.std.provider.getOptional(ElementRendererIdentifier(type)),
        type
      ).toBeDefined();
    }

    // …and both are still the element under their own band and their own
    // middle: selection, resizing and the contextual row are content
    // affordances, not tooling.
    const band = UML_PARTITION_FRAME_V.geometry.margin.top;
    expect(edgeless.gfx.getElementByPoint(250, 100 + band / 2)?.id).toBe(
      partition
    );
    expect(edgeless.gfx.getElementByPoint(250, 285)?.id).toBe(action);
    // The region's own declaration is registered too, which is what makes the
    // composite state on the other half of the document load.
    expect(UML_REGION_FRAME.type).toBe('umlRegion');
  });
});
