import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
// Straight off the framework package, as the neighbouring wardley specs do:
// `@labre/affine` re-exports the blocks, not the framework modules.
import {
  WARDLEY_NODE_SIZE,
  WARDLEY_ROLE,
  wardleyPorterArrows,
} from '@labre/affine-gfx-wardley';
import {
  ConnectorElementModel,
  GroupElementModel,
  ShapeElementModel,
  TextElementModel,
  WardleyNodeElementModel,
} from '@labre/affine/model';
import { getRegisteredCommands, runCommand } from '@labre/affine/std';
import { beforeEach, describe, expect, test } from 'vitest';

import { pointerdown, pointerup, wait } from '../utils/common.js';
import { getDocRootBlock, getSurface } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * Porter's forces, drawn from the sub-menu into a real document.
 *
 * The unit suite owns the geometry, the presets and the losses the OWM export
 * reports. What only a real editor can answer is what a user actually gets:
 * that one click produces ONE object rather than five loose ones, that the
 * letter really is the circle's own text in the Y document (and not a string
 * that never became one), that the four arrows landed where the notation puts
 * them — and, since the recette of #210, that the two defects it found are
 * gone: the arrows are polygons standing clear of the rim rather than
 * connectors whose heads swallowed the glyph, and a double-click at the centre
 * opens the editor on the letter instead of landing on nothing.
 */
