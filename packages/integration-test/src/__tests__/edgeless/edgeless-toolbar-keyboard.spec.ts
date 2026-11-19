import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import type { MindmapElementModel } from '@labre/affine/model';
import {
  EDGELESS_TOOLBAR_WIDGET,
  EdgelessCommandMenu,
  type EdgelessToolbarWidget,
} from '@labre/affine/widgets/edgeless-toolbar';
import { userEvent } from '@vitest/browser/context';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  onTestFinished,
  test,
} from 'vitest';

import { wait } from '../utils/common.js';
import { deepQueryAll } from '../utils/deep-query.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * #679 (design audit P1-7): the canvas toolbar could not be used without a
 * mouse — no button took focus, Tab never reached the row (the canvas's Tab
 * binding swallowed it), and the only keyboard path was the Alt+←/→ highlight,
 * which assistive technology never saw. ADR 0054: the toolbar is one
 * `role="toolbar"`, one Tab stop with a roving `tabindex`, ←/→ walk it across
 * the senior pager, Enter / Space press, Escape goes back to the canvas.
 *
 * Real keys from Playwright's keyboard (`userEvent.keyboard`), because focus
 * moves and Tab order are what is under test, and a synthetic keydown moves
 * no focus. The Alt+←/→ highlight, which stays, is held by
 * `canvas-arrows-move-first.spec.ts`; the names by
 * `edgeless-toolbar-a11y.spec.ts`.
 */

/** Where the focus really is, through every shadow root. */
function deepActive(): Element | null {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }
  return active;
}

const SENIOR_MOUNT_MS = 50;

