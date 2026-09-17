import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { ElementRendererIdentifier } from '@labre/affine/blocks/surface';
// Straight off the framework package, as the bpmn, wardley and c4 specs already
// reach for theirs: `@labre/affine` re-exports the blocks, not the framework
// modules.
import { UML_ROLE } from '@labre/affine-gfx-uml';
import {
  GroupElementModel,
  TextElementModel,
  UML_FRAME_BAND_HEIGHT,
  type UmlDiagramElementModel,
  UmlNodeElementModel,
} from '@labre/affine/model';
import { getRegisteredCommands, runCommand } from '@labre/affine/std';
import { SeniorToolIdentifier } from '@labre/affine/widgets/edgeless-toolbar';
import type { GfxModel } from '@labre/std/gfx';
import { beforeEach, describe, expect, test } from 'vitest';

import { pointerdown, pointermove, pointerup, wait } from '../utils/common.js';
import { getDocRootBlock, getSurface } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * The UML pack on a REAL editor.
 *
 * The unit suites own each half: what a creation action builds (`gfx/uml`),
 * what the frame's hit test carves out (`affine-model`), what the commands
 * declare (`affine/all`). What only a live editor can answer is whether the
 * pieces meet — whether the command a user clicks builds the component the
 * palette records, whether the frame under it stays under it, and whether the
 * pointer that lands on the heading band reaches the view that renames it.
 *
 * Every gesture below goes through real `PointerEvent`s on the editor host, for
 * the reason `c4-board-title-band.spec.ts` documents at length: a spec that
 * called `view.dispatch('dblclick', …)` by hand once passed while the real
 * board, under a real mouse, renamed nothing.
 */
describe('the UML toolbox draws what it declares', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    return cleanup;
  });

  /** Run one registered command, the way the sub-menu runs it. */
  const run = async (commandId: string) => {
    const command = getRegisteredCommands(edgeless.std).find(
      c => c.id === commandId
    );
    expect(command, commandId).toBeDefined();
    runCommand(edgeless.std, command!, {
      surface: 'senior-menu',
      source: 'toolbar:general',
    });
    await wait();
  };

  const surfaceModel = () => getSurface(window.doc, window.editor).model;

  /** The last group the surface gained — the component just drawn. */
  const lastGroup = () => {
    const groups = surfaceModel().elementModels.filter(
      (model): model is GroupElementModel => model instanceof GroupElementModel
    );
    return groups[groups.length - 1];
  };

  const lastDiagram = () => {
    const frames = surfaceModel().elementModels.filter(
      (model): model is UmlDiagramElementModel => model.type === 'umlDiagram'
    );
    return frames[frames.length - 1];
  };

  /* ── What a command actually puts on the canvas ──────────────────────── */

  test('addClass builds one node and its three compartments, grouped', async () => {
    await run('uml.addDiagram');
    await run('uml.addClass');

    const group = lastGroup();
    expect(group).toBeDefined();

    const children = group.childElements;
    const nodes = children.filter(
      (child): child is UmlNodeElementModel =>
        child instanceof UmlNodeElementModel
    );
    const texts = children.filter(
      (child): child is TextElementModel => child instanceof TextElementModel
    );

    // The shape is a body and nothing else; the words are its own children, one
    // per compartment, so the grammar can read each tier back on its own.
    expect(nodes).toHaveLength(1);
    expect(texts).toHaveLength(3);
    expect(texts.map(text => text.role).sort()).toEqual(
      [UML_ROLE.name, UML_ROLE.attributes, UML_ROLE.operations].sort()
    );
    // Every tier carries the seed it was born with: an empty compartment would
    // be a box a user has to guess the shape of.
    for (const text of texts) {
      expect(text.text.toString().length, text.role).toBeGreaterThan(0);
    }
  });

  test('the diagram stays UNDER what is drawn on it', async () => {
    await run('uml.addDiagram');
    const diagram = lastDiagram();
    await run('uml.addClass');
    const group = lastGroup();

    // The sheet is painted first and stays there: a frame created before the
    // component must not come out on top of it, or every element it holds is
    // hidden behind the thing that holds them.
    expect(
      diagram.index < group.index,
      `${diagram.index} < ${group.index}`
    ).toBe(true);
  });

  test('addUseCase draws a use case, and the frame says which diagram it is', async () => {
    await run('uml.addDiagram');
    const diagram = lastDiagram();

    // A use-case diagram is the same sheet declaring a different kind: the
    // heading is `<kind> <name>` (Annex A), so switching it rewrites the tag
    // rather than adding a second one.
    diagram.kind = 'uc';
    await wait();
    expect(diagram.heading.startsWith('uc ')).toBe(true);

    await run('uml.addUseCase');
    const group = lastGroup();
    const node = group.childElements.find(
      (child): child is UmlNodeElementModel =>
        child instanceof UmlNodeElementModel
    );
    expect(node).toBeDefined();
    expect(node!.kind).toBe('use-case');
    // One label, not three compartments: an ellipse has nothing to divide.
    expect(
      group.childElements.filter(child => child instanceof TextElementModel)
    ).toHaveLength(1);
  });

  /* ── Driving the real pointer pipeline ───────────────────────────────── */

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

  const doubleClick = async (p: { x: number; y: number }) => {
    tap(p);
    tap(p);
    await wait();
  };

  /** What the editor's own picking says is under a MODEL-space point. */
  const pick = (x: number, y: number): GfxModel | null =>
    edgeless.gfx.getElementByPoint(x, y);

  /** The in-place `<input>` the view opens, or null. */
  const nameEditor = () =>
    (Array.from(document.body.children).findLast(
      el => el.tagName === 'INPUT'
    ) as HTMLInputElement | undefined) ?? null;

  test('a click on the heading band picks the frame, the plot does not', async () => {
    await run('uml.addDiagram');
    const diagram = lastDiagram();
    const [x, y, w, h] = diagram.deserializedXYWH;

    // Well inside the band and clear of every edge, so the answer is the
    // BAND's rather than the border's.
    expect(pick(x + w / 2, y + UML_FRAME_BAND_HEIGHT / 2)?.id).toBe(diagram.id);
    // The plot is where the diagram goes: a click in the middle of the sheet
    // belongs to whatever is drawn under the pointer, never to the sheet.
    expect(pick(x + w / 2, y + h / 2)?.id).not.toBe(diagram.id);
  });

  test('a double-click on the band opens the heading editor', async () => {
    await run('uml.addDiagram');
    const diagram = lastDiagram();
    const [x, y, w] = diagram.deserializedXYWH;
    const point = at(x + w - 200, y + UML_FRAME_BAND_HEIGHT / 2);

    // The ordinary path a hand takes: move onto the band, then click twice.
    pointermove(host(), point);
    await wait();
    await doubleClick(point);

    const input = nameEditor();
    expect(input).not.toBeNull();
    // Opened on the words currently drawn, never on an empty box.
    expect(input!.value).toBe(diagram.name);
    // The frame is held in editing so the global delete/escape keys stand down.
    expect(edgeless.gfx.selection.editing).toBe(true);

    input!.value = 'Ordering';
    input!.dispatchEvent(new Event('blur'));
    await wait();
    expect(diagram.name).toBe('Ordering');
    // …and the kind is untouched: the band edits the NAME, and the heading is
    // the kind plus it.
    expect(diagram.heading).toBe('class Ordering');
  });
});

