import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
// Straight off the framework packages, as the uml, c4 and bpmn specs already
// reach for theirs: `@labre/affine` re-exports the blocks, not the framework
// modules.
import { UML_ROLE } from '@labre/affine-gfx-uml';
import {
  UML_FRAME_BAND_HEIGHT,
  type UmlDiagramElementModel,
} from '@labre/affine/model';
import type { GfxModel } from '@labre/std/gfx';
import { beforeEach, describe, expect, test } from 'vitest';

import { drag, pointerdown, pointerup, wait } from '../utils/common.js';
import { getDocRootBlock, getSurface } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * The PO's recette of the UML pack, 2026-09-15 — the two observations about the
 * diagram FRAME, driven on a real editor.
 *
 * O1, the hit test: « quand je double clique sur le board "UML Diagram", il
 * passe en mode sélection alors qu'un pattern retenu pour les boards est de
 * n'être cliquable que par les bordures et les bandes ». The geometry itself is
 * owned by `uml-models.unit.spec.ts` ("picks the frame by its border and its
 * heading band, never its middle"); what only a live editor can answer is
 * whether the PICKER and the double-click ROUTER agree with it, and the cases
 * below are that question asked through `getElementByPoint` and through real
 * `PointerEvent`s.
 *
 * O2, the depth: « au déplacement ou au redimensionnement le board passe au
 * premier plan, occultant ainsi les objets qui sont inclus dedans ». That one
 * reproduced, and the last two cases are it — see
 * `framework-background/stacking.ts` and `stacking.unit.spec.ts` for the rule
 * and the reason.
 */
describe('the UML diagram frame, as the recette drove it', () => {
  let edgeless!: EdgelessRootBlockComponent;

  const W = 1400;
  const H = 900;
  const BAND = UML_FRAME_BAND_HEIGHT;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    return cleanup;
  });

  const surface = () => getSurface(window.doc, window.editor).model;

  /** A frame at the origin, the size a fresh one is created at. */
  const addFrame = async () => {
    const id = surface().addElement({
      type: 'umlDiagram',
      role: UML_ROLE.diagram,
      kind: 'class',
      name: 'Orders',
      xywh: `[0,0,${W},${H}]`,
    });
    await wait();
    return surface().getElementById(id) as UmlDiagramElementModel;
  };

  /** What the editor's own picking says is under a MODEL-space point. */
  const pick = (x: number, y: number): GfxModel | null =>
    edgeless.gfx.getElementByPoint(x, y);

  const host = () => window.editor.host as HTMLElement;

  /** A model point, as the position the pointer helpers take. */
  const at = (x: number, y: number) => {
    const [vx, vy] = edgeless.gfx.viewport.toViewCoord(x, y);
    return { x: vx, y: vy };
  };

  const tap = (p: { x: number; y: number }) => {
    pointerdown(host(), p);
    pointerup(host(), p);
  };

  /** Two presses close enough in time to count as one gesture. */
  const doubleClick = async (p: { x: number; y: number }) => {
    tap(p);
    tap(p);
    await wait();
  };

  /** The in-place `<input>` the view opens to rename, or null. */
  const renameEditor = () =>
    (Array.from(document.body.children).findLast(
      el => el.tagName === 'INPUT'
    ) as HTMLInputElement | undefined) ?? null;

  /* ── O1: the frame answers on its band and its border, and nowhere else ─ */

  test('a click in the heading band picks the frame', async () => {
    const frame = await addFrame();

    // Well inside the band and well clear of every edge, so the answer is the
    // BAND's and not the border band's — and full width, which is the whole
    // point of reserving the top margin.
    expect(pick(W / 2, BAND / 2)?.id).toBe(frame.id);
    expect(pick(W - 100, BAND / 2)?.id).toBe(frame.id);
  });

  test('a click in the middle of the sheet does not pick the frame', async () => {
    const frame = await addFrame();

    // One node height under the painted edge, and the dead centre: the drawing
    // is where the work goes, so a click there belongs to whatever is under
    // the pointer — never to the sheet itself.
    expect(pick(W / 2, BAND + 40)?.id).not.toBe(frame.id);
    expect(pick(W / 2, H / 2)?.id).not.toBe(frame.id);
    expect(pick(200, H - 100)?.id).not.toBe(frame.id);
  });

  test('a node dropped under the band still takes its own click', async () => {
    const frame = await addFrame();
    const nodeId = surface().addElement({
      type: 'umlNode',
      kind: 'class',
      role: UML_ROLE.class,
      filled: true,
      xywh: `[600,${BAND + 10},240,120]`,
    });
    await wait();

    expect(pick(720, BAND + 70)?.id).toBe(nodeId);
    // …and the band above it is still the frame's, so neither took the other's.
    expect(pick(720, BAND / 2)?.id).toBe(frame.id);
  });

  test('a double-click in the middle of the sheet neither selects nor renames it', async () => {
    const frame = await addFrame();
    edgeless.gfx.selection.clear();
    await wait();

    await doubleClick(at(W / 2, H / 2));

    expect(renameEditor()).toBeNull();
    expect(edgeless.gfx.selection.selectedIds).not.toContain(frame.id);
    expect(frame.name).toBe('Orders');
  });

  test('…and a double-click in the band opens the rename on the author’s half', async () => {
    await addFrame();

    // Deliberately far from the drawn glyphs: the whole band is the target.
    await doubleClick(at(W - 200, BAND / 2));

    const input = renameEditor();
    expect(input).not.toBeNull();
    // `name` alone — the kind is the picker's half of `<kind> <name>`.
    expect(input!.value).toBe('Orders');
  });

  /* ── O2: the sheet stays under everything drawn on it ─────────────────── */

  /**
   * The recette's own stack: two classes on the sheet, and a use case SUBJECT
   * drawn on an empty corner of it. The subject is a framework background too,
   * so before the fix the sheet read as "buried" under it and every move raised
   * the sheet just above the topmost background it overlapped — which, the
   * subject being the topmost element of the whole stack, was the very front.
   */
  const drawnSheet = async () => {
    const frame = await addFrame();
    const surfaceModel = surface();
    const first = surfaceModel.addElement({
      type: 'umlNode',
      kind: 'class',
      role: UML_ROLE.class,
      xywh: '[200,200,200,120]',
    });
    const second = surfaceModel.addElement({
      type: 'umlNode',
      kind: 'class',
      role: UML_ROLE.class,
      xywh: '[600,400,200,120]',
    });
    await wait();
    const subject = surfaceModel.addElement({
      type: 'umlSubject',
      role: UML_ROLE.subject,
      name: 'Sales',
      xywh: '[950,600,380,260]',
    });
    await wait();
    return {
      frame,
      above: [first, second, subject].map(
        id => surfaceModel.getElementById(id)!
      ),
    };
  };

  const expectSheetUnderneath = (
    frame: UmlDiagramElementModel,
    above: GfxModel[]
  ) => {
    for (const element of above) {
      expect(
        edgeless.service.layer.compare(element, frame),
        element.id
      ).toBeGreaterThan(0);
    }
  };

  test('moving the frame keeps everything drawn on it on top', async () => {
    const { frame, above } = await drawnSheet();
    expectSheetUnderneath(frame, above);

    edgeless.service.crud.updateElement(frame.id, {
      xywh: `[20,20,${W},${H}]`,
    });
    await wait();

    expectSheetUnderneath(frame, above);
  });

  test('…and so does resizing it', async () => {
    const { frame, above } = await drawnSheet();

    edgeless.service.crud.updateElement(frame.id, {
      xywh: `[0,0,${W + 200},${H + 200}]`,
    });
    await wait();

    expectSheetUnderneath(frame, above);
  });
});

