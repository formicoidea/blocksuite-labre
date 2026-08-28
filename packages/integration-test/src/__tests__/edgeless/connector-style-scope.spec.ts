import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { ConnectorTool } from '@labre/affine/gfx/connector';
import {
  type ConnectorElementModel,
  ConnectorMode,
  PointStyle,
  type ShapeElementModel,
  ShapeType,
  StrokeStyle,
} from '@labre/affine/model';
import { EditPropsStore } from '@labre/affine/shared/services';
import { getRegisteredCommands, runCommand } from '@labre/affine/std';
// Straight off the framework package, as `bpmn.spec.ts` already does:
// `@labre/affine` re-exports the blocks, not the framework modules.
import { BPMN_ROLE } from '@labre/affine-gfx-bpmn';
import { C4_ROLE } from '@labre/affine-gfx-c4';
import type { BlockStdScope } from '@labre/std';
import { beforeEach, describe, expect, test } from 'vitest';

import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * Review #144 M1, end to end: a framework flow tool must style ITS OWN edges
 * without restyling the plain connector tool. BPMN 2.0 (p.40) forbids other
 * connectors adopting a flow's line style, and the leak did exactly that —
 * arming a typed flow wrote its look into `EditPropsStore`, so the next plain
 * connector came out dressed as a flow while carrying no role.
 *
 * The fix moves the framework look onto `ConnectorToolOptions.style`, applied
 * at creation only. This spec pins both halves of the contract on a real
 * editor: the user's own last plain style survives a framework activation,
 * and the framework edge still draws with its full look and role.
 */
describe('framework flow styles never leak into the plain connector', () => {
  let service!: EdgelessRootBlockComponent['service'];
  let std!: BlockStdScope;

  beforeEach(async () => {
    sessionStorage.removeItem('blocksuite:prop:record');
    const cleanup = await setupEditor('edgeless');
    const edgelessRoot = getDocRootBlock(window.doc, window.editor, 'edgeless');
    service = edgelessRoot.service;
    std = edgelessRoot.std;
    return cleanup;
  });

  const addShape = () => {
    const id = service.crud.addElement('shape', {
      shapeType: ShapeType.Rect,
      xywh: '[0,0,100,100]',
    });
    if (!id) throw new Error('failed to add shape');
    return service.crud.getElementById(id) as ShapeElementModel;
  };

  /**
   * Draw with the CURRENTLY ARMED connector tool, from the given shape — the
   * quick-connect gesture, which runs the tool's real creation path.
   */
  const draw = (from: ShapeElementModel) => {
    const tool = service.gfx.tool.currentTool$.peek() as ConnectorTool;
    const point = service.gfx.viewport.toViewCoord(50, 50);
    tool.quickConnect(point, from);
    const connectors = service.surface.getElementsByType('connector');
    return connectors[connectors.length - 1] as ConnectorElementModel;
  };

  test('arm sequence flow → draw → the plain connector stays its own', () => {
    const shape = addShape();

    // The user's own plain style, recorded the ordinary way.
    const ownId = service.crud.addElement('connector', {
      mode: ConnectorMode.Straight,
    });
    if (!ownId) throw new Error('failed to add connector');
    service.crud.updateElement(ownId, { strokeWidth: 10 });

    // Arm the BPMN sequence flow through its real command…
    const command = getRegisteredCommands(std).find(
      candidate => candidate.id === 'bpmn.sequenceFlowTool'
    );
    expect(command, 'bpmn.sequenceFlowTool is not registered').toBeTruthy();
    runCommand(std, command!, {
      surface: 'senior-menu',
      source: 'toolbar:general',
    });

    // …and the last-props store did not move: still the user's own style.
    const last = std.get(EditPropsStore).lastProps$.value.connector;
    expect(last.strokeStyle).toBe(StrokeStyle.Solid);
    expect(last.rearEndpointStyle).toBe(PointStyle.Arrow);
    expect(last.strokeWidth).toBe(10);

    // The flow itself still draws with the full BPMN look, and the role.
    const flow = draw(shape);
    expect(flow.role).toBe(BPMN_ROLE.sequenceFlow);
    expect(flow.mode).toBe(ConnectorMode.Orthogonal);
    expect(flow.strokeStyle).toBe(StrokeStyle.Solid);
    expect(flow.frontEndpointStyle).toBe(PointStyle.None);
    expect(flow.rearEndpointStyle).toBe(PointStyle.Triangle);

    // Pick the plain connector tool and draw: the user's own style, the plain
    // default markers, and NO role — not a message-flow costume.
    service.gfx.tool.setTool(ConnectorTool, { mode: ConnectorMode.Straight });
    const plain = draw(shape);
    expect(plain.yMap.has('role')).toBe(false);
    expect(plain.strokeStyle).toBe(StrokeStyle.Solid);
    expect(plain.frontEndpointStyle).toBe(PointStyle.None);
    expect(plain.rearEndpointStyle).toBe(PointStyle.Arrow);
    expect(plain.strokeWidth).toBe(10);
  });

  /**
   * The same contract on the framework that arrived AFTER the fix. C4's
   * relationship is the loudest costume of the lot — dashed where the plain
   * connector is solid — so a leak here would be visible on the very next edge
   * the user draws, and the invariant only holds if it holds for every
   * framework that arms the connector, not just the six the fix was written
   * for.
   */
  test('arm c4 relationship → draw → the plain connector stays plain', () => {
    const shape = addShape();

    // The user's own plain style, recorded the ordinary way.
    const ownId = service.crud.addElement('connector', {
      mode: ConnectorMode.Straight,
    });
    if (!ownId) throw new Error('failed to add connector');
    service.crud.updateElement(ownId, { strokeWidth: 10 });

    const command = getRegisteredCommands(std).find(
      candidate => candidate.id === 'c4.relationshipTool'
    );
    expect(command, 'c4.relationshipTool is not registered').toBeTruthy();
    runCommand(std, command!, {
      surface: 'senior-menu',
      source: 'toolbar:general',
    });

    // The last-props store did not move: still the user's own style.
    const last = std.get(EditPropsStore).lastProps$.value.connector;
    expect(last.strokeStyle).toBe(StrokeStyle.Solid);
    expect(last.rearEndpointStyle).toBe(PointStyle.Arrow);
    expect(last.strokeWidth).toBe(10);

    // The relationship itself still draws with the whole C4 stencil: straight,
    // dashed, filled head, and the role.
    const relationship = draw(shape);
    expect(relationship.role).toBe(C4_ROLE.relationship);
    expect(relationship.mode).toBe(ConnectorMode.Straight);
    expect(relationship.strokeStyle).toBe(StrokeStyle.Dash);
    expect(relationship.frontEndpointStyle).toBe(PointStyle.None);
    expect(relationship.rearEndpointStyle).toBe(PointStyle.Triangle);

    // …and the plain connector is still SOLID, still the user's width, still
    // roleless — not a relationship in disguise.
    service.gfx.tool.setTool(ConnectorTool, { mode: ConnectorMode.Straight });
    const plain = draw(shape);
    expect(plain.yMap.has('role')).toBe(false);
    expect(plain.strokeStyle).toBe(StrokeStyle.Solid);
    expect(plain.frontEndpointStyle).toBe(PointStyle.None);
    expect(plain.rearEndpointStyle).toBe(PointStyle.Arrow);
    expect(plain.strokeWidth).toBe(10);
  });
});
