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

  /**
   * A map on the STRICT profile.
   *
   * Since PF9 the default (`wardley.sketch`) demotes the pilot rule to `audit`,
   * which is invisible on the canvas by design — so the markers this suite is
   * about only exist on a map whose owner asked for them.
   */
  const addBackground = () =>
    service.surface.addElement({
      type: 'wardley',
      role: 'wardley:map',
      validationProfile: 'wardley.strict',
      xywh: '[0,0,1600,900]',
    });

  /** Group the given elements, exactly as the Wardley toolbox does. */
  const groupOf = (ids: string[]) => {
    const [, result] = service.std.command.exec(createGroupCommand, {
      elements: ids,
    });
    return result.groupId as string;
  };

  /**
   * A change arrow occupying `xywh`, pointing BACK towards genesis — one W1
   * finding, wherever it sits.
   *
   * Ported off the tracer bullet's "a component parked off the map" (PF13,
   * 01/08/2026): that rule is gone, and the fixture replacing it has the same
   * shape — one element, one finding, attributable to one map — behind a rule
   * a Wardley practitioner actually asked for. Nothing this suite pinned down
   * was dropped in the move; only what it draws changed.
   */
  const addBackwardsArrow = (xywh: string) => {
    const [x, y, w, h] = JSON.parse(xywh) as number[];
    return service.surface.addElement({
      type: 'connector',
      role: 'wardley:change-arrow',
      source: { position: [x + w, y + h / 2] },
      target: { position: [x, y + h / 2] },
    });
  };

  /** A component, drawn the way the Wardley toolbox draws one. */
  const addComponent = (xywh: string) =>
    service.surface.addElement({
      type: 'wardleyNode',
      kind: 'component',
      role: 'wardley:component',
      fillColor: '#ffffff',
      strokeColor: '#1f2328',
      filled: true,
      xywh,
    });

  /** The same arrow, the right way round: nothing to report. */
  const addForwardArrow = (xywh: string) => {
    const [x, y, w, h] = JSON.parse(xywh) as number[];
    return service.surface.addElement({
      type: 'connector',
      role: 'wardley:change-arrow',
      source: { position: [x, y + h / 2] },
      target: { position: [x + w, y + h / 2] },
    });
  };

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
        addBackwardsArrow('[3000,3000,40,40]');
        await settle();

        expect(validation.violations$.value).toHaveLength(1);
        // The bracket is on the canvas; what the DOM contributes while it is up
        // is its invisible hit band, and no badge at all.
        expect(bracketHits().length).toBeGreaterThan(0);
        expect(badges()).toHaveLength(0);
      });

      test('the badge takes over once the bracket is gone', async () => {
        addBackground();
        addBackwardsArrow('[3000,3000,40,40]');
        await settle();
        await age();

        expect(badges()).toHaveLength(1);
        expect(bracketHits()).toHaveLength(0);
      });

      test(
        'the handover happens on its own, without anything changing',
        async () => {
          addBackground();
          addBackwardsArrow('[3000,3000,40,40]');
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
        addBackwardsArrow('[3000,3000,40,40]');
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
        addBackwardsArrow('[3000,3000,40,40]');
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
        // Two ungrouped change arrows, 100 model units apart: one badge each.
        addBackwardsArrow('[3000,3000,40,40]');
        addBackwardsArrow('[3100,3000,40,40]');
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

    test('a component is badged clear of its top-right corner', async () => {
      addBackground();
      // Two components deep into each other: W3, and the one fixture whose
      // anchors are plain BOXES.
      const first = addComponent('[200,200,40,40]');
      addComponent('[220,200,40,40]');
      await settle();
      await age();

      const anchor = resolveViolationAnchors(
        validation.violations$.value,
        service.surface
      ).find(candidate => candidate.id === first)!;
      expect(anchor.kind).toBe('node');

      // Outside the corner by the mark's gap plus half a badge, so it does not
      // land under the selected-rect north-east resize handle.
      const offset = VIOLATION_MARK_PADDING + VIOLATION_BADGE_SIZE / 2;
      expect(anchor.markAt).toEqual([
        anchor.bound.maxX + offset,
        anchor.bound.y - offset,
      ]);

      const [x, y] = service.viewport.toViewCoord(...anchor.markAt);
      const badge = badges().find(
        candidate => (candidate as HTMLElement).dataset.anchorId === first
      ) as HTMLElement;
      expect(parseFloat(badge.style.left)).toBeCloseTo(x, 0);
      expect(parseFloat(badge.style.top)).toBeCloseTo(y, 0);
    });

    /**
     * The PO's second capture, 02/08: an amber dot at the top-right corner of a
     * diagonal link's bounding box — white paper, a long way from the trait it
     * was accusing. A link is marked where the link IS.
     */
    test('a link is badged in the middle of its trait', async () => {
      addBackground();
      // Deliberately diagonal, so the corner and the middle are nowhere near
      // each other and the assertion cannot pass by accident.
      const id = service.surface.addElement({
        type: 'connector',
        role: 'wardley:change-arrow',
        source: { position: [3400, 3400] },
        target: { position: [3000, 3000] },
      });
      await settle();
      await age();

      const [anchor] = resolveViolationAnchors(
        validation.violations$.value,
        service.surface
      );
      expect(anchor.id).toBe(id);
      expect(anchor.kind).toBe('edge');
      // The middle of the trait — which for this link is also where the
      // rectangle's diagonals cross.
      expect(anchor.markAt[0]).toBeCloseTo(3200, 0);
      expect(anchor.markAt[1]).toBeCloseTo(3200, 0);

      const [x, y] = service.viewport.toViewCoord(...anchor.markAt);
      const style = (badges()[0] as HTMLElement).style;
      expect(parseFloat(style.left)).toBeCloseTo(x, 0);
      expect(parseFloat(style.top)).toBeCloseTo(y, 0);

      // ...and emphatically not on the corner it used to sit on.
      const offset = VIOLATION_MARK_PADDING + VIOLATION_BADGE_SIZE / 2;
      const [cornerX] = service.viewport.toViewCoord(
        anchor.bound.maxX + offset,
        anchor.bound.y - offset
      );
      expect(parseFloat(style.left)).toBeLessThan(cornerX - 100);
    });

    test('a clean board raises no marker at all', async () => {
      addBackground();
      addForwardArrow('[200,200,40,40]');
      await settle();

      expect(badges()).toHaveLength(0);
      expect(bracketHits()).toHaveLength(0);
      expect(bubble()).toBeNull();
    });

    test('clicking the badge opens a bubble naming the rule', async () => {
      addBackground();
      addBackwardsArrow('[3000,3000,40,40]');
      await settle();
      await age();

      clickElement(badges()[0]);
      await settle();

      const open = bubble();
      expect(open).not.toBeNull();
      // No catalogue: the FRAMEWORK's own wording is shown (PF13), because the
      // rule ships one beside its key — the same `labelKey` + `fallback` pair a
      // profile and a background label already carry. The framework owns the
      // word; the library still never invents one.
      expect(open?.textContent).toContain(
        'This change arrow points against evolution.'
      );
      // The rule carries a remediation hint, so the bubble lists it too.
      expect(open?.textContent).toContain('Evolution runs left to right');
      // ...and the severity, as chrome, which the library may word itself.
      expect(open?.textContent?.toLowerCase()).toContain('warning');
    });

    test('clicking the bracket opens the same bubble', async () => {
      addBackground();
      addBackwardsArrow('[3000,3000,40,40]');
      await settle();
      // Still in the flash: no badge yet, but the mark is already clickable.
      expect(badges()).toHaveLength(0);

      clickElement(bracketHits()[0]);
      await settle();

      expect(bubble()?.textContent).toContain(
        'This change arrow points against evolution.'
      );
      expect(service.gfx.selection.selectedElements).toHaveLength(0);
    });

    test('clicking the badge does not select the element underneath', async () => {
      addBackground();
      addBackwardsArrow('[3000,3000,40,40]');
      await settle();
      await age();

      clickElement(badges()[0]);
      await settle();

      expect(service.gfx.selection.selectedElements).toHaveLength(0);
      expect(bubble()).not.toBeNull();
    });

    test('clicking elsewhere closes the bubble', async () => {
      addBackground();
      addBackwardsArrow('[3000,3000,40,40]');
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
      addBackwardsArrow('[3000,3000,40,40]');
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
      addBackwardsArrow('[3000,3000,40,40]');
      await settle();
      await age();

      clickElement(badges()[0]);
      await settle();
      expect(bubble()).not.toBeNull();

      clickElement(badges()[0]);
      await settle();
      expect(bubble()).toBeNull();
    });

    /**
     * PO recette, 02/08. Two halves of one report, both about a bubble the user
     * could not finish reading:
     *
     * - it opened UNDERNEATH the element toolbar;
     * - the wheel over it panned the BOARD, which closed it — and never
     *   scrolled it, because the edgeless wheel handler cancels the default
     *   action before panning.
     */
    describe('an open bubble owns the front of the board, and the wheel', () => {
      /** A bubble open on a violation, with the dispatcher live. */
      const openBubble = async () => {
        addBackground();
        addBackwardsArrow('[3000,3000,40,40]');
        await settle();
        await age();
        // The edgeless wheel handler hangs off the dispatcher, which ignores
        // everything while it believes the editor is unfocused.
        service.std.event.active = true;
        clickElement(badges()[0]);
        await settle();
        expect(bubble()).not.toBeNull();
      };

      const wheel = (target: EventTarget) => {
        const event = new WheelEvent('wheel', {
          deltaY: 240,
          bubbles: true,
          composed: true,
          cancelable: true,
        });
        target.dispatchEvent(event);
        return event;
      };

      const viewportState = () => {
        const { centerX, centerY, zoom } = service.viewport;
        return { centerX, centerY, zoom };
      };

      test('it is raised over the toolbars while it is open, and only then', async () => {
        await openBubble();

        const host = widget() as HTMLElement;
        // A z-index of its own makes the host a stacking context, so the bubble
        // can never climb out of it: the HOST is what has to come up.
        const raised = parseInt(getComputedStyle(host).zIndex, 10);
        expect(raised).toBeGreaterThan(100);

        clickElement(document.body);
        await settle();
        // Back down to the badge's own level, well below the toolbars.
        expect(getComputedStyle(host).zIndex).toBe('2');
      });

      test('the wheel over the bubble leaves the board exactly where it was', async () => {
        await openBubble();
        const before = viewportState();

        const event = wheel(bubble()!);
        await settle();

        // The board did not move, so the bubble was not closed by its own
        // `viewportUpdated` subscription...
        expect(viewportState()).toEqual(before);
        expect(bubble()).not.toBeNull();
        // ...and the default action survived, which is what scrolls the bubble.
        // (A synthetic wheel never scrolls anything itself: what is asserted
        // here is that nothing cancelled the scroll on its way past.)
        expect(event.defaultPrevented).toBe(false);
      });

      test('the wheel anywhere on the board is held while it is open', async () => {
        await openBubble();
        const before = viewportState();

        // The PO's call: the gesture belongs to the thing being read until it
        // is dismissed, wherever the pointer happens to be.
        wheel(service.std.host);
        await settle();

        expect(viewportState()).toEqual(before);
        expect(bubble()).not.toBeNull();
      });

      test('dismissing it hands the wheel back to the canvas', async () => {
        await openBubble();
        const before = viewportState();

        clickElement(document.body);
        await settle();
        expect(bubble()).toBeNull();

        wheel(service.std.host);
        await settle();

        // The board scrolls again: the guard is scoped to "a bubble is open",
        // not to the widget existing.
        expect(viewportState()).not.toEqual(before);
        await resetViewport();
      });
    });

    test('the bubble flips above the badge rather than off the bottom', async () => {
      addBackground();
      addBackwardsArrow('[3000,3000,40,40]');
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
      const id = addBackwardsArrow('[3000,3000,40,40]');
      await settle();
      await age();
      clickElement(badges()[0]);
      await settle();
      expect(bubble()).not.toBeNull();

      // Turned round: now pointing towards commodity.
      service.surface.updateElement(id, {
        source: { position: [3000, 3020] },
        target: { position: [3040, 3020] },
      });
      await settle();

      expect(validation.violations$.value).toEqual([]);
      expect(badges()).toHaveLength(0);
      expect(bracketHits()).toHaveLength(0);
      expect(bubble()).toBeNull();

      // ...and it stays closed: breaking the same element again must not
      // resurrect the bubble on its own.
      service.surface.updateElement(id, {
        source: { position: [3040, 3020] },
        target: { position: [3000, 3020] },
      });
      await settle();
      await age();

      expect(badges()).toHaveLength(1);
      expect(bubble()).toBeNull();
    });

    test('two violating members of one group share one marker and one line', async () => {
      addBackground();
      const a = addBackwardsArrow('[3000,3000,40,40]');
      const b = addBackwardsArrow('[3100,3000,40,40]');
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
      const nodeId = addBackwardsArrow('[3000,3000,40,40]');
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
            key === 'com.labre.wardley.validation.change-arrow-against-evolution'
              ? 'Cette flèche remonte le sens de l’évolution'
              : undefined,
        }),
      ])
    );

    test('the bubble shows the resolved label, and falls back per key', async () => {
      addBackground();
      addBackwardsArrow('[3000,3000,40,40]');
      await settle();
      await age();

      clickElement(badges()[0]);
      await settle();

      const text = bubble()?.textContent ?? '';
      // The HOST's wording wins over the framework's own, key by key.
      expect(text).toContain('Cette flèche remonte le sens de l’évolution');
      expect(text).not.toContain(
        'This change arrow points against evolution.'
      );
      // The catalogue does not know the SUGGESTION key, so that line falls
      // back to the framework's own wording — and never to a raw dotted key,
      // because this rule ships one.
      expect(text).toContain('Evolution runs left to right');
      expect(text).not.toContain('com.labre.wardley.validation.');
    });
  });
});
