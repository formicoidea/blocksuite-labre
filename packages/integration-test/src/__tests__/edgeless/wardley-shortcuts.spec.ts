import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

const key = (k: string) =>
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })
  );

describe('wardley canvas shortcuts', () => {
  let service!: EdgelessRootBlockComponent['service'];

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    service = getDocRootBlock(window.doc, window.editor, 'edgeless').service;
    // The dispatcher only runs keyDown handlers while active (normally set by
    // a pointerdown/click/focusin on the host).
    service.std.event.active = true;

    return cleanup;
  });

  test('w then c creates a wardley component node group', async () => {
    expect(service.surface.elementModels.length).toBe(0);

    key('w');
    key('c');
    await wait();

    const types = service.surface.elementModels.map(m => m.type);
    expect(types).toContain('wardleyNode');
    // node + label are grouped
    expect(types).toContain('group');

    // The semantic role reaches the shared document, not just the model
    // accessor — the whole point of declaring `role` on the base element
    // model. Since PF13.6 the label grouped with it carries one too: it is a
    // free text element, so its role is the only thing that says it names an
    // artefact, and W3 is written on that.
    const node = service.surface.getElementsByType('wardleyNode')[0];
    expect(node.role).toBe('wardley:component');
    expect(node.yMap.get('role')).toBe('wardley:component');

    const label = service.surface.getElementsByType('text')[0];
    expect(label.yMap.get('role')).toBe('wardley:label');
  });

  test('w then i creates an inertia bar, carrying its role', async () => {
    key('w');
    key('i');
    await wait();

    const shapes = service.surface.getElementsByType('shape');
    expect(shapes.length).toBe(1);
    // A plain filled rect on the canvas: the role is the whole of what makes
    // it inertia, and what W2 is written on (PF13.5).
    expect(shapes[0].yMap.get('role')).toBe('wardley:inertia');
  });

  test('w then a creates an anchor, carrying its role (labre#538)', async () => {
    key('w');
    key('a');
    await wait();

    const nodes = service.surface.getElementsByType('wardleyNode');
    expect(nodes.length).toBe(1);
    expect(nodes[0].yMap.get('role')).toBe('wardley:anchor');
  });

  test('w then e arms the evolution arrow tool (labre#538)', async () => {
    key('w');
    key('e');
    await wait();

    // A connector tool, not the eraser `e` alone reaches: the chord was
    // consumed by the wardley namespace. Nothing is drawn until a drag.
    expect(service.gfx.tool.currentToolName$.peek()).toBe('connector');
    expect(service.surface.elementModels.length).toBe(0);
  });

  test('an unknown key in the armed wardley namespace does nothing (w+h ≠ hand)', async () => {
    const before = service.gfx.tool.currentToolName$.peek();

    key('w');
    key('h'); // no wardley shortcut on 'h' — must NOT reach the hand binding
    await wait();

    expect(service.gfx.tool.currentToolName$.peek()).toBe(before);
    expect(service.surface.elementModels.length).toBe(0);

    // the namespace was left: 'h' alone still reaches the hand tool
    key('h');
    await wait();
    expect(service.gfx.tool.currentToolName$.peek()).toBe('pan');
  });

  test('the chord prefix expires and does not leak into single keys', async () => {
    key('w');
    // wait past the chord timeout (1.2s)
    await wait(1500);
    key('c');
    await wait();

    // 'c' alone activates the connector tool (edgeless keyboard), creates nothing
    expect(service.surface.elementModels.length).toBe(0);
  });
});