describe('drawing Porter’s forces from the Wardley sub-menu', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    return cleanup;
  });

  const surfaceModel = () => getSurface(window.doc, window.editor).model;

  /** Run the command the way the sub-menu runs it, and return its group. */
  const drawPorter = async () => {
    const command = getRegisteredCommands(edgeless.std).find(
      c => c.id === 'wardley.addPorter'
    );
    expect(command, 'wardley.addPorter').toBeDefined();
    runCommand(edgeless.std, command!, {
      surface: 'senior-menu',
      source: 'toolbar:general',
    });
    await wait();

    const groups = surfaceModel().elementModels.filter(
      (model): model is GroupElementModel =>
        model instanceof GroupElementModel && model.group === null
    );
    expect(groups).toHaveLength(1);
    return groups[0];
  };

  const circleOf = (group: GroupElementModel) =>
    group.childElements.filter(
      (child): child is WardleyNodeElementModel =>
        child instanceof WardleyNodeElementModel
    );

  /**
   * The arrows. Filtered by `shapeType`, not by `instanceof ShapeElementModel`:
   * `WardleyNodeElementModel` extends it, so the circle would come back too.
   */
  const arrowsOf = (group: GroupElementModel) =>
    group.childElements.filter(
      (child): child is ShapeElementModel =>
        child instanceof ShapeElementModel &&
        !(child instanceof WardleyNodeElementModel)
    );

  test('one click makes one object: a circle and its four arrows', async () => {
    const group = await drawPorter();

    expect(group.childElements).toHaveLength(5);
    expect(circleOf(group)).toHaveLength(1);
    expect(arrowsOf(group)).toHaveLength(4);
    // No label anywhere: the letter is the notation, and a force is not
    // something the author names.
    expect(
      group.childElements.some(child => child instanceof TextElementModel)
    ).toBe(false);
    // …and nothing is a connector. A connector's triangle head is sized off its
    // stroke width, which is what made this glyph render as a solid red star.
    expect(
      group.childElements.some(child => child instanceof ConnectorElementModel)
    ).toBe(false);
  });

  test('the circle carries the porter role and the letter as its own text', async () => {
    const [circle] = circleOf(await drawPorter());

    expect(circle.kind).toBe('porter');
    expect(circle.role).toBe(WARDLEY_ROLE.porter);
    // The point of writing it as shape text rather than as a label beside the
    // circle: it survives the trip into the Y document as a `Y.Text`, which is
    // what the native shape editor opens on a double-click.
    expect(circle.text?.toString()).toBe('R');
    // The canonical diameter, unmoved by the letter inside it.
    const [, , w, h] = circle.deserializedXYWH;
    expect([w, h]).toEqual([
      WARDLEY_NODE_SIZE.porter.w,
      WARDLEY_NODE_SIZE.porter.h,
    ]);
  });

  test('the arrows are polygons standing clear of the rim', async () => {
    const group = await drawPorter();
    const [circle] = circleOf(group);
    const [x, y, w, h] = circle.deserializedXYWH;
    const expected = wardleyPorterArrows(x + w / 2, y + h / 2);

    const arrows = arrowsOf(group);
    for (const arrow of arrows) {
      // Role-less, exactly like the market's triangle: the glyph's own wiring,
      // not a relation the author drew — so W3 never has a composite report an
      // overlap with itself.
      expect(arrow.role).toBeUndefined();
      expect(arrow.shapeType).toBe('polygon');
      expect(arrow.vertices).toHaveLength(7);
      expect(arrow.strokeWidth).toBe(0);
    }

    // The four boxes the shared helper describes, and no others.
    expect(arrows.map(a => a.xywh).sort()).toEqual(
      expected.map(a => a.xywh).sort()
    );

    // BUG 1, as the eye sees it: not one arrow reaches the circle, so the
    // letter is legible and the centre belongs to the circle.
    for (const arrow of arrows) {
      const [ax, ay, aw, ah] = arrow.deserializedXYWH;
      const apart = ax >= x + w || ax + aw <= x || ay >= y + h || ay + ah <= y;
      expect(apart, arrow.xywh).toBe(true);
    }
  });

  /* ── The letter is editable, which is the whole of BUG 2 ─────────────── */

  /** A model point, as the pointer helpers take it. */
  const at = (x: number, y: number) => {
    const [vx, vy] = edgeless.gfx.viewport.toViewCoord(x, y);
    return { x: vx, y: vy };
  };

  /**
   * A real double-click: two presses in the same place, close enough in time
   * that `ClickController` counts them as one gesture. Driven through the host
   * so the dispatcher, the tool controller and the view manager all do their
   * own work — the routing is half of what is under test.
   */
  const doubleClick = async (p: { x: number; y: number }) => {
    const host = window.editor.host as HTMLElement;
    pointerdown(host, p);
    pointerup(host, p);
    pointerdown(host, p);
    pointerup(host, p);
    await wait();
  };

  const shapeEditor = () =>
    edgeless.querySelector('edgeless-shape-text-editor') as
      | (HTMLElement & {
          inlineEditor?: {
            insertText: (
              range: { index: number; length: number },
              text: string
            ) => void;
          };
          inlineEditorContainer?: HTMLElement;
        })
      | null;

  test('a double-click at the centre opens the editor on the letter', async () => {
    const group = await drawPorter();
    const [circle] = circleOf(group);
    const [x, y, w, h] = circle.deserializedXYWH;

    await doubleClick(at(x + w / 2, y + h / 2));

    // The native shape text editor, mounted by `WardleyNodeView` — the handler
    // the recette found missing, which left the one character that carries the
    // whole meaning of this glyph unreachable.
    expect(shapeEditor()).not.toBeNull();
    expect(edgeless.gfx.selection.editing).toBe(true);
    expect(edgeless.gfx.selection.selectedIds).toEqual([circle.id]);
  });

  test('typing another letter rewrites it without resizing the circle', async () => {
    const group = await drawPorter();
    const [circle] = circleOf(group);
    const [x, y, w, h] = circle.deserializedXYWH;

    await doubleClick(at(x + w / 2, y + h / 2));
    const editor = shapeEditor();
    expect(editor?.inlineEditor).toBeTruthy();

    // Replace the R with an L — the struggle for survival rather than relative
    // competition. One character in, one character out.
    editor!.inlineEditor!.insertText({ index: 0, length: 1 }, 'L');
    await wait();

    // Escape ends the edit, and the container blurs with it — which is what
    // unmounts the editor and trims what was typed.
    editor!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    editor!.inlineEditorContainer?.dispatchEvent(
      new FocusEvent('blur', { bubbles: false })
    );
    await wait();
    await wait();

    expect(circle.text?.toString()).toBe('L');
    // `TextFitMode.Overflow`: the glyph keeps the canonical size that says
    // "external force" at a glance, whatever the author types into it.
    expect(circle.deserializedXYWH.slice(2)).toEqual([w, h]);
    expect([w, h]).toEqual([
      WARDLEY_NODE_SIZE.porter.w,
      WARDLEY_NODE_SIZE.porter.h,
    ]);
  });

  test('a double-click on another wardley kind opens no shape editor', async () => {
    // The porter is the ONE kind whose name is its own inner text. Every other
    // artefact wears a separate text element beside it, and opening the shape's
    // editor there would write a second, invisible name.
    const command = getRegisteredCommands(edgeless.std).find(
      c => c.id === 'wardley.addComponent'
    );
    runCommand(edgeless.std, command!, {
      surface: 'senior-menu',
      source: 'toolbar:general',
    });
    await wait();

    const node = surfaceModel().elementModels.find(
      (model): model is WardleyNodeElementModel =>
        model instanceof WardleyNodeElementModel && model.kind === 'component'
    )!;
    const [x, y, w, h] = node.deserializedXYWH;
    await doubleClick(at(x + w / 2, y + h / 2));

    expect(shapeEditor()).toBeNull();
  });
});
