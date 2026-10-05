/**
 * The pure half of the selection pane's drag: which slot of the dragged row's
 * own list a visible gap is, and what a drop there writes.
 *
 * Why it exists: the pane's drag used to read a gap as "above or below the
 * hovered row" among the hovered row's siblings, so the space under the last
 * row was no target, and a frame's members — siblings in the list, not in the
 * stack `canvas.element.reorder` restacks in — took a drop that the command
 * then refused without a word. The integration suite
 * (`selection-pane-drag.spec.ts`) drives the gesture with a real pointer;
 * this one pins the rule on hand-made rows.
 */
import type { SelectionPaneNode } from '@labre/affine-block-surface';
import { describe, expect, test } from 'vitest';

import {
  paneDropAbove,
  type PaneDropRow,
  paneLists,
  paneSlotAtGap,
} from '../selection-pane/drop.js';

const node = (
  id: string,
  children?: SelectionPaneNode[],
  kind: SelectionPaneNode['kind'] = 'element'
): SelectionPaneNode => ({
  id,
  kind,
  type: kind === 'layer' ? 'layer' : 'shape',
  layerId: '@default',
  locked: false,
  hiddenLocal: false,
  hiddenForEveryone: false,
  ...(children ? { children } : {}),
});

/** The visible rows of `tree`, every container expanded. */
function rowsOf(tree: SelectionPaneNode[]): PaneDropRow[] {
  const rows: PaneDropRow[] = [];
  const walk = (list: SelectionPaneNode[], depth: number, parent: string) => {
    for (const n of list) {
      rows.push({ node: n, depth, parent });
      if (n.children) walk(n.children, depth + 1, n.id);
    }
  };
  walk(tree, 0, '');
  return rows;
}

const self = (id: string) => id;

describe('the slot a gap offers', () => {
  // t, G(a, b), z — five visible rows.
  const tree = [node('t'), node('G', [node('a'), node('b')]), node('z')];
  const rows = rowsOf(tree);
  const lists = paneLists(tree);

  test('before the first row, between two rows, after the last', () => {
    expect(paneSlotAtGap(rows, 0, '', lists)?.index).toBe(0);
    expect(paneSlotAtGap(rows, 1, '', lists)?.index).toBe(1);
    expect(paneSlotAtGap(rows, 5, '', lists)?.index).toBe(3);
  });

  test('under a group’s last member is after the group, for a loose row', () => {
    expect(paneSlotAtGap(rows, 4, '', lists)).toMatchObject({
      parent: '',
      index: 2,
      depth: 0,
    });
  });

  test('inside a group is no slot for a loose row, a slot for a member', () => {
    expect(paneSlotAtGap(rows, 3, '', lists)).toBeNull();
    expect(paneSlotAtGap(rows, 2, '', lists)).toBeNull();
    expect(paneSlotAtGap(rows, 3, 'G', lists)).toMatchObject({
      parent: 'G',
      index: 1,
      depth: 1,
    });
    expect(paneSlotAtGap(rows, 4, 'G', lists)?.index).toBe(2);
  });
});

describe('what a drop writes', () => {
  const list = [node('a'), node('b'), node('c')];

  test('the row it lands above, or the bottom', () => {
    expect(paneDropAbove(list, 0, 'c', self)).toEqual({ above: 'a' });
    expect(paneDropAbove(list, 2, 'a', self)).toEqual({ above: 'c' });
    expect(paneDropAbove(list, 3, 'a', self)).toEqual({ above: null });
  });

  test('a frame’s block of members stands for the frame', () => {
    // loose, m1, m2, other: m1 and m2 paint together, right above frame F.
    const rows = [node('loose'), node('m1'), node('m2'), node('other')];
    const stackOf = (id: string) => (id === 'm1' || id === 'm2' ? 'F' : id);

    expect(paneDropAbove(rows, 1, 'other', stackOf)).toEqual({ above: 'F' });
    expect(paneDropAbove(rows, 3, 'loose', stackOf)).toEqual({
      above: 'other',
    });
    expect(paneDropAbove(rows, 2, 'loose', stackOf)).toBeNull();
  });

  test('a frame member moves among its frame’s members only', () => {
    const rows = [node('loose'), node('m1'), node('m2'), node('other')];
    const stackOf = (id: string) =>
      id === 'm1' || id === 'm2' ? id : undefined;

    expect(paneDropAbove(rows, 1, 'm2', stackOf)).toEqual({ above: 'm1' });
    expect(paneDropAbove(rows, 3, 'm1', stackOf)).toEqual({ above: null });
    expect(paneDropAbove(rows, 0, 'm2', stackOf)).toBeNull();
  });
});
