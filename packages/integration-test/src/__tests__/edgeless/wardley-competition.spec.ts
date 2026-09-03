import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import {
  GroupElementModel,
  TextElementModel,
  WardleyNodeElementModel,
} from '@labre/affine/model';
import { getRegisteredCommands, runCommand } from '@labre/affine/std';
import { readElementTags } from '@labre/affine/std/gfx';
import { AFFINE_TOOLBAR_WIDGET } from '@labre/affine/widgets/toolbar';
import { beforeEach, describe, expect, test } from 'vitest';

import { pointerdown, pointerup, wait } from '../utils/common.js';
import { getDocRootBlock, getSurface } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * A Porter's-forces glyph says the same thing twice, and this is where the two
 * spellings are made to agree in a real editor.
 *
 * The unit suite owns the pack, the two pure mappings and the watcher's seams
 * on a stubbed surface. What only a mounted editor can answer is the part the
 * user actually lives: that the "Qualify" dropdown appears on the composite the
 * sub-menu draws, that picking a force REDRAWS the circle, that typing a letter
 * into that circle QUALIFIES it, that a letter nobody can read leaves no claim
 * behind — and that the five-forces panel the PO asked for really is in the
 * legend the map's own button generates.
 */

const COMPETITION = 'wardley:competition';
const RELATIVE = `${COMPETITION}/relative`;
const STRUGGLE = `${COMPETITION}/struggle`;
const ESTABLISH = `${COMPETITION}/establish`;

/** Native-shaped click: composed, so it crosses the widget's shadow boundary. */
function clickElement(element: Element) {
  const rect = element.getBoundingClientRect();
  const init = {
    bubbles: true,
    composed: true,
    cancelable: true,
    clientX: rect.x + rect.width / 2,
    clientY: rect.y + rect.height / 2,
    pointerId: 1,
    isPrimary: true,
  };
  element.dispatchEvent(new PointerEvent('pointerdown', init));
  element.dispatchEvent(new PointerEvent('pointerup', init));
  element.dispatchEvent(new MouseEvent('click', init));
}

/** See the note in `wardley-validation-bubble.spec.ts`: the viewport persists. */
const VIEWPORT_STORAGE_KEY = 'blocksuite:doc:home:edgelessViewport';

function forgetStoredViewport() {
  localStorage.removeItem(VIEWPORT_STORAGE_KEY);
  sessionStorage.removeItem(VIEWPORT_STORAGE_KEY);
}

