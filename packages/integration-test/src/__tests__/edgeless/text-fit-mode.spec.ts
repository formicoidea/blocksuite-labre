import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import {
  applyTextFitMode,
  effectiveShapeFontSize,
  MIN_CONTAINED_FONT_SIZE,
  nextTextFitMode,
  normalizeShapeBound,
} from '@labre/affine/gfx/shape';
import type { ShapeElementModel } from '@labre/affine/model';
import { TextFitMode } from '@labre/affine/model';
import { Bound } from '@labre/global/gfx';
import { beforeEach, describe, expect, test } from 'vitest';
import * as Y from 'yjs';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

describe('shape text fit mode', () => {
  let service!: EdgelessRootBlockComponent['service'];

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    service = getDocRootBlock(window.doc, window.editor, 'edgeless').service;

    return cleanup;
  });

  const addShape = (props: Record<string, unknown> = {}) => {
    const id = service.surface.addElement({
      type: 'shape',
      shapeType: 'rect',
      xywh: '[0,0,120,80]',
      text: new Y.Text('post-it'),
      ...props,
    });
    return service.surface.getElementById(id) as ShapeElementModel;
  };

  test('defaults to grow — documents created before the prop stay intact', async () => {
    const shape = addShape();
    await wait();
    expect(shape.textFitMode).toBe(TextFitMode.Grow);
  });

  test('the mode round-trips through the document', async () => {
    const shape = addShape({ textFitMode: TextFitMode.Contained });
    await wait();
    expect(shape.textFitMode).toBe(TextFitMode.Contained);
  });

  test('grow keeps the bound clamp; contained/overflow free the bounds', async () => {
    const shape = addShape({
      text: new Y.Text('a fairly long text that needs wrapping room'),
    });
    await wait();

    const tiny = () => new Bound(0, 0, 30, 20);

    // grow: the bound is clamped up to fit the text
    const grown = normalizeShapeBound(shape, tiny());
    expect(grown.w).toBeGreaterThan(30);
    expect(grown.h).toBeGreaterThan(20);

    for (const mode of [TextFitMode.Contained, TextFitMode.Overflow]) {
      service.crud.updateElement(shape.id, { textFitMode: mode });
      await wait();
      const free = normalizeShapeBound(shape, tiny());
      expect(free.w).toBe(30);
      expect(free.h).toBe(20);
    }
  });

  test('contained derives a smaller font size when the text overflows', async () => {
    const shape = addShape({
      textFitMode: TextFitMode.Contained,
      fontSize: 28,
      text: new Y.Text(
        'a long enough text that cannot possibly fit a 120 by 80 post-it at size 28'
      ),
    });
    await wait();

    const derived = effectiveShapeFontSize(shape);
    expect(derived).toBeLessThan(28);
    expect(derived).toBeGreaterThanOrEqual(MIN_CONTAINED_FONT_SIZE);

    // short text keeps the configured size
    service.crud.updateElement(shape.id, { text: new Y.Text('ok') });
    await wait();
    expect(effectiveShapeFontSize(shape)).toBe(28);
  });

  test('cycling: grow → contained → overflow → grow, and grow re-clamps', async () => {
    const shape = addShape({
      text: new Y.Text('a fairly long text that needs wrapping room'),
    });
    await wait();

    expect(nextTextFitMode(shape.textFitMode)).toBe(TextFitMode.Contained);

    applyTextFitMode(service.std, [shape], TextFitMode.Contained);
    await wait();
    expect(shape.textFitMode).toBe(TextFitMode.Contained);

    // shrink the shape below its text: allowed in contained mode
    service.crud.updateElement(shape.id, { xywh: '[0,0,40,30]' });
    await wait();
    expect(shape.w).toBe(40);

    applyTextFitMode(service.std, [shape], TextFitMode.Overflow);
    await wait();
    expect(shape.textFitMode).toBe(TextFitMode.Overflow);
    expect(shape.w).toBe(40); // bounds untouched

    // back to grow: the bounds are re-clamped to fit the text again
    applyTextFitMode(service.std, [shape], TextFitMode.Grow);
    await wait();
    expect(shape.textFitMode).toBe(TextFitMode.Grow);
    expect(shape.w).toBeGreaterThan(40);
    expect(shape.h).toBeGreaterThan(30);
  });

  test('grow and overflow always use the configured font size', async () => {
    const long = () =>
      new Y.Text('a long enough text that would shrink in contained mode');
    for (const mode of [TextFitMode.Grow, TextFitMode.Overflow]) {
      const shape = addShape({
        textFitMode: mode,
        fontSize: 28,
        text: long(),
      });
      await wait();
      expect(effectiveShapeFontSize(shape)).toBe(28);
    }
  });
});
