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
  });

  test('w then i creates an inertia bar', async () => {
    key('w');
    key('i');
    await wait();

    const shapes = service.surface.getElementsByType('shape');
    expect(shapes.length).toBe(1);
  });

  test('an unknown key in the armed wardley namespace does nothing (w+e ≠ eraser)', async () => {
    const before = service.gfx.tool.currentToolName$.peek();

    key('w');
    key('e'); // no wardley shortcut on 'e' — must NOT reach the eraser binding
    await wait();

    expect(service.gfx.tool.currentToolName$.peek()).toBe(before);
    expect(service.surface.elementModels.length).toBe(0);

    // the namespace was left: 'e' alone still reaches the eraser tool
    key('e');
    await wait();
    expect(service.gfx.tool.currentToolName$.peek()).toBe('eraser');
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