/**
 * O1, second reading (2026-09-16): « je peux sélectionner un UML diagram depuis
 * l'aire à l'intérieur ». The gesture that did it is the MARQUEE — a drag on the
 * sheet draws a selection rectangle, and box selection kept every element the
 * rectangle overlapped, the sheet included. A board joins a marquee only when
 * the marquee holds all of it (`FrameworkBackgroundElementModel.boxSelectable`).
 */
describe('a marquee drawn on the UML sheet does not take the sheet', () => {
  let edgeless!: EdgelessRootBlockComponent;

  const W = 1400;
  const H = 900;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    return cleanup;
  });

  const surface = () => getSurface(window.doc, window.editor).model;
  const host = () => window.editor.host as HTMLElement;
  const at = (x: number, y: number) => {
    const [vx, vy] = edgeless.gfx.viewport.toViewCoord(x, y);
    return { x: vx, y: vy };
  };

  const addFrame = async () => {
    const id = surface().addElement({
      type: 'umlDiagram',
      role: UML_ROLE.diagram,
      kind: 'class',
      name: 'Orders',
      xywh: `[0,0,${W},${H}]`,
    });
    await wait();
    return id;
  };

  const marquee = async (x0: number, y0: number, x1: number, y1: number) => {
    edgeless.gfx.selection.clear();
    await wait();
    drag(host(), at(x0, y0), at(x1, y1));
    await wait();
    return edgeless.gfx.selection.selectedIds;
  };

  test('a rectangle dragged inside the frame leaves it unselected', async () => {
    const frame = await addFrame();
    expect(await marquee(300, 200, 700, 500)).not.toContain(frame);
  });

  test('…but it takes the classes it lassoes', async () => {
    await addFrame();
    const cls = surface().addElement({
      type: 'umlNode',
      kind: 'class',
      role: UML_ROLE.class,
      filled: true,
      xywh: `[400,300,240,120]`,
    });
    await wait();
    expect(await marquee(300, 200, 700, 500)).toEqual([cls]);
  });

  test('a rectangle that holds the whole frame takes it', async () => {
    const frame = await addFrame();
    expect(await marquee(-50, -50, W + 50, H + 50)).toContain(frame);
  });

  test('and a C4 board answers the same way', async () => {
    const board = surface().addElement({
      type: 'c4Board',
      role: 'c4:board',
      name: 'System',
      xywh: `[0,0,${W},${H}]`,
    });
    await wait();
    expect(await marquee(300, 200, 700, 500)).not.toContain(board);
    expect(await marquee(-50, -50, W + 50, H + 50)).toContain(board);
  });
});