/**
 * ADR 0009's two halves, on one editor: the flag takes the BUTTON away and
 * leaves the DRAWING alone.
 *
 * Its own `describe` because `setupEditor` with flags builds a second view
 * manager, and mounting one on top of the default all-on editor would leave two
 * editors in one page (the note `template-insertion.spec.ts` carries).
 */
describe('a UML diagram on an editor with the framework switched off', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless', undefined, {
      flags: { uml: false },
    });
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    return cleanup;
  });

  test('the senior button is gone, and so are the commands behind it', () => {
    const seniors = [
      ...edgeless.std.provider.getAll(SeniorToolIdentifier).keys(),
    ];
    expect(seniors).not.toContain('uml');
    expect(
      getRegisteredCommands(edgeless.std).filter(c => c.owner === 'uml')
    ).toEqual([]);
    // Nothing of the sub-menu was mounted either, so there is no button to
    // click into a no-op.
    expect(document.querySelector('edgeless-uml-senior-button')).toBeNull();
  });

  test('a stored diagram still paints, and still takes its own click', async () => {
    // Written straight onto the surface, the way a document created while the
    // flag was on arrives: no command runs here, because there is none to run.
    const surface = getSurface(window.doc, window.editor).model;
    const id = surface.addElement({
      type: 'umlDiagram',
      role: UML_ROLE.diagram,
      kind: 'class',
      name: 'Ordering',
      xywh: '[0,0,1400,900]',
    });
    await wait();

    // The renderer is registered from the ALWAYS-ON half, so the sheet paints.
    expect(
      edgeless.std.provider.getOptional(ElementRendererIdentifier('umlDiagram'))
    ).toBeDefined();
    // …and it is still the element under its own heading band: selection,
    // resizing and the contextual row are content affordances, not tooling.
    expect(
      edgeless.gfx.getElementByPoint(700, UML_FRAME_BAND_HEIGHT / 2)?.id
    ).toBe(id);
  });
});
