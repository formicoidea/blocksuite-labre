import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import {
  backgroundInstanceZoneBand,
  backgroundInstanceZones,
  backgroundPlot,
} from '@labre/affine/blocks/surface';
// Straight off the framework package, as the connector and template specs
// already reach for theirs: `@labre/affine` re-exports the blocks, not the
// framework modules.
import {
  BPMN_POOL_BACKGROUND,
  BPMN_ROLE,
  BPMN_ROLE_OF_KIND,
  bpmnBoardOf,
  bpmnLaneOf,
  bpmnPoolOf,
  exportBpmnXml,
} from '@labre/affine-gfx-bpmn';
import {
  type BpmnNodeElementModel,
  type BpmnPoolElementModel,
  type ConnectorElementModel,
  ConnectorMode,
  PointStyle,
  ShapeElementModel,
  StrokeStyle,
} from '@labre/affine/model';
import {
  COMMAND_USAGE_KEY,
  EditPropsStore,
} from '@labre/affine/shared/services';
import {
  type AnyCommandDescriptor,
  getCommandsForSurface,
  getRegisteredCommands,
  runCommand,
  SENIOR_MENU_RANKED_SLOTS,
} from '@labre/affine/std';
import { edgelessToolbarSlotsContext } from '@labre/affine/widgets/edgeless-toolbar';
import { ContextProvider } from '@lit/context';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock, getSurface } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * The BPMN sub-menu popover. Not exported by the framework package — it is a
 * custom element `effects()` registers — so it is reached the way the senior
 * button reaches it, by tag name.
 */
type BpmnMenuElement = HTMLElement & {
  edgeless: EdgelessRootBlockComponent;
  updateComplete: Promise<unknown>;
  /** `EdgelessCommandMenu`'s own selection — what `render()` maps to buttons. */
  commands: AnyCommandDescriptor[];
};

describe('BPMN framework elements', () => {
  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    return cleanup;
  });

  test('each flow-object node is a native shape with its kind', () => {
    const surface = getSurface(window.doc, window.editor).model;

    const cases = [
      { kind: 'startEvent', shapeType: 'ellipse' },
      { kind: 'endEvent', shapeType: 'ellipse' },
      { kind: 'task', shapeType: 'rect' },
      { kind: 'gatewayExclusive', shapeType: 'diamond' },
    ] as const;

    for (const { kind, shapeType } of cases) {
      const id = surface.addElement({
        type: 'bpmnNode',
        kind,
        shapeType,
        xywh: '[0,0,80,80]',
      });
      const model = surface.getElementById(id) as BpmnNodeElementModel;
      expect(model.type).toBe('bpmnNode');
      expect(model.kind).toBe(kind);
      expect(model.shapeType).toBe(shapeType);
      // Inherits native shape behaviour + restricts connector anchors to centre.
      expect(model instanceof ShapeElementModel).toBe(true);
      expect(model.centerAnchorOnly).toBe(true);
    }
  });

  test('pool is a non-connectable background with an editable name', () => {
    const surface = getSurface(window.doc, window.editor).model;

    const id = surface.addElement({ type: 'bpmnPool', xywh: '[0,0,560,200]' });
    const pool = surface.getElementById(id) as BpmnPoolElementModel;
    expect(pool.type).toBe('bpmnPool');
    expect(pool.name).toBe('Pool');
    expect(pool.resizeEnabled).toBe(true);
    expect(pool.connectable).toBe(false);
  });

  test('a sequence flow connects two nodes', async () => {
    const surface = getSurface(window.doc, window.editor).model;

    const startId = surface.addElement({
      type: 'bpmnNode',
      kind: 'startEvent',
      shapeType: 'ellipse',
      xywh: '[0,0,56,56]',
    });
    const taskId = surface.addElement({
      type: 'bpmnNode',
      kind: 'task',
      shapeType: 'rect',
      xywh: '[300,0,120,72]',
    });

    const connId = surface.addElement({
      type: 'connector',
      mode: ConnectorMode.Orthogonal,
      source: { id: startId, position: [0.5, 0.5] },
      target: { id: taskId, position: [0.5, 0.5] },
    });

    await wait(200);

    const connector = surface.getElementById(connId) as ConnectorElementModel;
    expect(connector.path.length).toBeGreaterThan(0);
    expect(connector.source.id).toBe(startId);
    expect(connector.target.id).toBe(taskId);
  });
});

