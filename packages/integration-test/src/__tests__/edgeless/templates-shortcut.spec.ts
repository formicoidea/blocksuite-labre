/**
 * The Templates panel from the keyboard (ADR 0055, product owner's decision of
 * 2026-11-20): `l` on the canvas opens it as a click on its toolbar button
 * does, with the caret in its search field; `t` was refused (the Text tool),
 * `m` is the mind map's.
 *
 * Driven by the REAL keyboard on a real edgeless editor, at the suite's 1024px
 * where the senior row is paged and the Templates button (the last senior
 * tool) is not drawn until the row is scrolled to it: the shortcut has to page
 * it in. The spec holds what the product owner's rule asks of any navigation
 * aid: typing in the search field fires no canvas shortcut, Escape closes the
 * panel and hands the keyboard back to the canvas (the arrows move the
 * selection, Space pans), and the key does nothing where it must not (a note
 * being edited, a read-only board, inside a chord namespace).
 *
 * Real keystrokes go to whatever holds the focus, and the suite shares one
 * page, so every test blurs the focus first.
 */
import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import {
  EDGELESS_TOOLBAR_WIDGET,
  type EdgelessToolbarWidget,
} from '@labre/affine/widgets/edgeless-toolbar';
import type { ShapeElementModel } from '@labre/affine/model';
import { SurfaceSelection } from '@labre/std';
import { userEvent } from '@vitest/browser/context';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';

import { deepQueryAll } from '../utils/deep-query.js';
import { addNote, getDocRootBlock } from '../utils/edgeless.js';
import { snapshotPageState } from '../utils/page-state.js';
import { setupEditor } from '../utils/setup.js';

// The commands these tests run write the usage store, and the Templates panel
// its remembered category: the shared page gets them back as it was.
let restorePage: () => void = () => {};
beforeAll(() => {
  restorePage = snapshotPageState();
});
afterAll(() => restorePage());

type Service = EdgelessRootBlockComponent['service'];

async function mount() {
  const cleanup = await setupEditor('edgeless');
  const service: Service = getDocRootBlock(
    window.doc,
    window.editor,
    'edgeless'
  ).service;
  service.std.event.active = true;
  (document.activeElement as HTMLElement | null)?.blur();
  const id = service.crud.addElement('shape', {
    shapeType: 'rect',
    xywh: '[0,0,100,100]',
  })!;
  const shape = service.crud.getElementById(id) as ShapeElementModel;
  const select = () =>
    service.selection.set({ elements: [id], editing: false });
  select();
  const panel = () =>
    deepQueryAll(document, 'edgeless-templates-panel')[0] ?? null;
  const search = () =>
    (panel()?.shadowRoot?.querySelector('.search-input') ??
      null) as HTMLInputElement | null;
  /** The focused element, through every shadow root. */
  const deepActive = () => {
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) {
      active = active.shadowRoot.activeElement;
    }
    return active;
  };
  const tool = () => service.gfx.tool.currentToolName$.peek();
  const count = () => service.gfx.gfxElements.length;
  return {
    cleanup,
    service,
    shape,
    select,
    panel,
    search,
    deepActive,
    tool,
    count,
  };
}

