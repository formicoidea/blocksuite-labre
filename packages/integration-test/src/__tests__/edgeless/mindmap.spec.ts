import type { MindMapView } from '@labre/affine/gfx/mindmap';
import { mountShapeTextEditor } from '@labre/affine/gfx/shape';
import {
  LayoutType,
  MINDMAP_NODE_MAX_WIDTH,
  type MindmapElementModel,
  type ShapeElementModel,
} from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';
import type { GfxController } from '@labre/std/gfx';
import { beforeEach, describe, expect, test } from 'vitest';

import { click, pointermove, wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

describe('mindmap', () => {
  let gfx: GfxController;
  const moveAndClick = ({ x, y, w, h }: Bound) => {
    const { left, top } = gfx.viewport;
    x += left;
    y += top;

    // trigger enter event
    pointermove(editor.host!, { x: x + w / 2, y: y + h / 2 });
    // trigger move event
    pointermove(editor.host!, { x: x + w / 2 + 1, y: y + h / 2 + 1 });
    click(editor.host!, { x: x + w / 2, y: y + h / 2 });
  };

  const move = ({ x, y, w, h }: Bound) => {
    x += gfx.viewport.left;
    y += gfx.viewport.top;

    pointermove(editor.host!, { x: x + w / 2, y: y + h / 2 });
  };

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    gfx = getDocRootBlock(window.doc, window.editor, 'edgeless').gfx;

    return cleanup;
  });

  test('a node grows while an IME composition is still in progress', async () => {
    const mindmapId = gfx.surface!.addElement({
      type: 'mindmap',
      children: { text: 'root', children: [{ text: 'leaf1' }] },
    });
    const mindmap = gfx.getElementById(mindmapId) as MindmapElementModel;
    const root = getDocRootBlock(window.doc, window.editor, 'edgeless');

    doc.captureSync();
    await wait();

    const rootNode = mindmap.tree.element as ShapeElementModel;
    // Every mind map style caps its nodes, so the growth below is bounded.
    expect(rootNode.maxWidth).toBe(MINDMAP_NODE_MAX_WIDTH);

    mountShapeTextEditor(rootNode, root);
    await wait();

    const shapeEditor = root.querySelector('edgeless-shape-text-editor') as
      | (HTMLElement & { inlineEditorContainer?: HTMLElement })
      | null;
    const container = shapeEditor?.inlineEditorContainer;
    expect(container).toBeTruthy();

    const initialWidth = rootNode.w;

    // A composition only ever touches the DOM: the model is written when the
    // user validates, so nothing would tell the shape to grow in between.
    container!.dispatchEvent(
      new CompositionEvent('compositionstart', { data: '', bubbles: true })
    );
    const preedit = container!.querySelector('[data-v-text="true"]');
    expect(preedit).toBeTruthy();
    const composed = '測試測試測試測試測試測試測試測試測試測試';
    preedit!.textContent = composed;
    container!.dispatchEvent(
      new CompositionEvent('compositionupdate', {
        data: composed,
        bubbles: true,
      })
    );
    await wait();
    await wait();

    expect(rootNode.w).toBeGreaterThan(initialWidth);
    expect(rootNode.w).toBeLessThanOrEqual(MINDMAP_NODE_MAX_WIDTH);

    container!.dispatchEvent(
      new CompositionEvent('compositionend', {
        data: composed,
        bubbles: true,
      })
    );
    await wait();
  });

  test('a node wraps at its max width instead of stretching', async () => {
    const mindmapId = gfx.surface!.addElement({
      type: 'mindmap',
      children: {
        text: 'abcdefghijklmnopqrstuvwxyz'.repeat(20),
        children: [{ text: 'leaf1' }],
      },
    });
    const mindmap = gfx.getElementById(mindmapId) as MindmapElementModel;
    const root = getDocRootBlock(window.doc, window.editor, 'edgeless');

    doc.captureSync();
    await wait();

    const rootNode = mindmap.tree.element as ShapeElementModel;
    expect(rootNode.maxWidth).toBe(MINDMAP_NODE_MAX_WIDTH);

    mountShapeTextEditor(rootNode, root);
    await wait();

    const shapeEditor = root.querySelector('edgeless-shape-text-editor') as
      | (HTMLElement & { richText?: HTMLElement })
      | null;
    const richText = shapeEditor?.richText;
    expect(richText).toBeTruthy();

    // The editor box is capped…
    expect(richText!.clientWidth).toBeLessThanOrEqual(MINDMAP_NODE_MAX_WIDTH);
    // …the text wraps inside it rather than running off to the right…
    expect(richText!.scrollWidth).toBeLessThanOrEqual(
      richText!.clientWidth + 1
    );
    // …and the measure written back to the model respects the cap too.
    expect(rootNode.w).toBeLessThanOrEqual(MINDMAP_NODE_MAX_WIDTH);
  });

  test('a mind map written before nodes had a max width still loads', async () => {
    const mindmapId = gfx.surface!.addElement({
      type: 'mindmap',
      children: {
        text: 'abcdefghijklmnopqrstuvwxyz'.repeat(20),
        children: [{ text: 'leaf1' }],
      },
    });
    const mindmap = gfx.getElementById(mindmapId) as MindmapElementModel;

    doc.captureSync();
    await wait();

    const rootNode = mindmap.tree.element as ShapeElementModel;

    // Rewind the element to what a client from before this change stored: the
    // mind map styles carried no `maxWidth`, so the key was simply absent.
    // `maxWidth` itself is not new — `ShapeElementModel` has always declared
    // it — which is why an older client reads a document written by this one.
    const legacyXYWH = '[0,0,900,60]';
    window.doc.transact(() => {
      rootNode.yMap.delete('maxWidth');
      rootNode.yMap.set('xywh', legacyXYWH);
    });
    await wait();

    expect(rootNode.yMap.has('maxWidth')).toBe(false);
    // The absent key reads back as the field default, so nothing caps the node
    expect(rootNode.maxWidth).toBe(false);
    // …and opening the document runs no layout, so the stored geometry — and
    // with it the painted node — is exactly what the old client left.
    expect(rootNode.xywh).toBe(legacyXYWH);

    // The first layout of the session is what adopts the cap. That is a
    // deliberate change of rendering for long nodes: they wrap from now on.
    mindmap.layout();
    await wait();

    expect(rootNode.maxWidth).toBe(MINDMAP_NODE_MAX_WIDTH);
    expect(rootNode.w).toBeLessThanOrEqual(
      MINDMAP_NODE_MAX_WIDTH + rootNode.padding[1] * 2
    );
  });

  test('delete the root node should remove all children', async () => {
    const tree = {
      text: 'root',
      children: [
        {
          text: 'leaf1',
        },
        {
          text: 'leaf2',
        },
        {
          text: 'leaf3',
          children: [
            {
              text: 'leaf4',
            },
          ],
        },
      ],
    };
    const mindmapId = gfx.surface!.addElement({
      type: 'mindmap',
      children: tree,
    });
    const mindmap = () => gfx.getElementById(mindmapId) as MindmapElementModel;

    expect(gfx.surface!.elementModels.length).toBe(6);
    doc.captureSync();

    gfx.deleteElement(mindmap().tree.element);
    await wait();
    expect(gfx.surface!.elementModels.length).toBe(0);
    doc.captureSync();
    await wait();

    doc.undo();
    expect(gfx.surface!.elementModels.length).toBe(6);
    await wait();

    gfx.deleteElement(mindmap().tree.children[2].element);
    await wait();
    expect(gfx.surface!.elementModels.length).toBe(4);
    await wait();

    doc.undo();
    await wait();
    expect(gfx.surface!.elementModels.length).toBe(6);
  });

  test('mindmap should layout automatically when creating', async () => {
    const tree = {
      text: 'root',
      children: [
        {
          text: 'leaf1',
        },
        {
          text: 'leaf2',
        },
        {
          text: 'leaf3',
          children: [
            {
              text: 'leaf4',
            },
          ],
        },
      ],
    };
    const mindmapId = gfx.surface!.addElement({
      type: 'mindmap',
      layoutType: LayoutType.RIGHT,
      children: tree,
    });
    const mindmap = () => gfx.getElementById(mindmapId) as MindmapElementModel;

    doc.captureSync();
    await wait();

    const root = mindmap().tree.element;
    const children = mindmap().tree.children.map(child => child.element);
    const leaf4 = mindmap().tree.children[2].children[0].element;

    expect(children[0].x).greaterThan(root.x + root.w);
    expect(children[1].x).greaterThan(root.x + root.w);
    expect(children[2].x).greaterThan(root.x + root.w);

    expect(children[1].y).greaterThan(children[0].y + children[0].h);
    expect(children[2].y).greaterThan(children[1].y + children[1].h);

    expect(leaf4.x).greaterThan(children[2].x + children[2].w);
  });

  test('deliberately creating a circular reference should be resolved correctly', async () => {
    const tree = {
      text: 'root',
      children: [
        {
          text: 'leaf1',
        },
        {
          text: 'leaf2',
        },
        {
          text: 'leaf3',
          children: [
            {
              text: 'leaf4',
            },
          ],
        },
      ],
    };
    const mindmapId = gfx.surface!.addElement({
      type: 'mindmap',
      layoutType: LayoutType.RIGHT,
      children: tree,
    });
    const mindmap = () => gfx.getElementById(mindmapId) as MindmapElementModel;

    doc.captureSync();
    await wait();

    // create a circular reference
    doc.transact(() => {
      const root = mindmap().tree;
      const leaf3 = root.children[2];
      const leaf4 = root.children[2].children[0];

      mindmap().children.set(leaf3.id, {
        index: leaf3.detail.index,
        parent: leaf4.id,
      });
    });
    doc.captureSync();

    await wait();

    // the circular referenced node should be removed
    expect(mindmap().nodeMap.size).toBe(3);
  });

  test('mindmap collapse and expand should work correctly', async () => {
    const tree = {
      text: 'root',
      children: [
        {
          text: 'leaf1',
        },
        {
          text: 'leaf2',
        },
        {
          text: 'leaf3',
          children: [
            {
              text: 'leaf4',
            },
          ],
        },
      ],
    };

    // click to active the editor
    click(editor.host!, { x: 50, y: 50 });

    const mindmapId = gfx.surface!.addElement({
      type: 'mindmap',
      layoutType: LayoutType.RIGHT,
      children: tree,
    });
    const mindmap = () => gfx.getElementById(mindmapId) as MindmapElementModel;
    const mindmapView = () => gfx.view.get(mindmapId) as MindMapView;

    doc.captureSync();
    await wait(100);

    // collapse the root node
    {
      const rootButton = mindmapView().getCollapseButton(mindmap().tree)!;

      moveAndClick(gfx.viewport.toViewBound(rootButton.elementBound));
      await wait(500);

      expect(rootButton.hidden).toBe(false);
      expect(rootButton.opacity).toBe(1);
      expect(mindmap().tree.detail.collapsed).toBe(true);
      expect(mindmap().getNodeByPath([0, 0])!.element.hidden).toBe(true);
      expect(mindmap().getNodeByPath([0, 1])!.element.hidden).toBe(true);
      expect(mindmap().getNodeByPath([0, 2])!.element.hidden).toBe(true);
      expect(mindmap().getNodeByPath([0, 2, 0])!.element.hidden).toBe(true);

      doc.captureSync();
      await wait();

      doc.undo();
      await wait();

      expect(mindmap().tree.detail.collapsed).toBe(undefined);
      expect(mindmap().getNodeByPath([0, 0])!.element.hidden).toBe(false);
      expect(mindmap().getNodeByPath([0, 1])!.element.hidden).toBe(false);
      expect(mindmap().getNodeByPath([0, 2])!.element.hidden).toBe(false);
      expect(mindmap().getNodeByPath([0, 2, 0])!.element.hidden).toBe(false);
    }

    // collapse a child node
    {
      const node = mindmap().getNodeByPath([0, 2])!;
      const childButton = mindmapView().getCollapseButton(node)!;

      moveAndClick(gfx.viewport.toViewBound(childButton.elementBound));
      await wait(500);

      expect(childButton.hidden).toBe(false);
      expect(childButton.opacity).toBe(1);

      expect(mindmap().getNodeByPath([0, 2])!.element.hidden).toBe(false);
      expect(mindmap().getNodeByPath([0, 2])!.detail.collapsed).toBe(true);
      expect(mindmap().getNodeByPath([0, 2, 0])!.element.hidden).toBe(true);

      doc.captureSync();
      await wait();

      doc.undo();
      await wait();

      expect(mindmap().getNodeByPath([0, 2])!.detail.collapsed).toBe(undefined);
      expect(mindmap().getNodeByPath([0, 2, 0])!.element.hidden).toBe(false);
    }

    // collapse root node and collapse a child node
    {
      const childButton = mindmapView().getCollapseButton(
        mindmap().getNodeByPath([0, 2])!
      )!;
      // collapse child node
      moveAndClick(gfx.viewport.toViewBound(childButton.elementBound));
      await wait(500);

      doc.captureSync();
      await wait();

      const rootButton = mindmapView().getCollapseButton(mindmap().tree)!;
      // collapse root node
      moveAndClick(gfx.viewport.toViewBound(rootButton.elementBound));
      await wait(500);

      // child button should be hidden
      expect(childButton.hidden).toBe(true);
      expect(childButton.opacity).toBe(0);

      // expand root node
      doc.undo();
      await wait();

      // child button should be visible
      expect(childButton.hidden).toBe(false);
      expect(childButton.opacity).toBe(1);

      // child nodes should still be collapsed
      expect(mindmap().getNodeByPath([0, 2])!.detail.collapsed).toBe(true);
      expect(mindmap().getNodeByPath([0, 2, 0])!.element.hidden).toBe(true);

      // expand child node
      doc.undo();
      await wait();

      // child button should be visible
      expect(mindmap().getNodeByPath([0, 2])!.detail.collapsed).toBe(undefined);
      expect(mindmap().getNodeByPath([0, 2, 0])!.element.hidden).toBe(false);
    }
  });

  test("selected node's collapse button should be visible", async () => {
    const tree = {
      text: 'root',
      children: [
        {
          text: 'leaf1',
        },
        {
          text: 'leaf2',
        },
        {
          text: 'leaf3',
          children: [
            {
              text: 'leaf4',
            },
          ],
        },
      ],
    };

    // click to active the editor
    click(editor.host!, { x: 50, y: 50 });

    const mindmapId = gfx.surface!.addElement({
      type: 'mindmap',
      layoutType: LayoutType.RIGHT,
      children: tree,
    });
    const mindmap = () => gfx.getElementById(mindmapId) as MindmapElementModel;
    const mindmapView = () => gfx.view.get(mindmapId) as MindMapView;
    await wait();

    gfx.selection.set({ elements: [mindmap().tree.id] });
    const rootButton = mindmapView().getCollapseButton(mindmap().tree)!;
    expect(rootButton.hidden).toBe(false);
    expect(rootButton.opacity).toBe(1);

    gfx.selection.set({ elements: [mindmap().getNodeByPath([0, 2])!.id] });
    const childButton = mindmapView().getCollapseButton(
      mindmap().getNodeByPath([0, 2])!
    )!;
    expect(childButton.hidden).toBe(false);
    expect(childButton.opacity).toBe(1);
  });

  test('move near to the collapsed button should show the button', async () => {
    const tree = {
      text: 'root',
      children: [
        {
          text: 'leaf1',
        },
        {
          text: 'leaf2',
        },
        {
          text: 'leaf3',
          children: [
            {
              text: 'leaf4',
            },
          ],
        },
      ],
    };

    // click to active the editor
    click(editor.host!, { x: 50, y: 50 });

    const mindmapId = gfx.surface!.addElement({
      type: 'mindmap',
      layoutType: LayoutType.RIGHT,
      children: tree,
    });
    const mindmap = () => gfx.getElementById(mindmapId) as MindmapElementModel;
    const mindmapView = () => gfx.view.get(mindmapId) as MindMapView;
    await wait();

    const rootButton = mindmapView().getCollapseButton(mindmap().tree)!;
    move(gfx.viewport.toViewBound(rootButton.elementBound).moveDelta(10, 10));
    await wait();
    expect(rootButton.opacity).toBe(1);

    const childButton = mindmapView().getCollapseButton(
      mindmap().getNodeByPath([0, 2])!
    )!;
    move(gfx.viewport.toViewBound(childButton.elementBound).moveDelta(10, 10));
    await wait();
    expect(childButton.opacity).toBe(1);

    move(new Bound(0, 0, 0, 0));
    await wait();

    expect(childButton.opacity).toBe(0);
    expect(rootButton.opacity).toBe(0);
  });

  test("collapsed node's button should be always visible except its ancestor is collapsed", async () => {
    const tree = {
      text: 'root',
      children: [
        {
          text: 'leaf1',
        },
        {
          text: 'leaf2',
        },
        {
          text: 'leaf3',
          children: [
            {
              text: 'leaf4',
            },
          ],
        },
      ],
    };

    // click to active the editor
    click(editor.host!, { x: 50, y: 50 });

    const mindmapId = gfx.surface!.addElement({
      type: 'mindmap',
      layoutType: LayoutType.RIGHT,
      children: tree,
    });
    const mindmap = () => gfx.getElementById(mindmapId) as MindmapElementModel;
    const mindmapView = () => gfx.view.get(mindmapId) as MindMapView;

    doc.captureSync();
    await wait();

    const childButton = mindmapView().getCollapseButton(
      mindmap().getNodeByPath([0, 2])!
    )!;
    // collapse the child node
    moveAndClick(gfx.viewport.toViewBound(childButton.elementBound));
    // move out of the button, the button should still be visible
    move(new Bound(0, 0, 0, 0));
    await wait();
    expect(childButton.hidden).toBe(false);
    expect(childButton.opacity).toBe(1);

    const rootButton = mindmapView().getCollapseButton(mindmap().tree)!;
    // collapse the root node
    moveAndClick(gfx.viewport.toViewBound(rootButton.elementBound));
    // move out of the button, the root button should be visible
    move(new Bound(0, 0, 0, 0));
    await wait();
    expect(rootButton.hidden).toBe(false);
    expect(rootButton.opacity).toBe(1);
    // the collapsed child button should be hidden
    expect(childButton.hidden).toBe(true);
    expect(childButton.opacity).toBe(0);
  });
});
