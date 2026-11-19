import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { AFFINE_TOOLBAR_WIDGET } from '@labre/affine/widgets/toolbar';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * #679 (design audit P2-20): the element toolbar measured 37px — a 36px
 * content box plus its 0.5px border on each side, which this suite's Chromium
 * rounds to 38px — a height on none of the shell's control steps (28, 32, 40). It is 40px OUTSIDE, border included,
 * still one row (DESIGN.md "Editor Toolbar").
 *
 * Measured by the browser, the only place a border is laid out: happy-dom
 * computes no box. The same `editor-toolbar` draws the page view's formatting
 * toolbar, so the bare component is measured as well as the canvas one.
 */

const EXPECTED_HEIGHT = 40;

describe('the element toolbar is one 40px row', () => {
  const mounted: HTMLElement[] = [];

  afterEach(() => {
    mounted.splice(0).forEach(element => element.remove());
  });

  test('the bare editor-toolbar, border included', async () => {
    const bar = document.createElement('editor-toolbar');
    const entry = document.createElement('div');
    entry.textContent = 'Entry';
    bar.append(entry);
    document.body.append(bar);
    mounted.push(bar);
    await bar.updateComplete;
    expect(bar.getBoundingClientRect().height).toBe(EXPECTED_HEIGHT);
  });

  describe('on the canvas', () => {
    let edgeless!: EdgelessRootBlockComponent;

    beforeEach(async () => {
      const cleanup = await setupEditor('edgeless');
      edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
      return cleanup;
    });

    test('over a selected shape', async () => {
      const id = edgeless.service.crud.addElement('shape', {
        shapeType: 'rect',
        xywh: '[0,0,100,100]',
      })!;
      edgeless.service.selection.set({ elements: [id], editing: false });
      const toolbar = () =>
        (
          edgeless.widgetComponents[AFFINE_TOOLBAR_WIDGET] as
            | { toolbar?: HTMLElement }
            | undefined
        )?.toolbar ?? null;
      for (
        let frame = 0;
        frame < 20 && !toolbar()?.hasAttribute('data-open');
        frame++
      ) {
        await wait(25);
      }
      const bar = toolbar();
      expect(bar?.hasAttribute('data-open')).toBe(true);
      expect(bar!.getBoundingClientRect().height).toBe(EXPECTED_HEIGHT);
    });
  });
});