describe('the Templates panel on `l`', () => {
  test('opens the panel with the caret in its search field', async () => {
    const { cleanup, panel, search, deepActive } = await mount();
    try {
      expect(panel()).toBeNull();
      await userEvent.keyboard('l');
      await vi.waitFor(() => expect(search()).toBeTruthy());
      await vi.waitFor(() => expect(deepActive()).toBe(search()));
    } finally {
      cleanup();
    }
  });

  test('typing in the search field filters and fires no canvas shortcut', async () => {
    const { cleanup, service, shape, search, tool, count } = await mount();
    try {
      await userEvent.keyboard('l');
      await vi.waitFor(() => expect(search()).toBeTruthy());
      const toolBefore = tool();
      const selected = [...service.selection.selectedIds];
      const x = shape.elementBound.x;
      const elements = count();

      // Tool letters, chord prefixes, Delete, an arrow, undo: all text here.
      await userEvent.keyboard(
        'wardley tvbpdl{Backspace}{Delete}{ArrowRight}{Control>}z{/Control}'
      );

      expect(tool()).toBe(toolBefore);
      expect([...service.selection.selectedIds]).toEqual(selected);
      expect(shape.elementBound.x).toBe(x);
      expect(count()).toBe(elements);
      expect(search()!.isConnected).toBe(true);
      expect(search()!.value.startsWith('wardley')).toBe(true);
    } finally {
      cleanup();
    }
  });

  test('Escape closes it and gives the keyboard back to the canvas', async () => {
    const { cleanup, service, shape, select, panel, search, tool } =
      await mount();
    try {
      await userEvent.keyboard('l');
      await vi.waitFor(() => expect(search()).toBeTruthy());

      await userEvent.keyboard('{Escape}');
      await vi.waitFor(() => expect(panel()).toBeNull());
      expect(document.activeElement).toBe(service.std.host);
      expect(service.std.event.active).toBe(true);

      // The panel's tool is gone, and the canvas keys work at once.
      select();
      const x = shape.elementBound.x;
      await userEvent.keyboard('{ArrowRight}');
      await vi.waitFor(() => expect(shape.elementBound.x).toBeGreaterThan(x));
      await userEvent.keyboard('[Space>]');
      await vi.waitFor(() => expect(tool()).toBe('pan'));
      await userEvent.keyboard('[/Space]');
    } finally {
      cleanup();
    }
  });

  /**
   * The button sits last in a PAGED row: `l` pages the row to it, and the
   * row goes back to the page the user was on when the panel closes, however
   * it closes. It stayed on the last page before (0 to 12 at 1024px).
   */
  test('the toolbar row goes back to its page when the panel closes', async () => {
    const { cleanup, service, panel, search } = await mount();
    try {
      const root = getDocRootBlock(window.doc, window.editor, 'edgeless');
      const toolbar = root.widgetComponents[
        EDGELESS_TOOLBAR_WIDGET
      ] as unknown as EdgelessToolbarWidget;
      const page = toolbar.scrollSeniorToolIndex;

      // Escape.
      await userEvent.keyboard('l');
      await vi.waitFor(() => expect(search()).toBeTruthy());
      expect(toolbar.scrollSeniorToolIndex).not.toBe(page);
      await userEvent.keyboard('{Escape}');
      await vi.waitFor(() => expect(panel()).toBeNull());
      expect(toolbar.scrollSeniorToolIndex).toBe(page);

      // `l` again, the focus back on the canvas.
      await userEvent.keyboard('l');
      await vi.waitFor(() => expect(search()).toBeTruthy());
      service.std.host.focus();
      await userEvent.keyboard('l');
      await vi.waitFor(() => expect(panel()).toBeNull());
      expect(toolbar.scrollSeniorToolIndex).toBe(page);

      // A click elsewhere.
      await userEvent.keyboard('l');
      await vi.waitFor(() => expect(search()).toBeTruthy());
      // The panel listens for outside clicks from its first frame on.
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise(resolve => requestAnimationFrame(resolve));
      document.body.click();
      await vi.waitFor(() => expect(panel()).toBeNull());
      expect(toolbar.scrollSeniorToolIndex).toBe(page);
    } finally {
      cleanup();
    }
  });

  test('`l` again, the focus outside the field, closes it', async () => {
    const { cleanup, service, panel, search } = await mount();
    try {
      await userEvent.keyboard('l');
      await vi.waitFor(() => expect(search()).toBeTruthy());
      // The focus back on the canvas, the panel still open.
      service.std.host.focus();
      await vi.waitFor(() =>
        expect(document.activeElement).toBe(service.std.host)
      );
      expect(panel()).toBeTruthy();

      await userEvent.keyboard('l');
      await vi.waitFor(() => expect(panel()).toBeNull());

      // …and a third time opens it again.
      await userEvent.keyboard('l');
      await vi.waitFor(() => expect(panel()).toBeTruthy());
    } finally {
      cleanup();
    }
  });

  test('in a note being edited, `l` is a letter', async () => {
    const { cleanup, service, panel } = await mount();
    try {
      const noteId = addNote(window.doc);
      const paragraphId = window.doc.getModelById(noteId)!.children[0]!.id;
      const surfaceId = window.doc.getModelsByFlavour('affine:surface')[0]!.id;
      service.std.selection.setGroup('gfx', [
        new SurfaceSelection(surfaceId, [noteId], true),
      ]);
      const paragraph = await vi.waitFor(() => {
        const block = window.editor.host!.view.getBlock(
          paragraphId
        ) as unknown as HTMLElement & {
          inlineEditor?: { focusEnd(): void };
        };
        expect(block?.inlineEditor).toBeTruthy();
        return block;
      });
      paragraph.inlineEditor!.focusEnd();

      await userEvent.keyboard('l');

      const text = () =>
        (
          window.doc.getModelById(paragraphId) as unknown as {
            props: { text: { toString(): string } };
          }
        ).props.text.toString();
      await vi.waitFor(() => expect(text()).toBe('l'));
      expect(panel()).toBeNull();
    } finally {
      cleanup();
    }
  });

  test('on a read-only board it does nothing and throws nothing', async () => {
    const { cleanup, service, panel, tool } = await mount();
    const errors: string[] = [];
    const onError = (e: ErrorEvent) => errors.push(String(e.message));
    const onRejection = (e: PromiseRejectionEvent) =>
      errors.push(String(e.reason));
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    try {
      service.std.store.readonly = true;
      await userEvent.keyboard('l');
      // A sentinel the read-only canvas allows: once `h` has switched the
      // tool, the `l` before it has been handled.
      await userEvent.keyboard('h');
      await vi.waitFor(() => expect(tool()).toBe('pan'));
      expect(panel()).toBeNull();
      expect(errors).toEqual([]);
    } finally {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      cleanup();
    }
  });

  test('after a chord prefix, `l` belongs to that namespace', async () => {
    const { cleanup, panel, tool, count } = await mount();
    try {
      const elements = count();
      // No BPMN chord on `l`: swallowed, no panel, nothing placed.
      await userEvent.keyboard('bl');
      expect(panel()).toBeNull();
      expect(count()).toBe(elements);
      // Wardley's `w l` is its link tool: the chord wins within 1.2 s.
      await userEvent.keyboard('wl');
      await vi.waitFor(() => expect(tool()).toBe('connector'));
      expect(panel()).toBeNull();
      // Alone again, `l` opens the panel.
      await userEvent.keyboard('{Escape}v');
      await userEvent.keyboard('l');
      await vi.waitFor(() => expect(panel()).toBeTruthy());
    } finally {
      cleanup();
    }
  });

  test('Shift+L and Alt+L do not open it', async () => {
    const { cleanup, panel, tool } = await mount();
    try {
      // A real keyboard sends `L` with Shift held; Alt+L sends `l`.
      await userEvent.keyboard('{Shift>}L{/Shift}');
      await userEvent.keyboard('{Alt>}l{/Alt}');
      await userEvent.keyboard('h');
      await vi.waitFor(() => expect(tool()).toBe('pan'));
      expect(panel()).toBeNull();
    } finally {
      cleanup();
    }
  });
});
