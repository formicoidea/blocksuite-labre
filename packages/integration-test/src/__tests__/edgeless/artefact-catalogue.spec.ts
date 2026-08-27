import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import {
  ArtefactCatalogueProvider,
  COMMAND_USAGE_KEY,
} from '@labre/affine/shared/services';
import { TOUCH_TARGET_MIN_PX } from '@labre/affine/shared/consts';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * The artefact catalogue sidepanel (PF6), on a real editor.
 *
 * The unit suite owns the grouping and the wordings; this one owns what only a
 * mounted editor can answer — that the seam resolves to the library's own
 * panel, that the panel draws the registry rather than a list of its own, that
 * a row is big enough for a finger, that one tap creates the artefact and puts
 * the panel away, and that every way out (X, Escape, click-away) leaves the
 * armed tool exactly where it was.
 */

const PANEL = '[data-testid="artefact-catalogue-panel"]';
const GROUP = '[data-testid="artefact-catalogue-group"]';
const ENTRY = '[data-testid="artefact-catalogue-entry"]';
const CLOSE = '[data-testid="artefact-catalogue-close"]';

const CATALOGUE_WIDGET = 'edgeless-artefact-catalogue-widget';

describe('artefact catalogue sidepanel', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    return cleanup;
  });

  /** The seam the "More artefacts…" entry calls — never the widget directly. */
  const catalogue = () => edgeless.std.get(ArtefactCatalogueProvider);

  const widget = () => edgeless.widgetComponents[CATALOGUE_WIDGET];
  const widgetRoot = () => widget()?.shadowRoot ?? null;
  const panel = () => widgetRoot()?.querySelector<HTMLElement>(PANEL) ?? null;
  const entries = () =>
    Array.from(widgetRoot()?.querySelectorAll<HTMLElement>(ENTRY) ?? []);
  const groups = () =>
    Array.from(widgetRoot()?.querySelectorAll<HTMLElement>(GROUP) ?? []);

  const settle = async () => {
    await edgeless.updateComplete;
    await widget()?.updateComplete;
    await wait(0);
  };

  const open = async (owner: 'wardley' | 'bpmn' = 'wardley') => {
    catalogue().open(owner);
    await settle();
  };

  /** Native-shaped click: composed, so it crosses the widget's shadow boundary. */
  const clickElement = (element: Element) => {
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
  };

  const armedTool = () => edgeless.gfx.tool.currentToolName$.peek();

  test('the seam resolves to the library panel, and opening shows it', async () => {
    // `getOptional`, not `get`: this is the exact call the senior sub-menu's
    // "More artefacts…" entry makes to decide whether to render at all
    // (`EdgelessCommandMenu._renderCatalogueButton`). A library assembly where
    // it answered `undefined` would suppress the button silently, so the two
    // tranches meet here.
    expect(edgeless.std.getOptional(ArtefactCatalogueProvider)).toBeDefined();
    expect(panel()).toBeNull();

    await open();

    const opened = panel();
    expect(opened).not.toBeNull();
    expect(opened!.dataset.owner).toBe('wardley');
  });

  test('the panel draws the registry: groups, in the framework order', async () => {
    await open();

    // Wardley's three declared categories, in declaration order — the panel
    // never sorts the headers alphabetically (that would overrule the
    // framework's own reading of its toolbox).
    expect(groups().map(group => group.dataset.category)).toEqual([
      'backgrounds',
      'nodes',
      'connectors',
    ]);
    // Every catalogue command has a row, and every row an icon and a label.
    expect(entries()).toHaveLength(13);
    for (const entry of entries()) {
      expect(entry.dataset.commandId, entry.outerHTML).toBeTruthy();
      expect(entry.textContent?.trim(), entry.dataset.commandId).toBeTruthy();
    }
    // The chord a command ships with is spelled out beside its label.
    const component = entries().find(
      entry => entry.dataset.commandId === 'wardley.addComponent'
    );
    expect(component?.textContent).toContain('W C');
  });

  test('every row is at least a finger tall', async () => {
    await open();

    for (const entry of entries()) {
      const { minHeight } = getComputedStyle(entry);
      expect(minHeight, entry.dataset.commandId).toBe(
        `${TOUCH_TARGET_MIN_PX}px`
      );
      expect(
        entry.getBoundingClientRect().height,
        entry.dataset.commandId
      ).toBeGreaterThanOrEqual(TOUCH_TARGET_MIN_PX);
    }
  });

  test('a tap creates the artefact and the panel STAYS for the next one', async () => {
    await open();
    const before = armedTool();

    const row = entries().find(
      entry => entry.dataset.commandId === 'wardley.addComponent'
    );
    expect(row).toBeDefined();
    clickElement(row!);
    await settle();
    clickElement(row!);
    await settle();

    // Furnishing is several artefacts in a row (PO recette, 27/08/2026): the
    // first default — close on insert — turned that into open-click-reopen.
    expect(edgeless.surface.model.getElementsByType('wardleyNode').length).toBe(
      2
    );
    expect(panel()).not.toBeNull();
    expect(armedTool()).toBe(before);
  });

  test('the head section lists what was used, and only once something was', async () => {
    // A previous test in this FILE may have fed the store — the panel's whole
    // point is that the measure persists. Start this scenario from silence.
    localStorage.removeItem(COMMAND_USAGE_KEY);
    await open();
    expect(
      widgetRoot()?.querySelector('[data-testid="artefact-catalogue-ranked"]')
    ).toBeNull();

    const row = entries().find(
      entry => entry.dataset.commandId === 'wardley.addInertia'
    );
    expect(row).toBeDefined();
    clickElement(row!);
    await settle();
    catalogue().close();
    await open();

    const head = widgetRoot()?.querySelector<HTMLElement>(
      '[data-testid="artefact-catalogue-ranked"]'
    );
    expect(head).not.toBeNull();
    const headIds = Array.from(
      head!.querySelectorAll<HTMLElement>(ENTRY),
      entry => entry.dataset.commandId
    );
    expect(headIds).toEqual(['wardley.addInertia']);
    // The same row still sits in its category below — the head is a shortcut,
    // not a re-filing.
    expect(
      entries().filter(e => e.dataset.commandId === 'wardley.addInertia').length
    ).toBe(2);
  });

  test('a wheel over the panel never pans the board', async () => {
    await open();
    const { viewport } = edgeless.gfx;
    const centerBefore = [viewport.centerX, viewport.centerY];

    // Dispatched from INSIDE the panel, as a real wheel would compose: the
    // widget's capture listener on the host must stop it before the edgeless
    // dispatcher pans (same mechanism as the violation bubble, PR #103).
    panel()!.dispatchEvent(
      new WheelEvent('wheel', { deltaY: 240, bubbles: true, composed: true })
    );
    await settle();

    expect([viewport.centerX, viewport.centerY]).toEqual(centerBefore);
    expect(panel()).not.toBeNull();
  });

  test('the close button closes, and arms nothing', async () => {
    await open();
    const before = armedTool();

    const close = widgetRoot()?.querySelector<HTMLElement>(CLOSE);
    expect(close).not.toBeNull();
    clickElement(close!);
    await settle();

    expect(panel()).toBeNull();
    expect(armedTool()).toBe(before);
  });

  test('Escape closes — on the editor host, not on the document', async () => {
    await open();
    const before = armedTool();

    edgeless.std.host.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        composed: true,
        cancelable: true,
      })
    );
    await settle();

    expect(panel()).toBeNull();
    expect(armedTool()).toBe(before);
  });

  test('a pointer down outside closes; one inside does not', async () => {
    await open();
    const before = armedTool();

    // Inside first: a gesture on a row must not dismiss the panel under the
    // finger that is about to invoke it.
    clickElement(groups()[0]);
    await settle();
    expect(panel()).not.toBeNull();

    document.body.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        composed: true,
        pointerId: 1,
        isPrimary: true,
      })
    );
    await settle();

    expect(panel()).toBeNull();
    expect(armedTool()).toBe(before);
  });

  test('re-opening switches owner and starts the list at the top', async () => {
    await open('wardley');
    const body = widgetRoot()?.querySelector<HTMLElement>(
      '[data-testid="artefact-catalogue-body"]'
    );
    expect(body).not.toBeNull();
    body!.scrollTop = 40;

    catalogue().close();
    await settle();
    expect(panel()).toBeNull();

    await open('bpmn');
    expect(panel()!.dataset.owner).toBe('bpmn');
    expect(
      widgetRoot()?.querySelector<HTMLElement>(
        '[data-testid="artefact-catalogue-body"]'
      )?.scrollTop
    ).toBe(0);
  });
});
