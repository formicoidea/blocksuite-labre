import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import {
  PivotRecordPickerExtension,
  READING_PROPOSAL_WIDGET,
  ReadingManager,
} from '@labre/affine/blocks/surface';
import type { ExtensionType } from '@labre/store';
import type { BlockFlags } from '@labre/affine/flags';
import { AFFINE_TOOLBAR_WIDGET } from '@labre/affine/widgets/toolbar';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import * as Y from 'yjs';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * MF3 end to end: the proposal panel a click opens, in a real editor.
 *
 * The unit suites own the five readings, the Wardley declaration and the drift
 * trigger. This one owns what only a real editor can answer: that the entry is
 * reachable from ONE click on a composite component, that the panel it opens
 * says what the map says, that Escape puts it away — and, the one that matters,
 * that all of it leaves the document byte-identical.
 */

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

/** See `wardley-validation-bubble.spec.ts`: the viewport persists per doc id. */
const VIEWPORT_STORAGE_KEY = 'blocksuite:doc:home:edgelessViewport';

function forgetStoredViewport() {
  localStorage.removeItem(VIEWPORT_STORAGE_KEY);
  sessionStorage.removeItem(VIEWPORT_STORAGE_KEY);
}

describe('the reversed reading of a Wardley component', () => {
  let service!: EdgelessRootBlockComponent['service'];
  let root!: EdgelessRootBlockComponent;
  let unmount: (() => void) | null = null;

  const addMap = () =>
    service.surface.addElement({
      type: 'wardley',
      role: 'wardley:map',
      xywh: '[0,0,1600,900]',
    });

  /** A component whose centre sits in the "Product" phase. */
  const addComponent = (xywh = '[871,441,18,18]') =>
    service.surface.addElement({
      type: 'wardleyNode',
      kind: 'component',
      role: 'wardley:component',
      xywh,
    });

  const addLabel = (xywh = '[900,441,120,26]') =>
    service.surface.addElement({
      type: 'text',
      text: 'Brewing tea',
      role: 'wardley:label',
      xywh,
    });

  const groupOf = (...ids: string[]) =>
    service.surface.addElement({
      type: 'group',
      children: Object.fromEntries(ids.map(id => [id, true])),
    });

  /** The element toolbar; its actions render into `editor-toolbar`'s LIGHT DOM. */
  const toolbar = () =>
    (
      root.widgetComponents[AFFINE_TOOLBAR_WIDGET] as
        | { toolbar?: HTMLElement }
        | undefined
    )?.toolbar ?? null;

  /**
   * The reading entry, by the testid the toolbar derives from an action id —
   * `renderActionItem` keeps the last dot-separated segment of
   * `y1.element-reading`.
   */
  const readButton = () =>
    toolbar()?.querySelector('[data-testid="element-reading"]') ?? null;

  const widget = () => root.widgetComponents[READING_PROPOSAL_WIDGET];
  const query = (selector: string) =>
    widget()?.shadowRoot?.querySelector(selector) ?? null;
  const panel = () => query('[data-testid="reading-panel"]');
  const field = (testid: string) => query(`[data-testid="${testid}"]`);

  const manager = () => service.std.get(ReadingManager);

  const settle = async () => {
    await wait(250);
    await root.updateComplete;
    await widget()?.updateComplete;
    await wait(0);
  };

  const select = async (...ids: string[]) => {
    service.gfx.selection.set({ elements: ids, editing: false });
    await settle();
  };

  const snapshot = () => Y.encodeStateAsUpdate(window.doc.spaceDoc);

  const mount = async (
    flags?: BlockFlags,
    extensions: ExtensionType[] = []
  ) => {
    forgetStoredViewport();
    const cleanup = await setupEditor(
      'edgeless',
      extensions,
      flags ? { flags } : undefined
    );
    unmount = cleanup;
    root = getDocRootBlock(window.doc, window.editor, 'edgeless');
    service = root.service;
    service.std.event.active = true;
  };

  beforeEach(async () => {
    await mount();
    return () => {
      unmount?.();
      unmount = null;
    };
  });
  afterEach(() => forgetStoredViewport());

  test('one click on a composite component offers the reading', async () => {
    addMap();
    const group = groupOf(addComponent(), addLabel());
    await select(group);

    // A single click selects the GROUP; the role lives on the node, and the
    // entry resolves through the group exactly as the qualification dropdown
    // does.
    expect(readButton()).not.toBeNull();
  });

  test('a plain shape is neutral, and offers nothing', async () => {
    const shape = service.surface.addElement({
      type: 'shape',
      shapeType: 'rect',
      xywh: '[100,100,60,60]',
    });
    await select(shape);

    expect(readButton()).toBeNull();
  });

  test('the panel opens on the click and says what the map says', async () => {
    addMap();
    const component = addComponent();
    const label = addLabel();
    const group = groupOf(component, label);
    await select(group);

    clickElement(readButton()!);
    await settle();

    expect(panel()).not.toBeNull();
    expect(field('reading-node-type')?.textContent).toContain('component');
    // Read off the map's own zones, not off a number in the reading code.
    expect(field('reading-phase')?.textContent).toContain('Product');
    // Carried nothing, proposes nothing.
    expect(field('reading-nature-empty')).not.toBeNull();
  });

  test('opening and closing it a hundred times writes nothing', async () => {
    addMap();
    const component = addComponent();
    await select(component);
    const before = snapshot();

    for (let i = 0; i < 100; i++) {
      manager().open(component);
      manager().close();
    }
    await settle();

    // The whole arbitration, in one assertion: a reading is a read.
    expect(snapshot()).toEqual(before);
    expect(
      service.surface.getElementById(component)!.yMap.has('tags')
    ).toBe(false);
  });

  test('with no host picker there is nothing to link with', async () => {
    addMap();
    const component = addComponent();
    await select(component);

    manager().open(component);
    await settle();

    // The library cannot choose a document. With no picker registered the
    // affordance is HIDDEN rather than disabled — a button that opens nothing
    // is worse than no button.
    expect(field('reading-record')).not.toBeNull();
    expect(field('reading-link-record')).toBeNull();
  });

  test('the host’s picker is what turns the proposal into a binding', async () => {
    unmount?.();
    unmount = null;
    await mount(undefined, [
      PivotRecordPickerExtension({ pick: async () => 'pivot-payments' }),
    ]);

    addMap();
    const component = addComponent();
    await select(component);
    manager().open(component);
    await settle();

    const link = field('reading-link-record') as HTMLElement | null;
    expect(link).not.toBeNull();
    // Before the click, nothing is bound: rendering the proposal wrote nothing.
    expect(service.surface.getElementById(component)!.pivotDocId).toBeUndefined();

    clickElement(link!);
    await settle();

    // …and the confirmation went through the existing `pivot.bind` rung.
    expect(service.surface.getElementById(component)!.pivotDocId).toBe(
      'pivot-payments'
    );
  });

  test('Escape puts the panel away', async () => {
    addMap();
    const component = addComponent();
    await select(component);

    manager().open(component);
    await settle();
    expect(panel()).not.toBeNull();

    service.std.host.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    await settle();

    expect(panel()).toBeNull();
  });

  test('the flag takes the reading away, and leaves the map drawn', async () => {
    unmount?.();
    unmount = null;
    await mount({ wardley: false } as BlockFlags);

    addMap();
    const component = addComponent();
    await select(component);

    // No profile is registered, so there is no entry and nothing to open —
    // while the map and the component are still on the board, still selectable
    // (ADR 0009).
    expect(readButton()).toBeNull();
    expect(manager().profiles).toHaveLength(0);
    expect(service.surface.getElementById(component)).not.toBeNull();
  });
});
