import { describe, expect, test, vi } from 'vitest';

import { MindmapStyle } from '../consts/mindmap.js';
import type { MindmapNode } from '../elements/mindmap/mindmap.js';
import { MindmapElementModel } from '../elements/mindmap/mindmap.js';
import {
  applyNodeStyle,
  MINDMAP_NODE_MAX_WIDTH,
  mindmapStyleGetters,
} from '../elements/mindmap/style.js';

const styles = Object.values(MindmapStyle).filter(
  (value): value is MindmapStyle => typeof value === 'number'
);

describe('mindmap node style', () => {
  test('every style caps its nodes at the mind map max width', () => {
    expect(styles.length).toBeGreaterThan(0);

    for (const style of styles) {
      const getter = mindmapStyleGetters[style];
      expect(getter.root.maxWidth).toBe(MINDMAP_NODE_MAX_WIDTH);

      // the style of a node is picked by its path, so probe a few depths
      for (const path of [[0, 0], [0, 1], [0, 0, 0], [0, 2, 1]]) {
        const { node } = getter.getNodeStyle({} as MindmapNode, path);
        expect(node.maxWidth).toBe(MINDMAP_NODE_MAX_WIDTH);
      }
    }
  });

  test('applying a style writes the cap onto the element', () => {
    // A node written before the cap existed simply has no `maxWidth`. The
    // prop is not new — `ShapeElementModel` has always declared it — so the
    // element reads `false` until a layout applies the style below.
    const element = { maxWidth: false } as Record<string, unknown>;
    const node = { element } as unknown as MindmapNode;

    applyNodeStyle(node, mindmapStyleGetters[MindmapStyle.ONE].root);

    expect(element.maxWidth).toBe(MINDMAP_NODE_MAX_WIDTH);
  });
});

/**
 * `stashTree` is called both by the shape text editor, for the whole tree, and
 * by every `layout()` that editor triggers while the user types. The inner
 * call must not write the stashed geometry back mid-edit.
 */
describe('MindmapElementModel.stashTree', () => {
  const buildTree = () => {
    const makeElement = () => ({
      stash: vi.fn(),
      pop: vi.fn(),
    });
    const makeNode = (id: string, children: MindmapNode[] = []) =>
      ({
        id,
        element: makeElement(),
        children,
      }) as unknown as MindmapNode;

    const leafA = makeNode('leaf-a');
    const leafB = makeNode('leaf-b');
    const child = makeNode('child', [leafA, leafB]);
    const root = makeNode('root', [child]);
    const nodes = [root, child, leafA, leafB];
    const nodeMap = new Map(nodes.map(node => [node.id, node]));

    const mindmap = {
      _stashedNode: new Set<string>(),
      getNode: (id: string) => nodeMap.get(id) ?? null,
    };

    const stashTree = (node: MindmapNode | string) =>
      MindmapElementModel.prototype.stashTree.call(
        mindmap as never,
        node as never
      );

    const elementOf = (node: MindmapNode) =>
      node.element as unknown as ReturnType<typeof makeElement>;

    return { mindmap, stashTree, root, child, leafA, leafB, nodes, elementOf };
  };

  test('stashes every node of the subtree once', () => {
    const { stashTree, root, nodes, elementOf, mindmap } = buildTree();

    const pop = stashTree(root);

    expect(pop).toBeTypeOf('function');
    for (const node of nodes) {
      expect(elementOf(node).stash).toHaveBeenCalledTimes(1);
      expect(elementOf(node).stash).toHaveBeenCalledWith('xywh');
    }
    expect(mindmap._stashedNode.size).toBe(nodes.length);
  });

  test('a nested stash of an already stashed node is a no-op', () => {
    const { stashTree, root, child, leafA, nodes, elementOf } = buildTree();

    const pop = stashTree(root);

    // this is the call a `layout()` triggered from the text editor makes
    expect(stashTree(child)).toBeUndefined();
    expect(stashTree(leafA)).toBeUndefined();

    // nothing was stashed twice, and nothing was popped by the inner calls
    for (const node of nodes) {
      expect(elementOf(node).stash).toHaveBeenCalledTimes(1);
      expect(elementOf(node).pop).not.toHaveBeenCalled();
    }

    pop!();

    for (const node of nodes) {
      expect(elementOf(node).pop).toHaveBeenCalledTimes(1);
    }
  });

  test('popping releases the whole subtree, so a later stash works again', () => {
    const { stashTree, root, nodes, elementOf, mindmap } = buildTree();

    stashTree(root)!();

    expect(mindmap._stashedNode.size).toBe(0);

    expect(stashTree(root)).toBeTypeOf('function');
    for (const node of nodes) {
      expect(elementOf(node).stash).toHaveBeenCalledTimes(2);
    }
  });
});
