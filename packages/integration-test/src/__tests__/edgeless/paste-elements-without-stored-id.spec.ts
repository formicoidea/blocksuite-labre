/**
 * Copy, paste and duplicate in a document whose canvas elements have no stored
 * `id` (#681 documents, written outside the editor; ADR 0056, a known limit of
 * ADR 0053).
 *
 * Such an element mounts under its key in the elements map (ADR 0053 §1), but
 * `serialize()` returned its STORED map, so the clipboard saw `id: undefined`
 * for every element:
 * - copying N elements pasted ONE (the paste deduplicates by `id`);
 * - a group was not pasted at all (its children had no new id: `Copy failed`);
 * - a copied connector stayed attached to the ORIGINAL ends.
 *
 * The scene: shapes, a connector between two of them and a group, made with
 * the editor, then stripped of their stored `id` — what such a document holds.
 * The gestures are the real ones: Mod+D, and a real Mod+C / Mod+V through the
 * system clipboard. What is asserted is what the user sees: every element
 * copied once, the copy of a connector ends on the copies, the group comes
 * back with its children; the originals are untouched.
 */
import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import {
  type ConnectorElementModel,
  type GroupElementModel,
  ShapeType,
} from '@labre/affine/model';
import { IS_MAC } from '@labre/global/env';
import { commands, userEvent } from '@vitest/browser/context';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

declare module '@vitest/browser/context' {
  interface BrowserCommands {
    /** Grant or take back the clipboard permissions (`vitest.config.ts`). */
    systemClipboard: (granted: boolean) => Promise<void>;
  }
}

const MOD = IS_MAC ? 'Meta' : 'Control';
const chord = (key: string) => `{${MOD}>}${key}{/${MOD}}`;
/** Shape size and the gap between two shapes, in model units. */
const SIZE = 100;
const GAP = 3 * SIZE;

describe('elements stored without an id', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    sessionStorage.removeItem('blocksuite:prop:record');
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    edgeless.std.event.active = true;
    return cleanup;
  });

  const surface = () => edgeless.service.surface;
  const crud = () => edgeless.service.crud;
  const ids = () => new Set(surface().elementModels.map(model => model.id));
  const created = (before: Set<string>) =>
    surface().elementModels.filter(model => !before.has(model.id));

  const settle = async () => {
    await edgeless.updateComplete;
    await wait(100);
  };

  const shape = (x: number, y = 0) =>
    crud().addElement('shape', {
      shapeType: ShapeType.Rect,
      xywh: `[${x},${y},${SIZE},${SIZE}]`,
    })!;

  /** What a #681 document holds: the same elements, no stored `id`. */
  const stripStoredIds = (elementIds: string[]) => {
    surface().store.transact(() => {
      elementIds.forEach(id => surface().getElementById(id)!.yMap.delete('id'));
    });
  };

  const selectAndFocus = async (elementIds: string[]) => {
    edgeless.service.gfx.selection.set({
      elements: elementIds,
      editing: false,
    });
    // Focus without a click, which would change the selection.
    edgeless.std.host.focus();
    await settle();
  };

  async function connectedPair() {
    const a = shape(0);
    const b = shape(GAP);
    const connector = crud().addElement('connector', {
      source: { id: a },
      target: { id: b },
    })!;
    await settle();
    stripStoredIds([a, b, connector]);
    return { a, b, connector };
  }

  function expectCopiesOfThePair(
    copies: ReturnType<typeof created>,
    sources: { a: string; b: string }
  ) {
    const shapes = copies.filter(model => model.type === 'shape');
    const connectors = copies.filter(
      model => model.type === 'connector'
    ) as ConnectorElementModel[];
    expect(shapes, 'both shapes are copied').toHaveLength(
      [sources.a, sources.b].length
    );
    expect(connectors, 'the connector is copied').toHaveLength(1);
    const copyIds = shapes.map(model => model.id).sort();
    expect(
      [connectors[0].source.id, connectors[0].target.id].sort(),
      'the copied connector ends on the copies, not on the originals'
    ).toEqual(copyIds);
    expect(copyIds).not.toContain(sources.a);
    expect(copyIds).not.toContain(sources.b);
  }

  test('mod+d copies every element, and the connector between the copies', async () => {
    const pair = await connectedPair();
    const before = ids();

    await selectAndFocus([pair.a, pair.b, pair.connector]);
    await userEvent.keyboard(chord('d'));
    await settle();

    expectCopiesOfThePair(created(before), pair);
    const original = surface().getElementById(
      pair.connector
    ) as ConnectorElementModel;
    expect(original.source.id).toBe(pair.a);
    expect(original.target.id).toBe(pair.b);
  });

  test('mod+d copies a group with its children', async () => {
    const children = [shape(0, GAP), shape(2 * SIZE, GAP)];
    const group = crud().addElement('group', {
      children: Object.fromEntries(children.map(id => [id, true])),
    })!;
    await settle();
    stripStoredIds([...children, group]);
    const before = ids();

    await selectAndFocus([group]);
    await userEvent.keyboard(chord('d'));
    await settle();

    const copies = created(before);
    const groups = copies.filter(
      model => model.type === 'group'
    ) as GroupElementModel[];
    expect(groups, 'the group is copied').toHaveLength(1);
    const copiedChildren = copies
      .filter(model => model.type === 'shape')
      .map(model => model.id)
      .sort();
    expect(copiedChildren).toHaveLength(children.length);
    expect([...groups[0].childIds].sort()).toEqual(copiedChildren);
  });

  test('a real copy then paste copies every element, and the connector between the copies', async () => {
    const pair = await connectedPair();
    const before = ids();

    await selectAndFocus([pair.a, pair.b, pair.connector]);
    await commands.systemClipboard(true);
    try {
      await userEvent.keyboard(chord('c'));
      await settle();
      await userEvent.keyboard(chord('v'));
      await settle();
    } finally {
      await commands.systemClipboard(false);
    }

    expectCopiesOfThePair(created(before), pair);
  });
});
