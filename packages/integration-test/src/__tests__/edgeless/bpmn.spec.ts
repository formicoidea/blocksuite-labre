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
  bpmnLaneOf,
  bpmnPoolOf,
} from '@labre/affine-gfx-bpmn';
import {
  type BpmnNodeElementModel,
  type BpmnPoolElementModel,
  type ConnectorElementModel,
  ConnectorMode,
  ShapeElementModel,
} from '@labre/affine/model';
import {
  type AnyCommandDescriptor,
  getRegisteredCommands,
  runCommand,
} from '@labre/affine/std';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock, getSurface } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

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