describe('edgeless toolbar keyboard model', () => {
  let edgeless!: EdgelessRootBlockComponent;

  const toolbar = () =>
    edgeless.widgetComponents[
      EDGELESS_TOOLBAR_WIDGET
    ] as unknown as EdgelessToolbarWidget;

  const container = () =>
    toolbar().shadowRoot!.querySelector<HTMLElement>(
      '.edgeless-toolbar-container'
    )!;

  /** The focused element, when it is a button of the toolbar's row. */
  const focusedButton = () => {
    const active = deepActive();
    if (!active || active.getAttribute('role') !== 'button') return null;
    return container().contains(hostIn(active))
      ? (active as HTMLElement)
      : null;
  };

  /** The element of the toolbar's own shadow tree that holds `node`. */
  function hostIn(node: Element): Element {
    let current: Node = node;
    while (current.getRootNode() !== toolbar().shadowRoot) {
      const root = current.getRootNode() as ShadowRoot;
      if (!root.host) return node;
      current = root.host;
    }
    return current as Element;
  }

  const canvasHasFocus = () => deepActive() === window.editor.host;

  /** Tab from the canvas until the toolbar has the focus. */
  const tabIntoToolbar = async () => {
    window.editor.host!.focus();
    const visited: string[] = [];
    for (let step = 0; step < 8 && !focusedButton(); step++) {
      await userEvent.keyboard('{Tab}');
      visited.push(deepActive()?.tagName ?? 'none');
    }
    expect(
      focusedButton(),
      `Tab reaches the toolbar (visited ${visited.join(', ')})`
    ).not.toBeNull();
  };

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    edgeless.std.event.active = true;
    await wait(SENIOR_MOUNT_MS);
    return cleanup;
  });

  afterEach(() => {
    toolbar().activePopper?.dispose();
    toolbar().activePopper = null;
  });

  test('the row is one named toolbar', () => {
    expect(container().getAttribute('role')).toBe('toolbar');
    expect(container().getAttribute('aria-label')).toBe('Canvas tools');
  });

  test('Tab reaches the toolbar in one stop, on the active tool', async () => {
    await tabIntoToolbar();
    const stop = focusedButton()!;
    expect(stop.getAttribute('aria-pressed')).toBe('true');
    expect(stop.getAttribute('aria-label')).toBe('Select');
    expect(stop.matches(':focus-visible')).toBe(true);

    await userEvent.keyboard('{Tab}');
    expect(focusedButton(), 'the next Tab leaves the toolbar').toBeNull();
    // Back from the canvas, the same one stop. (Shift+Tab from where the
    // focus went would leave the suite's frame, so it is not used here.)
    await tabIntoToolbar();
    expect(focusedButton()).toBe(stop);
  });

  test('the arrows walk every button, across the pager, and wrap', async () => {
    const bar = toolbar();
    await tabIntoToolbar();
    const first = focusedButton()!;
    const names: string[] = [];
    let pagedTo = 0;
    for (let step = 0; step < 64; step++) {
      names.push(focusedButton()!.getAttribute('aria-label') ?? '');
      await userEvent.keyboard('{ArrowRight}');
      await wait(SENIOR_MOUNT_MS);
      pagedTo = Math.max(pagedTo, bar.scrollSeniorToolIndex);
      if (focusedButton() === first) break;
    }
    expect(focusedButton(), 'the walk wraps to the first button').toBe(first);
    // The senior row is paged at this width: the walk turned its pages.
    expect(pagedTo).toBeGreaterThan(0);
    expect(names).toContain('Wardley map');
    expect(names).toContain('UML');
    expect(names).toContain('Eraser');
    expect(names.every(name => name !== '')).toBe(true);
    expect(new Set(names).size, names.join(' | ')).toBe(names.length);

    // And back: ← from the first lands on the last, End goes there too.
    await userEvent.keyboard('{ArrowLeft}');
    await wait(SENIOR_MOUNT_MS);
    const last = focusedButton()!;
    expect(last.getAttribute('aria-label')).toBe(names.at(-1));
    await userEvent.keyboard('{Home}');
    await wait(SENIOR_MOUNT_MS);
    expect(focusedButton()).toBe(first);
    await userEvent.keyboard('{End}');
    await wait(SENIOR_MOUNT_MS);
    expect(focusedButton()!.getAttribute('aria-label')).toBe(names.at(-1));
  });

  test('the walk follows what the flags draw: { wardley: false }', async () => {
    // A second editor over the first, with the Wardley tooling off (ADR 0009).
    const cleanup = await setupEditor('edgeless', [], {
      flags: { wardley: false },
    });
    onTestFinished(cleanup);
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    edgeless.std.event.active = true;
    await wait(SENIOR_MOUNT_MS);

    await tabIntoToolbar();
    const first = focusedButton()!;
    const names: string[] = [];
    for (let step = 0; step < 64; step++) {
      names.push(focusedButton()!.getAttribute('aria-label') ?? '');
      await userEvent.keyboard('{ArrowRight}');
      await wait(SENIOR_MOUNT_MS);
      if (focusedButton() === first) break;
    }
    expect(focusedButton()).toBe(first);
    expect(names).not.toContain('Wardley map');
    expect(names).toContain('EDGY');
  });

  test('one Tab stop at a time: the focused button holds tabindex 0', async () => {
    await tabIntoToolbar();
    await userEvent.keyboard('{ArrowRight}');
    const here = focusedButton()!;
    // Every button of the toolbar, through every shadow root, the pager
    // arrows and "More Tools" included: one Tab stop, the focused one.
    const stops = deepQueryAll(container(), '[role="button"]').filter(
      button => button.tabIndex >= 0
    );
    expect(stops).toEqual([here]);
  });

  test('Enter picks a tool, and the canvas gets the keyboard back', async () => {
    await tabIntoToolbar();
    for (
      let step = 0;
      step < 64 && focusedButton()?.getAttribute('aria-label') !== 'Eraser';
      step++
    ) {
      await userEvent.keyboard('{ArrowRight}');
      await wait(SENIOR_MOUNT_MS);
    }
    expect(focusedButton()?.getAttribute('aria-label')).toBe('Eraser');

    await userEvent.keyboard('{Enter}');
    await wait(SENIOR_MOUNT_MS);
    expect(edgeless.gfx.tool.currentToolName$.peek()).toBe('eraser');
    expect(canvasHasFocus()).toBe(true);

    // The canvas dispatcher has its keys again: V is the select tool.
    await userEvent.keyboard('v');
    expect(edgeless.gfx.tool.currentToolName$.peek()).toBe('default');
  });

  test('Escape gives the canvas back and leaves the tool alone', async () => {
    await tabIntoToolbar();
    await userEvent.keyboard('{ArrowRight}');
    const tool = edgeless.gfx.tool.currentToolName$.peek();
    await userEvent.keyboard('{Escape}');
    expect(canvasHasFocus()).toBe(true);
    expect(edgeless.gfx.tool.currentToolName$.peek()).toBe(tool);
  });

  test('a framework sub-menu opens with Enter and closes with Escape', async () => {
    const bar = toolbar();
    await tabIntoToolbar();
    for (
      let step = 0;
      step < 64 &&
      focusedButton()?.getAttribute('aria-label') !== 'Wardley map';
      step++
    ) {
      await userEvent.keyboard('{ArrowRight}');
      await wait(SENIOR_MOUNT_MS);
    }
    const wardley = focusedButton()!;
    expect(wardley.getAttribute('aria-label')).toBe('Wardley map');

    await userEvent.keyboard('{Enter}');
    await wait(SENIOR_MOUNT_MS);
    expect(bar.activePopper?.element).toBeInstanceOf(EdgelessCommandMenu);
    expect(wardley.getAttribute('aria-pressed')).toBe('true');
    expect(focusedButton(), 'focus stays on the button').toBe(wardley);

    await userEvent.keyboard('{Escape}');
    expect(bar.activePopper).toBeNull();
    expect(focusedButton(), 'and comes back to it').toBe(wardley);

    await userEvent.keyboard('{Escape}');
    expect(canvasHasFocus()).toBe(true);
  });

  test('a button clicked with the pointer leaves every key to the canvas', async () => {
    const bar = toolbar();
    const eraser = () =>
      bar
        .shadowRoot!.querySelector('edgeless-eraser-tool-button')
        ?.shadowRoot?.querySelector<HTMLElement>('edgeless-toolbar-button');
    for (let scroll = 0; scroll < 32 && !eraser(); scroll++) {
      bar.scrollSeniorToolIndex = scroll;
      await bar.updateComplete;
      await wait(SENIOR_MOUNT_MS);
    }
    await userEvent.click(eraser()!);
    expect(edgeless.gfx.tool.currentToolName$.peek()).toBe('eraser');
    // Whatever the click left focused, it is not the keyboard's: no ring.
    expect(focusedButton()?.matches(':focus-visible') ?? false).toBe(false);

    // So Escape is the canvas's, which puts the select tool back (the
    // toolbar's own Escape would have kept the eraser).
    await userEvent.keyboard('{Escape}');
    expect(edgeless.gfx.tool.currentToolName$.peek()).toBe('default');
  });
});

