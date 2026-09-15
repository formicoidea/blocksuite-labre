import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
// Straight off the framework package, as the bpmn, wardley and c4 specs already
// reach for theirs: `@labre/affine` re-exports the blocks, not the framework
// modules.
import {
  UML_ROLE,
  umlCompartmentBoxes,
  umlStackHeight,
  umlTierLineCount,
} from '@labre/affine-gfx-uml';
import {
  getFontString,
  getLineHeight,
  mountTextElementEditor,
  wrapText,
} from '@labre/affine/gfx/text';
import {
  GroupElementModel,
  TextElementModel,
  UmlNodeElementModel,
} from '@labre/affine/model';
import { getRegisteredCommands, runCommand } from '@labre/affine/std';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock, getSurface } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * The compartment watcher on a REAL editor.
 *
 * The unit suite owns the decision — measure the tiers, grow the box, move the
 * texts — against four plain objects. What only a live editor can answer is
 * whether the seam is WIRED: whether the watcher is registered at all (it hangs
 * off the always-on half of `view.ts`, so a document opened with the UML button
 * off must still get it), whether the real text editor's selection is the one it
 * listens to, and whether the separators the canvas renderer strokes end up
 * between the compartments that a real classifier now has.
 *
 * The typing goes through `mountTextElementEditor` — the very call a
 * double-click on a tier makes — and the newlines are written into the element's
 * own `Y.Text`, which is exactly what the inline editor bound to it writes into.
 * Closing the editor is `selection.clear()`, which is what clicking onto bare
 * canvas does and what the editor itself unmounts on.
 */
