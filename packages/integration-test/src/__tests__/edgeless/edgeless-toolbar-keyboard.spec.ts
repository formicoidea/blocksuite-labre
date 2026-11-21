import { FrameTool, PresentTool } from '@labre/affine/blocks/frame';
import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { DefaultTool } from '@labre/affine/blocks/surface';
import type { MindmapElementModel } from '@labre/affine/model';
import {
  type AssetPickerRequest,
  AssetPickerExtension,
  EditPropsStore,
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
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  onTestFinished,
  test,
  vi,
} from 'vitest';

import { deepQueryAll } from '../utils/deep-query.js';
import { addNote, getDocRootBlock } from '../utils/edgeless.js';
import {
  type Box,
  centre,
  describeBox,
  focusRing,
  inside,
  ringClippedBy,
  selectionRing,
} from '../utils/focus-ring.js';
import { pointerMoveTo } from '../utils/pointer.js';
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

/** Settles a press: the row and every tool re-rendered, frames drawn. */
const frames = async (count = 2) => {
  for (let i = 0; i < count; i++) {
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
};

/** A storage's keys and values, to put back as they were. */
const storageCopy = (storage: Storage) =>
  Object.fromEntries(
    Object.keys(storage).map(key => [key, storage.getItem(key)!])
  );
const storageRestore = (storage: Storage, copy: Record<string, string>) => {
  storage.clear();
  Object.entries(copy).forEach(([key, value]) => storage.setItem(key, value));
};

/**
 * The suite shares one page (`isolate: false`): what this file's presses write
 * to the browser's storage (the commands' usage ranking, the templates panel's
 * category, the presentation's toast flag) and where its real mouse rests
 * would reach every spec after it (#691). Both go back to how the file found
 * them: the storage as it was, the mouse at the frame's corner, where
 * Playwright starts it.
 */
let storageBefore: [Record<string, string>, Record<string, string>];
beforeAll(() => {
  storageBefore = [storageCopy(localStorage), storageCopy(sessionStorage)];
});
afterAll(async () => {
  storageRestore(localStorage, storageBefore[0]);
  storageRestore(sessionStorage, storageBefore[1]);
  await pointerMoveTo('html', 0, 0, 1);
});

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

  /**
   * The keyboard's walk of the row: Tab from the canvas, then → across every
   * button and every page of the senior row until it wraps to the first.
   * `visit` sees each button as the keyboard stands on it.
   */
  const walkRow = async (visit: (button: HTMLElement) => void) => {
    const first = await tabIntoToolbar();
    for (let step = 0; step < 64; step++) {
      const here = focusedButton()!;
      visit(here);
      await userEvent.keyboard('{ArrowRight}');
      await until(
        () => focusedButton() !== null && focusedButton() !== here,
        `ArrowRight moves on from ${here.getAttribute('aria-label')}`
      );
      if (focusedButton() === first) break;
    }
    return first;
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

  /** The editors mounted and not yet torn down, and the body before the first. */
  let mounted = 0;
  let bodyBefore = new Set<Element>();

  const mount = async (options?: Parameters<typeof setupEditor>[2]) => {
    if (mounted++ === 0) bodyBefore = new Set(document.body.children);
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
      // The suite shares one page (`isolate: false`). The mind map menu's
      // import falls back to a hidden file input on the body (`openFilesWith`,
      // `affine-shared/utils/file/filesys.ts`), removed only on `change`,
      // which no dialog ever sends here: left, later specs found it (#691).
      document.body
        .querySelectorAll(':scope > input.affine-upload-input')
        .forEach(input => input.remove());
      // Nothing a test appended to the body outlives its editors (a test
      // may mount a second one over the first: checked once both are gone).
      if (--mounted > 0) return;
      expect(
        [...document.body.children]
          .filter(child => !bodyBefore.has(child))
          .map(child => child.outerHTML.slice(0, 120))
      ).toEqual([]);
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
      const names: string[] = [];
      let pagedTo = 0;
      const first = await walkRow(here => {
        names.push(here.getAttribute('aria-label') ?? '');
        pagedTo = Math.max(pagedTo, bar.scrollSeniorToolIndex);
      });
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
  /** The last menu a press opened, which may still be on its way out. */
  let lastMenu: Element | null = null;

  const reset = async () => {
    const bar = toolbar();
    // A menu leaves through a 230ms transition, during which a press of its
    // button toggles it shut again: wait until it is gone — the open one,
    // and the last one seen, which a press may have closed already.
    const menu = bar.activePopper?.element;
    bar.activePopper?.dispose();
    bar.activePopper = null;
    if (menu) await until(() => !menu.isConnected, 'the menu has left');
    const seen = lastMenu;
    lastMenu = null;
    if (seen) await holds(() => !seen.isConnected);
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

  /** Every control a menu draws: what a keyboard must reach in it. */
  const MENU_CONTROL =
    'button, [role="button"], [role="radio"], [role="slider"]';
  const drawnControls = (opened: Element) =>
    [opened, opened.shadowRoot]
      .flatMap(root => (root ? deepQueryAll(root, MENU_CONTROL) : []))
      .filter(
        control =>
          control.getClientRects().length > 0 &&
          !control.hasAttribute('disabled') &&
          (control as { disabled?: boolean }).disabled !== true &&
          // A disabled slider leaves the tab order.
          !(
            control.getAttribute('role') === 'slider' &&
            control.getAttribute('tabindex') === '-1'
          )
      );

  const describeControl = (control: Element) =>
    control.getAttribute('aria-label') ??
    control.textContent?.trim() ??
    control.localName;

  /**
   * What stays out of the menu model, and why (ADR 0054): the templates
   * panel draws its cards as a scrolling grid behind a search field, which
   * needs a model of its own.
   */
  const OWN_MODEL = new Set(['Template']);

  /** Opens the menu of `button` with Enter; what it opened, if anything. */
  const openWithEnter = async (button: HTMLElement) => {
    const root = button.getRootNode() as ShadowRoot;
    const children = root.childElementCount;
    button.focus();
    await press('{Enter}');
    await frames(2);
    const popper = toolbar().activePopper?.element ?? null;
    lastMenu = popper;
    if (popper) return popper;
    return root.childElementCount > children ? root.lastElementChild : null;
  };

  /**
   * The keyboard's walk of an open menu, from the control it stands on: each
   * group both ways with the arrows, then Tab to the next, until Tab leaves
   * the menu. `visit` sees each control the first time the keyboard stands
   * on it; what was reached comes back.
   */
  const walkMenu = async (
    opened: Element,
    visit: (control: Element) => void = () => {}
  ) => {
    const drawn = drawnControls(opened);
    const reached = new Set<Element | null>();
    const stand = () => {
      const here = deepActive();
      if (reached.has(here)) return;
      reached.add(here);
      if (here && within(here, opened)) visit(here);
    };
    stand();
    // Walk each group both ways, then Tab to the next one.
    for (let group = 0; group <= drawn.length; group++) {
      for (const key of ['{ArrowRight}', '{ArrowLeft}']) {
        for (let step = 0; step < drawn.length; step++) {
          await press(key);
          stand();
        }
      }
      await press('{Tab}');
      if (!within(deepActive(), opened)) break;
      stand();
    }
    return reached;
  };

  /**
   * #679 acceptance (the product owner): in the frameworks' sub-menu the
   * focus never reached the tools, and in the shapes menu only the colours.
   * Every button that opens a menu, on every page, from the keyboard: the
   * focus goes onto its first control; the arrows (inside a group) and Tab
   * (between groups) reach every control it draws; Tab past the last group
   * closes it and gives the button the focus back, as Escape does. The same
   * menu opened with the mouse moves no focus.
   */
  test(
    'every menu a button opens: the keyboard enters it, reaches every control and leaves',
    { timeout: 240_000 },
    async () => {
      const buttons = await everyButton();
      const opening: string[] = [];
      const failures: string[] = [];
      for (const [name, scroll] of buttons) {
        await reset();
        const button = await buttonNamed(name, scroll);
        const opened = await openWithEnter(button);
        if (!opened) continue;
        opening.push(name);
        if (OWN_MODEL.has(name)) continue;
        if (!(await holds(() => within(deepActive(), opened)))) {
          failures.push(`${name}: the keyboard did not go in (${where()})`);
          continue;
        }
        const drawn = drawnControls(opened);
        const reached = await walkMenu(opened);
        const missing = drawn.filter(control => !reached.has(control));
        if (missing.length > 0) {
          failures.push(
            `${name}: not reached ${missing.map(describeControl).join(', ')} (reached ${[...reached].map(control => (control ? describeControl(control) : 'none')).join(', ')})`
          );
        }
        if (!(await holds(() => focusedButton() === button))) {
          failures.push(`${name}: Tab past the end left (${where()})`);
        }
        // Escape, from inside: closed, the button focused. A menu leaves
        // through a transition, during which a press toggles it shut again.
        await holds(() => !opened.isConnected);
        const again = await openWithEnter(button);
        if (!again || !(await holds(() => within(deepActive(), again)))) {
          failures.push(`${name}: did not open again (${where()})`);
          continue;
        }
        await press('{Escape}');
        if (
          !(await holds(
            () => !again.isConnected || !within(deepActive(), again)
          ))
        ) {
          failures.push(`${name}: Escape does not close it`);
        }
        if (!(await holds(() => focusedButton() === button))) {
          failures.push(
            `${name}: Escape does not give the focus back (${where()})`
          );
        }
        // The mouse: the menu opens, the focus stays where it was.
        await reset();
        await userEvent.click(await buttonNamed(name, scroll));
        await frames(3);
        const byMouse = toolbar().activePopper?.element;
        if (byMouse && within(deepActive(), byMouse)) {
          failures.push(`${name}: a click moved the focus into the menu`);
        }
        if (focusedButton() !== null) {
          failures.push(`${name}: a click left the focus on the button`);
        }
      }
      await reset();
      console.info(`[679] menus: ${opening.join(', ')}`);
      expect(opening.length).toBeGreaterThan(10);
      expect(failures).toEqual([]);
    }
  );

  /**
   * What a press left behind, read the same way after a click and after a
   * key: the tool and its options, the last props the menus write (shape
   * name, connector mode, colours, widths, pen or highlighter), which menu is
   * open, and what the canvas gained.
   */
  const pressState = () => {
    const option = edgeless.gfx.tool.currentToolOption$.peek();
    const menu = toolbar().activePopper?.element;
    return {
      tool: tool(),
      options: JSON.stringify(option?.options ?? null, (_key, value) =>
        typeof value === 'function' ? undefined : value
      ),
      props: JSON.stringify(edgeless.std.get(EditPropsStore).lastProps$.peek()),
      menu: menu?.isConnected ? menu.localName : null,
      models: edgeless.store.getAllModels().length,
      elements: edgeless.gfx.surface!.elementModels.length,
      picks: picks.length,
    };
  };
  /**
   * The props the menus remember (shape name, connector mode, colours,
   * widths), saved and put back so that the keyboard path and the mouse path
   * start from the same place: compared from where the other left them, a
   * side effect of one path showed in both and compared equal (fourth review
   * of #679). `reset()` puts the tool back; the tools read their options from
   * these props when a row button arms them.
   */
  type PropsStore = {
    innerProps$: { value: unknown };
    lastUsedStyle$: { value: unknown };
  };
  const propsStore = () =>
    edgeless.std.get(EditPropsStore) as unknown as PropsStore;
  const saveProps = () => ({
    inner: propsStore().innerProps$.value,
    used: propsStore().lastUsedStyle$.value,
  });
  const restoreProps = (saved: ReturnType<typeof saveProps>) => {
    propsStore().innerProps$.value = saved.inner;
    propsStore().lastUsedStyle$.value = saved.used;
  };

  /** Where a press starts from: the tool, its options, the props, the menu. */
  const startOf = ({
    tool,
    options,
    props,
    menu,
  }: ReturnType<typeof pressState>) =>
    JSON.stringify({ tool, options, props, menu });

  const changeFrom = (before: ReturnType<typeof pressState>) => {
    const now = pressState();
    return JSON.stringify({
      ...now,
      models: now.models - before.models,
      elements: now.elements - before.elements,
      picks: now.picks - before.picks,
    });
  };

  /**
   * Walks the keyboard to `target` the way a user does: the arrows inside a
   * group, both ways, Tab to the next one. A slider is crossed with Tab
   * alone — its arrows would change the width on the way.
   */
  const walkTo = async (target: Element, limit: number) => {
    for (let group = 0; group < limit; group++) {
      if (deepActive() === target) return true;
      if (deepActive()?.getAttribute('role') !== 'slider') {
        // Rightwards until the group wraps (a row of buttons: all seen) or
        // stops at its end (a grid entered mid-way: back to its start).
        const start = deepActive();
        let wrapped = false;
        for (const key of ['{ArrowRight}', '{ArrowLeft}']) {
          if (wrapped) break;
          for (let step = 0; step < limit; step++) {
            const here = deepActive();
            await press(key);
            const now = deepActive();
            if (now === target) return true;
            if (now === here) break;
            if (key === '{ArrowRight}' && now === start) {
              wrapped = true;
              break;
            }
          }
        }
      }
      await press('{Tab}');
      if (deepActive() === target) return true;
    }
    return deepActive() === target;
  };

  /**
   * #679, third review: Enter on "Highlighter" closed the pen menu where a
   * click leaves it open, and the test that should have held it pressed the
   * first control of each menu and read only the tool and the counts. Every
   * control of every menu of every page now: the state after Enter equals
   * the state after a real click; in keyboard mode the focus stays on the
   * control (or the one drawn in its place) while the menu stays, and is on
   * the canvas when it closes. Space too, on the first control of a group.
   * A slider is left out: Enter is not its activation, its keys are held by
   * `slider-continuous.unit.spec.ts`.
   */
  /**
   * Each row button by its place, read before any press: a tool's name
   * follows its state (the connector is named by its mode). `button()` turns
   * its page to and returns it.
   */
  const rowPlaces = async () => {
    const places: {
      name: string;
      button: () => Promise<HTMLElement>;
    }[] = [];
    for (const [name, scroll] of await everyButton()) {
      const named = await buttonNamed(name, scroll);
      const position = rowButtons().indexOf(named);
      places.push({
        name,
        button: async () => {
          const bar = toolbar();
          bar.scrollSeniorToolIndex = scroll;
          await bar.updateComplete;
          await rowReady();
          return rowButtons()[position];
        },
      });
    }
    return places;
  };

  const enterEqualsClick = async (commandMenus: boolean) => {
    const places = await rowPlaces();
    const failures: string[] = [];
    let pressed = 0;
    await reset();
    const initial = saveProps();
    for (const { name, button: buttonAt } of places) {
      if (OWN_MODEL.has(name)) continue;
      await reset();
      restoreProps(initial);
      const first = await openWithEnter(await buttonAt());
      if (!first) continue;
      if (first instanceof EdgelessCommandMenu !== commandMenus) continue;
      const count = drawnControls(first).length;
      // Where Tab lands is a group's first control: Space is pressed there.
      const firstOfGroup = new Set<number>();
      await holds(() => within(deepActive(), first));
      for (let step = 0; step <= count; step++) {
        const at = drawnControls(first).indexOf(deepActive() as HTMLElement);
        if (at < 0) break;
        firstOfGroup.add(at);
        await press('{Tab}');
      }
      for (let index = 0; index < count; index++) {
        for (const key of ['{Enter}', '{ }']) {
          if (key === '{ }' && !firstOfGroup.has(index)) continue;
          // The keyboard.
          await reset();
          restoreProps(initial);
          const opened = await openWithEnter(await buttonAt());
          if (!opened || !(await holds(() => within(deepActive(), opened)))) {
            failures.push(`${name}: the keyboard did not go in`);
            break;
          }
          const target = drawnControls(opened)[index];
          if (target.getAttribute('role') === 'slider') break;
          if (!(await walkTo(target, 4 * count))) {
            failures.push(`${name} #${index}: not reached by the keys`);
            break;
          }
          const keyFrom = pressState();
          const keyTool = edgeless.gfx.tool.currentToolOption$.peek();
          await press(key);
          await pointerSettled();
          await frames(3);
          const byKey = changeFrom(keyFrom);
          const open = toolbar().activePopper?.element;
          const focusOk = open?.isConnected
            ? await holds(() => {
                const active = deepActive();
                // The same control, or the one drawn in its place: a
                // menu that redraws (a drag's copy) moves the indices.
                const named = target.getAttribute('aria-label');
                return (
                  !!active &&
                  within(active, open) &&
                  (drawnControls(open).indexOf(active as HTMLElement) ===
                    index ||
                    (named !== null &&
                      active.getAttribute('aria-label') === named))
                );
              })
            : await holds(() => canvasHasFocus());
          if (!focusOk) {
            failures.push(
              `${name} ${describeControl(target)} ${key}: the focus is at ${where()}`
            );
          }
          // The mouse, from the same props.
          await reset();
          restoreProps(initial);
          await userEvent.click(await buttonAt());
          const drawn = () => {
            const menu = toolbar().activePopper?.element;
            return menu?.isConnected ? drawnControls(menu) : [];
          };
          await holds(() => drawn().length === count);
          lastMenu = toolbar().activePopper?.element ?? null;
          const control = drawn()[index];
          if (!control) {
            failures.push(
              `${name} #${index}: a click opens ${drawn().length} controls, not ${count}`
            );
            break;
          }
          // The press that opened the menu armed the tool, from state that
          // neither `reset()` (the tool) nor the props put back (fourth review
          // of #679): the pen kind and the note's block type live on their
          // row button, so the keyboard's press on Highlighter or Text armed
          // the mouse path's opening with it; and the Shape button is a stack
          // of three shapes, the click arming the one under the pointer, which
          // the stack's `.shape:hover` transition (0.3s) moves when the real
          // click lands a frame after the pointer on a loaded machine — the
          // ellipse, where Enter on the centre armed the rounded rectangle.
          // What this test compares is the press on a menu control: the mouse
          // path starts from the tool and options the keyboard path started
          // from, and a start that still differs is a failure of its own.
          if (keyTool && startOf(keyFrom) !== startOf(pressState())) {
            edgeless.gfx.tool.setTool(
              keyTool.toolType as never,
              keyTool.options as never
            );
            await frames(2);
          }
          const clickFrom = pressState();
          if (startOf(keyFrom) !== startOf(clickFrom)) {
            failures.push(
              `${name} ${describeControl(control)} ${key}: the paths start apart\n key   ${startOf(keyFrom)}\n click ${startOf(clickFrom)}`
            );
            continue;
          }
          await userEvent.click(control);
          await pointerSettled();
          await frames(3);
          const byClick = changeFrom(clickFrom);
          pressed++;
          if (byKey !== byClick) {
            failures.push(
              `${name} ${describeControl(control)} ${key}\n start ${startOf(keyFrom)}\n key   ${byKey}\n click ${byClick}`
            );
          }
          // Where a mouse leaves the focus: on the canvas, never in the menu.
          if (!(await holds(() => canvasHasFocus()))) {
            failures.push(
              `${name} ${describeControl(control)} click: the focus is at ${where()}`
            );
          }
        }
      }
    }
    await reset();
    return { failures, pressed };
  };

  test(
    'Enter on any control of an option menu does what a click on it does',
    { timeout: 900_000 },
    async () => {
      const { failures, pressed } = await enterEqualsClick(false);
      expect(pressed).toBeGreaterThan(20);
      expect(failures).toEqual([]);
    }
  );

  test(
    "Enter on any command of a framework's menu does what a click on it does",
    { timeout: 900_000 },
    async () => {
      const { failures, pressed } = await enterEqualsClick(true);
      expect(pressed).toBeGreaterThan(20);
      expect(failures).toEqual([]);
    }
  );

  /**
   * #679, third and fourth reviews: a control the keyboard had visited kept
   * its `tabindex`, so a later click focused it: Tab was then swallowed and
   * Escape dropped the focus on the body. The first guard closed the menu
   * and reopened it with the mouse — a NEW menu, which no keyboard had
   * touched: it could not fail. The case is a click in the SAME menu. Every
   * menu: opened from the keyboard and walked, then a real click on another
   * of its controls; no control keeps a `tabindex` it was not drawn with,
   * the focus is on the canvas, and the canvas has its keys — Escape, the
   * arrows, Space, Delete, Tab.
   */
  test(
    'a keyboard visit leaves nothing behind for a click in the same menu',
    { timeout: 300_000 },
    async () => {
      const failures: string[] = [];
      const visited: string[] = [];
      // Space has no effect to read: it must reach the window, unconsumed.
      const reached: string[] = [];
      const onWindow = (event: KeyboardEvent) => reached.push(event.key);
      window.addEventListener('keydown', onWindow);
      onTestFinished(() => window.removeEventListener('keydown', onWindow));
      for (const { name, button } of await rowPlaces()) {
        if (OWN_MODEL.has(name)) continue;
        // The menu as the mouse draws it: the tabindex its controls own.
        await reset();
        await userEvent.click(await button());
        await frames(3);
        const byMouse = toolbar().activePopper?.element;
        if (!byMouse?.isConnected) continue;
        lastMenu = byMouse;
        const own = drawnControls(byMouse).map(control =>
          control.getAttribute('tabindex')
        );
        // The keyboard opens it and walks it, then the mouse clicks in it.
        await reset();
        const opened = await openWithEnter(await button());
        if (!opened || !(await holds(() => within(deepActive(), opened)))) {
          failures.push(`${name}: the keyboard did not go in (${where()})`);
          continue;
        }
        await press('{ArrowRight}');
        const controls = drawnControls(opened);
        const target = controls.find(
          control =>
            control !== deepActive() &&
            control.getAttribute('role') !== 'slider'
        );
        if (!target) continue;
        visited.push(name);
        await userEvent.click(target);
        await pointerSettled();
        await frames(3);
        const kept = controls.filter(
          (control, at) => own[at] === null && control.hasAttribute('tabindex')
        );
        if (kept.length > 0) {
          failures.push(
            `${name}: ${kept.map(describeControl).join(', ')} kept a tabindex`
          );
        }
        if (!(await holds(() => canvasHasFocus()))) {
          failures.push(`${name}: after the click the focus is at ${where()}`);
        }
        await press('{Escape}');
        if (!(await holds(() => tool() === 'default'))) {
          failures.push(`${name}: Escape left the tool on ${tool()}`);
        }
        const shape = addShape();
        select(shape.id);
        const x = shape.elementBound.x;
        await press('{ArrowRight}');
        if (shape.elementBound.x !== x + 1) {
          failures.push(`${name}: → did not move the shape`);
        }
        reached.length = 0;
        await press('{ }');
        if (!reached.includes(' ')) {
          failures.push(`${name}: Space did not reach the canvas`);
        }
        await press('{Delete}');
        if (edgeless.service.crud.getElementById(shape.id)) {
          failures.push(`${name}: Delete did not remove the shape`);
        }
        await press('{Tab}');
        if (focusedButton() === null) {
          failures.push(`${name}: Tab from the canvas went to ${where()}`);
        }
      }
      await reset();
      console.info(
        `[679] clicked after a keyboard visit: ${visited.join(', ')}`
      );
      expect(visited.length).toBeGreaterThan(8);
      expect(failures).toEqual([]);
    }
  );

  /**
   * #679, fourth review: a press in a menu settles a frame later, and it then
   * did what it meant at the press, whatever came since: Enter then Tab typed
   * in a row kept the focus on the option (the Tab lost), Enter then Escape
   * gave the canvas the keys instead of the menu's button, and a pointer
   * press in between got the keyboard's `tabindex` put back. What comes
   * before the press settles keeps its own move.
   *
   * The second key goes in the same task as Enter, before any frame: real
   * keys through the driver arrive a frame apart here and never raced (the
   * guard removed, they stayed green), where a fast typist or a loaded page
   * does race. The key handlers move the focus themselves, so a dispatched
   * keydown walks the menu as a real one does; what it lands on is checked
   * against the same keys pressed for real, with a pause.
   */
  describe('what comes before a press settles keeps its move', () => {
    /** The shapes menu opened from the keyboard, on its second shape. */
    const shapeMenu = async () => {
      await reset();
      const buttons = await everyButton();
      const button = await buttonNamed('Shape', buttons.get('Shape')!);
      const opened = (await openWithEnter(button))!;
      await until(() => within(deepActive(), opened), 'the keyboard is in');
      await press('{ArrowRight}');
      return { button, opened, option: deepActive() as HTMLElement };
    };

    /** A keydown on the focused control, now, in this task. */
    const keyNow = (key: string) =>
      deepActive()!.dispatchEvent(
        new KeyboardEvent('keydown', {
          key,
          bubbles: true,
          composed: true,
          cancelable: true,
        })
      );

    for (const next of ['Tab', 'ArrowRight']) {
      test(`Enter then ${next} before the press settles: ${next} keeps its move`, async () => {
        const paused = await shapeMenu();
        await press('{Enter}');
        await frames(4);
        await press(`{${next}}`);
        await frames(4);
        const expected = drawnControls(paused.opened).indexOf(
          deepActive() as HTMLElement
        );
        expect(expected).toBeGreaterThanOrEqual(0);

        const fast = await shapeMenu();
        keyNow('Enter');
        keyNow(next);
        await frames(6);
        expect(deepActive()).not.toBe(fast.option);
        expect(
          drawnControls(fast.opened).indexOf(deepActive() as HTMLElement)
        ).toBe(expected);
      });
    }

    test('Enter then Escape before the press settles: the menu closes onto its button', async () => {
      const { button } = await shapeMenu();
      keyNow('Enter');
      keyNow('Escape');
      await frames(6);
      expect(await holds(() => focusedButton() === button)).toBe(true);
      expect(toolbar().activePopper).toBeNull();
    });

    test('a pointer press before Enter settles ends keyboard mode for good', async () => {
      const { opened, option } = await shapeMenu();
      const other = drawnControls(opened).find(
        control =>
          control !== option &&
          control.localName === 'edgeless-tool-icon-button'
      )!;
      const keyboardMarks = () =>
        drawnControls(opened).filter(
          control =>
            control.localName === 'edgeless-tool-icon-button' &&
            control.hasAttribute('tabindex')
        );
      keyNow('Enter');
      other.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, composed: true })
      );
      await frames(6);
      expect(keyboardMarks()).toEqual([]);
      // And the click that pointer press begins is a mouse's click.
      await userEvent.click(other);
      await frames(4);
      expect(keyboardMarks()).toEqual([]);
      expect(within(deepActive(), opened)).toBe(false);
      expect(await holds(() => canvasHasFocus())).toBe(true);
    });
  });

  /**
   * #679, fourth review: Enter on a mind map style then Escape left the tool
   * on `empty` — the style still picked up, the canvas deaf to clicks — where
   * a click then Escape gives the select tool back: the drag's Escape listens
   * on the window, which the menu's Escape never reached.
   */
  test('Escape after picking a mind map style gives the select tool back, as with the mouse', async () => {
    const buttons = await everyButton();
    const scroll = buttons.get('Mind Map')!;
    await reset();
    const button = await buttonNamed('Mind Map', scroll);
    const opened = (await openWithEnter(button))!;
    await until(() => within(deepActive(), opened), 'the keyboard is in');
    await press('{Enter}');
    await until(() => tool() === 'empty', 'the style is picked up');
    await press('{Escape}');
    expect(await holds(() => tool() === 'default')).toBe(true);
    expect(await holds(() => focusedButton() === button)).toBe(true);

    await reset();
    await userEvent.click(await buttonNamed('Mind Map', scroll));
    await frames(3);
    const menu = toolbar().activePopper!.element;
    lastMenu = menu;
    await userEvent.click(drawnControls(menu)[0]);
    await until(() => tool() === 'empty', 'the style is picked up');
    await press('{Escape}');
    expect(await holds(() => tool() === 'default')).toBe(true);
  });

  /**
   * #679, third review: the chosen option of a menu is announced
   * (`aria-pressed`) and follows a choice made with the mouse.
   */
  test('the chosen shape is pressed, and follows a click', async () => {
    const buttons = await everyButton();
    await reset();
    await userEvent.click(await buttonNamed('Shape', buttons.get('Shape')!));
    await frames(3);
    const menu = toolbar().activePopper!.element;
    lastMenu = menu;
    const options = () =>
      drawnControls(menu).filter(control =>
        control.hasAttribute('aria-pressed')
      );
    const chosen = () =>
      options().filter(
        control => control.getAttribute('aria-pressed') === 'true'
      );
    expect(options().length).toBeGreaterThan(2);
    expect(chosen()).toHaveLength(1);
    const before = chosen()[0];
    const other = options().find(control => control !== before)!;
    await userEvent.click(other);
    await until(() => chosen()[0] === other, 'the click is announced');
    expect(chosen()).toHaveLength(1);
    expect(before.getAttribute('aria-pressed')).toBe('false');
  });

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

    test('Tab in a framework menu closes it and gives its button the focus', async () => {
      const wardley = await focusButton('Wardley map');
      await press('{Enter}');
      const menu = toolbar().activePopper?.element;
      expect(menu).toBeInstanceOf(EdgelessCommandMenu);
      await until(() => within(deepActive(), menu!), 'the keyboard is in it');
      await press('{Tab}');
      expect(onBody()).toBe(false);
      await until(() => toolbar().activePopper === null, 'the menu closed');
      expect(focusedButton()).toBe(wardley);
    });

    /**
     * #679 acceptance (the product owner, A): a framework menu wider than the
     * toolbar is a horizontal scroller, and Chromium makes a scroller whose
     * items take no focus a Tab stop of its own. Tab from the button landed
     * on the strip (its ring, the arrows scrolling it), never on a tool.
     */
    test('a menu wider than the toolbar: the keyboard is on its tools, never on its strip', async () => {
      const column = window.editor.parentElement as HTMLElement;
      onTestFinished(() => {
        column.style.width = '';
      });
      const size = toolbar().scrollSeniorToolSize;
      column.style.width = '700px';
      window.dispatchEvent(new Event('resize'));
      await until(
        () => toolbar().scrollSeniorToolSize < size,
        'the row is narrow'
      );
      const wardley = await focusButton('Wardley map');
      await press('{Enter}');
      const menu = toolbar().activePopper!.element;
      const strip = deepQueryAll(
        menu.shadowRoot!,
        '.menu-container-scrollable'
      )[0];
      await until(
        () => strip.scrollWidth > strip.clientWidth,
        'the menu is wider than the toolbar'
      );
      const strips: string[] = [];
      for (let step = 0; step < 4; step++) {
        await press('{Tab}');
        if (deepActive() === strip) strips.push(`Tab ${step + 1}`);
        if (focusedButton() === wardley) break;
      }
      expect(strips).toEqual([]);
      expect(focusedButton()).toBe(wardley);
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

  test('a frame tool picked with Enter opens its options with the keyboard in them', async () => {
    edgeless.gfx.tool.setTool(FrameTool);
    edgeless.gfx.tool.setTool(DefaultTool);
    const frame = rowButtons().find(
      button => button.getAttribute('aria-label') === 'Frame'
    )!;
    frame.focus();
    await press('{Enter}');
    expect(tool()).toBe('frame');
    const menu = toolbar().activePopper?.element;
    expect(menu).toBeTruthy();
    await until(
      () => within(deepActive(), menu!),
      'the keyboard is in the options'
    );
    await press('{Escape}');
    expect(toolbar().activePopper).toBeNull();
    expect(focusedButton()).toBe(frame);
  });

  /**
   * The product owner's acceptance of #691 (ADR 0054, amendment of
   * 2026-11-21): where the keyboard's ring is drawn. Every ring of the bar
   * and of its menus is measured from what draws it (`utils/focus-ring.ts`).
   */
  describe('the focus ring, where the product owner saw it', () => {
    /** The bar inside its border: the smooth corner's box, less its stroke. */
    const barInside = (): Box => {
      const bar = toolbar().shadowRoot!.querySelector(
        'smooth-corner'
      ) as HTMLElement & { borderWidth: number };
      const box = bar.getBoundingClientRect();
      const border = bar.borderWidth;
      return {
        left: box.left + border,
        top: box.top + border,
        right: box.right - border,
        bottom: box.bottom - border,
      };
    };

    /** What is wrong with the ring `control` draws on the bar, if anything. */
    const barRingFaults = (control: HTMLElement, name: string) => {
      const ring = focusRing(control);
      if (!ring) return [`${name}: no ring`];
      const faults: string[] = [];
      if (ring.width < 2) faults.push(`${name}: a ${ring.width}px ring`);
      const bar = barInside();
      if (!inside(ring.outer, bar)) {
        faults.push(
          `${name}: ring ${describeBox(ring.outer)} out of the bar inside its border ${describeBox(bar)}`
        );
      }
      const clipped = ringClippedBy(ring);
      if (clipped.length > 0) {
        faults.push(
          `${name}: ring ${describeBox(ring.outer)} clipped by ${clipped.join(', ')}`
        );
      }
      return faults;
    };

    /**
     * Remark 2: after Tab, the 2px ring of the Note button was a rectangle
     * whose top edge sat on the bar's top border and whose bottom edge was
     * cut by the bar's bottom. A senior tool's button is as tall as the bar,
     * and its ring was drawn on its box. Every button the keyboard stands on
     * — the quick tools, each senior tool on every page of the pager, "More
     * tools" at a narrow width — and the pager arrows: the whole ring inside
     * the bar, clear of its border, clipped by nothing.
     */
    test('the ring of every button of the bar lies inside the bar, clear of its border', async () => {
      const faults: string[] = [];
      const measured = new Set<string>();
      const measure = (button: HTMLElement) => {
        const name = button.getAttribute('aria-label') ?? button.localName;
        measured.add(name);
        faults.push(...barRingFaults(button, name));
      };
      await walkRow(measure);
      // The pager arrows take the focus only from code (they are no stop):
      // measured on a page where both are live.
      const bar = toolbar();
      bar.scrollSeniorToolIndex = 1;
      await bar.updateComplete;
      await rowReady();
      for (const arrow of bar.shadowRoot!.querySelectorAll<HTMLElement>(
        '.senior-nav-button'
      )) {
        arrow.focus();
        await frames();
        expect(arrow.matches(':focus-visible')).toBe(true);
        measure(arrow);
      }
      // Narrow: the quick tools fold into "More tools", one senior tool a page.
      const column = window.editor.parentElement as HTMLElement;
      onTestFinished(() => {
        column.style.width = '';
      });
      column.style.width = '380px';
      window.dispatchEvent(new Event('resize'));
      await until(
        () =>
          bar
            .shadowRoot!.querySelector<HTMLElement>('.quick-tool-more-button')
            ?.hasAttribute('disabled') === false,
        '"More tools" holds tools'
      );
      await rowReady();
      // "More tools" and the pager arrows open by a width transition: the
      // ring is measured where the row comes to rest.
      await until(
        () => bar.shadowRoot!.getAnimations().length === 0,
        'the row has come to rest'
      );
      // From the first button across "More tools" and the first senior
      // pages. ponytail: not the whole narrow row — at 380px → stalls on
      // "Add file" on the base already (found here, reported with #691's
      // follow-ups); walk it whole once that is fixed.
      await tabIntoToolbar();
      await press('{Home}');
      for (let step = 0; step < 5; step++) {
        const here = focusedButton()!;
        measure(here);
        await userEvent.keyboard('{ArrowRight}');
        await until(() => focusedButton() !== here, 'ArrowRight moves');
      }
      expect(measured).toContain('Note');
      expect(measured).toContain('More Tools');
      expect(measured).toContain('Next tools');
      expect(faults).toEqual([]);
    });

    /**
     * Remark 1: in the Shape menu, the keyboard's ring around the chosen
     * swatch sat down and to the left of its selection ring — two rings that
     * were not concentric. The selection ring was 27px on a 24px swatch, so
     * 1.5px out on each side: on half pixels, which the browser snaps to one
     * side, half a pixel from where the focus ring is, which itself left
     * only 0.5px between the two. Every control of every menu, reached by the
     * keyboard: the ring is whole (clipped by nothing), centred on the swatch
     * it surrounds, and on a chosen swatch concentric with its selection ring
     * on whole pixels, with the same gap of at least 1px all round.
     */
    test(
      'in every menu, the ring is whole and centred; a chosen swatch has two concentric rings',
      { timeout: 240_000 },
      async () => {
        const buttons = await everyButton();
        const faults: string[] = [];
        let swatches = 0;
        let chosen = 0;
        const near = (a: number, b: number) => Math.abs(a - b) <= 0.5;
        const whole = (value: number) =>
          Math.abs(value - Math.round(value)) < 0.01;
        for (const [name, scroll] of buttons) {
          if (OWN_MODEL.has(name)) continue;
          await reset();
          const opened = await openWithEnter(await buttonNamed(name, scroll));
          if (!opened) continue;
          if (!(await holds(() => within(deepActive(), opened)))) {
            faults.push(`${name}: the keyboard did not go in (${where()})`);
            continue;
          }
          await walkMenu(opened, control => {
            const label = `${name} › ${describeControl(control)}`;
            const ring = focusRing(control);
            if (!ring) {
              faults.push(`${label}: no ring`);
              return;
            }
            const clipped = ringClippedBy(ring);
            if (clipped.length > 0) {
              faults.push(
                `${label}: ring ${describeBox(ring.outer)} clipped by ${clipped.join(', ')}`
              );
            }
            const swatch = control.shadowRoot?.querySelector('.color-unit');
            if (!swatch) return;
            swatches++;
            const at = centre(ring.outer);
            const disc = centre(swatch.getBoundingClientRect());
            if (!near(at.x, disc.x) || !near(at.y, disc.y)) {
              faults.push(
                `${label}: ring centred at ${at.x},${at.y}, the swatch at ${disc.x},${disc.y}`
              );
            }
            const selection = selectionRing(control);
            if (!selection) return;
            chosen++;
            const mid = centre(selection);
            if (!near(at.x, mid.x) || !near(at.y, mid.y)) {
              faults.push(
                `${label}: focus ring centred at ${at.x},${at.y}, selection ring at ${mid.x},${mid.y}`
              );
            }
            const host = control.getBoundingClientRect();
            const offsets = [
              selection.left - host.left,
              selection.top - host.top,
              ring.inner.left - host.left,
              ring.inner.top - host.top,
            ];
            if (!offsets.every(whole)) {
              faults.push(
                `${label}: rings off whole pixels, offsets ${offsets.join(', ')}`
              );
            }
            const gaps = [
              selection.left - ring.inner.left,
              selection.top - ring.inner.top,
              ring.inner.right - selection.right,
              ring.inner.bottom - selection.bottom,
            ];
            if (gaps.some(gap => gap < 1 || !near(gap, gaps[0]))) {
              faults.push(
                `${label}: gaps between the rings ${gaps.join(', ')} (selection ${describeBox(selection)}, focus inner ${describeBox(ring.inner)})`
              );
            }
          });
        }
        await reset();
        expect(swatches).toBeGreaterThan(10);
        expect(chosen).toBeGreaterThan(2);
        expect(faults).toEqual([]);
      }
    );
  });

  /**
   * Remark 3 of the product owner's acceptance of #691: Tab always started
   * again at the first button, the active tool's — and a placed shape or a
   * picked style gives the select tool back, so nearly always the first —
   * which made him cross the whole bar again. The Tab stop is the button
   * used last in the row (the APG toolbar: focus returns to the control that
   * last had it), for the life of the editor; until the row is used, the
   * active tool's (ADR 0054, amendment of 2026-11-21). Sub-menus are
   * unchanged. At every step, exactly one button of the row is a Tab stop.
   */
  describe('the Tab stop is the button used last', () => {
    const named = (name: string) =>
      rowButtons().find(button => button.getAttribute('aria-label') === name);

    /** The roving `tabindex` as it stands: one `0` on the row, the rest `-1`. */
    const expectOneStop = async (stop: HTMLElement) => {
      await rowReady();
      const controls = [
        ...rowButtons(),
        ...toolbar().shadowRoot!.querySelectorAll<HTMLElement>(
          '.senior-nav-button, .quick-tool-more-button'
        ),
      ];
      const label = (control: Element) =>
        control.getAttribute('aria-label') ?? control.localName;
      expect(
        controls
          .filter(control => control.getAttribute('tabindex') === '0')
          .map(label)
      ).toEqual([label(stop)]);
      expect(
        controls
          .filter(control => control.getAttribute('tabindex') !== '0')
          .filter(control => control.getAttribute('tabindex') !== '-1')
          .map(label)
      ).toEqual([]);
    };

    /** → from where the keyboard stands to the button named `name`. */
    const walkTo = async (name: string) => {
      for (
        let step = 0;
        step < 64 && focusedButton()?.getAttribute('aria-label') !== name;
        step++
      ) {
        const here = focusedButton();
        await userEvent.keyboard('{ArrowRight}');
        await until(() => focusedButton() !== here, 'ArrowRight moves');
      }
      expect(focusedButton()?.getAttribute('aria-label')).toBe(name);
      return focusedButton()!;
    };

    test('Tab, a walk to a button, Shift+Tab, Tab: the keyboard is back on that button', async () => {
      const select = await tabIntoToolbar();
      expect(
        select.getAttribute('aria-pressed'),
        'unused: the active tool'
      ).toBe('true');
      const undo = await walkTo('Undo');
      await press('{Shift>}{Tab}{/Shift}');
      expect(canvasHasFocus()).toBe(true);
      await expectOneStop(undo);
      expect(await tabIntoToolbar()).toBe(undo);

      // A senior tool, left with Escape (the tool unchanged).
      const note = await walkTo('Note');
      await press('{Escape}');
      expect(canvasHasFocus()).toBe(true);
      expect(tool()).toBe('default');
      await expectOneStop(note);
      expect(await tabIntoToolbar()).toBe(note);
    });

    test('a tool that gives the select tool back after use: Tab comes back to it', async () => {
      // The mouse rests out of the way: a tooltip it raised over the menu
      // would take the press (`_pressLikePointer` presses what is drawn).
      await pointerMoveTo('html', 0, 0, 1);
      await tabIntoToolbar();
      const frame = await walkTo('Frame');
      await press('{Enter}');
      const menu = toolbar().activePopper?.element;
      await until(
        () => !!menu && within(deepActive(), menu),
        'the keyboard is in the frame options'
      );
      const before = edgeless.store.getAllModels().length;
      // A preset: a frame is placed and the select tool is back. Pressed once
      // the menu has slid in: a press lands where the pointer would.
      const preset = deepActive()!;
      await until(() => {
        const box = preset.getBoundingClientRect();
        const x = box.left + box.width / 2;
        const y = box.top + box.height / 2;
        let hit = document.elementFromPoint(x, y);
        while (hit?.shadowRoot) {
          const inner = hit.shadowRoot.elementFromPoint(x, y);
          if (!inner || inner === hit) break;
          hit = inner;
        }
        return within(hit, preset);
      }, 'the frame options have slid in');
      await press('{Enter}');
      await until(() => tool() === 'default', 'the select tool is back');
      expect(edgeless.store.getAllModels().length).toBe(before + 1);
      // The options stay open on the preset (ADR 0054 §10): Escape closes
      // them onto the Frame button, Escape again gives the canvas the keys —
      // where the stop used to go back to the active tool, Select.
      if (toolbar().activePopper) {
        await press('{Escape}');
        await until(() => focusedButton() === frame, 'back on Frame');
      }
      // The second Escape comes while the options are still sliding out: it
      // closes nothing more (it used to press Frame again, the menu back).
      await press('{Escape}');
      await until(() => canvasHasFocus(), 'the canvas has the keys');
      expect(toolbar().activePopper).toBeNull();
      expect(tool()).toBe('default');
      await expectOneStop(frame);
      const back = await tabIntoToolbar();
      expect(back).toBe(frame);
      expect(back.getAttribute('aria-pressed')).toBe('false');
    });

    test('a click moves the stop to the button and focuses nothing', async () => {
      const undo = named('Undo')!;
      await userEvent.click(undo);
      expect(focusedButton(), 'a click focuses nothing').toBeNull();
      await expectOneStop(undo);
      expect(await tabIntoToolbar()).toBe(undo);

      // A senior tool clicked, its menu closed with Escape on the canvas.
      await press('{Shift>}{Tab}{/Shift}');
      const note = named('Note')!;
      await userEvent.click(note);
      expect(focusedButton()).toBeNull();
      await press('{Escape}');
      await until(() => tool() === 'default', 'Escape gave the select tool');
      await expectOneStop(note);
      expect(await tabIntoToolbar()).toBe(note);
    });

    test('a tool picked from the canvas does not move the stop', async () => {
      await tabIntoToolbar();
      const undo = await walkTo('Undo');
      await press('{Escape}');
      // A letter: the hand. Then the select tool again.
      await press('h');
      expect(tool()).toBe('pan');
      await expectOneStop(undo);
      await press('v');
      expect(tool()).toBe('default');
      await expectOneStop(undo);
      expect(await tabIntoToolbar()).toBe(undo);
    });

    test('the button used last on another page: Tab turns the bar to it', async () => {
      const bar = toolbar();
      await tabIntoToolbar();
      await press('{End}');
      await until(() => bar.scrollSeniorToolIndex > 0, 'End pages the row');
      const last = focusedButton()!.getAttribute('aria-label');
      await press('{Escape}');
      // Back to the first page with the mouse: an arrow moves no stop.
      const previous = bar.shadowRoot!.querySelector<HTMLElement>(
        '.senior-nav-button-wrapper.prev icon-button'
      )!;
      for (let step = 0; step < 16 && bar.scrollSeniorToolIndex > 0; step++) {
        await userEvent.click(previous);
        await frames();
      }
      expect(bar.scrollSeniorToolIndex).toBe(0);
      expect(named(last!)).toBeUndefined();
      // Not drawn: the page on show holds the active tool's stop.
      await expectOneStop(named('Select')!);
      const back = await tabIntoToolbar();
      expect(back.getAttribute('aria-label')).toBe(last);
      expect(bar.scrollSeniorToolIndex).toBeGreaterThan(0);
      await expectOneStop(back);
    });

    test('the button used last, folded away by a resize: the active tool holds the stop until it is back', async () => {
      await tabIntoToolbar();
      await walkTo('Selection pane');
      await press('{Escape}');
      const column = window.editor.parentElement as HTMLElement;
      onTestFinished(() => {
        column.style.width = '';
      });
      const width = async (value: string, folded: boolean) => {
        column.style.width = value;
        window.dispatchEvent(new Event('resize'));
        await until(
          () => (named('Selection pane') === undefined) === folded,
          folded ? 'the selection pane folds into "More tools"' : 'wide again'
        );
        await rowReady();
      };
      await width('380px', true);
      const active = rowButtons().find(
        button => button.getAttribute('aria-pressed') === 'true'
      )!;
      await expectOneStop(active);
      // The memory outlives the resize.
      await width('', false);
      await expectOneStop(named('Selection pane')!);
      // Gone when Tab comes: the active tool.
      await width('380px', true);
      expect(await tabIntoToolbar()).toBe(active);
    });

    test('each editor has its own, stored nowhere: a second one, Wardley off, starts on its active tool', async () => {
      const storage = () => [
        storageCopy(localStorage),
        storageCopy(sessionStorage),
      ];
      const before = storage();
      await tabIntoToolbar();
      await walkTo('Wardley map');
      await press('{Escape}');
      expect((await tabIntoToolbar()).getAttribute('aria-label')).toBe(
        'Wardley map'
      );
      await press('{Escape}');
      expect(storage(), 'nothing stored').toEqual(before);

      onTestFinished(await mount({ flags: { wardley: false } }));
      expect(named('Wardley map')).toBeUndefined();
      const stop = await tabIntoToolbar();
      expect(stop.getAttribute('aria-pressed')).toBe('true');
      expect(stop.getAttribute('aria-label')).toBe('Select');
      await expectOneStop(stop);
    });
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
