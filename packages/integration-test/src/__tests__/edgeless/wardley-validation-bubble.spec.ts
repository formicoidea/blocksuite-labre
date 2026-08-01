import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import {
  resolveViolationAnchors,
  ValidationManager,
  VIOLATION_BADGE_SIZE,
  VIOLATION_DETAIL_WIDGET,
  VIOLATION_EMPHASIS_MS,
  VIOLATION_MARK_PADDING,
} from '@labre/affine/blocks/surface';
import { createGroupCommand, ungroupCommand } from '@labre/affine/gfx/group';
import type { GroupElementModel } from '@labre/affine/model';
import { TranslationExtension } from '@labre/affine/shared/services';
import type { ExtensionType } from '@labre/store';
import { Text } from '@labre/store';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * PF7 restitution: the flash, the badge that replaces it, and the bubble both
 * of them open.
 *
 * The unit suite owns the ephemeral → persistent state machine (it takes
 * timestamps, so it needs no browser). This suite owns what only a real editor
 * can answer: that the two markers hand over instead of overlapping, that they
 * scale with the board, that clicking either names the rule instead of
 * selecting the shape underneath, and that correcting the drawing takes
 * everything away.
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

const setup = (extensions: ExtensionType[] = []) =>
  setupEditor('edgeless', extensions);

/**
 * `EditPropsStore` persists the edgeless viewport under a key derived from the
 * DOC id — and every spec in this suite builds the same `doc:home`. The browser
 * suite runs with `isolate: false`, so a zoom or a pan left behind here is
 * restored by the NEXT spec file's editor, which then renders a canvas nobody
 * asked for. This spec is the first one to move the viewport at all, so it is
 * the first that has to clean up after itself.
 */
const VIEWPORT_STORAGE_KEY = 'blocksuite:doc:home:edgelessViewport';

function forgetStoredViewport() {
  localStorage.removeItem(VIEWPORT_STORAGE_KEY);
  sessionStorage.removeItem(VIEWPORT_STORAGE_KEY);
}