describe('a classifier grows to fit what is typed into it', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    return cleanup;
  });

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

  /** The class just drawn: its shape and the three tiers grouped with it. */
  const lastClassifier = () => {
    const groups = surfaceModel().elementModels.filter(
      (model): model is GroupElementModel => model instanceof GroupElementModel
    );
    const group = groups[groups.length - 1];
    expect(group).toBeDefined();

    const children = group.childElements;
    const node = children.find(
      (child): child is UmlNodeElementModel =>
        child instanceof UmlNodeElementModel
    );
    const tier = (role: string) =>
      children.find(
        (child): child is TextElementModel =>
          child instanceof TextElementModel && child.role === role
      );
    expect(node).toBeDefined();

    return {
      group,
      node: node!,
      name: tier(UML_ROLE.name)!,
      attributes: tier(UML_ROLE.attributes)!,
      operations: tier(UML_ROLE.operations)!,
    };
  };

  /** Open the tier's editor, type into it, and close it — one commit. */
  const type = async (tier: TextElementModel, lines: string[]) => {
    mountTextElementEditor(tier, edgeless);
    await wait();
    expect(edgeless.gfx.selection.editing).toBe(true);

    window.doc.transact(() => {
      tier.text.delete(0, tier.text.length);
      if (lines.length) tier.text.insert(0, lines.join('\n'));
    });
    await wait();

    edgeless.gfx.selection.clear();
    await wait();
  };

  /** The mounted canvas-text editor, or null. */
  const textEditor = () =>
    document.querySelector('edgeless-text-editor') as
      | (HTMLElement & {
          element: TextElementModel;
          inlineEditorContainer?: HTMLElement;
        })
      | null;

  /**
   * Close the open editor the way a user does — by letting the inline editor
   * lose focus, which is what unmounts it and runs its COMMIT.
   *
   * `selection.clear()` (what {@link type} does) is enough to make the watcher
   * fire, and it is the lighter gesture, but it leaves the editor in the DOM: it
   * is the blur that runs the disposer, and the disposer is where a text emptied
   * of its words used to be deleted.
   */
  const blurEditor = async () => {
    const editor = textEditor();
    expect(editor, 'no text editor is open').not.toBeNull();
    editor!.inlineEditorContainer?.dispatchEvent(new FocusEvent('blur'));
    await wait(100);
  };

  /** Open a tier's editor, empty it, and let it close on a blur. */
  const empty = async (tier: TextElementModel) => {
    mountTextElementEditor(tier, edgeless);
    await wait();
    window.doc.transact(() => tier.text.delete(0, tier.text.length));
    await wait();
    await blurEditor();
  };

  const box = (element: { deserializedXYWH: number[] }) =>
    element.deserializedXYWH as [number, number, number, number];

  /**
   * How tall the canvas renderer PAINTS a tier — its own wrap at the tier's own
   * width, times its own line height.
   *
   * This is the number the compartment has to be big enough for, and the one the
   * watcher used to answer with a `\n` count: a tier is created with
   * `hasMaxWidth`, so a long signature is BROKEN before it is drawn.
   */
  const paintedHeight = (tier: TextElementModel) => {
    const font = getFontString(tier);
    const [, , w] = box(tier);
    const lines = tier.text
      .toString()
      .split('\n')
      .reduce(
        (total, line) => total + wrapText(line, font, w).split('\n').length,
        0
      );
    return (
      lines * getLineHeight(tier.fontFamily, tier.fontSize, tier.fontWeight)
    );
  };

  test('three more attribute lines make the box taller, with the tiers under them', async () => {
    await run('uml.addDiagram');
    await run('uml.addClass');

    const { node, name, attributes, operations } = lastClassifier();
    const [x, y, w, before] = box(node);

    await type(attributes, [
      '+ id : CustomerId',
      '+ name : String',
      '+ email : Email',
      '+ createdAt : Instant',
      '+ status : Status',
    ]);

    // The stack the five lines need, computed the way the watcher computes it —
    // never a literal, which would turn every nudge to a margin into a failure.
    const lines = {
      name: umlTierLineCount(name.text),
      attributes: umlTierLineCount(attributes.text),
      operations: umlTierLineCount(operations.text),
    };
    expect(lines.attributes).toBe(5);
    const required = umlStackHeight(node.kind, lines)!;
    expect(required).toBeGreaterThan(before);

    const [, , , after] = box(node);
    expect(after).toBeCloseTo(required, 6);
    // It grew: nothing else about the box moved.
    expect(box(node)[0]).toBe(x);
    expect(box(node)[1]).toBe(y);
    expect(box(node)[2]).toBe(w);

    // …and the three tiers are exactly where that box puts them, which is what
    // the renderer reads the separators off.
    const boxes = umlCompartmentBoxes(node.kind, x, y, w, after, lines);
    for (const [tier, expected] of [
      [name, boxes.name],
      [attributes, boxes.attributes!],
      [operations, boxes.operations!],
    ] as const) {
      const [tx, ty, tw, th] = box(tier);
      expect(tx, tier.role).toBeCloseTo(expected.x, 6);
      expect(ty, tier.role).toBeCloseTo(expected.y, 6);
      expect(tw, tier.role).toBeCloseTo(expected.w, 6);
      expect(th, tier.role).toBeCloseTo(expected.h, 6);
    }

    // The separators sit on the boundaries of the tiers as they NOW are: the
    // first where the attributes compartment opens, the second where it closes.
    expect(boxes.splits[0]).toBeCloseTo(box(attributes)[1] - y, 6);
    expect(boxes.splits[1]).toBeCloseTo(
      box(attributes)[1] + box(attributes)[3] - y,
      6
    );
    // …and not where the stencil's three-line stack would have ruled the second.
    const stencil = umlCompartmentBoxes(node.kind, x, y, w, after);
    expect(boxes.splits[1]).not.toBeCloseTo(stencil.splits[1], 6);
  });

  /**
   * The PO's recette of 14/09/2026: « la boîte ne grandit pas du tout à la bonne
   * taille ».
   *
   * ONE attribute line, too long for the compartment — which the canvas renderer
   * therefore WRAPS before it paints, because every tier is created with
   * `hasMaxWidth`. The text editor measured that correctly and grew the box
   * while the author typed; the commit then counted the author's `\n` (one),
   * sized the compartment for one line and put the box back — 92.7 units of
   * painted words into a 54.6-unit compartment, the remainder drawn straight
   * through the separator and across the operations.
   *
   * The numbers below are MEASURED rather than written down: the assertion is
   * that the compartment holds what the renderer paints, whatever the font
   * metrics of the day happen to be.
   */
  test('a line long enough to WRAP grows the box for every painted line', async () => {
    await run('uml.addDiagram');
    await run('uml.addClass');

    const { node, attributes, operations } = lastClassifier();
    const [, , , before] = box(node);

    const long =
      '+ findByCustomerIdAndStatus(id : CustomerId, status : OrderStatus) : List<Order>';
    await type(attributes, [long]);

    // The premise: one typed line, several painted ones. If the compartment ever
    // grows wide enough for this signature the case has stopped testing wrapping
    // and has to be given a longer one.
    expect(umlTierLineCount(attributes.text)).toBe(1);
    const painted = paintedHeight(attributes);
    const perLine = getLineHeight(
      attributes.fontFamily,
      attributes.fontSize,
      attributes.fontWeight
    );
    expect(painted).toBeGreaterThan(perLine * 1.5);

    // The compartment holds every painted line…
    expect(box(attributes)[3] + 0.5).toBeGreaterThanOrEqual(painted);
    // …the rule under it is below the last one, not through it…
    expect(box(operations)[1]).toBeGreaterThanOrEqual(
      box(attributes)[1] + painted - 0.5
    );
    // …and the node grew to make room, rather than staying the stencil's height.
    expect(box(node)[3]).toBeGreaterThan(before);
    expect(box(operations)[1] + box(operations)[3]).toBeLessThanOrEqual(
      box(node)[1] + box(node)[3]
    );
  });

  /**
   * The PO's recette of 14/09/2026: « si je supprime l'intérieur du titre […] je
   * n'arrive pas à entrer dans l'édition de texte ».
   *
   * A free canvas text emptied of its words is nothing, and the editor deletes
   * it — which is right for a text somebody abandoned and wrong for a
   * COMPARTMENT. Emptying a classifier's title used to take the `uml:name`
   * element out of the group, and the next double-click on the body then fell
   * through to the SHAPE's own inner text (`UmlNodeView`), which R16 keeps empty
   * and the UML renderer never paints: an editor opened on a field nothing shows.
   */
  test('a title emptied to the placeholder stays, and stays editable', async () => {
    await run('uml.addDiagram');
    await run('uml.addClass');

    const { group, node, name, attributes, operations } = lastClassifier();
    const children = group.childElements.length;

    await empty(name);

    // Still there, still the group's, still carrying its role — an empty
    // compartment, which is a thing UML draws (§14.2.4) and not an absence.
    expect(surfaceModel().getElementById(name.id)).not.toBeNull();
    expect(group.childElements).toHaveLength(children);
    expect(name.text.toString()).toBe('');
    expect(name.role).toBe(UML_ROLE.name);
    // …and the watcher put it back into its compartment rather than leaving it
    // at whatever size the editor's placeholder measured.
    const lines = {
      name: umlTierLineCount(name.text),
      attributes: umlTierLineCount(attributes.text),
      operations: umlTierLineCount(operations.text),
    };
    const [x, y, w, h] = box(node);
    const expected = umlCompartmentBoxes(node.kind, x, y, w, h, lines).name;
    expect(box(name)[3]).toBeCloseTo(expected.h, 6);

    // The gesture the PO could not make: a double-click on the BODY opens the
    // name compartment's own editor, not the shape's invisible inner text.
    const view = edgeless.gfx.view.get(node) as {
      dispatch(event: string, evt: unknown): boolean;
    };
    const [vx, vy] = edgeless.gfx.viewport.toViewCoord(x + w / 2, y + 20);
    view.dispatch('dblclick', {
      x: vx,
      y: vy,
      raw: { clientX: vx, clientY: vy },
    });
    await wait(100);

    expect(document.querySelector('edgeless-shape-text-editor')).toBeNull();
    expect(textEditor()?.element.id).toBe(name.id);

    // …and what is typed into it lands in the compartment.
    window.doc.transact(() => name.text.insert(0, 'Ligne'));
    await wait();
    await blurEditor();
    expect(name.text.toString()).toBe('Ligne');
  });

  test('an edit the stencil already fits leaves the box alone', async () => {
    await run('uml.addDiagram');
    await run('uml.addClass');

    const { node, name, operations, attributes } = lastClassifier();
    const before = [node.xywh, name.xywh, operations.xywh];

    // Three attribute lines, which is exactly what a fresh 200 × 120 class is
    // sized for — the overwhelmingly common edit, and the one where a write
    // would cost the author a ctrl-Z for nothing.
    await type(attributes, ['+ a : A', '+ b : B', '+ c : C']);

    expect([node.xywh, name.xywh, operations.xywh]).toEqual(before);
  });

  /**
   * The re-layout is several writes — the box and the tiers — and it has to be
   * ONE undo entry, or an author who changes their mind walks the layout back a
   * tier at a time and sees a broken picture at every stop.
   *
   * It is its own entry rather than part of the typing, which is
   * `captureSync()`'s doing and is deliberate: the alternative is an entry whose
   * contents depend on how long the author paused before clicking away, and a
   * layout that sometimes comes back with the words and sometimes does not is
   * worse than one that always behaves the same.
   *
   * The EDITED tier is left out of the comparison on purpose. The canvas text
   * editor shrink-wraps the element it is mounted on while the author types
   * (`_updateRect` on every render), so that one box has a write of the
   * editor's own underneath the watcher's — which is precisely what the watcher
   * puts back into the compartment when the edit commits, as the first case
   * asserts.
   */
  test('the whole re-layout is ONE undo step', async () => {
    await run('uml.addDiagram');
    await run('uml.addClass');

    const { node, name, attributes, operations } = lastClassifier();
    const before = [node, name, operations].map(element => element.xywh);
    const typed = ['+ a : A', '+ b : B', '+ c : C', '+ d : D'];

    await type(attributes, typed);
    expect(node.xywh).not.toBe(before[0]);

    window.doc.undo();
    await wait();

    // The box and the tiers it moved, back in one step…
    expect([node, name, operations].map(element => element.xywh)).toEqual(
      before
    );
    // …and the words the author typed are still there: undoing a consequence
    // does not undo the cause.
    expect(attributes.text.toString()).toBe(typed.join('\n'));
  });
});
