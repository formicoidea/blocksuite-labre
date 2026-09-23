import type { PageRootBlockComponent } from '@labre/affine/blocks/root';
import { AFFINE_TOOLBAR_WIDGET } from '@labre/affine/widgets/toolbar';
import type { RichText } from '@labre/affine-rich-text';
import { TextSelection } from '@labre/std';
import { Text } from '@labre/store';
import { userEvent } from '@vitest/browser/context';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { addNote, getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * **The format bar's row is planned from the room the EDITOR has** — not from
 * where in the line the selection happens to be.
 *
 * The bug this is about, reported on app.labre.cc: with the sidebar open on a
 * 1280px screen, selecting text near the start of a line sent one entry into
 * the "⋮" while 900px of column sat empty beside it, and on a narrow window
 * the row's last icons were painted over the document, outside their own
 * background. Both came from the same number: the cap `size()` writes, which
 * used to be computed before `shift()` had run and was then the row's own
 * width less twice what a row CENTRED on the selection would overhang by.
 *
 * The column is narrowed the way the sidebar narrows it — by making the
 * editor's container narrower — and NOT by resizing the window: this suite
 * runs `isolate: false`, one browser page for every spec file, so a spec that
 * resized the window would hand the next one a different world. The clipping
 * box is the container either way, which is the number under test.
 */
describe('the format bar, at every editor width', () => {
  let root!: PageRootBlockComponent;
  let container!: HTMLElement;
  let paragraphId!: string;
  let unmount: (() => void) | null = null;

  const widget = () =>
    root.widgetComponents[AFFINE_TOOLBAR_WIDGET] as
      | { toolbar?: HTMLElement }
      | undefined;

  const toolbar = () => widget()?.toolbar ?? null;

  const entries = () => Array.from(toolbar()?.children ?? []) as HTMLElement[];

  /**
   * What the row is made of, right now: every entry, in order, and whether it
   * reads with its word or as an icon alone. This string changing between two
   * widths IS the symptom the ticket is about.
   */
  const composition = () =>
    entries()
      .map(child => {
        const id = child.dataset.toolbarActionId;
        if (!id) return child.localName;
        return `${id}:${child.querySelector('.label') ? 'label' : 'icon'}`;
      })
      .join('|');

  /** The cap `size()` wrote on the row. */
  const capOf = () => Number.parseFloat(toolbar()!.style.maxWidth);

  /** How many lines the row occupies. One, always. */
  const lines = () => new Set(entries().map(child => child.offsetTop)).size;

  /**
   * How far the row's content sticks out of its own background, in pixels.
   *
   * Measured from the entries' LAYOUT boxes rather than from `scrollWidth`:
   * the row is `overflow-x: clip`, so it has no scrollable overflow to report
   * any more — which is the point of the clip, and exactly why the overflow
   * has to be measured somewhere the clip cannot hide it.
   */
  const spill = () => {
    const bar = toolbar()!;
    const box = bar.getBoundingClientRect();
    const right = entries().reduce(
      (furthest, child) =>
        Math.max(furthest, child.getBoundingClientRect().right),
      box.left
    );
    return Math.max(0, right - box.right);
  };

  const frames = async (count = 4) => {
    for (let i = 0; i < count; i++) {
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
  };

  const settle = async () => {
    await wait(200);
    await root.updateComplete;
    await frames();
  };

  /** The padding `size()` keeps between the row and the edge of the column. */
  const EDGE = 10;

  /**
   * The window getting narrower: the editor's column is now this wide.
   *
   * The `resize` event goes with the width, because that is what a window
   * being resized does and it is what the positioner listens to — it is not
   * watching the container for its own account.
   */
  const columnOf = async (width: number) => {
    container.style.width = `${width}px`;
    window.dispatchEvent(new Event('resize'));
    await settle();
  };

  /**
   * A column that leaves the row on screen `short` pixels less than it needs.
   *
   * Derived rather than written down: how wide the format bar is depends on
   * the wordings in force and on what the document allows, and a hard-coded
   * width would make this spec pass or fail for reasons that have nothing to
   * do with it.
   */
  const tooShortBy = (short: number) =>
    toolbar()!.getBoundingClientRect().width - short + 2 * EDGE;

  /** Selects `length` characters from `index` — a real, non-collapsed range. */
  const select = async (index: number, length: number) => {
    const std = window.editor.std;
    std.selection.setGroup('note', [
      std.selection.create(TextSelection, {
        from: { blockId: paragraphId, index, length },
        to: null,
      }),
    ]);
    await settle();
  };

  beforeEach(async () => {
    unmount = await setupEditor('page');
    root = getDocRootBlock(window.doc, window.editor, 'page');
    container = window.editor.parentElement as HTMLElement;

    const noteId = addNote(window.doc);
    paragraphId = window.doc.addBlock(
      'affine:paragraph',
      {
        text: new Text(
          'Une phrase assez longue pour que la selection puisse commencer au ' +
            'tout debut de la ligne comme au milieu.'
        ),
      },
      noteId
    );
    await wait(100);

    const richText = window.editor.host!.querySelector<RichText>(
      `[data-block-id="${paragraphId}"] rich-text`
    );
    if (!richText) throw new Error('the paragraph rich text is missing');
    await userEvent.click(richText);

    return () => {
      container.style.width = '';
      unmount?.();
      unmount = null;
    };
  });

  test('a 1280px screen with the sidebar open keeps the whole row', async () => {
    // The editor as it is at its widest here, with a selection in the middle
    // of the line: the reference row, whole.
    await columnOf(1000);
    await select(60, 12);
    const whole = composition();
    expect(whole).not.toBe('');

    // The column of a 1280px window with a 320px sidebar — and the selection
    // at the very start of the line, which is what used to collapse the row:
    // centred on those words the bar would begin left of the column, and the
    // old cap read that overhang as a lack of room.
    await columnOf(960);
    await select(0, 12);

    expect(composition()).toBe(whole);
    expect(lines()).toBe(1);
    expect(spill()).toBe(0);
    expect(toolbar()!.scrollWidth).toBeLessThanOrEqual(
      toolbar()!.clientWidth + 1
    );
  });

  test('the room is the column, wherever in the line the selection is', async () => {
    await columnOf(960);

    await select(0, 12);
    const atTheStart = capOf();

    await select(60, 12);
    const inTheMiddle = capOf();

    await select(95, 12);
    const atTheEnd = capOf();

    // One column, one cap. Before, this number swung by hundreds of pixels
    // from one selection to the next and took the row's contents with it.
    expect(inTheMiddle).toBe(atTheStart);
    expect(atTheEnd).toBe(atTheStart);
    expect(atTheStart).toBeGreaterThan(900);
  });

  test('a column too short for the row spends entries, and never spills', async () => {
    await columnOf(1000);
    await select(0, 12);
    const whole = composition();

    // A column forty pixels too short for the row it has to hold. Something
    // has to give way — into the "⋮", the way it is meant to — and the row
    // must stay inside its own background while it does.
    await columnOf(tooShortBy(40));
    await select(0, 12);

    expect(composition()).not.toBe(whole);
    expect(lines()).toBe(1);
    expect(spill()).toBe(0);
  });

  test('a phone-width column keeps the row inside its background', async () => {
    // 420px: the width at which the row used to be told it had 75px of room
    // and painted its remaining icons over the document.
    await columnOf(420);
    await select(0, 12);

    expect(lines()).toBe(1);
    expect(spill()).toBe(0);

    // And inside the column, not hanging off one of its edges.
    const box = toolbar()!.getBoundingClientRect();
    const column = container.getBoundingClientRect();
    expect(box.left).toBeGreaterThanOrEqual(column.left - 1);
    expect(box.right).toBeLessThanOrEqual(column.right + 1);
  });

  test('the row stops clipping while one of its menus is open', async () => {
    await columnOf(1000);
    await select(0, 12);

    // Closed: clipped on the X axis, so a row that cannot give way any
    // further is cut at its own background instead of painted over the
    // document. And NOT on the Y axis, where the panels hang.
    const closed = getComputedStyle(toolbar()!);
    expect(closed.overflowX).toBe('clip');
    expect(closed.overflowY).toBe('visible');

    const menu = toolbar()!.querySelector<
      HTMLElement & { show(force?: boolean): void }
    >('editor-menu-button');
    if (!menu) throw new Error('the row has no dropdown to open');
    menu.show(true);
    await settle();

    // Open: not clipped at all. A clipping box is also what floating-ui fits
    // a panel into, and a panel wider than the row that opened it — or
    // centred on a trigger at one end of it — would otherwise be clamped
    // inside the row and cut off.
    expect(menu.dataset.open).toBe('true');
    expect(toolbar()!.dataset.menuOpen).toBe('true');
    expect(getComputedStyle(toolbar()!).overflowX).toBe('visible');
    expect(
      menu
        .shadowRoot!.querySelector('editor-menu-content')!
        .getBoundingClientRect().width
    ).toBeGreaterThan(0);
  });

  test('and the room comes back, and so does the row', async () => {
    await columnOf(1000);
    await select(0, 12);
    const whole = composition();

    await columnOf(tooShortBy(40));
    await select(0, 12);
    expect(composition()).not.toBe(whole);

    // Widened with the selection left exactly as it is: the collapse is
    // reversible, and nothing about it was written down anywhere.
    await columnOf(1000);

    expect(composition()).toBe(whole);
    expect(lines()).toBe(1);
  });
});
