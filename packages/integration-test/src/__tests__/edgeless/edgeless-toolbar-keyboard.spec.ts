import { FrameTool, PresentTool } from '@labre/affine/blocks/frame';
import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { DefaultTool } from '@labre/affine/blocks/surface';
import type { MindmapElementModel } from '@labre/affine/model';
import {
  type AssetPickerRequest,
  AssetPickerExtension,
} from '@labre/affine/shared/services';
import {
  EDGELESS_TOOLBAR_WIDGET,
  EdgelessCommandMenu,
  type EdgelessToolbarWidget,
} from '@labre/affine/widgets/edgeless-toolbar';
import type { RichText } from '@labre/affine-rich-text';
import { SurfaceSelection } from '@labre/std';
import { Text } from '@labre/store';
import { userEvent } from '@vitest/browser/context';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  onTestFinished,
  test,
  vi,
} from 'vitest';

import { deepQueryAll } from '../utils/deep-query.js';
import { addNote, getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * #679 (design audit P1-7): the canvas toolbar could not be used without a
 * mouse. ADR 0054: one `role="toolbar"`, one Tab stop with a roving
 * `tabindex`, ←/→ walk it across the senior pager, Enter / Space press,
 * Escape closes what a button opened or goes back to the canvas.
 *
 * The rule under test everywhere (product owner, 2026-11-20): navigating the
 * toolbar never overrides the canvas's keyboard. Keyboard mode is a toolbar
 * button holding the focus, which only the keyboard gives it; there the row
 * takes its own keys alone (←/→, Home/End, Enter, Space, Escape, Tab) and
 * every other key reaches the canvas. Outside it — after a mouse click on a
 * tool, after Escape, after picking a tool — the toolbar takes nothing: the
 * tests press real keys and check the shape actually moved.
 *
 * Real keys and a real mouse from Playwright (`userEvent`): focus moves and
 * Tab order are what is under test, and a synthetic keydown moves no focus.
 * The Alt+←/→ highlight is held by `canvas-arrows-move-first.spec.ts`, the
 * names and states by `edgeless-toolbar-a11y.spec.ts`.
 */

/** Where the focus really is, through every shadow root. */
function deepActive(): Element | null {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }
  return active;
}

/** Whether `node` lies inside `root`, crossing shadow boundaries upwards. */
function within(node: Node | null, root: Node): boolean {
  let current: Node | null = node;
  while (current) {
    if (current === root) return true;
    current = current.parentNode ?? (current as ShadowRoot).host ?? null;
  }
  return false;
}

/** What takes the focus with Tab, through every shadow root. */
const FOCUSABLE =
  'button:not([disabled]), input, select, textarea, [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

