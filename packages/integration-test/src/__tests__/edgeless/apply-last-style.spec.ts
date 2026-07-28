import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import {
  DefaultTheme,
  FontStyle,
  type ShapeElementModel,
  ShapeType,
} from '@labre/affine/model';
import { EditPropsStore } from '@labre/affine/shared/services';
import type { BlockStdScope } from '@labre/std';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

const press = (key: string, ctrl = true) =>
  document.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      ctrlKey: ctrl,
      bubbles: true,
      cancelable: true,
    })
  );

describe('mod+y applies the last used style across element types', () => {
  let service!: EdgelessRootBlockComponent['service'];
  let std!: BlockStdScope;

  beforeEach(async () => {
    sessionStorage.removeItem('blocksuite:prop:record');
    const cleanup = await setupEditor('edgeless');
    const edgelessRoot = getDocRootBlock(window.doc, window.editor, 'edgeless');
    service = edgelessRoot.service;
    std = edgelessRoot.std;
    // The dispatcher only runs keyDown handlers while active (normally set by
    // a pointerdown/click/focusin on the host).
    std.event.active = true;
    return cleanup;
  });

  function addShape(shapeType: ShapeType) {
    const id = service.crud.addElement('shape', { shapeType });
    if (!id) throw new Error('failed to add shape');
    return service.crud.getElementById(id) as ShapeElementModel;
  }

  test('a fill picked on a rect repaints an ellipse', async () => {
    const rect = addShape(ShapeType.Rect);
    const ellipse = addShape(ShapeType.Ellipse);
    const ellipseXYWH = ellipse.xywh;

    // Real recording path: styling the rect via crud records the last style.
    service.crud.updateElement(rect.id, {
      fillColor: DefaultTheme.FillColorShortMap.Orange,
    });
    expect(ellipse.fillColor).not.toBe(DefaultTheme.FillColorShortMap.Orange);

    service.gfx.selection.set({ elements: [ellipse.id], editing: false });
    press('y');
    await wait();

    expect(ellipse.fillColor).toBe(DefaultTheme.FillColorShortMap.Orange);
    expect(ellipse.xywh).toBe(ellipseXYWH);
  });

  test('a font style set on a text restyles a shape', async () => {
    const rect = addShape(ShapeType.Rect);
    expect(rect.fontStyle).toBe(FontStyle.Normal);

    // Same layer a real font-style edit on a text element records through.
    std.get(EditPropsStore).recordLastProps('text', {
      fontStyle: FontStyle.Italic,
    });

    service.gfx.selection.set({ elements: [rect.id], editing: false });
    press('y');
    await wait();

    expect(rect.fontStyle).toBe(FontStyle.Italic);
  });

  test('one undo restores the previous style', async () => {
    const rect = addShape(ShapeType.Rect);
    const ellipse = addShape(ShapeType.Ellipse);
    const originalFill = ellipse.fillColor;

    service.crud.updateElement(rect.id, {
      fillColor: DefaultTheme.FillColorShortMap.Orange,
    });
    service.gfx.selection.set({ elements: [ellipse.id], editing: false });
    press('y');
    await wait();
    expect(ellipse.fillColor).toBe(DefaultTheme.FillColorShortMap.Orange);

    std.store.undo();
    await wait();
    expect(ellipse.fillColor).toBe(originalFill);
  });

  test('mod+d duplicates the selection', async () => {
    const rect = addShape(ShapeType.Rect);
    expect(service.surface.getElementsByType('shape').length).toBe(1);

    service.gfx.selection.set({ elements: [rect.id], editing: false });
    press('d');
    await wait(100);

    expect(service.surface.getElementsByType('shape').length).toBe(2);
  });
});
