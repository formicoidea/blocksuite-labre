import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import {
  type ConnectorElementModel,
  ConnectorMode,
  ShapeType,
} from '@labre/affine/model';
import { Bound, type IVec } from '@labre/global/gfx';
import { beforeEach, describe, expect, test } from 'vitest';

import { pointerdown, pointermove, pointerup, wait } from '../utils/common.js';
import { getDocRootBlock, getSurface } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * A connector's THREE labels, driven through the real pointer pipeline
 * (`docs/adr/0018` phase 2).
 *
 * The unit suites own the decisions — which pair of fields a selector names,
 * which label a point asks for, what an empty commit removes. What only a live
 * editor can answer is whether the double-click ever ARRIVES at the connector
 * view, and whether a label seeded at an endpoint still sits at that endpoint
 * once the node it is bound to has moved. Both have to be true for an end
 * label to be worth a red-zone field at all: a multiplicity that drifts away
 * from its end is the free-text mechanism phase 1 already had.
 *
 * Everything below dispatches real `PointerEvent`s at real screen coordinates,
 * the way `c4-board-title-band.spec.ts` does, and reaches into no view.
 */
describe('a connector carries a label at each end', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    return cleanup;
  });

  /** Two boxes far enough apart that the line between them is open space. */
  const addConnector = async () => {
    const surface = getSurface(window.doc, window.editor).model;
    const sourceId = surface.addElement({
      type: 'shape',
      shapeType: ShapeType.Rect,
      xywh: '[0,0,100,100]',
    });
    const targetId = surface.addElement({
      type: 'shape',
      shapeType: ShapeType.Rect,
      xywh: '[500,0,100,100]',
    });
    const connectorId = surface.addElement({
      type: 'connector',
      mode: ConnectorMode.Straight,
      source: { id: sourceId },
      target: { id: targetId },
    });
    await wait(200);

    return {
      sourceId,
      targetId,
      connector: surface.getElementById(connectorId) as ConnectorElementModel,
    };
  };

  const host = () => window.editor.host as HTMLElement;

  /** A model point, as the position the pointer helpers take. */
  const at = (point: IVec) => {
    const [vx, vy] = edgeless.gfx.viewport.toViewCoord(point[0], point[1]);
    return { x: vx, y: vy };
  };

  const tap = (p: { x: number; y: number }) => {
    pointerdown(host(), p);
    pointerup(host(), p);
  };

  /** Two presses in one place, close enough in time to be one gesture. */
  const doubleClick = async (point: IVec) => {
    const p = at(point);
    pointermove(host(), p);
    tap(p);
    tap(p);
    await wait(100);
  };

  /** The mounted label editor, or null. */
  const labelEditor = () =>
    document.querySelector('edgeless-connector-label-editor') as
      | (HTMLElement & {
          which: string;
          connector: ConnectorElementModel;
          inlineEditorContainer?: HTMLElement;
        })
      | null;

  /**
   * Closes the open editor the way a user does: the inline editor loses focus,
   * the editor takes itself off the mount point, and its disposer commits.
   *
   * Never `editor.remove()`: the commit runs inside `disconnectedCallback` and
   * moves the focus, which fires the editor's own blur handler and its own
   * `remove()` — from inside the first one, on a node the DOM has already
   * detached.
   */
  const closeEditor = async () => {
    const editor = labelEditor();
    if (!editor) throw new Error('no label editor is open');
    const container = editor.inlineEditorContainer;
    if (!container) throw new Error('the label editor has no inline editor');
    container.dispatchEvent(new FocusEvent('blur'));
    await wait(100);
  };

  /** A point ON the line, `distance` model units in from `end`. */
  const nearEnd = (
    connector: ConnectorElementModel,
    end: 'source' | 'target',
    distance: number
  ): IVec => {
    const path = connector.absolutePath;
    const [from, toward] =
      end === 'source'
        ? [path[0], path[1] ?? path[path.length - 1]]
        : [path[path.length - 1], path[path.length - 2] ?? path[0]];
    const dx = toward[0] - from[0];
    const dy = toward[1] - from[1];
    const len = Math.hypot(dx, dy) || 1;
    return [from[0] + (dx / len) * distance, from[1] + (dy / len) * distance];
  };

  const middle = (connector: ConnectorElementModel): IVec => {
    const point = connector.getPointByOffsetDistance(0.5);
    return [point[0], point[1]];
  };

  /**
   * A point `offset` model units to the SIDE of the line, `along` units in from
   * `end` — where a user aiming at an arrowhead actually lands.
   *
   * A connector is a hairline: the pointer is almost never ON it, and
   * `docs/adr/0018` sized the end-label grab at 24 units precisely because the
   * thing being aimed at is the arrowhead rather than a box that does not exist
   * yet.
   */
  const besideEnd = (
    connector: ConnectorElementModel,
    end: 'source' | 'target',
    along: number,
    offset: number
  ): IVec => {
    const on = nearEnd(connector, end, along);
    const path = connector.absolutePath;
    const [from, toward] =
      end === 'source'
        ? [path[0], path[1] ?? path[path.length - 1]]
        : [path[path.length - 1], path[path.length - 2] ?? path[0]];
    const dx = toward[0] - from[0];
    const dy = toward[1] - from[1];
    const len = Math.hypot(dx, dy) || 1;
    // The unit normal to the segment.
    return [on[0] + (-dy / len) * offset, on[1] + (dx / len) * offset];
  };

  /** Types into the open editor's label and commits it the way a blur does. */
  const commit = async (text: string) => {
    const editor = labelEditor();
    if (!editor) throw new Error('no label editor is open');
    const yText =
      editor.which === 'source'
        ? editor.connector.sourceLabel
        : editor.which === 'target'
          ? editor.connector.targetLabel
          : editor.connector.text;
    yText?.insert(0, text);
    await closeEditor();
  };

  test('a double-click near the source end opens THAT end', async () => {
    const { connector } = await addConnector();
    expect(connector.sourceLabel).toBeUndefined();

    await doubleClick(nearEnd(connector, 'source', 8));

    expect(labelEditor()?.which).toBe('source');
    // The field pair exists as soon as the editor is open: the label is a real
    // (empty) label until it is committed empty, which removes it again.
    expect(connector.sourceLabel).toBeDefined();
    expect(connector.sourceLabelXYWH).toHaveLength(4);
    expect(connector.text).toBeUndefined();

    await commit('0..*');

    expect(connector.sourceLabel?.toString()).toBe('0..*');
    expect(connector.targetLabel).toBeUndefined();
    expect(connector.text).toBeUndefined();
  });

  /**
   * The PO's recette of 14/09/2026: « la zone de texte apparaît mais il n'est
   * pas possible de taper dedans. Pourtant quand j'utilise la commande du menu
   * contextuel ça fonctionne. »
   *
   * Two things had to be true for that, and only one of them was tested. The
   * editor has to MOUNT — which the cases above prove, for a double-click that
   * lands on the line — and the caret has to end up in it, which nothing
   * asserted: every case here commits by writing into the `Y.Text` directly,
   * which a keyboard cannot do. So this one goes through the contenteditable the
   * user types into.
   */
  test('the caret lands in the editor a double-click opened', async () => {
    const { connector } = await addConnector();

    await doubleClick(nearEnd(connector, 'source', 8));
    const editor = labelEditor();
    expect(editor?.which).toBe('source');

    const container = editor!.inlineEditorContainer!;
    expect(container.contains(document.activeElement)).toBe(true);

    // The keystrokes a user makes, through the inline editor's own input path:
    // `beforeinput` is what the editor binds to its event source, and it can
    // only resolve an inline range if the caret is really in this editor. A
    // mounted-but-unfocused overlay swallows this exactly as it swallowed the
    // PO's typing.
    container.dispatchEvent(
      new InputEvent('beforeinput', {
        inputType: 'insertText',
        data: '0..*',
        bubbles: true,
        cancelable: true,
      })
    );
    await wait(100);
    expect(connector.sourceLabel?.toString()).toBe('0..*');

    await closeEditor();
    expect(connector.sourceLabel?.toString()).toBe('0..*');
  });

  /**
   * …and the other half of the same observation: WHERE the gesture is answered.
   *
   * `CONNECTOR_END_LABEL_GRAB` is 24 model units and `docs/adr/0018` says why —
   * the label is not there yet, so the target is the arrowhead. But the
   * dispatcher only ever handed the connector view a double-click that its own
   * hit test answered, which for a hairline is the line itself: measured, about
   * five units. Past that the event reached nobody, `getElementByPoint` answered
   * null, and `DblClickAddEdgelessText` took it for a double-click on empty
   * canvas and dropped a text block at the arrowhead — a text box that appears
   * and is not the label.
   */
  test('a double-click BESIDE the arrowhead still opens that end', async () => {
    const { connector } = await addConnector();
    const blocks = () =>
      window.doc.getModelsByFlavour('affine:edgeless-text').length;
    expect(blocks()).toBe(0);

    // Twelve units off the line: well inside the grab, well outside anything a
    // hairline's own hit test answers.
    await doubleClick(besideEnd(connector, 'target', 8, 12));

    expect(labelEditor()?.which).toBe('target');
    // …and nothing was written on the canvas to stand in for it.
    expect(blocks()).toBe(0);

    await commit('1');
    expect(connector.targetLabel?.toString()).toBe('1');
  });

  test('a double-click near the target end opens the other one', async () => {
    const { connector } = await addConnector();

    await doubleClick(nearEnd(connector, 'target', 8));
    expect(labelEditor()?.which).toBe('target');

    await commit('1');
    expect(connector.targetLabel?.toString()).toBe('1');
    expect(connector.sourceLabel).toBeUndefined();
  });

  test('the middle of the line still opens the caption', async () => {
    const { connector } = await addConnector();

    await doubleClick(middle(connector));
    expect(labelEditor()?.which).toBe('center');

    await commit('owns');
    expect(connector.text?.toString()).toBe('owns');
    expect(connector.sourceLabel).toBeUndefined();
    expect(connector.targetLabel).toBeUndefined();
  });

  test('an end label committed empty leaves no fields behind', async () => {
    const { connector } = await addConnector();

    await doubleClick(nearEnd(connector, 'source', 8));
    expect(connector.sourceLabel).toBeDefined();

    // Nothing typed: the same answer the caption has always given.
    await closeEditor();

    expect(connector.sourceLabel).toBeUndefined();
    expect(connector.sourceLabelXYWH).toBeUndefined();
  });

  test('the source label follows its endpoint when the node moves', async () => {
    const { sourceId, connector } = await addConnector();
    const surface = getSurface(window.doc, window.editor).model;

    await doubleClick(nearEnd(connector, 'source', 8));
    await commit('0..*');

    const endpointBefore = connector.absolutePath[0];
    const boxBefore = Bound.fromXYWH(connector.sourceLabelXYWH!).center;
    const offsetBefore: IVec = [
      boxBefore[0] - endpointBefore[0],
      boxBefore[1] - endpointBefore[1],
    ];

    // Drag the source node down and to the left; the connector re-routes and
    // its first point moves with it.
    const source = surface.getElementById(sourceId)!;
    surface.updateElement(sourceId, {
      xywh: Bound.deserialize(source.xywh).moveDelta(-160, 240).serialize(),
    });
    await wait(200);

    const endpointAfter = connector.absolutePath[0];
    expect(
      Math.hypot(
        endpointAfter[0] - endpointBefore[0],
        endpointAfter[1] - endpointBefore[1]
      )
    ).toBeGreaterThan(50);

    const boxAfter = Bound.fromXYWH(connector.sourceLabelXYWH!).center;

    // The label kept ITS OWN place relative to the end it belongs to — which
    // is the whole reason an end label is a field and not a grouped text
    // element (`docs/adr/0018`, "Alternatives rejected").
    expect(boxAfter[0] - endpointAfter[0]).toBeCloseTo(offsetBefore[0], 0);
    expect(boxAfter[1] - endpointAfter[1]).toBeCloseTo(offsetBefore[1], 0);
  });

  test('undo takes the end label away again', async () => {
    const { connector } = await addConnector();
    window.doc.captureSync();

    await doubleClick(nearEnd(connector, 'source', 8));
    await commit('0..*');
    window.doc.captureSync();

    expect(connector.sourceLabel?.toString()).toBe('0..*');

    window.doc.undo();
    await wait(100);

    expect(connector.sourceLabel?.toString() ?? '').not.toBe('0..*');
  });
});