/**
 * Lanes (couloirs) end to end (B4).
 *
 * The unit suite owns what the three operations write. This one owns what only
 * a real editor can answer: that the registered commands reach them, that the
 * partition they build is the one the audit reads elements against, and that
 * the whole thing comes back off in one press of ctrl+z.
 */
describe('BPMN pool lanes', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    return cleanup;
  });

  const command = (id: string): AnyCommandDescriptor => {
    const found = getRegisteredCommands(edgeless.std).find(c => c.id === id);
    expect(found, id).toBeDefined();
    return found!;
  };

  /** Invoke through the bottleneck, exactly as the contextual toolbar does. */
  const invoke = async (id: string) => {
    runCommand(edgeless.std, command(id), {
      surface: 'contextual-toolbar',
      source: 'toolbar:general',
    });
    await wait();
  };

  const addPool = (xywh = '[0,0,600,400]') => {
    const surface = getSurface(window.doc, window.editor).model;
    const id = surface.addElement({
      type: 'bpmnPool',
      role: 'bpmn:pool',
      xywh,
    });
    const pool = surface.getElementById(id) as BpmnPoolElementModel;
    // Selecting is what makes the lane commands available at all: they are
    // `availability: 'selection'`, because a lane divides a pool that exists.
    edgeless.gfx.selection.set({ elements: [id], editing: false });
    return pool;
  };

  test('a fresh pool writes no `lanes` key at all', () => {
    const pool = addPool();
    // The whole of the compatibility promise, stated on a live document: a pool
    // that has no lane is byte-identical to one authored before the field
    // existed. No migration, no schema version bump.
    expect(pool.lanes).toBeUndefined();
    expect(pool.yMap.has('lanes')).toBe(false);
    expect(pool.serialize()).not.toHaveProperty('lanes');
  });

  test('the commands divide the pool, and the audit reads the division', async () => {
    const pool = addPool();

    await invoke('bpmn.addLane');
    await invoke('bpmn.addLane');

    const lanes = pool.lanes!;
    expect(lanes).toHaveLength(2);
    // Two lanes of equal weight: the second took the average of the first.
    expect(lanes[0].size).toBe(lanes[1].size);
    // Named on creation (PO recette, 2026-08-26) — which is what makes the
    // first click visible: a titled band appears on a pool that had none.
    expect(lanes.map(lane => lane.name)).toEqual(['Lane 1', 'Lane 2']);

    // Rename the top one through the same path the in-place editor uses.
    const surface = getSurface(window.doc, window.editor).model;
    surface.updateElement(pool.id, {
      lanes: lanes.map((lane, i) =>
        i === 0 ? { ...lane, name: 'Front office' } : lane
      ),
    });
    await wait();
    expect(pool.lanes?.[0].name).toBe('Front office');
    // …and the other keeps the name it was created with: renaming one lane is
    // one lane's business.
    expect(pool.lanes?.[1].name).toBe('Lane 2');

    // A task dropped in the LOWER half of the pool's plot.
    const [px, py, pw, ph] = pool.deserializedXYWH;
    const plot = backgroundPlot(BPMN_POOL_BACKGROUND, pw, ph);
    const taskId = surface.addElement({
      type: 'bpmnNode',
      kind: 'task',
      role: 'bpmn:task',
      shapeType: 'rect',
      xywh: `[${px + plot.x0 + 40},${py + plot.y0 + plot.height * 0.7},120,72]`,
    });
    const task = surface.getElementById(taskId) as BpmnNodeElementModel;

    const zones = backgroundInstanceZones(
      BPMN_POOL_BACKGROUND,
      pool as unknown as Readonly<Record<string, unknown>>
    );
    expect(zones.map(zone => zone.id)).toEqual([
      `lane:${lanes[0].id}`,
      `lane:${lanes[1].id}`,
    ]);
    expect(zones[0].name).toBe('Front office');

    // Asked, not recomputed. `bpmnLaneOf` IS the centre-against-plot-ratios
    // arithmetic this spec used to spell out inline, and it is the same
    // arithmetic the audit runs — so the question a rule will ask is the
    // question answered here, on a real editor, against a real dropped task.
    expect(bpmnLaneOf(pool, task.elementBound)?.id).toBe(lanes[1].id);
    expect(bpmnPoolOf([pool], task.elementBound)).toBe(pool);
  });

  test('a lane’s title band belongs to the lane, not to a gutter', () => {
    const pool = addPool();
    const surface = getSurface(window.doc, window.editor).model;
    surface.updateElement(pool.id, {
      lanes: [
        { id: 'top', name: 'Front office', size: 1 },
        { id: 'bottom', name: 'Back office', size: 1 },
      ],
    });

    const [px, py, pw, ph] = pool.deserializedXYWH;
    const plot = backgroundPlot(BPMN_POOL_BACKGROUND, pw, ph);
    const zones = backgroundInstanceZones(
      BPMN_POOL_BACKGROUND,
      pool as unknown as Readonly<Record<string, unknown>>
    );

    // The strip is CHROME inside the lane, so the zone rects still cover the
    // whole plot: an element sitting ON a title band is in that lane, which is
    // what BPMN means by the band belonging to it.
    expect(zones.map(zone => zone.rect)).toEqual([
      { x: 0, y: 0, w: 1, h: 0.5 },
      { x: 0, y: 0.5, w: 1, h: 0.5 },
    ]);

    const strip = backgroundInstanceZoneBand(
      BPMN_POOL_BACKGROUND,
      zones[1],
      plot
    );
    expect(strip).not.toBeNull();

    // A small node whose centre lands squarely on the lower lane's strip.
    const cx = px + strip!.x + strip!.w / 2;
    const cy = py + strip!.y + strip!.h / 2;
    const nodeId = surface.addElement({
      type: 'bpmnNode',
      kind: 'task',
      role: 'bpmn:task',
      shapeType: 'rect',
      xywh: `[${cx - 10},${cy - 10},20,20]`,
    });
    const bound = (surface.getElementById(nodeId) as BpmnNodeElementModel)
      .elementBound;

    // Asked through the facts, like the lane test above: the strip is chrome,
    // so the answer has to be the lane it is drawn in and not "no lane".
    expect(bpmnLaneOf(pool, bound)?.id).toBe('bottom');
  });

  test('removing the last lane takes the prop back out of the document', async () => {
    const pool = addPool();

    await invoke('bpmn.addLane');
    expect(pool.lanes).toHaveLength(1);

    await invoke('bpmn.removeLane');
    // Not `[]` — the KEY goes, so the pool returns to its pre-lane bytes.
    expect(pool.lanes).toBeUndefined();
    expect(pool.yMap.has('lanes')).toBe(false);
  });

  test('a lane is one undo step, and undoing it leaves no trace', async () => {
    const pool = addPool();

    await invoke('bpmn.addLane');
    await invoke('bpmn.addLane');
    expect(pool.lanes).toHaveLength(2);

    window.doc.undo();
    await wait();
    expect(pool.lanes).toHaveLength(1);

    window.doc.undo();
    await wait();
    // All the way back to a pool that never had a lane — the key included.
    expect(pool.lanes).toBeUndefined();
    expect(pool.yMap.has('lanes')).toBe(false);
  });

  test('the lane commands withdraw when no pool is selected', () => {
    addPool();
    edgeless.gfx.selection.clear();

    expect(command('bpmn.addLane').when?.(edgeless.std)).toBe(false);
    expect(command('bpmn.removeLane').when?.(edgeless.std)).toBe(false);
  });
});

