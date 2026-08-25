import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import type { MindmapElementModel } from '@labre/affine-model';
import { ShapeElementModel } from '@labre/affine-model';
import type { GfxModel } from '@labre/std/gfx';
import { beforeEach, describe, expect, test } from 'vitest';

import { pointermove, wait } from '../utils/common.js';
import { addNote, getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * Recipe bug: on a wardley map, clicking an auto-complete arrow raised
 * `TypeError: Cannot read properties of undefined (reading 'background')`.
 *
 * The culprit is the **group**: a wardley component is a `wardleyNode` plus its
 * `text` label bundled in a `GroupElementModel`, and a click on the map selects
 * that group. `createEdgelessElement` treated "not a shape" as "therefore a
 * note" and read `current.props.background` — a group has no `props` bag at
 * all. The widget offered the arrows in the first place because its render
 * guard hung on a stale `_isHover` flag rather than on the predicate the click
 * handlers actually use.
 */
describe('auto-complete on something that is neither shape nor note', () => {
  let edgeless!: EdgelessRootBlockComponent;
  let service!: EdgelessRootBlockComponent['service'];

  const key = (k: string) =>
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })
    );

  const select = async (element: GfxModel) => {
    service.gfx.selection.set({ elements: [element.id], editing: false });
    await wait();
  };

  const autoComplete = () => {
    const rect = document.querySelector('edgeless-selected-rect');
    return (rect?.shadowRoot ?? rect)?.querySelector('edgeless-auto-complete');
  };

  const arrows = () => {
    const widget = autoComplete();
    return Array.from(
      (widget?.shadowRoot ?? widget)?.querySelectorAll(
        '.edgeless-auto-complete-arrow'
      ) ?? []
    ) as HTMLElement[];
  };

  /** pointerdown on the arrow, pointerup on the document: a plain click. */
  const clickArrow = (arrow: HTMLElement) => {
    const { x, y } = arrow.getBoundingClientRect();
    const init = {
      clientX: x + 2,
      clientY: y + 2,
      bubbles: true,
      pointerId: 1,
      isPrimary: true,
    };
    arrow.dispatchEvent(new PointerEvent('pointerdown', init));
    document.dispatchEvent(new PointerEvent('pointerup', init));
  };

  /** Collects anything the click throws past the handler, as the browser sees it. */
  const recordUncaught = () => {
    const errors: string[] = [];
    const onError = (e: ErrorEvent) => errors.push(String(e.error ?? e.message));
    window.addEventListener('error', onError);
    return {
      errors,
      stop: () => window.removeEventListener('error', onError),
    };
  };

  /**
   * Walk the pointer off the selected element, towards where an arrow would
   * sit. Reproducing the recipe needs it: the old render guard only offered
   * arrows on a non-shape once its `_isHover` flag had gone false, which is
   * precisely what reaching for an arrow does.
   */
  const movePointerAway = async () => {
    const host = window.editor.host!;
    pointermove(host, { x: 4, y: 4 });
    pointermove(host, { x: 5, y: 5 });
    await wait();
  };

  const addWardleyComponent = async () => {
    key('w');
    key('c');
    await wait();
    const node = service.surface.getElementsByType('wardleyNode')[0];
    return { node, group: node.group!, label: service.surface.getElementsByType('text')[0] };
  };

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    service = edgeless.service;
    service.std.event.active = true;
    return cleanup;
  });

  // ------------------------------------------------------------- the repro

  test('a selected wardley component (a group) is offered no arrow at all', async () => {
    const { group } = await addWardleyComponent();
    await select(group);
    await movePointerAway();

    expect(autoComplete()).toBeTruthy();
    expect(arrows()).toHaveLength(0);
  });

  test('even forced, completing a group creates nothing and throws nothing', async () => {
    const { group } = await addWardleyComponent();
    await select(group);
    await movePointerAway();

    const before = service.surface.elementModels.length;
    const watch = recordUncaught();

    // Straight at the click handler, bypassing the (now absent) arrow: this is
    // the exact call that used to read `group.props.background`.
    const widget = autoComplete() as unknown as {
      current: GfxModel;
      _generateElementOnClick: (type: number) => void;
    };
    widget._generateElementOnClick(0 /* Direction.Right */);
    await wait();
    watch.stop();

    expect(watch.errors).toEqual([]);
    expect(service.surface.elementModels.length).toBe(before);
  });

  test('a free wardley label is offered no arrow either', async () => {
    const { label } = await addWardleyComponent();
    await select(label);
    await movePointerAway();

    expect(arrows()).toHaveLength(0);
  });

  // --------------------------------------------------- the paths that stay

  test('a plain shape keeps its four arrows, and the click still clones it', async () => {
    const id = service.surface.addElement({
      type: 'shape',
      shapeType: 'rect',
      xywh: '[0,0,100,100]',
    });
    const shape = service.surface.getElementById(id) as ShapeElementModel;
    await select(shape);

    expect(arrows()).toHaveLength(4);

    const watch = recordUncaught();
    clickArrow(arrows()[0]);
    await wait();
    watch.stop();

    expect(watch.errors).toEqual([]);
    expect(service.surface.getElementsByType('shape')).toHaveLength(2);
    // shape + clone + the connector between them
    expect(service.surface.getElementsByType('connector')).toHaveLength(1);
  });

  test('a note keeps its two arrows, and the click still adds a note', async () => {
    const noteId = addNote(window.doc, { xywh: '[0,0,400,100]' });
    await wait();
    const note = service.gfx.getElementById(noteId) as GfxModel;
    await select(note);

    expect(arrows()).toHaveLength(2);

    const watch = recordUncaught();
    clickArrow(arrows()[0]);
    await wait();
    watch.stop();

    expect(watch.errors).toEqual([]);
    expect(window.doc.getModelsByFlavour('affine:note')).toHaveLength(2);
  });

  test('a lone wardley node is a shape: it completes into a typed wardley clone', async () => {
    const { node } = await addWardleyComponent();
    // Entering the group selects the node alone — the same thing a
    // double-click does on the canvas.
    await select(node);

    expect(arrows()).toHaveLength(4);
    expect(node).toBeInstanceOf(ShapeElementModel);

    const watch = recordUncaught();
    clickArrow(arrows()[0]);
    await wait();
    watch.stop();

    expect(watch.errors).toEqual([]);
    // The clone keeps the wardley type, it does not degrade into a plain rect.
    expect(service.surface.getElementsByType('wardleyNode')).toHaveLength(2);
  });

  test('a mindmap node still gets its sub/sibling buttons', async () => {
    const mindmapId = service.surface.addElement({
      type: 'mindmap',
      children: { text: 'root', children: [{ text: 'leaf' }] },
    });
    const mindmap = service.surface.getElementById(
      mindmapId
    ) as MindmapElementModel;
    await wait();

    await select(mindmap.tree.element);

    expect(arrows().length).toBeGreaterThan(0);
  });

  test('a multi-selection is offered no arrow', async () => {
    const a = service.surface.addElement({
      type: 'shape',
      shapeType: 'rect',
      xywh: '[0,0,100,100]',
    });
    const b = service.surface.addElement({
      type: 'shape',
      shapeType: 'rect',
      xywh: '[200,0,100,100]',
    });
    service.gfx.selection.set({ elements: [a, b], editing: false });
    await wait();

    expect(arrows()).toHaveLength(0);
  });
});