describe('the violation markers and their detail bubble', () => {
  let service!: EdgelessRootBlockComponent['service'];
  let root!: EdgelessRootBlockComponent;
  let validation!: ValidationManager;

  const addBackground = () =>
    service.surface.addElement({
      type: 'wardley',
      role: 'wardley:map',
      xywh: '[0,0,1600,900]',
    });

  /** Group the given elements, exactly as the Wardley toolbox does. */
  const groupOf = (ids: string[]) => {
    const [, result] = service.std.command.exec(createGroupCommand, {
      elements: ids,
    });
    return result.groupId as string;
  };

  const addComponent = (xywh: string) =>
    service.surface.addElement({
      type: 'wardleyNode',
      kind: 'component',
      role: 'wardley:component',
      xywh,
    });

  const widget = () => root.widgetComponents[VIOLATION_DETAIL_WIDGET];

  /** The widget's shadow root — where markers and bubbles live. */
  const widgetRoot = () => widget()?.shadowRoot ?? null;

  const queryAll = (selector: string) =>
    Array.from(widgetRoot()?.querySelectorAll(selector) ?? []);

  const badges = () => queryAll('[data-testid="violation-badge"]');
  const badgeDots = () => queryAll('[data-testid="violation-badge-dot"]');
  const bracketHits = () => queryAll('[data-testid="violation-bracket-hit"]');
  const bubble = () =>
    widgetRoot()?.querySelector('[data-testid="violation-bubble"]') ?? null;

  /** Past the manager's 120 ms debounce, then past lit's render. */
  const settle = async () => {
    await wait(250);
    await root.updateComplete;
    await widget()?.updateComplete;
    await wait(0);
  };

  /**
   * Age every mark past its window, so the bracket is done and the badge is
   * due — without waiting the real 3.6 s in every single test.
   *
   * This is not a back door: `ViolationTimeline` takes `now` explicitly for
   * exactly this reason. One test below does wait for the real handover.
   */
  const age = async () => {
    const shown = validation.violations$.value.filter(
      violation => violation.severity !== 'audit'
    );
    validation.timeline.clear();
    validation.timeline.sync(shown, performance.now() - VIOLATION_EMPHASIS_MS - 1);
    widget()?.requestUpdate();
    await settle();
  };

  /** Put the viewport back where it was found, before it can be persisted. */
  const resetViewport = async () => {
    service.viewport.setZoom(1);
    service.viewport.setCenter(0, 0);
    await settle();
  };

  const mount = async (extensions?: ExtensionType[]) => {
    forgetStoredViewport();
    const cleanup = await setup(extensions);
    root = getDocRootBlock(window.doc, window.editor, 'edgeless');
    service = root.service;
    validation = service.std.get(ValidationManager);
    return cleanup;
  };

  afterEach(() => forgetStoredViewport());

  describe('with no catalogue registered', () => {
    beforeEach(async () => mount());

    describe('the two markers hand over, and never overlap', () => {
      test('a fresh violation shows the bracket and no badge', async () => {
        addBackground();
        addComponent('[3000,3000,40,40]');
        await settle();

        expect(validation.violations$.value).toHaveLength(1);
        // The bracket is on the canvas; what the DOM contributes while it is up
        // is its invisible hit band, and no badge at all.
        expect(bracketHits().length).toBeGreaterThan(0);
        expect(badges()).toHaveLength(0);
      });

      test('the badge takes over once the bracket is gone', async () => {
        addBackground();
        addComponent('[3000,3000,40,40]');
        await settle();
        await age();

        expect(badges()).toHaveLength(1);
        expect(bracketHits()).toHaveLength(0);
      });

      test(
        'the handover happens on its own, without anything changing',
        async () => {
          addBackground();
          addComponent('[3000,3000,40,40]');
          await settle();
          expect(badges()).toHaveLength(0);

          // No edit, no pan: only time passes. The widget has to wake itself.
          await wait(VIOLATION_EMPHASIS_MS + 400);
          await widget()?.updateComplete;

          expect(badges()).toHaveLength(1);
          expect(bracketHits()).toHaveLength(0);
        },
        VIOLATION_EMPHASIS_MS + 15_000
      );
    });

    describe('the markers are sized in model space', () => {
      test('the badge halves when the board is zoomed out by half', async () => {
        addBackground();
        addComponent('[3000,3000,40,40]');
        await settle();
        await age();

        service.viewport.setZoom(1);
        await settle();
        const atOne = (badgeDots()[0] as HTMLElement).style.width;

        service.viewport.setZoom(0.25);
        await settle();
        const atQuarter = (badgeDots()[0] as HTMLElement).style.width;

        expect(parseFloat(atOne)).toBeCloseTo(VIOLATION_BADGE_SIZE, 1);
        // Proportional to the zoom — the whole point of the PO's dimensioning
        // case: affordances must not grow relative to the map they annotate.
        expect(parseFloat(atQuarter)).toBeCloseTo(VIOLATION_BADGE_SIZE / 4, 1);

        await resetViewport();
      });

      test('the click target keeps a screen-pixel floor at any zoom', async () => {
        addBackground();
        addComponent('[3000,3000,40,40]');
        await settle();
        await age();

        service.viewport.setZoom(0.25);
        await settle();

        const badge = badges()[0] as HTMLElement;
        // Visual shrinks, target does not: still reachable by thumb.
        expect(parseFloat((badgeDots()[0] as HTMLElement).style.width)).toBeLessThan(
          24
        );
        expect(parseFloat(badge.style.width)).toBeGreaterThanOrEqual(44);
        expect(parseFloat(badge.style.height)).toBeGreaterThanOrEqual(44);

        await resetViewport();
      });

      test('two badges 60 units apart never overlap, at any zoom', async () => {
        addBackground();
        // Two ungrouped components, 60 model units apart: one badge each.
        addComponent('[3000,3000,40,40]');
        addComponent('[3100,3000,40,40]');
        await settle();
        await age();
        expect(badges()).toHaveLength(2);

        for (const zoom of [0.1, 0.25, 0.5, 1, 2]) {
          service.viewport.setZoom(zoom);
          await settle();

          const dots = badgeDots().map(dot => {
            const badge = dot.parentElement as HTMLElement;
            return {
              x: parseFloat(badge.style.left),
              size: parseFloat((dot as HTMLElement).style.width),
            };
          });
          const gap = Math.abs(dots[0].x - dots[1].x);
          // Both dots are centred on their anchor: they are clear of each
          // other as soon as the gap exceeds one diameter. In model space the
          // gap and the diameter scale together, so this holds at every zoom.
          expect(gap).toBeGreaterThan(dots[0].size);
        }

        await resetViewport();
      });
    });

    test('the badge is anchored clear of the anchor corner', async () => {
      addBackground();
      const id = addComponent('[3000,3000,40,40]');
      await settle();
      await age();

      const [anchor] = resolveViolationAnchors(
        validation.violations$.value,
        service.surface
      );
      expect(anchor.id).toBe(id);

      // Outside the corner by the mark's gap plus half a badge, so it does not
      // land under the selected-rect north-east resize handle.
      const offset = VIOLATION_MARK_PADDING + VIOLATION_BADGE_SIZE / 2;
      const [x, y] = service.viewport.toViewCoord(
        anchor.bound.maxX + offset,
        anchor.bound.y - offset
      );
      const style = (badges()[0] as HTMLElement).style;
      expect(parseFloat(style.left)).toBeCloseTo(x, 0);
      expect(parseFloat(style.top)).toBeCloseTo(y, 0);
    });

    test('a clean board raises no marker at all', async () => {
      addBackground();
      addComponent('[200,200,40,40]');
      await settle();

      expect(badges()).toHaveLength(0);
      expect(bracketHits()).toHaveLength(0);
      expect(bubble()).toBeNull();
    });

    test('clicking the badge opens a bubble naming the rule', async () => {
      addBackground();
      addComponent('[3000,3000,40,40]');
      await settle();
      await age();

      clickElement(badges()[0]);
      await settle();

      const open = bubble();
      expect(open).not.toBeNull();
      // No catalogue: the raw key is shown rather than wording the library
      // invented for somebody else's rule.
      expect(open?.textContent).toContain(
        'com.labre.wardley.validation.component-outside-map'
      );
      // The rule carries a remediation hint, so the bubble lists it too.
      expect(open?.textContent).toContain(
        'com.labre.wardley.validation.component-outside-map.suggestion'
      );
      // ...and the severity, as chrome, which the library may word itself.
      expect(open?.textContent?.toLowerCase()).toContain('warning');
    });

    test('clicking the bracket opens the same bubble', async () => {
      addBackground();
      addComponent('[3000,3000,40,40]');
      await settle();
      // Still in the flash: no badge yet, but the mark is already clickable.
      expect(badges()).toHaveLength(0);

      clickElement(bracketHits()[0]);
      await settle();

      expect(bubble()?.textContent).toContain(
        'com.labre.wardley.validation.component-outside-map'
      );
      expect(service.gfx.selection.selectedElements).toHaveLength(0);
    });

    test('clicking the badge does not select the element underneath', async () => {
      addBackground();
      addComponent('[3000,3000,40,40]');
      await settle();
      await age();

      clickElement(badges()[0]);
      await settle();

      expect(service.gfx.selection.selectedElements).toHaveLength(0);
      expect(bubble()).not.toBeNull();
    });

    test('clicking elsewhere closes the bubble', async () => {
      addBackground();
      addComponent('[3000,3000,40,40]');
      await settle();
      await age();
      clickElement(badges()[0]);
      await settle();
      expect(bubble()).not.toBeNull();

      clickElement(document.body);
      await settle();

      expect(bubble()).toBeNull();
      // The badge itself stays: the violation has not gone anywhere.
      expect(badges()).toHaveLength(1);
    });

    test('escape closes the bubble, scoped to the editor host', async () => {
      addBackground();
      addComponent('[3000,3000,40,40]');
      await settle();
      await age();
      clickElement(badges()[0]);
      await settle();
      expect(bubble()).not.toBeNull();

      // Outside the editor, the library takes nothing: the page keeps Escape.
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          composed: true,
        })
      );
      await settle();
      expect(bubble()).not.toBeNull();

      service.std.host.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          composed: true,
        })
      );
      await settle();
      expect(bubble()).toBeNull();
    });

    test('clicking the badge again closes the bubble', async () => {
      addBackground();
      addComponent('[3000,3000,40,40]');
      await settle();
      await age();

      clickElement(badges()[0]);
      await settle();
      expect(bubble()).not.toBeNull();

      clickElement(badges()[0]);
      await settle();
      expect(bubble()).toBeNull();
    });

    test('the bubble flips above the badge rather than off the bottom', async () => {
      addBackground();
      addComponent('[3000,3000,40,40]');
      await settle();

      // Pan so the (still off-map) anchor sits near the bottom edge. Moving
      // the ELEMENT there instead would drop it back on the map and clear the
      // violation we are trying to look at.
      const { viewport } = service;
      const { height, zoom } = viewport;
      viewport.setCenter(3000, 3000 + height / (2 * zoom) - (height - 30) / zoom);
      await settle();
      await age();

      clickElement(badges()[0]);
      await settle();

      const open = bubble() as HTMLElement;
      expect(open).not.toBeNull();
      expect(open.dataset.flipY).toBe('true');
      // Pinned by its bottom edge, so no amount of content hangs off the
      // bottom of the EDITOR viewport — the space the widget is laid out in,
      // which in this fixture is taller than the browser window.
      expect(open.style.transform).toContain('translateY(-100%)');
      expect(open.getBoundingClientRect().bottom).toBeLessThanOrEqual(
        viewport.top + viewport.height + 1
      );

      await resetViewport();
    });

    test('correcting the drawing takes marker and bubble away', async () => {
      addBackground();
      const id = addComponent('[3000,3000,40,40]');
      await settle();
      await age();
      clickElement(badges()[0]);
      await settle();
      expect(bubble()).not.toBeNull();

      // Back on the map.
      service.surface.updateElement(id, { xywh: '[200,200,40,40]' });
      await settle();

      expect(validation.violations$.value).toEqual([]);
      expect(badges()).toHaveLength(0);
      expect(bracketHits()).toHaveLength(0);
      expect(bubble()).toBeNull();

      // ...and it stays closed: breaking the same element again must not
      // resurrect the bubble on its own.
      service.surface.updateElement(id, { xywh: '[3000,3000,40,40]' });
      await settle();
      await age();

      expect(badges()).toHaveLength(1);
      expect(bubble()).toBeNull();
    });

    test('two violating members of one group share one marker and one line', async () => {
      addBackground();
      const a = addComponent('[3000,3000,40,40]');
      const b = addComponent('[3100,3000,40,40]');
      groupOf([a, b]);
      await settle();
      await age();

      // Two violations — the engine still indicts each element separately —
      // but one badge, and one line: the bubble speaks about RULES, and the
      // same rule said twice says nothing extra.
      expect(validation.violations$.value).toHaveLength(2);
      expect(badges()).toHaveLength(1);

      clickElement(badges()[0]);
      await settle();

      expect(bubble()?.querySelectorAll('.violation-entry')).toHaveLength(1);
    });

    test('a group that is dissolved hands its badge back to the element', async () => {
      addBackground();
      const nodeId = addComponent('[3000,3000,40,40]');
      const labelId = service.surface.addElement({
        type: 'text',
        xywh: '[3050,3000,120,24]',
        text: new Text('Payments'),
      });
      const groupId = groupOf([nodeId, labelId]);
      await settle();
      await age();

      const grouped = (badges()[0] as HTMLElement).style.left;
      service.std.command.exec(ungroupCommand, {
        group: service.surface.getElementById(groupId) as GroupElementModel,
      });
      await settle();
      await age();

      expect(badges()).toHaveLength(1);
      // The anchor shrank back to the bare node, so the badge moved left.
      expect(parseFloat((badges()[0] as HTMLElement).style.left)).toBeLessThan(
        parseFloat(grouped)
      );
    });
  });

  describe('with a catalogue registered by the host', () => {
    beforeEach(async () =>
      mount([
        TranslationExtension({
          t: key =>
            key === 'com.labre.wardley.validation.component-outside-map'
              ? 'This component sits outside the map'
              : undefined,
        }),
      ])
    );

    test('the bubble shows the resolved label, and falls back per key', async () => {
      addBackground();
      addComponent('[3000,3000,40,40]');
      await settle();
      await age();

      clickElement(badges()[0]);
      await settle();

      const text = bubble()?.textContent ?? '';
      expect(text).toContain('This component sits outside the map');
      // The message key itself is gone from the bubble; the only occurrence
      // left is the SUGGESTION key, which the catalogue does not know.
      expect(
        text.split('com.labre.wardley.validation.component-outside-map').length
      ).toBe(2);
      expect(text).toContain(
        'com.labre.wardley.validation.component-outside-map.suggestion'
      );
    });
  });
});
