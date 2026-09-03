import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import {
  ArtefactCatalogueProvider,
  COMMAND_USAGE_KEY,
} from '@labre/affine/shared/services';
import { TOUCH_TARGET_MIN_PX } from '@labre/affine/shared/consts';
import { CATALOGUE_HEAD_RANKED_SLOTS } from '@labre/affine/std';
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
    // The usage store persists across spec FILES sharing this browser page —
    // any earlier spec that ran a wardley command would summon the "Recent &
    // frequent" head section here and its duplicated rows would shift every
    // count below. Each scenario starts from silence and feeds the store
    // itself when usage is its subject.
    localStorage.removeItem(COMMAND_USAGE_KEY);
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

    // Wardley's four declared categories, in declaration order — the panel
    // never sorts the headers alphabetically (that would overrule the
    // framework's own reading of its toolbox). `interchange` is last and last
    // on purpose: the two directions of the OWM DSL are what you do WITH a map,
    // after the three sections of what you draw one with.
    expect(groups().map(group => group.dataset.category)).toEqual([
      'backgrounds',
      'nodes',
      'connectors',
      'interchange',
    ]);
    // Sixteen of Wardley's seventeen catalogue commands, and the seventeenth is
    // absent for a reason the panel is supposed to have: it filters on
    // `isCommandAvailable` AND on `when`, and `wardley.exportOwm` needs a
    // Wardley map on the board to have a plot to measure coordinates against.
    // This board has none, so there is nothing to export and no row offering to.
    //
    // Both IMPORTS are here, and that is the tier distinction made visible:
    // neither needs anything on the board, so both render — the native OWM
    // route and the visual-tier SVG fallback beside it, each labelled with what
    // it promises (`docs/adr/0012`, P2).
    expect(entries()).toHaveLength(16);
    const shown = entries().map(entry => entry.dataset.commandId);
    expect(shown).toContain('wardley.importOwm');
    expect(shown).toContain('wardley.importSvg');
    expect(shown).not.toContain('wardley.exportOwm');
    // Every row has an icon and a label.
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

  /**
   * The head section's SIZE, sensed on the rendered panel — the test above uses
   * one used command and would pass at a cap of 7, of 13 or of 200.
   *
   * Seven rows, not the sub-menu's fourteen (architect's ruling of
   * 2026-08-28): the two surfaces share the arbitration and not the magnitude,
   * because at `TOUCH_TARGET_MIN_PX` a row fourteen of them would fill the
   * first screen of a 320px panel with duplicates and push every category under
   * the fold. Every wardley command is fed a measure here, so what bounds the
   * section is the slot count and nothing else.
   */
  test('the head section stops at seven rows however much was used', async () => {
    await open();
    const all = entries().map(entry => entry.dataset.commandId!);
    expect(all.length).toBeGreaterThan(CATALOGUE_HEAD_RANKED_SLOTS);

    // Every command measured: descending counts, ascending timestamps, so the
    // two axes disagree and the seven seats are genuinely contested.
    localStorage.setItem(
      COMMAND_USAGE_KEY,
      JSON.stringify(
        Object.fromEntries(
          all.map((id, index) => [id, { c: all.length - index, t: index }])
        )
      )
    );
    catalogue().close();
    await open();

    const head = widgetRoot()?.querySelector<HTMLElement>(
      '[data-testid="artefact-catalogue-ranked"]'
    );
    expect(head).not.toBeNull();
    const headIds = Array.from(
      head!.querySelectorAll<HTMLElement>(ENTRY),
      entry => entry.dataset.commandId!
    );
    expect(headIds).toHaveLength(CATALOGUE_HEAD_RANKED_SLOTS);
    // Four by recency (the latest timestamps are the LAST commands) and three
    // by frequency (the heaviest counts are the first) — both halves of a
    // section labelled "Recent & frequent", not seven of one.
    expect(headIds.slice(0, 4)).toEqual(all.slice(-4).reverse());
    expect(headIds.slice(4)).toEqual(all.slice(0, 3));
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