/** Settles a press: the row and every tool re-rendered, frames drawn. */
const frames = async (count = 2) => {
  for (let i = 0; i < count; i++) {
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
};

describe('edgeless toolbar keyboard model', () => {
  let edgeless!: EdgelessRootBlockComponent;
  const picks: AssetPickerRequest[] = [];

  const toolbar = () =>
    edgeless.widgetComponents[
      EDGELESS_TOOLBAR_WIDGET
    ] as unknown as EdgelessToolbarWidget;

  const container = () =>
    toolbar().shadowRoot!.querySelector<HTMLElement>(
      '.edgeless-toolbar-container'
    )!;

  /** The row's buttons on show, in order (the tools', then "More Tools"). */
  const rowButtons = () =>
    Array.from(
      toolbar().shadowRoot!.querySelectorAll<HTMLElement>(
        '.quick-tool-item, .senior-tool-item'
      )
    )
      .flatMap(item => deepQueryAll(item, '[role="button"]'))
      // The row's own buttons, not those of a menu one of them opened.
      .filter(button => (button as { onToolbarRow?: boolean }).onToolbarRow);

  /** The focused element, when it is a button of the toolbar's row. */
  const focusedButton = () => {
    const active = deepActive();
    if (!active || active.getAttribute('role') !== 'button') return null;
    return within(active, container()) ? (active as HTMLElement) : null;
  };

  const canvasHasFocus = () => deepActive() === window.editor.host;

  const tool = () => edgeless.gfx.tool.currentToolName$.peek();

  /** Whether `condition` comes to hold within a second. */
  const holds = (condition: () => boolean) =>
    vi
      .waitFor(() => {
        if (!condition()) throw new Error('not yet');
      })
      .then(
        () => true,
        () => false
      );

  /**
   * The pointer tool swaps Select and Hand behind its own 100ms animation:
   * its icon fades out on the press and back in once the tool is swapped.
   */
  const pointerSettled = () =>
    until(
      () =>
        deepQueryAll(
          toolbar().shadowRoot!,
          'edgeless-default-tool-button'
        ).every(
          button =>
            (button as unknown as { currentIcon?: HTMLElement }).currentIcon
              ?.style.opacity !== '0'
        ),
      'the pointer tool has swapped'
    );

  /** Where the focus is, for a failure's message. */
  const where = () => {
    const chain: string[] = [];
    let active: Element | null = document.activeElement;
    while (active) {
      chain.push(active.getAttribute('aria-label') ?? active.localName);
      active = active.shadowRoot?.activeElement ?? null;
    }
    return chain.join(' > ');
  };

  /** Waits until `condition` holds, failing with `message` if it never does. */
  const until = (condition: () => boolean, message: string) =>
    vi.waitFor(() => {
      if (!condition()) throw new Error(message);
    });

  /**
   * The row has read itself: every tool's button is drawn, named and given
   * its place in the roving `tabindex` — only then can the keyboard reach it.
   */
  const rowReady = () =>
    until(() => {
      const drawn = toolbar().shadowRoot!.querySelectorAll(
        '.quick-tool-item, .senior-tool-item'
      ).length;
      const buttons = rowButtons();
      return (
        buttons.length >= drawn &&
        drawn > 0 &&
        buttons.every(
          button =>
            button.hasAttribute('aria-label') && button.hasAttribute('tabindex')
        )
      );
    }, 'the row is not ready');

  /** Tab from the canvas: ONE press must give the toolbar the focus. */
  const tabIntoToolbar = async () => {
    await rowReady();
    window.editor.host!.focus();
    await userEvent.keyboard('{Tab}');
    await until(() => focusedButton() !== null, 'Tab reaches the toolbar');
    return focusedButton()!;
  };

  const press = async (keys: string) => {
    await userEvent.keyboard(keys);
    await frames();
  };

  const addShape = () => {
    const id = edgeless.service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[0,0,100,100]',
    })!;
    return edgeless.service.crud.getElementById(id)!;
  };

  const select = (id: string) =>
    edgeless.service.selection.set({ elements: [id], editing: false });

  /** A focusable after the editor, so that leaving it forwards lands there. */
  const after = document.createElement('button');
  after.textContent = 'after the editor';

  const mount = async (options?: Parameters<typeof setupEditor>[2]) => {
    const cleanup = await setupEditor(
      'edgeless',
      [
        AssetPickerExtension({
          pick: async (request: AssetPickerRequest) => {
            picks.push(request);
            return null;
          },
        }),
      ],
      options
    );
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    edgeless.std.event.active = true;
    document.body.append(after);
    await rowReady();
    return () => {
      after.remove();
      cleanup();
    };
  };

  beforeEach(async () => {
    picks.length = 0;
    return mount();
  });

  afterEach(() => {
    toolbar().activePopper?.dispose();
    toolbar().activePopper = null;
  });

  describe('keyboard mode', () => {
    test('the row is one named toolbar', () => {
      expect(container().getAttribute('role')).toBe('toolbar');
      expect(container().getAttribute('aria-label')).toBe('Canvas tools');
    });

    test('one Tab from the canvas reaches the toolbar, on the active tool', async () => {
      const stop = await tabIntoToolbar();
      expect(stop.getAttribute('aria-pressed')).toBe('true');
      expect(stop.getAttribute('aria-label')).toBe('Select');
      expect(stop.matches(':focus-visible')).toBe(true);

      // One stop: the next Tab leaves the editor, to what follows it.
      await press('{Tab}');
      expect(deepActive()).toBe(after);
      // And the canvas's Tab comes back to the same stop.
      expect(await tabIntoToolbar()).toBe(stop);
    });

    test('Shift+Tab from the toolbar goes back to the canvas', async () => {
      await tabIntoToolbar();
      await press('{Shift>}{Tab}{/Shift}');
      expect(canvasHasFocus()).toBe(true);
    });

    test('the arrows walk every button, across the pager, and wrap', async () => {
      const bar = toolbar();
      const first = await tabIntoToolbar();
      const names: string[] = [];
      let pagedTo = 0;
      for (let step = 0; step < 64; step++) {
        const here = focusedButton()!;
        names.push(here.getAttribute('aria-label') ?? '');
        await userEvent.keyboard('{ArrowRight}');
        await until(
          () => focusedButton() !== null && focusedButton() !== here,
          `ArrowRight moves on from ${names.at(-1)}`
        );
        pagedTo = Math.max(pagedTo, bar.scrollSeniorToolIndex);
        if (focusedButton() === first) break;
      }
      expect(focusedButton(), 'the walk wraps to the first button').toBe(first);
      expect(pagedTo, 'the walk turned the pager').toBeGreaterThan(0);
      expect(names).toContain('Wardley map');
      expect(names).toContain('UML');
      expect(names).toContain('Eraser');
      expect(new Set(names).size, names.join(' | ')).toBe(names.length);

      await userEvent.keyboard('{ArrowLeft}');
      await until(
        () => focusedButton()?.getAttribute('aria-label') === names.at(-1),
        'ArrowLeft from the first lands on the last'
      );
      await userEvent.keyboard('{Home}');
      await until(() => focusedButton() === first, 'Home goes to the first');
      await userEvent.keyboard('{End}');
      await until(
        () => focusedButton()?.getAttribute('aria-label') === names.at(-1),
        'End goes to the last'
      );
    });

    test('one Tab stop at a time: the focused button holds tabindex 0', async () => {
      await tabIntoToolbar();
      const first = focusedButton();
      await userEvent.keyboard('{ArrowRight}');
      await until(() => focusedButton() !== first, 'ArrowRight moves');
      const here = focusedButton()!;
      const stops = deepQueryAll(container(), '[role="button"]').filter(
        button => button.tabIndex >= 0
      );
      expect(stops).toEqual([here]);
    });

    test('only the row keys stop at the toolbar; the canvas keeps the others', async () => {
      const shape = addShape();
      select(shape.id);
      const x = shape.elementBound.x;
      const stop = await tabIntoToolbar();

      // ←/→ belong to the row: the shape stays, the focus moves.
      await userEvent.keyboard('{ArrowRight}');
      await until(() => focusedButton() !== stop, 'ArrowRight moves');
      expect(shape.elementBound.x).toBe(x);

      // A letter is the canvas's (product owner, 2026-11-20): H is the hand.
      await press('h');
      expect(tool()).toBe('pan');
      // So is Delete: the selected shape goes.
      edgeless.gfx.tool.setTool(DefaultTool);
      select(shape.id);
      focusedButton()?.focus();
      await press('{Delete}');
      expect(edgeless.service.crud.getElementById(shape.id)).toBeNull();
    });

    test('Enter picks a tool and gives the canvas its keyboard back', async () => {
      await tabIntoToolbar();
      for (
        let step = 0;
        step < 64 && focusedButton()?.getAttribute('aria-label') !== 'Eraser';
        step++
      ) {
        const here = focusedButton();
        await userEvent.keyboard('{ArrowRight}');
        await until(() => focusedButton() !== here, 'ArrowRight moves');
      }
      await press('{Enter}');
      expect(tool()).toBe('eraser');
      expect(canvasHasFocus()).toBe(true);

      // The canvas has its keys again: V, then the arrows move the shape.
      await press('v');
      expect(tool()).toBe('default');
      const shape = addShape();
      select(shape.id);
      const x = shape.elementBound.x;
      await press('{ArrowRight}');
      expect(shape.elementBound.x).toBe(x + 1);
    });

    test('Escape gives the canvas back, the tool unchanged, the arrows the canvas', async () => {
      await tabIntoToolbar();
      const before = tool();
      await press('{Escape}');
      expect(canvasHasFocus()).toBe(true);
      expect(tool()).toBe(before);

      const shape = addShape();
      select(shape.id);
      const x = shape.elementBound.x;
      await press('{ArrowRight}');
      expect(shape.elementBound.x).toBe(x + 1);
      await userEvent.keyboard('{ >}');
      await until(() => tool() === 'pan', 'Space held pans');
      await userEvent.keyboard('{/ }');
    });

    test('the walk follows what the flags draw: { wardley: false }', async () => {
      // A second editor over the first, with the Wardley tooling off (ADR 0009).
      onTestFinished(await mount({ flags: { wardley: false } }));
      const first = await tabIntoToolbar();
      const names: string[] = [];
      for (let step = 0; step < 64; step++) {
        const here = focusedButton()!;
        names.push(here.getAttribute('aria-label') ?? '');
        await userEvent.keyboard('{ArrowRight}');
        await until(() => focusedButton() !== here, 'ArrowRight moves');
        if (focusedButton() === first) break;
      }
      expect(focusedButton()).toBe(first);
      expect(names).not.toContain('Wardley map');
      expect(names).toContain('EDGY');
    });
  });

  /**
   * B6 of the review of #679, now the rule of the product owner: outside
   * keyboard mode the toolbar takes no key at all. Before #679 no toolbar
   * button could take focus, so a click left every key to the canvas; it
   * still does, and the shape has to actually move.
   */
  describe('outside keyboard mode, the toolbar takes nothing', () => {
    const noRing = () =>
      expect(
        deepQueryAll(container(), '[role="button"]').filter(button =>
          button.matches(':focus-visible')
        )
      ).toEqual([]);

    test('after a real click on a tool, then a letter, the canvas has every key', async () => {
      const frame = rowButtons().find(
        button => button.getAttribute('aria-label') === 'Frame'
      )!;
      await userEvent.click(frame);
      expect(tool()).toBe('frame');
      expect(focusedButton(), 'a click puts no focus on the row').toBeNull();
      noRing();
      toolbar().activePopper?.dispose();
      toolbar().activePopper = null;

      // A non-Escape key first: it is the canvas's (V is the select tool).
      await press('v');
      expect(tool()).toBe('default');
      expect(focusedButton()).toBeNull();

      const shape = addShape();
      select(shape.id);
      const x = shape.elementBound.x;
      await press('{ArrowRight}');
      expect(shape.elementBound.x).toBe(x + 1);
      await press('{ArrowLeft}');
      expect(shape.elementBound.x).toBe(x);

      await userEvent.keyboard('{ >}');
      await until(() => tool() === 'pan', 'Space held pans');
      await userEvent.keyboard('{/ }');
      await until(() => tool() === 'default', 'Space released');

      // Enter does what it does on the canvas: on a mind map node, it adds
      // one (on a plain shape it does nothing, on the base as here).
      const gfx = edgeless.gfx;
      const mindmapId = gfx.surface!.addElement({
        type: 'mindmap',
        children: { text: 'root', children: [{ text: 'leaf' }] },
      });
      const mindmap = gfx.getElementById(mindmapId) as MindmapElementModel;
      gfx.selection.set({
        elements: [mindmap.tree.children[0]!.element.id],
        editing: false,
      });
      const nodes = mindmap.nodeMap.size;
      await press('{Enter}');
      await until(
        () => mindmap.nodeMap.size === nodes + 1,
        'Enter adds a mind map node'
      );
      noRing();
    });

    test('a click after the keyboard was in the row gives every key back to the canvas', async () => {
      await tabIntoToolbar();
      // Undo: a press that changes neither the tool nor the selection, so
      // nothing else moves the focus off the row.
      const undo = rowButtons().find(
        button => button.getAttribute('aria-label') === 'Undo'
      )!;
      await userEvent.click(undo);
      expect(focusedButton(), 'the click ends keyboard mode').toBeNull();
      noRing();

      const shape = addShape();
      select(shape.id);
      const x = shape.elementBound.x;
      await press('{ArrowRight}');
      expect(shape.elementBound.x).toBe(x + 1);
    });

    /**
     * Second review of #679: a click that changes neither the tool nor the
     * selection (the layers pane, Add file, Undo with nothing to undo) leaves
     * nothing else to move the focus off the button — no `RangeBinding`
     * answer, no tool change. Only the row's own `mousedown`
     * (`_onContainerMouseDown`) gives the canvas the keys back; without it,
     * the arrows, Enter and Space were the toolbar's. Every button whose
     * click is of that kind, read from what the row draws.
     */
    test(
      'after a click that moves neither the tool nor the selection, the canvas has every key',
      { timeout: 120_000 },
      async () => {
        const buttons = await everyButton();
        const quiet: string[] = [];
        const failures: string[] = [];
        for (const [name, scroll] of buttons) {
          await reset();
          const shape = addShape();
          select(shape.id);
          // Nothing to undo: Undo is then a click of that kind too.
          edgeless.store.resetHistory();
          const before = tool();
          await userEvent.click(await buttonNamed(name, scroll));
          await pointerSettled();
          await frames(3);
          const selected = edgeless.gfx.selection.selectedIds;
          const quietClick =
            tool() === before &&
            selected.length === 1 &&
            selected[0] === shape.id;
          if (!quietClick) continue;
          quiet.push(name);
          const x = shape.elementBound.x;
          await press('{ArrowRight}');
          if (shape.elementBound.x !== x + 1) {
            failures.push(`${name}: → did not move the shape (${where()})`);
          }
          await press('{ArrowLeft}');
          if (shape.elementBound.x !== x) {
            failures.push(`${name}: ← did not move the shape (${where()})`);
          }
          await userEvent.keyboard('{ >}');
          if (!(await holds(() => tool() === 'pan'))) {
            failures.push(`${name}: Space did not pan (${where()})`);
          }
          await userEvent.keyboard('{/ }');
          await until(() => tool() === before, 'Space released');
        }
        await reset();
        expect(quiet).toContain('Selection pane');
        expect(quiet).toContain('Undo');
        expect(quiet).toContain('Add file');
        expect(failures).toEqual([]);
      }
    );

    /**
     * Second review of #679: the row swallows the release of the key that
     * pressed a button. A release lost to a native dialog the press opened (a
     * file picker) left that wait standing, and the next Space released on the
     * canvas was swallowed instead, its pan stuck.
     */
    test('a press whose key release is lost does not swallow the next Space release', async () => {
      const undo = rowButtons().find(
        button => button.getAttribute('aria-label') === 'Undo'
      )!;
      undo.focus();
      // The keydown alone: its keyup never comes.
      undo.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: ' ',
          code: 'Space',
          bubbles: true,
          composed: true,
          cancelable: true,
        })
      );
      await userEvent.click(window.editor.host!, {
        position: { x: 200, y: 200 },
      });
      expect(focusedButton()).toBeNull();
      await userEvent.keyboard('{ >}');
      await until(() => tool() === 'pan', 'Space held pans');
      await userEvent.keyboard('{/ }');
      await until(() => tool() === 'default', 'Space released ends the pan');
    });

    test('after a real click on a pager arrow, the arrows move the shape', async () => {
      const arrow = toolbar().shadowRoot!.querySelector<HTMLElement>(
        '.senior-nav-button-wrapper.next icon-button'
      )!;
      await userEvent.click(arrow);
      expect(toolbar().scrollSeniorToolIndex).toBeGreaterThan(0);
      const shape = addShape();
      select(shape.id);
      const x = shape.elementBound.x;
      await press('{ArrowRight}');
      expect(shape.elementBound.x).toBe(x + 1);
      expect(focusedButton()).toBeNull();
      noRing();
    });
  });

  /**
   * Review of #679, B1: the editor host is the editor's first stop and the
   * notes, `contenteditable`, come before the toolbar in the DOM, so the
   * browser's Tab from the canvas went into the first note's text. The canvas
   * moves the focus to the toolbar itself.
   */
  describe('Tab on a canvas that holds notes', () => {
    let noteId!: string;

    beforeEach(() => {
      noteId = addNote(window.doc);
      const doc = window.doc;
      doc.addBlock(
        'affine:list',
        { type: 'bulleted', text: new Text('first') },
        noteId
      );
      doc.addBlock(
        'affine:list',
        { type: 'bulleted', text: new Text('second') },
        noteId
      );
      doc.addBlock('affine:code', { text: new Text('const a = 1;') }, noteId);
      doc.addBlock('affine:database', {}, noteId);
    });

    const noteElement = () =>
      window.editor.host!.querySelector(`[data-block-id="${noteId}"]`)!;

    const caretInNote = () => {
      const selection = document.getSelection();
      return (
        !!selection?.anchorNode && within(selection.anchorNode, noteElement())
      );
    };

    test('one Tab reaches the toolbar and puts no caret in a note', async () => {
      await until(() => !!noteElement(), 'the note is drawn');
      await tabIntoToolbar();
      expect(within(deepActive(), noteElement())).toBe(false);
      expect(caretInNote()).toBe(false);
    });

    test('Shift+Tab from the toolbar is the canvas, not the last note', async () => {
      await tabIntoToolbar();
      await press('{Shift>}{Tab}{/Shift}');
      expect(canvasHasFocus()).toBe(true);
      expect(caretInNote()).toBe(false);
    });

    test('Shift+Tab from the canvas leaves the editor backwards', async () => {
      window.editor.host!.focus();
      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      window.editor.host!.dispatchEvent(event);
      expect(event.defaultPrevented, 'the browser moves the focus').toBe(false);
      await press('{Shift>}{Tab}{/Shift}');
      expect(within(deepActive(), window.editor.host!)).toBe(false);
      expect(caretInNote()).toBe(false);
    });

    /**
     * B10: Tab inside a block being edited on the canvas is the block's, as
     * before #679 — the list item indents, the toolbar never takes it.
     */
    test('Tab in a list item being edited indents it; the toolbar keeps out', async () => {
      const second = window.doc
        .getModelsByFlavour('affine:list')
        .find(model => model.text?.toString() === 'second')!;
      const richText = await vi.waitFor(() => {
        const found = window.editor.host!.querySelector<RichText>(
          `[data-block-id="${second.id}"] rich-text`
        );
        if (!found) throw new Error('the list item is not drawn');
        return found;
      });
      // The note in edit mode, the caret at the end of the item — what a
      // double click does, without the note's mask in the way.
      const surfaceId = window.doc.getModelsByFlavour('affine:surface')[0]!.id;
      edgeless.std.selection.setGroup('gfx', [
        new SurfaceSelection(surfaceId, [noteId], true),
      ]);
      await until(
        () => edgeless.service.selection.editing,
        'the note is being edited'
      );
      (
        richText as unknown as { inlineEditor: { focusEnd(): void } }
      ).inlineEditor.focusEnd();
      await until(() => {
        const caret = document.getSelection()?.anchorNode ?? null;
        return within(caret, richText);
      }, 'the caret is in the item');
      await press('{Tab}');
      expect(focusedButton()).toBeNull();
      await until(
        () => second.parent?.flavour === 'affine:list',
        'the list item indents under the first'
      );
    });
  });

  /** Every row button, every pager page, as the walk meets them. */
  const everyButton = async () => {
    const bar = toolbar();
    const seen = new Map<string, number>();
    const last = Math.max(
      0,
      (bar as unknown as { _seniorTools: unknown[] })._seniorTools.length -
        bar.scrollSeniorToolSize
    );
    for (let scroll = 0; scroll <= last; scroll++) {
      bar.scrollSeniorToolIndex = scroll;
      await bar.updateComplete;
      await rowReady();
      rowButtons().forEach(button => {
        const name = button.getAttribute('aria-label')!;
        if (!seen.has(name)) seen.set(name, scroll);
      });
    }
    return seen;
  };

  /** The row's button named `name`, its page turned to. */
  const buttonNamed = async (name: string, scroll: number) => {
    const bar = toolbar();
    bar.scrollSeniorToolIndex = scroll;
    await bar.updateComplete;
    await rowReady();
    return rowButtons().find(
      button => button.getAttribute('aria-label') === name
    )!;
  };

  /** Back to a quiet canvas: nothing open, the select tool, the canvas focused. */
  const reset = async () => {
    const bar = toolbar();
    // A menu leaves through a 230ms transition, during which a press of its
    // button toggles it shut again: wait until it is gone.
    const menu = bar.activePopper?.element;
    bar.activePopper?.dispose();
    bar.activePopper = null;
    if (menu) await until(() => !menu.isConnected, 'the menu has left');
    // The templates panel is no popper: a click outside it closes it, and
    // left open, the next press of its button would toggle it shut.
    const [panel] = deepQueryAll(
      toolbar().shadowRoot!,
      'edgeless-templates-panel'
    );
    if (panel) {
      document.body.click();
      await until(() => !panel.isConnected, 'the templates panel has left');
    }
    const pane = rowButtons().find(
      button => button.getAttribute('aria-label') === 'Selection pane'
    );
    if (pane?.getAttribute('aria-pressed') === 'true') {
      await userEvent.click(pane);
      await until(
        () => pane.getAttribute('aria-pressed') === 'false',
        'the pane is closed'
      );
    }
    edgeless.service.selection.clear();
    edgeless.gfx.tool.setTool(DefaultTool);
    // One step to undo: the shape added next, whatever came before.
    edgeless.store.resetHistory();
    window.editor.host!.focus();
    await frames(3);
  };

  /**
   * What a press did, read the same way after a click and after a key: the
   * tool, what opened, every button's state, a text being edited, the assets
   * asked for, and how many things the canvas gained or lost.
   */
  const outcome = async (pressIt: () => Promise<void>) => {
    const count = () => edgeless.store.getAllModels().length;
    const elements = () => edgeless.gfx.surface!.elementModels.length;
    const before = {
      models: count(),
      elements: elements(),
      picks: picks.length,
    };
    await pressIt();
    await pointerSettled();
    await frames(3);
    return JSON.stringify({
      tool: tool(),
      opened: toolbar().activePopper?.element.localName ?? null,
      pressed: rowButtons().map(
        button =>
          `${button.getAttribute('aria-label')}=${button.getAttribute('aria-pressed')}`
      ),
      editing: edgeless.service.selection.editing,
      models: count() - before.models,
      elements: elements() - before.elements,
      picks: picks.length - before.picks,
    });
  };

  /**
   * B2 of the review of #679: Enter on Shape and on Mind Map did nothing — a
   * click on their draggable is a `mousedown`, then a `mouseup` on the window,
   * which a lone synthetic `click` never sends. Every button, every page: a
   * real click, Enter and Space must do the same thing, once.
   */
  test(
    'Enter and Space do what a click does, on every button, once',
    { timeout: 180_000 },
    async () => {
      const buttons = await everyButton();
      expect(buttons.size).toBeGreaterThan(15);
      const mismatches: string[] = [];
      for (const [name, scroll] of buttons) {
        // Something to undo, so that Undo has an effect to compare.
        await reset();
        addShape();
        const byClick = await outcome(async () => {
          await userEvent.click(await buttonNamed(name, scroll));
        });
        for (const key of ['{Enter}', '{ }']) {
          await reset();
          addShape();
          const byKey = await outcome(async () => {
            (await buttonNamed(name, scroll)).focus();
            await userEvent.keyboard(key);
          });
          if (byKey !== byClick) {
            mismatches.push(
              `${name} ${key}\n click ${byClick}\n key   ${byKey}`
            );
          }
        }
        // A held key presses once: its repeats do nothing more.
        await reset();
        addShape();
        const held = await outcome(async () => {
          const button = await buttonNamed(name, scroll);
          button.focus();
          await userEvent.keyboard('{Enter}');
          button.dispatchEvent(
            new KeyboardEvent('keydown', {
              key: 'Enter',
              repeat: true,
              bubbles: true,
              composed: true,
              cancelable: true,
            })
          );
        });
        if (held !== byClick) {
          mismatches.push(`${name} held\n click ${byClick}\n held  ${held}`);
        }
      }
      await reset();
      expect(mismatches).toEqual([]);
    }
  );

  /**
   * B4 of the review of #679: only the Wardley sub-menu kept the focus on its
   * button. Every button whose press opens something in the toolbar (a menu,
   * a tool's options, the templates panel), from the keyboard: the focus
   * stays on the button, Tab reaches the controls that take focus, Escape
   * closes it and gives the button the focus back.
   */
  test(
    'whatever a button opens, Escape closes it and gives the button the focus',
    { timeout: 120_000 },
    async () => {
      const buttons = await everyButton();
      const opening: string[] = [];
      const reachable: string[] = [];
      const failures: string[] = [];
      for (const [name, scroll] of buttons) {
        await reset();
        const button = await buttonNamed(name, scroll);
        const root = button.getRootNode() as ShadowRoot;
        const children = root.childElementCount;
        button.focus();
        await press('{Enter}');
        await frames(2);
        const popper = toolbar().activePopper?.element ?? null;
        const grown = root.childElementCount > children;
        if (!popper && !grown) continue;
        opening.push(name);
        if (!(await holds(() => focusedButton() === button))) {
          failures.push(
            `${name}: the focus left the button when it opened (${where()})`
          );
        }
        const opened = popper ?? root.lastElementChild!;
        const controlsOf = () =>
          [opened, opened.shadowRoot]
            .flatMap(root => (root ? deepQueryAll(root, FOCUSABLE) : []))
            .filter(control => control.getClientRects().length > 0);
        // A panel may draw its content a few frames after it opens.
        await holds(() => controlsOf().length > 0);
        const controls = controlsOf();
        if (controls.length > 0) {
          await press('{Tab}');
          if (!within(deepActive(), opened)) {
            failures.push(`${name}: Tab does not reach its controls`);
          } else {
            const kinds = new Set(
              controls.map(
                control =>
                  `${control.localName}${control.getAttribute('type') ? `[${control.getAttribute('type')}]` : ''}`
              )
            );
            reachable.push(`${name} (${[...kinds].join(' ')})`);
          }
        }
        await press('{Escape}');
        const closed = await holds(() =>
          popper
            ? toolbar().activePopper === null
            : root.childElementCount === children
        );
        if (!closed) failures.push(`${name}: Escape does not close it`);
        if (!(await holds(() => focusedButton() === button))) {
          failures.push(
            `${name}: Escape does not give the button the focus (${where()})`
          );
        }
      }
      await reset();
      // What the report lists: which buttons open something, which have
      // controls the browser can focus.
      console.info(
        `[679] open something: ${opening.join(', ')}; Tab reaches controls in: ${reachable.join(', ') || 'none'}`
      );
      expect(opening.length).toBeGreaterThan(0);
      expect(failures).toEqual([]);
    }
  );

  /** B3 of the review of #679: in none of these does the focus end on the body. */
  describe('the focus never ends on the page body', () => {
    const onBody = () => {
      const active = document.activeElement;
      return !active || active === document.body;
    };

    const focusButton = async (name: string) => {
      const buttons = await everyButton();
      const button = await buttonNamed(name, buttons.get(name)!);
      button.focus();
      await frames();
      return button;
    };

    test('Tab from a framework button with its menu open', async () => {
      await focusButton('Wardley map');
      await press('{Enter}');
      expect(toolbar().activePopper?.element).toBeInstanceOf(
        EdgelessCommandMenu
      );
      await press('{Tab}');
      expect(onBody()).toBe(false);
      expect(deepActive()).toBe(after);
    });

    test('a resize that re-deals the row under the focused tool', async () => {
      const column = window.editor.parentElement as HTMLElement;
      onTestFinished(() => {
        column.style.width = '';
      });
      column.style.width = '560px';
      window.dispatchEvent(new Event('resize'));
      await until(
        () => toolbar().scrollSeniorToolSize < 4,
        'the row is narrow'
      );
      await tabIntoToolbar();
      await userEvent.keyboard('{End}');
      await until(
        () => toolbar().scrollSeniorToolIndex > 0,
        'End pages to the last tool'
      );
      column.style.width = '';
      window.dispatchEvent(new Event('resize'));
      await until(() => !onBody() && focusedButton() !== null, 'focus kept');
    });

    test('Escape in "More Tools" gives the focus back to it', async () => {
      const column = window.editor.parentElement as HTMLElement;
      onTestFinished(() => {
        column.style.width = '';
      });
      column.style.width = '380px';
      window.dispatchEvent(new Event('resize'));
      // Read again each time: the resize re-renders the row.
      const moreButton = () =>
        toolbar().shadowRoot!.querySelector<HTMLElement>(
          '.quick-tool-more-button'
        );
      await until(
        () => moreButton()?.hasAttribute('disabled') === false,
        '"More Tools" holds tools'
      );
      await rowReady();
      await until(() => {
        moreButton()!.focus();
        return deepActive() === moreButton();
      }, '"More Tools" takes the focus');
      const more = moreButton()!;
      // The row's resize handler is throttled (300ms, trailing): its trailing
      // run can close, or close and reopen, a menu opened meanwhile, and the
      // focus then stays on the button. Press again until the menu holds it.
      await vi.waitFor(
        async () => {
          if (!within(deepActive(), more)) return;
          await press('{Enter}');
          throw new Error('the menu takes focus');
        },
        { timeout: 3000, interval: 400 }
      );
      await press('{Escape}');
      await until(() => !onBody(), 'focus not on the body');
      expect(deepActive()).toBe(more);
    });

    test('Escape after tabbing into the selection pane', async () => {
      const pane = await focusButton('Selection pane');
      await press('{Enter}');
      expect(pane.getAttribute('aria-pressed')).toBe('true');
      await press('{Tab}');
      await press('{Escape}');
      await until(() => !onBody(), 'focus not on the body');
    });

    test('Escape after creating a text with Enter', async () => {
      await focusButton('Text');
      await press('{Enter}');
      await until(
        () => edgeless.service.selection.editing,
        'the text is being edited'
      );
      await press('{Escape}');
      await until(() => !onBody(), 'focus not on the body');
    });
  });

  /** B10: where the toolbar has no row, the canvas keeps Tab, as before. */
  describe('no row to go to', () => {
    test('presentation mode: Tab stays on the canvas', async () => {
      edgeless.gfx.tool.setTool(PresentTool);
      await until(() => toolbar().isPresentMode, 'presenting');
      window.editor.host!.focus();
      await press('{Tab}');
      expect(canvasHasFocus()).toBe(true);
    });

    test('a readonly board: Tab stays on the canvas', async () => {
      edgeless.store.readonly = true;
      onTestFinished(() => {
        edgeless.store.readonly = false;
      });
      await toolbar().updateComplete;
      window.editor.host!.focus();
      await press('{Tab}');
      expect(canvasHasFocus()).toBe(true);
    });
  });

  test('a frame tool picked with Enter keeps its options open on the button', async () => {
    edgeless.gfx.tool.setTool(FrameTool);
    edgeless.gfx.tool.setTool(DefaultTool);
    const frame = rowButtons().find(
      button => button.getAttribute('aria-label') === 'Frame'
    )!;
    frame.focus();
    await press('{Enter}');
    expect(tool()).toBe('frame');
    expect(toolbar().activePopper).not.toBeNull();
    expect(focusedButton()).toBe(frame);
    await press('{Escape}');
    expect(toolbar().activePopper).toBeNull();
    expect(focusedButton()).toBe(frame);
  });
});

/**
 * GUARD — the canvas's Tab binding before #679 acted in two cases and
 * swallowed Tab in every other. It must still act in those; on the canvas
 * itself it now moves the focus to the toolbar.
 */
describe('Tab on the canvas', () => {
  let edgeless!: EdgelessRootBlockComponent;

  const tab = () => {
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    });
    window.editor.host!.dispatchEvent(event);
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
    await vi.waitFor(() => expect(mindmap.nodeMap.size).toBe(nodes + 1));
  });

  test('while a text is edited it keeps Tab', () => {
    const id = edgeless.service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[0,0,100,100]',
    })!;
    edgeless.gfx.selection.set({ elements: [id], editing: true });
    expect(tab().defaultPrevented).toBe(true);
  });
});