/**
 * The descriptive-profile toolbox, on a real editor.
 *
 * BPMN is the first SHIPPED framework whose catalogue outgrows the fourteen
 * senior slots, so what `catalogue-overflow.spec.ts` proved on a synthetic
 * sixteen-command owner now has to hold for a framework a user actually opens:
 * the sub-menu collapses to seven ranked buttons plus "More artefacts…", and
 * the panel behind that button is the whole toolbox, in its sections.
 */
describe('the BPMN toolbox past fourteen', () => {
  let edgeless!: EdgelessRootBlockComponent;
  let menu!: BpmnMenuElement;
  let menuHost!: HTMLElement;

  beforeEach(async () => {
    // The usage measure is what the ranking reads, and it persists across
    // tests in this file. Start from silence so the seven are the cold-start
    // seven — the first seven in authored order — rather than whatever an
    // earlier scenario happened to click.
    localStorage.removeItem(COMMAND_USAGE_KEY);
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');

    // The popover, mounted the way the senior button mounts it. Its inner
    // slide menu consumes the toolbar's resize slot through Lit context, which
    // a standalone mount has to provide (a subject nobody ever fires).
    menu = document.createElement(
      'edgeless-bpmn-menu'
    ) as unknown as BpmnMenuElement;
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

  const catalogueWidget = () =>
    edgeless.widgetComponents['edgeless-artefact-catalogue-widget'];

  const catalogueRoot = () => catalogueWidget()?.shadowRoot ?? null;

  test('the sub-menu overflows: seven ranked slots plus More artefacts', () => {
    // 24 declared, 14 of them nominated for the row — and past the cap the
    // fourteen do not matter either: the catalogue is what gets ranked. The
    // twenty-fourth is `bpmn.exportXml`, which draws nothing and is therefore
    // in the catalogue and out of the sub-menu, like the two lane gestures.
    expect(
      getCommandsForSurface(edgeless.std, 'bpmn', 'catalogue')
    ).toHaveLength(24);
    expect(buttons()).toHaveLength(SENIOR_MENU_RANKED_SLOTS + 1);
  });

  test('the seven a first-time user meets can draw a process between them', async () => {
    // The recette regression, on the real popover. `beforeEach` clears the
    // usage store, so this IS a first contact: both ranking axes collapse to
    // authored order and the row is the first seven of the catalogue.
    //
    // It used to read Start, Message start, Timer start, End, Message end,
    // Terminate end, Task — six events and a rectangle, with nothing to connect
    // them. Now it is a start, an end, a task, a branch, the arrow between them,
    // the frame they sit in, and the one arrow allowed to leave it.
    //
    // Asserted on `menu.commands` — the mounted component's own selection,
    // which `render()` maps one-to-one onto the buttons. The buttons themselves
    // carry an icon and a `.tooltip` property and no label in the DOM, so there
    // is nothing text-shaped to read off them; the ranked-slot count above is
    // what ties this list to what is painted.
    expect(menu.commands.map(command => command.id)).toEqual([
      'bpmn.addStartEvent',
      'bpmn.addEndEvent',
      'bpmn.addTask',
      'bpmn.addExclusiveGateway',
      'bpmn.sequenceFlowTool',
      'bpmn.addPool',
      'bpmn.messageFlowTool',
    ]);
    expect(menu.commands).toHaveLength(SENIOR_MENU_RANKED_SLOTS);
  });

  test('the last button opens the catalogue on BPMN, in its sections', async () => {
    buttons().at(-1)!.click();
    await wait(0);
    await catalogueWidget()?.updateComplete;

    const panel = catalogueRoot()?.querySelector<HTMLElement>(
      '[data-testid="artefact-catalogue-panel"]'
    );
    expect(panel).not.toBeNull();
    expect(panel!.dataset.owner).toBe('bpmn');

    // The seven sections BPMN declares, in the order each is FIRST met — the
    // panel never sorts headers alphabetically. `swimlanes` sits fifth and not
    // last because the pool is one of the seven a user meets on a blank board,
    // and the section follows the earliest command filed under it.
    const groups = Array.from(
      catalogueRoot()?.querySelectorAll<HTMLElement>(
        '[data-testid="artefact-catalogue-group"]'
      ) ?? []
    );
    expect(groups.map(group => group.dataset.category)).toEqual([
      'events',
      'activities',
      'gateways',
      'flows',
      'swimlanes',
      'data',
      'annotations',
    ]);
    // …and every header reads as a phrase, not as a raw key: with no host
    // catalogue registered, `humanizeCategory` is what the panel falls back to.
    expect(groups[0].textContent).toContain('Events');
    expect(groups.at(-1)!.textContent).toContain('Annotations');

    // 21 rows, not 24: the panel filters on availability, and the two lane
    // gestures and the export all need a selected pool. Everything that can be
    // drawn from a blank board is listed.
    const entries = Array.from(
      catalogueRoot()?.querySelectorAll<HTMLElement>(
        '[data-testid="artefact-catalogue-entry"]'
      ) ?? []
    );
    expect(entries).toHaveLength(21);
    // The ones that are in the catalogue and NOT in the fourteen are reachable
    // here and nowhere else in the chrome — which is the whole promise.
    const ids = entries.map(entry => entry.dataset.commandId);
    expect(ids).toContain('bpmn.addTimerStartEvent');
    expect(ids).toContain('bpmn.addDataStore');
    expect(ids).toContain('bpmn.associationTool');
    expect(ids).toContain('bpmn.addGroup');
  });

  test('every new artefact command creates the node its kind means', async () => {
    const surface = getSurface(window.doc, window.editor).model;
    const created = new Map<string, string>();

    for (const descriptor of getCommandsForSurface(
      edgeless.std,
      'bpmn',
      'catalogue'
    )) {
      const element = descriptor.telemetry?.element ?? '';
      if (!element.startsWith('node:')) continue;
      runCommand(edgeless.std, descriptor, {
        surface: 'catalogue',
        source: 'toolbar:general',
      });
      created.set(descriptor.id, element.slice('node:'.length));
    }
    await wait();

    // Seventeen kinds, seventeen commands, seventeen elements — and each one
    // carries BOTH the kind that paints it and the role that says what it means.
    expect(created.size).toBe(17);
    const nodes = surface.getElementsByType(
      'bpmnNode'
    ) as BpmnNodeElementModel[];
    expect(nodes).toHaveLength(17);
    for (const node of nodes) {
      expect(node.role, node.kind).toBe(BPMN_ROLE_OF_KIND[node.kind]);
      // The unfilled ones: the three glyph-bodied artefacts, whose silhouette
      // the renderer draws, and the group, which is a lasso and must never
      // paint over what it is drawn around. Going through `createBpmnNode` is
      // what guarantees it; a hand-rolled creation site gets this wrong.
      const unfilled = ['dataObject', 'dataStore', 'textAnnotation', 'group'];
      expect(node.filled, node.kind).toBe(!unfilled.includes(node.kind));
    }
    expect(new Set(nodes.map(node => node.kind)).size).toBe(17);
  });

  test('the message-flow tool draws a dashed, role-stamped connector', async () => {
    const surface = getSurface(window.doc, window.editor).model;
    const commands = getCommandsForSurface(edgeless.std, 'bpmn', 'catalogue');
    const tool = commands.find(c => c.id === 'bpmn.messageFlowTool');
    expect(tool).toBeDefined();

    runCommand(edgeless.std, tool!, {
      surface: 'catalogue',
      source: 'toolbar:general',
    });
    await wait();

    // What the command actually does: it arms the native connector tool, and
    // the role travels in that tool's options (`ConnectorTool` writes
    // `role: this.activatedOption.role` onto every connector it creates, so an
    // edge drawn with this tool is BORN carrying it — the guarantee
    // `docs/adr/0010` asks for and the rules PR relies on).
    expect(edgeless.gfx.tool.currentToolName$.peek()).toBe('connector');

    // Below is the SHAPE of what that produces, assembled by hand: the props the
    // command recorded, plus the role the tool would have written. It checks the
    // preset the command arms and that a connector so built binds and routes —
    // NOT `ConnectorTool`'s own write, which is that tool's contract and is
    // covered where the tool lives.
    const from = surface.addElement({
      type: 'bpmnNode',
      kind: 'taskUser',
      role: BPMN_ROLE.taskUser,
      shapeType: 'rect',
      xywh: '[0,0,120,72]',
    });
    const to = surface.addElement({
      type: 'bpmnNode',
      kind: 'taskService',
      role: BPMN_ROLE.taskService,
      shapeType: 'rect',
      xywh: '[0,300,120,72]',
    });
    const last = edgeless.std.get(EditPropsStore).lastProps$.value.connector;
    const flowId = surface.addElement({
      type: 'connector',
      ...last,
      role: BPMN_ROLE.messageFlow,
      source: { id: from, position: [0.5, 0.5] },
      target: { id: to, position: [0.5, 0.5] },
    });
    await wait(200);

    const flow = surface.getElementById(flowId) as ConnectorElementModel;
    expect(flow.role).toBe(BPMN_ROLE.messageFlow);
    expect(flow.strokeStyle).toBe(StrokeStyle.Dash);
    expect(flow.frontEndpointStyle).toBe(PointStyle.Circle);
    expect(flow.rearEndpointStyle).toBe(PointStyle.Arrow);
    expect(flow.path.length).toBeGreaterThan(0);
  });

  test('the association tool arms a headless line and no direction', async () => {
    const tool = getCommandsForSurface(edgeless.std, 'bpmn', 'catalogue').find(
      c => c.id === 'bpmn.associationTool'
    );
    expect(tool).toBeDefined();

    runCommand(edgeless.std, tool!, {
      surface: 'catalogue',
      source: 'toolbar:general',
    });
    await wait();

    const last = edgeless.std.get(EditPropsStore).lastProps$.value.connector;
    expect(last.strokeStyle).toBe(StrokeStyle.Dash);
    // No head at either end: an association names no relation, so an arrowhead
    // would be the picture claiming a direction the role refuses to have.
    expect(last.frontEndpointStyle).toBe(PointStyle.None);
    expect(last.rearEndpointStyle).toBe(PointStyle.None);
  });
});

/**
 * The BPMN 2.0 XML export, on a REAL document.
 *
 * The unit suite owns the shape of the file — every assertion about namespaces,
 * nesting and the kind → element table lives there, on plain stubs. What only a
 * live editor can answer is whether the serializer reads the actual model: a
 * node's label is a `Y.Text` and not a string, a pool's bounds come off an
 * `xywh` the surface parsed, and a connector's routing is computed by the
 * manager rather than handed over. Those are the places a pure function tested
 * against hand-made stubs can be right about nothing.
 */
describe('the BPMN XML export, end to end', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    return cleanup;
  });

  const parse = (xml: string) => {
    const parsed = new DOMParser().parseFromString(xml, 'application/xml');
    expect(parsed.querySelector('parsererror')).toBeNull();
    return parsed;
  };

  /** Elements by local name, walked by hand — see the unit spec on why. */
  const byName = (root: Document, local: string) => {
    const found: Element[] = [];
    const walk = (element: Element) => {
      if (element.localName === local) found.push(element);
      for (const child of Array.from(element.children)) walk(child);
    };
    if (root.documentElement) walk(root.documentElement);
    return found;
  };

  const childrenNamed = (element: Element, local: string) =>
    Array.from(element.children).filter(child => child.localName === local);

  test('serializes a drawn process, labels and routing included', async () => {
    const surface = getSurface(window.doc, window.editor).model;

    const poolId = surface.addElement({
      type: 'bpmnPool',
      role: BPMN_ROLE.pool,
      name: 'Sales',
      xywh: '[0,0,600,400]',
      lanes: [
        { id: 'front', name: 'Front office', size: 1 },
        { id: 'back', name: 'Back office', size: 1 },
      ],
    });
    const pool = surface.getElementById(poolId) as BpmnPoolElementModel;

    // Two artefacts inside the pool, one per lane, each with a REAL label —
    // `text` is a `Y.Text`, which is the thing a hand-made stub never is.
    const startId = surface.addElement({
      type: 'bpmnNode',
      kind: 'startEvent',
      role: BPMN_ROLE_OF_KIND.startEvent,
      shapeType: 'ellipse',
      text: 'Order received',
      xywh: '[100,60,56,56]',
    });
    const taskId = surface.addElement({
      type: 'bpmnNode',
      kind: 'taskUser',
      role: BPMN_ROLE_OF_KIND.taskUser,
      shapeType: 'rect',
      text: 'Check the stock',
      xywh: '[300,260,120,72]',
    });
    const flowId = surface.addElement({
      type: 'connector',
      mode: ConnectorMode.Orthogonal,
      role: BPMN_ROLE.sequenceFlow,
      source: { id: startId, position: [0.5, 0.5] },
      target: { id: taskId, position: [0.5, 0.5] },
    });
    // …and one plain rectangle, which is not a BPMN artefact and must not
    // become an unnamed task.
    surface.addElement({
      type: 'shape',
      shapeType: 'rect',
      xywh: '[0,0,10,10]',
    });

    // Let the connector manager route the flow: `absolutePath` is `@local()`,
    // computed while the board is on screen, and it is what the export prefers
    // to a straight line between two centres.
    await wait(200);
    const flow = surface.getElementById(flowId) as ConnectorElementModel;
    expect(flow.absolutePath.length).toBeGreaterThanOrEqual(2);

    const board = bpmnBoardOf(edgeless.std);
    expect(board.pools).toHaveLength(1);
    expect(board.nodes).toHaveLength(2);
    expect(board.connectors).toHaveLength(1);

    const doc = parse(exportBpmnXml(board, { name: 'Order to cash' }));

    // The label came off a `Y.Text` and reached the file as characters.
    expect(byName(doc, 'userTask').map(e => e.getAttribute('name'))).toEqual([
      'Check the stock',
    ]);
    expect(byName(doc, 'startEvent')[0].getAttribute('name')).toBe(
      'Order received'
    );

    // The participant is the pool, and the lanes are the pool's.
    expect(byName(doc, 'participant')[0].getAttribute('name')).toBe('Sales');
    const lanes = byName(doc, 'lane');
    expect(lanes.map(l => l.getAttribute('name'))).toEqual([
      'Front office',
      'Back office',
    ]);

    // …and each artefact is referenced by the lane `bpmnLaneOf` puts it in.
    const start = surface.getElementById(startId) as BpmnNodeElementModel;
    const task = surface.getElementById(taskId) as BpmnNodeElementModel;
    expect(bpmnLaneOf(pool, start.elementBound)?.id).toBe('front');
    expect(bpmnLaneOf(pool, task.elementBound)?.id).toBe('back');
    const refs = lanes.map(lane =>
      childrenNamed(lane, 'flowNodeRef').map(child => child.textContent)
    );
    expect(refs[0]).toHaveLength(1);
    expect(refs[1]).toHaveLength(1);
    expect(refs[0][0]).not.toBe(refs[1][0]);

    // The routing the manager computed, not a straight line between centres.
    const edge = byName(doc, 'BPMNEdge')[0];
    expect(childrenNamed(edge, 'waypoint')).toHaveLength(
      flow.absolutePath.length
    );

    // The plain rectangle said nothing and is nowhere in the file: one shape
    // for the participant and one for each of the two artefacts.
    expect(byName(doc, 'task')).toHaveLength(0);
    expect(byName(doc, 'BPMNShape')).toHaveLength(3);
  });

  test('the command is offered on a selected pool and exports the board', async () => {
    const surface = getSurface(window.doc, window.editor).model;
    const poolId = surface.addElement({
      type: 'bpmnPool',
      role: BPMN_ROLE.pool,
      xywh: '[0,0,600,400]',
    });
    surface.addElement({
      type: 'bpmnNode',
      kind: 'task',
      role: BPMN_ROLE_OF_KIND.task,
      shapeType: 'rect',
      xywh: '[100,100,120,72]',
    });
    await wait();

    const command = getRegisteredCommands(edgeless.std).find(
      c => c.id === 'bpmn.exportXml'
    );
    expect(command, 'bpmn.exportXml is not registered').toBeDefined();

    // Nothing selected: the entry withdraws rather than greying.
    edgeless.gfx.selection.clear();
    expect(command!.when?.(edgeless.std)).toBe(false);

    edgeless.gfx.selection.set({ elements: [poolId], editing: false });
    expect(command!.when?.(edgeless.std)).toBe(true);

    // And the WHOLE board is what it serializes — the selected pool decides
    // the filename and nothing else.
    const doc = parse(exportBpmnXml(bpmnBoardOf(edgeless.std)));
    expect(byName(doc, 'participant')).toHaveLength(1);
    expect(byName(doc, 'task')).toHaveLength(1);
  });
});
