import { FrameTool } from '@labre/affine/blocks/frame';
import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import {
  EDGELESS_TOOLBAR_WIDGET,
  type EdgelessToolbarWidget,
} from '@labre/affine/widgets/edgeless-toolbar';
import { page } from '@vitest/browser/context';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { deepQueryAll } from '../utils/deep-query.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * #679, design audit of 2026-11-18 (P1-7): no button of the canvas toolbar had
 * an accessible name or exposed its state — select, frame, connector, undo,
 * layers, pen, eraser, every framework: `role="button"` and nothing else. And
 * after paging the senior row, the arrow went on showing the tooltip of the
 * tool it had just brought in (« Cynefin / Estuarine »).
 *
 * Read on the real toolbar at the suite's 1024px, where the senior row is
 * paged: every page is turned, so every senior tool the registry holds is
 * read. The keyboard model is `edgeless-toolbar-keyboard.spec.ts`.
 */

/** What a tooltip shows: its text, or the wording beside a shortcut. */
function tooltipWording(button: HTMLElement): string | null {
  const tooltip = button.shadowRoot?.querySelector('affine-tooltip');
  if (!tooltip) return null;
  const withShortcut = tooltip.querySelector(
    'affine-tooltip-content-with-shortcut'
  );
  if (withShortcut) return withShortcut.getAttribute('data-tip');
  return tooltip.textContent?.trim() || null;
}

/** The tooltip popups on screen, by what they say. */
const shownTooltips = () =>
  deepQueryAll(document.body, '[role="tooltip"]').map(
    tooltip => tooltip.textContent?.trim() ?? ''
  );

describe('edgeless toolbar: names, state and the pager tooltip', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    await wait();
    return cleanup;
  });

  const toolbar = () =>
    edgeless.widgetComponents[
      EDGELESS_TOOLBAR_WIDGET
    ] as unknown as EdgelessToolbarWidget;

  const seniorCount = () => {
    const bar = toolbar();
    return (bar as unknown as { _seniorTools: unknown[] })._seniorTools.length;
  };

  /** The buttons drawn by the row's items, each keyed by the tool it is. */
  const rowButtons = () =>
    Array.from(
      toolbar().shadowRoot!.querySelectorAll<HTMLElement>(
        '.quick-tool-item, .senior-tool-item'
      )
    ).flatMap((item, index) =>
      deepQueryAll(item, '[role="button"]').map((button, nth) => ({
        key: `${item.dataset.seniorIndex ?? `quick-${index}`}#${nth}`,
        button,
      }))
    );

  /**
   * Turn every page of the senior row and read each tool as it is drawn —
   * then, not at the end: Lit draws the next page into the same elements, so
   * one element is a different tool on every page.
   */
  const readWholeRow = async () => {
    const bar = toolbar();
    const seen = new Map<
      string,
      { name: string | null; tooltip: string | null }
    >();
    const last = Math.max(0, seniorCount() - bar.scrollSeniorToolSize);
    for (let scroll = 0; scroll <= last; scroll++) {
      bar.scrollSeniorToolIndex = scroll;
      await bar.updateComplete;
      await wait(20);
      rowButtons().forEach(({ key, button }) =>
        seen.set(key, {
          name: button.getAttribute('aria-label'),
          tooltip: tooltipWording(button),
        })
      );
    }
    bar.scrollSeniorToolIndex = 0;
    await bar.updateComplete;
    return seen;
  };

  test('every button of the row is named, and no two alike', async () => {
    const seen = await readWholeRow();
    // Every senior tool is drawn at least once (the pen and eraser share one).
    expect(seen.size).toBeGreaterThan(seniorCount());
    const names = Array.from(seen.values(), ({ name }) => name);
    const unnamed = Array.from(seen.keys()).filter((_, i) => !names[i]);
    expect(unnamed, 'buttons without a name').toEqual([]);
    expect(new Set(names).size, names.join(' | ')).toBe(names.length);
  });

  test('a tool is named with the wording of its tooltip', async () => {
    const seen = await readWholeRow();
    const mismatched = Array.from(seen.values()).filter(
      ({ name, tooltip }) => tooltip !== null && tooltip !== name
    );
    expect(mismatched).toEqual([]);
  });

  test('a framework button is named after the framework', async () => {
    await readWholeRow();
    const bar = toolbar();
    bar.scrollSeniorToolIndex = 0;
    await bar.updateComplete;
    // Page until the Wardley button is drawn, then ask the browser's own
    // accessibility tree for it by name.
    const find = () =>
      bar.shadowRoot!.querySelector('edgeless-wardley-senior-button');
    for (let scroll = 0; scroll < 32 && !find(); scroll++) {
      bar.scrollSeniorToolIndex = scroll;
      await bar.updateComplete;
    }
    await wait(20);
    const wardley = find()!.shadowRoot!.querySelector(
      'edgeless-toolbar-button'
    );
    const byName = page
      .getByRole('button', { name: 'Wardley map', exact: true })
      .elements();
    expect(byName).toContain(wardley);
  });

  test('the pager arrows and "more tools" are named by what they do', () => {
    const named = (selector: string) =>
      toolbar().shadowRoot!.querySelector(selector)?.getAttribute('aria-label');
    expect(named('.senior-nav-button-wrapper.prev icon-button')).toBe(
      'Previous tools'
    );
    expect(named('.senior-nav-button-wrapper.next icon-button')).toBe(
      'Next tools'
    );
    expect(named('.quick-tool-more-button')).toBe('More Tools');
  });

  test('the active tool says it is pressed; an action says nothing', async () => {
    const select = rowButtons().find(({ button }) =>
      button.classList.contains('edgeless-default-button')
    )!.button;
    const undo = rowButtons().find(({ button }) =>
      button.classList.contains('edgeless-undo-tool-button')
    )!.button;
    expect(select.getAttribute('aria-pressed')).toBe('true');
    expect(undo.hasAttribute('aria-pressed')).toBe(false);

    edgeless.gfx.tool.setTool(FrameTool);
    await toolbar().updateComplete;
    await wait(20);
    const frame = rowButtons().find(({ button }) =>
      button.classList.contains('edgeless-frame-button')
    )!.button;
    expect(frame.getAttribute('aria-pressed')).toBe('true');
    expect(select.getAttribute('aria-pressed')).toBe('false');
  });

  test('after paging, the arrow keeps no tooltip of the tool it brought in', async () => {
    const bar = toolbar();
    bar.scrollSeniorToolIndex = 0;
    await bar.updateComplete;
    await wait(20);
    // Two pages at least, so the arrow still has a tool to announce after one.
    expect(seniorCount()).toBeGreaterThan(2 * bar.scrollSeniorToolSize);
    const arrow = bar.shadowRoot!.querySelector<HTMLElement>(
      '.senior-nav-button-wrapper.next icon-button'
    )!;
    const announced = arrow
      .querySelector('affine-tooltip')!
      .textContent!.trim();

    // The pointer comes onto the arrow — the tooltip listens for exactly this
    // — and stays there while it clicks, as a user's does.
    arrow.dispatchEvent(new MouseEvent('mouseenter'));
    await wait(150);
    expect(shownTooltips()).toContain(announced);

    arrow.click();
    await bar.updateComplete;
    await wait(300);

    expect(bar.scrollSeniorToolIndex).toBeGreaterThan(0);
    expect(shownTooltips()).not.toContain(announced);
    arrow.dispatchEvent(new MouseEvent('mouseleave'));
  });
});
