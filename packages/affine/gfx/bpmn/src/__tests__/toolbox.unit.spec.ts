import { recordAction } from '@labre/affine-block-surface';
import { type BpmnNodeKind, ConnectorMode } from '@labre/affine-model';
import { describe, expect, it } from 'vitest';

import { createBpmnNode, createBpmnPool } from '../actions';
import { bpmnCommandsManifest } from '../commands-manifest';
import {
  BPMN_EDGE_STYLE,
  BPMN_EXTERNAL_LABEL_KINDS,
  bpmnLabelMode,
  NODE_LABEL,
  NODE_SIZE,
  POOL_REF_HEIGHT,
  POOL_REF_WIDTH,
} from '../consts';
import {
  bpmnLabelBoxFor,
  bpmnLabelProps,
  bpmnNodeProps,
  bpmnPoolProps,
} from '../presets';
import { BPMN_ROLE } from '../roles';
import {
  BPMN_TOOLBOX,
  bpmnFlowElement,
  bpmnNodeElements,
  bpmnPoolElement,
} from '../toolbox';

/**
 * BPMN's toolbar as pure builders (`docs/adr/0045`). What it would have caught:
 * an artefact built for a host that differs from the toolbar's (a node without
 * the preset's props, an event carrying its name inside instead of in a
 * grouped `bpmn:label`, a group that is not last or does not hold both), a
 * pool whose lanes the lane gesture would not have written, a flow drawn in
 * another line than its tool's, and a toolbar item a host cannot name the way
 * the toolbar does.
 */

const KINDS = Object.keys(NODE_SIZE) as BpmnNodeKind[];

/** A record or a built element, minus what only the writer decides. */
function body(element: Record<string, unknown>) {
  const {
    id: _id,
    index: _index,
    title: _title,
    children: _children,
    ...rest
  } = element;
  return Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== undefined)
  );
}

describe('bpmn toolbox', () => {
  it('builds an inscribed artefact as one element carrying its name', () => {
    const elements = bpmnNodeElements(
      'task',
      { x: 100, y: 50 },
      { name: 'Valider la commande' },
      't'
    );
    const { w, h } = NODE_SIZE.task;
    expect(elements).toEqual([
      {
        ...bpmnNodeProps('task', {
          xywh: `[100,50,${w},${h}]`,
          text: 'Valider la commande',
        }),
        id: 't:node',
      },
    ]);
  });

  it.each(BPMN_EXTERNAL_LABEL_KINDS)(
    'builds a %s as the bare symbol, its bpmn:label under it, group last',
    kind => {
      const { w, h } = NODE_SIZE[kind];
      const [node, label, group, ...rest] = bpmnNodeElements(
        kind,
        { x: 0, y: 0 },
        { name: 'Commande reçue' },
        'n'
      );
      expect(rest).toEqual([]);
      expect(node).toEqual({
        ...bpmnNodeProps(kind, { xywh: `[0,0,${w},${h}]` }),
        id: 'n:node',
      });
      expect(node?.text).toBeUndefined();
      const at = bpmnLabelBoxFor(kind, w / 2, h / 2);
      expect(label).toEqual({
        ...bpmnLabelProps('Commande reçue', at.x, at.y),
        id: 'n:label',
      });
      expect(label?.role).toBe(BPMN_ROLE.label);
      expect(group).toEqual({
        type: 'group',
        id: 'n:group',
        children: { 'n:node': true, 'n:label': true },
      });
    }
  );

  it.each(KINDS)('seeds an unnamed %s with the toolbar English seed', kind => {
    const elements = bpmnNodeElements(kind, { x: 0, y: 0 });
    const named =
      bpmnLabelMode(kind) === 'external' ? elements[1] : elements[0];
    expect(named?.text).toBe(NODE_LABEL[kind]);
  });

  it.each(KINDS)('places a %s as the toolbar action does', kind => {
    // The action draws around the recording's (0, 0) viewport centre.
    const { w, h } = NODE_SIZE[kind];
    const records = recordAction(std => createBpmnNode(std, kind)).records;
    const built = bpmnNodeElements(kind, { x: -w / 2, y: -h / 2 });
    expect(records.map(body)).toEqual(built.map(body));
  });

  it('builds a pool as the toolbar does, and its lanes as the lane gesture', () => {
    expect(bpmnPoolElement({ x: 10, y: 20 })).toEqual({
      ...bpmnPoolProps({
        xywh: `[10,20,${POOL_REF_WIDTH},${POOL_REF_HEIGHT}]`,
        name: 'Pool',
      }),
      id: 'pool',
    });
    const records = recordAction(createBpmnPool).records;
    expect(records.map(body)).toEqual([
      body(
        bpmnPoolElement({ x: -POOL_REF_WIDTH / 2, y: -POOL_REF_HEIGHT / 2 })
      ),
    ]);

    const pool = bpmnPoolElement(
      { x: 0, y: 0 },
      { name: 'Client', lanes: 'Ventes\n\nLogistique' },
      'client'
    );
    expect(pool).toMatchObject({
      type: 'bpmnPool',
      role: BPMN_ROLE.pool,
      name: 'Client',
      lanes: [
        { id: 'client-lane-1', name: 'Ventes', size: 1 },
        { id: 'client-lane-2', name: 'Lane 2', size: 1 },
        { id: 'client-lane-3', name: 'Logistique', size: 1 },
      ],
    });
  });

  it('draws each flow in the line its tool is armed with', () => {
    expect(bpmnFlowElement('sequenceFlow', 'a', 'b', 'oui')).toEqual({
      type: 'connector',
      role: BPMN_ROLE.sequenceFlow,
      mode: ConnectorMode.Orthogonal,
      ...BPMN_EDGE_STYLE.sequenceFlow,
      source: { id: 'a' },
      target: { id: 'b' },
      text: 'oui',
    });
    for (const link of BPMN_TOOLBOX.links) {
      const flow = link.build('a', 'b');
      expect(flow.type).toBe('connector');
      expect(flow).not.toHaveProperty('text');
    }
    expect(BPMN_TOOLBOX.links.map(link => link.build('a', 'b').role)).toEqual([
      BPMN_ROLE.sequenceFlow,
      BPMN_ROLE.messageFlow,
      BPMN_ROLE.association,
    ]);
  });

  it('lists every toolbar artefact, named by its toolbar command', () => {
    expect(BPMN_TOOLBOX.items.map(i => i.id)).toEqual([
      'start-event',
      'end-event',
      'task',
      'exclusive-gateway',
      'pool',
      'user-task',
      'service-task',
      'sub-process',
      'call-activity',
      'parallel-gateway',
      'message-start-event',
      'timer-start-event',
      'message-end-event',
      'terminate-end-event',
      'data-object',
      'data-store',
      'text-annotation',
      'group',
    ]);
    // Every node kind once: one item per kind, plus the pool.
    expect(BPMN_TOOLBOX.items.length).toBe(KINDS.length + 1);
    const rows = bpmnCommandsManifest.map(r => r.labelKey);
    const all = [...BPMN_TOOLBOX.items, ...BPMN_TOOLBOX.links];
    for (const item of all) {
      expect(rows, item.id).toContain(item.labelKey);
    }
    // …in the toolbar's own order.
    const positions = BPMN_TOOLBOX.items.map(i => rows.indexOf(i.labelKey));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});