/**
 * GUARD — the canvas's Tab binding, before ADR 0054 let Tab through. It acted
 * in two cases and swallowed Tab in every other; it must still act in those.
 */
describe('Tab on the canvas', () => {
  let edgeless!: EdgelessRootBlockComponent;

  const tab = () => {
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);
    return event;
  };

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    edgeless.std.event.active = true;
    return cleanup;
  });

  test('on a mind map node it adds a sibling, and keeps Tab', async () => {
    const gfx = edgeless.gfx;
    const id = gfx.surface!.addElement({
      type: 'mindmap',
      children: { text: 'root', children: [{ text: 'leaf' }] },
    });
    const mindmap = gfx.getElementById(id) as MindmapElementModel;
    const leaf = mindmap.tree.children[0]!.element;
    gfx.selection.set({ elements: [leaf.id], editing: false });
    const nodes = mindmap.nodeMap.size;
    expect(tab().defaultPrevented).toBe(true);
    await wait();
    expect(mindmap.nodeMap.size).toBe(nodes + 1);
  });

  test('while a text is edited it keeps Tab', () => {
    const gfx = edgeless.gfx;
    const id = edgeless.service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[0,0,100,100]',
    })!;
    gfx.selection.set({ elements: [id], editing: true });
    expect(tab().defaultPrevented).toBe(true);
  });

  test('anywhere else Tab is the browser’s', () => {
    expect(tab().defaultPrevented).toBe(false);
  });
});