describe('the force a Porter glyph marks', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    forgetStoredViewport();
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    edgeless.std.event.active = true;
    return () => {
      cleanup();
      forgetStoredViewport();
    };
  });

  const surfaceModel = () => getSurface(window.doc, window.editor).model;

  const run = async (id: string) => {
    const command = getRegisteredCommands(edgeless.std).find(c => c.id === id);
    expect(command, id).toBeDefined();
    runCommand(edgeless.std, command!, {
      surface: 'senior-menu',
      source: 'toolbar:general',
    });
    await wait();
  };

  const settle = async () => {
    await wait(250);
    await edgeless.updateComplete;
    await wait(0);
  };

  /** Draw the glyph the way the sub-menu does, and hand back its parts. */
  const drawPorter = async () => {
    await run('wardley.addPorter');
    const group = surfaceModel().elementModels.find(
      (model): model is GroupElementModel =>
        model instanceof GroupElementModel && model.group === null
    )!;
    const circle = group.childElements.find(
      (child): child is WardleyNodeElementModel =>
        child instanceof WardleyNodeElementModel
    )!;
    return { group, circle };
  };

  const select = async (...ids: string[]) => {
    edgeless.gfx.selection.set({ elements: ids, editing: false });
    await settle();
  };

  const toolbar = () =>
    (
      edgeless.widgetComponents[AFFINE_TOOLBAR_WIDGET] as
        | { toolbar?: HTMLElement }
        | undefined
    )?.toolbar ?? null;
  const toolbarQuery = (selector: string) =>
    toolbar()?.querySelector(selector) ?? null;

  const tagsEntry = () => toolbarQuery('[data-testid="element-tags-entry"]');
  const tagsButton = () =>
    tagsEntry()?.shadowRoot?.querySelector(
      '[data-testid="element-tags-button"]'
    ) ?? null;
  const sections = () =>
    Array.from(
      toolbar()?.querySelectorAll('[data-testid="element-tag-section"]') ?? []
    );
  const options = () =>
    Array.from(
      toolbar()?.querySelectorAll('[data-testid="element-tag-option"]') ?? []
    );
  const option = (valueId: string) =>
    options().find(el => (el as HTMLElement).dataset.valueId === valueId) ??
    null;

  const pick = async (selectionId: string, valueId: string) => {
    await select(selectionId);
    expect(option(valueId), valueId).not.toBeNull();
    clickElement(option(valueId)!);
    await settle();
  };

  const tagsOf = (element: WardleyNodeElementModel) =>
    readElementTags(element)[COMPETITION] ?? [];

  /* ── The dropdown ─────────────────────────────────────────────────── */

  test('one click on the composite reaches the three forces', async () => {
    // The sub-menu draws a circle and four polygons, grouped: a single click
    // selects the GROUP, and only the circle carries `wardley:porter`.
    const { group } = await drawPorter();
    await select(group.id);

    expect(tagsButton()).not.toBeNull();
    expect(sections().map(el => (el as HTMLElement).dataset.tagId)).toEqual([
      COMPETITION,
    ]);
    expect(
      options().map(el => [
        (el as HTMLElement).dataset.valueId,
        el.textContent?.trim(),
      ])
    ).toEqual([
      [RELATIVE, 'Relative competition (R)'],
      [STRUGGLE, 'Struggle for survival (L)'],
      [ESTABLISH, 'Struggle to establish (E)'],
    ]);
  });

  test('a component is offered its nature, and never a force', async () => {
    // The two tags of the one pack, on disjoint roles: a force is not a link in
    // the value chain, so nothing written on `wardley:component` reaches it and
    // nothing written on `wardley:porter` reaches a component.
    await run('wardley.addComponent');
    const node = surfaceModel().elementModels.find(
      (model): model is WardleyNodeElementModel =>
        model instanceof WardleyNodeElementModel && model.kind === 'component'
    )!;
    await select(node.id);

    expect(sections().map(el => (el as HTMLElement).dataset.tagId)).toEqual([
      'wardley:nature',
    ]);
  });

  /* ── Tag → letter ─────────────────────────────────────────────────── */

  test('picking a force redraws the letter in the circle', async () => {
    const { group, circle } = await drawPorter();
    expect(circle.text?.toString()).toBe('R');

    await pick(group.id, STRUGGLE);

    expect(tagsOf(circle)).toEqual([STRUGGLE]);
    expect(circle.text?.toString()).toBe('L');
    // Readable off the trigger without opening the menu.
    expect(tagsButton()?.textContent).toContain('Struggle for survival');
  });

  test('the qualification lands on the circle, not on the group', async () => {
    const { group, circle } = await drawPorter();
    await pick(group.id, ESTABLISH);

    expect(tagsOf(circle)).toEqual([ESTABLISH]);
    expect(circle.text?.toString()).toBe('E');
    // The group is scaffolding; the statement belongs to the artefact.
    expect(readElementTags(group)).toEqual({});
  });

  test('un-picking clears the claim and leaves the drawing alone', async () => {
    const { group, circle } = await drawPorter();
    await pick(group.id, ESTABLISH);
    await pick(group.id, ESTABLISH);

    expect(tagsOf(circle)).toEqual([]);
    // Removing a value from the menu is a statement about the qualification,
    // not about the map somebody is still reading.
    expect(circle.text?.toString()).toBe('E');
  });

  /* ── Letter → tag ─────────────────────────────────────────────────── */

  /** A model point, as the pointer helpers take it. */
  const at = (x: number, y: number) => {
    const [vx, vy] = edgeless.gfx.viewport.toViewCoord(x, y);
    return { x: vx, y: vy };
  };

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

  /** Type over the circle's whole text and close the editor, as a user does. */
  const retype = async (circle: WardleyNodeElementModel, letter: string) => {
    const [x, y, w, h] = circle.deserializedXYWH;
    await doubleClick(at(x + w / 2, y + h / 2));
    const editor = shapeEditor();
    expect(editor?.inlineEditor).toBeTruthy();

    editor!.inlineEditor!.insertText(
      { index: 0, length: circle.text!.length },
      letter
    );
    await wait();

    // Escape ends the edit and the container blurs with it, which is what
    // unmounts the editor — and what drops the EDITING selection the watcher
    // reads a commit off.
    editor!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    editor!.inlineEditorContainer?.dispatchEvent(
      new FocusEvent('blur', { bubbles: false })
    );
    await settle();
  };

  test('typing a letter qualifies the glyph, once the editor closes', async () => {
    const { circle } = await drawPorter();
    await retype(circle, 'E');

    expect(circle.text?.toString()).toBe('E');
    expect(tagsOf(circle)).toEqual([ESTABLISH]);
  });

  test('a letter nobody can read leaves no claim behind', async () => {
    const { group, circle } = await drawPorter();
    await pick(group.id, ESTABLISH);
    await retype(circle, 'X');

    expect(circle.text?.toString()).toBe('X');
    // Never the nearest value: a glyph nobody can read must not be reported as
    // a force somebody named — and the key goes with it.
    expect(tagsOf(circle)).toEqual([]);
    expect(readElementTags(circle)).toEqual({});
  });

  test('undo puts the letter and the claim back where they were', async () => {
    const { group, circle } = await drawPorter();
    await pick(group.id, STRUGGLE);
    expect([circle.text?.toString(), tagsOf(circle)]).toEqual([
      'L',
      [STRUGGLE],
    ]);

    await pick(group.id, ESTABLISH);
    expect([circle.text?.toString(), tagsOf(circle)]).toEqual([
      'E',
      [ESTABLISH],
    ]);

    window.doc.undo();
    await settle();

    // One gesture, one undo: the pick and the redraw it caused come back
    // together, and the previous force is the one on the map again.
    expect(tagsOf(circle)).toEqual([STRUGGLE]);
    expect(circle.text?.toString()).toBe('L');
  });

  /* ── The legend's five-forces panel ───────────────────────────────── */

  test('the map’s Legend button draws the five-forces panel', async () => {
    // Both are viewport-centred, so the force lands inside the map's perimeter
    // — which is what makes the legend describe it at all.
    await run('wardley.addBackground');
    await drawPorter();

    const background = surfaceModel().elementModels.find(
      model => model.role === 'wardley:map'
    )!;
    await select(background.id);

    const legendButton = toolbarQuery('[data-toolbar-action-id="d.legend"]');
    expect(legendButton).not.toBeNull();
    clickElement(legendButton!);
    await settle();

    const legend = surfaceModel()
      .elementModels.filter(
        (model): model is GroupElementModel =>
          model instanceof GroupElementModel && model.group === null
      )
      .find(group =>
        group.childElements.some(
          child =>
            child instanceof TextElementModel &&
            child.text.toString() === "Porter's five forces"
        )
      );
    expect(legend, 'the legend group').toBeTruthy();

    const words = legend!.childElements
      .filter((child): child is TextElementModel => {
        return child instanceof TextElementModel;
      })
      .map(child => child.text.toString());

    for (const force of [
      'Threat of new entrants',
      'Bargaining power of suppliers',
      'Bargaining power of customers',
      'Threat of substitutes',
    ]) {
      expect(words, force).toContain(force);
    }
    expect(words).toContain(
      'R/L/E = Relative competition, or struggLe for survival, or struggle to Establish'
    );

    // A legend documents the map, it is not part of it: nothing it drew is
    // roled, so no rule and no reading counts a phantom force.
    for (const child of legend!.childElements) {
      expect(child.role, child.id).toBeUndefined();
    }
  });
});
