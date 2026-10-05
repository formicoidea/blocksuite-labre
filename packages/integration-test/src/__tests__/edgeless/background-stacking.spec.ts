import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { SelectionPaneProvider } from '@labre/affine/shared/services';
import { beforeEach, describe, expect, test } from 'vitest';
import * as Y from 'yjs';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { pointerDown, pointerMoveTo, pointerUp } from '../utils/pointer.js';
import { setupEditor } from '../utils/setup.js';

/**
 * "A framework background is a floor, never a lid" — read off the layer
 * manager, which is the list the canvas actually paints from.
 *
 * The recette of 2026-09-08: on an EDGY board, everything that was not an EDGY
 * artefact ended up BEHIND the board — a shape, a frame, another framework's
 * map dropped on it for a cross-reading. The rule lives in one place
 * (`framework-background/stacking.ts`) and knows no framework, so these check
 * the two gestures that can produce a wrong depth (creating, moving) and that
 * the answer is the same whichever board is involved.
 */
describe('a framework background never covers what is drawn on it', () => {
  let service!: EdgelessRootBlockComponent['service'];

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    service = getDocRootBlock(window.doc, window.editor, 'edgeless').service;

    return cleanup;
  });

  const BOARD = '[0,0,1600,1000]';

  test('a board created over a shape lands under it', async () => {
    const surface = service.surface;

    const shapeId = surface.addElement({
      type: 'shape',
      shapeType: 'rect',
      xywh: '[200,200,100,100]',
    });
    await wait();

    const boardId = surface.addElement({ type: 'edgyBoard', xywh: BOARD });
    await wait();

    const shape = surface.getElementById(shapeId)!;
    const board = surface.getElementById(boardId)!;
    expect(service.layer.compare(shape, board)).toBeGreaterThan(0);
  });

  test('a foreign map dropped on a board sits between it and its artefacts', async () => {
    const surface = service.surface;

    const boardId = surface.addElement({ type: 'edgyBoard', xywh: BOARD });
    await wait();

    // A cross-reading: an Estuarine map laid on the EDGY board.
    const mapId = surface.addElement({
      type: 'estuarine',
      xywh: '[100,100,690,801]',
    });
    await wait();

    // ...and an EDGY node drawn afterwards, which belongs above both.
    const nodeId = surface.addElement({
      type: 'edgyNode',
      xywh: '[300,300,120,80]',
    });
    await wait();

    const board = surface.getElementById(boardId)!;
    const map = surface.getElementById(mapId)!;
    const node = surface.getElementById(nodeId)!;
    expect(service.layer.compare(map, board)).toBeGreaterThan(0);
    expect(service.layer.compare(node, map)).toBeGreaterThan(0);
  });

  test('a shape moved onto a board is raised above it', async () => {
    const surface = service.surface;

    const shapeId = surface.addElement({
      type: 'shape',
      shapeType: 'rect',
      xywh: '[5000,5000,100,100]',
    });
    await wait();

    const boardId = surface.addElement({ type: 'edgyBoard', xywh: BOARD });
    await wait();

    const shape = surface.getElementById(shapeId)!;
    const board = surface.getElementById(boardId)!;
    // Drawn far away, the shape legitimately stays under the board.
    expect(service.layer.compare(shape, board)).toBeLessThan(0);

    service.crud.updateElement(shapeId, { xywh: '[200,200,100,100]' });
    await wait();

    expect(service.layer.compare(shape, board)).toBeGreaterThan(0);
  });

  test('a board moved over free shapes goes under them', async () => {
    const surface = service.surface;

    const boardId = surface.addElement({
      type: 'edgyBoard',
      xywh: '[5000,5000,1600,1000]',
    });
    await wait();

    const shapeId = surface.addElement({
      type: 'shape',
      shapeType: 'rect',
      xywh: '[200,200,100,100]',
    });
    await wait();

    const board = surface.getElementById(boardId)!;
    const shape = surface.getElementById(shapeId)!;
    expect(service.layer.compare(shape, board)).toBeGreaterThan(0);

    service.crud.updateElement(boardId, { xywh: BOARD });
    await wait();

    expect(service.layer.compare(shape, board)).toBeGreaterThan(0);
  });

  // ADR 0033: a board is lowered when it is placed, never by its own move.
  // Placed away from a shape drawn before it, a board stacks above that shape;
  // moved over it, the board now covers it — the consequence the product
  // owner accepted. The shape is not lost: moving IT raises it again (above).
  test('a board stacked above a shape and then moved over it covers it', async () => {
    const surface = service.surface;

    const shapeId = surface.addElement({
      type: 'shape',
      shapeType: 'rect',
      xywh: '[200,200,100,100]',
    });
    await wait();
    const boardId = surface.addElement({
      type: 'edgyBoard',
      xywh: '[5000,5000,1600,1000]',
    });
    await wait();

    const shape = surface.getElementById(shapeId)!;
    const board = surface.getElementById(boardId)!;
    expect(service.layer.compare(board, shape)).toBeGreaterThan(0);

    service.crud.updateElement(boardId, { xywh: BOARD });
    await wait();

    expect(service.layer.compare(board, shape)).toBeGreaterThan(0);
  });

  /*
   * The guard the decision needs (ADR 0033): the depth a user gives a board by
   * hand survives what comes after — moving that board, and a peer's edit of
   * it arriving through sync.
   */
  test('a board dragged above an artefact from the pane stays above after a move and a remote update', async () => {
    const surface = service.surface;
    const shapeId = surface.addElement({
      type: 'shape',
      shapeType: 'rect',
      xywh: '[200,200,100,100]',
    });
    await wait();
    const boardId = surface.addElement({ type: 'edgyBoard', xywh: BOARD });
    await wait();
    const shape = surface.getElementById(shapeId)!;
    const board = surface.getElementById(boardId)!;
    // Placed over it, the board went under the shape (insertion default).
    expect(service.layer.compare(shape, board)).toBeGreaterThan(0);

    // The user drags the board's row above the shape's, in the pane.
    service.std.get(SelectionPaneProvider).open();
    await wait();
    const row = (id: string) =>
      `[data-testid="selection-pane-row"][data-id="${id}"]`;
    await pointerMoveTo(row(boardId), 0.3, 0.5, 1);
    await pointerDown();
    await pointerMoveTo(row(boardId), 0.3, 0.9, 3);
    await pointerMoveTo(row(shapeId), 0.4, 0.2, 6);
    await pointerUp();
    await wait();
    expect(
      service.layer.compare(board, shape),
      'dragged above'
    ).toBeGreaterThan(0);

    // Its own move does not sink it again...
    service.crud.updateElement(boardId, { xywh: '[20,20,1600,1000]' });
    await wait();
    expect(
      service.layer.compare(board, shape),
      'after its move'
    ).toBeGreaterThan(0);

    // ...nor does a peer's edit of it, arriving through sync.
    const space = window.doc.doc.spaceDoc;
    const peer = new Y.Doc();
    Y.applyUpdate(peer, Y.encodeStateAsUpdate(space));
    const peerBoard = (
      (
        peer
          .getMap<Y.Map<unknown>>('blocks')
          .get(surface.id)!
          .get('prop:elements') as Y.Map<unknown>
      ).get('value') as Y.Map<Y.Map<unknown>>
    ).get(boardId)!;
    const before = Y.encodeStateVector(peer);
    peerBoard.set('xywh', '[40,40,1600,1000]');
    Y.applyUpdate(space, Y.encodeStateAsUpdate(peer, before), 'peer');
    await wait();
    expect(board.xywh).toBe('[40,40,1600,1000]');
    expect(
      service.layer.compare(board, shape),
      'after a peer edit'
    ).toBeGreaterThan(0);
  });

  test('two superposed boards keep the artefacts of both on top', async () => {
    const surface = service.surface;

    const firstId = surface.addElement({ type: 'edgyBoard', xywh: BOARD });
    await wait();
    // Inside the band the second board will overlap — the artefact the second
    // board would otherwise have swallowed.
    const onFirstId = surface.addElement({
      type: 'edgyNode',
      xywh: '[500,100,120,80]',
    });
    await wait();

    const secondId = surface.addElement({
      type: 'edgyBoard',
      xywh: '[400,0,1600,1000]',
    });
    await wait();
    const onSecondId = surface.addElement({
      type: 'edgyNode',
      xywh: '[900,100,120,80]',
    });
    await wait();

    const first = surface.getElementById(firstId)!;
    const second = surface.getElementById(secondId)!;
    const onFirst = surface.getElementById(onFirstId)!;
    const onSecond = surface.getElementById(onSecondId)!;

    // The board placed later sits above the earlier one...
    expect(service.layer.compare(second, first)).toBeGreaterThan(0);
    // ...and neither board hides an artefact, its own or the other's.
    expect(service.layer.compare(onFirst, second)).toBeGreaterThan(0);
    expect(service.layer.compare(onSecond, second)).toBeGreaterThan(0);
  });

  test('every framework answers the same way', async () => {
    const surface = service.surface;

    // The rule keys on FrameworkBackgroundElementModel and on nothing else, so
    // a Wardley map and a C4 board owe the shape they cover the same depth as
    // an EDGY board does.
    const onMapId = surface.addElement({
      type: 'shape',
      shapeType: 'rect',
      xywh: '[200,200,100,100]',
    });
    const onBoardId = surface.addElement({
      type: 'shape',
      shapeType: 'rect',
      xywh: '[3200,200,100,100]',
    });
    await wait();

    const mapId = surface.addElement({ type: 'wardley', xywh: BOARD });
    const c4Id = surface.addElement({
      type: 'c4Board',
      xywh: '[3000,0,1600,900]',
    });
    await wait();

    expect(
      service.layer.compare(
        surface.getElementById(onMapId)!,
        surface.getElementById(mapId)!
      )
    ).toBeGreaterThan(0);
    expect(
      service.layer.compare(
        surface.getElementById(onBoardId)!,
        surface.getElementById(c4Id)!
      )
    ).toBeGreaterThan(0);
  });

  test('undo puts the moved shape back, and costs no extra history entry', async () => {
    const surface = service.surface;

    const shapeId = surface.addElement({
      type: 'shape',
      shapeType: 'rect',
      xywh: '[5000,5000,100,100]',
    });
    await wait();
    const boardId = surface.addElement({ type: 'edgyBoard', xywh: BOARD });
    await wait();

    const shape = surface.getElementById(shapeId)!;
    const board = surface.getElementById(boardId)!;
    const before = { xywh: shape.xywh, index: shape.index };

    service.doc.captureSync();
    service.crud.updateElement(shapeId, { xywh: '[200,200,100,100]' });
    await wait();
    service.doc.captureSync();

    const raised = shape.index;
    expect(service.layer.compare(shape, board)).toBeGreaterThan(0);

    // The rule's write rides in the same history entry as the move it answers
    // — one undo restores BOTH the position and the depth.
    service.doc.undo();
    await wait();
    expect(shape.xywh).toBe(before.xywh);
    expect(shape.index).toBe(before.index);
    expect(service.layer.compare(shape, board)).toBeLessThan(0);

    service.doc.redo();
    await wait();
    expect(shape.xywh).toBe('[200,200,100,100]');
    expect(shape.index).toBe(raised);
    expect(service.layer.compare(shape, board)).toBeGreaterThan(0);
    // Idempotence: replaying the rule over the restored state wrote nothing,
    // so there is no leftover entry to redo a second time.
    expect(service.doc.canRedo).toBe(false);
  });
});
