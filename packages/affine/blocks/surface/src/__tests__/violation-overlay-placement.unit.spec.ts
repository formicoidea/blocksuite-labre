import { Bound } from '@labre/global/gfx';
import { render } from 'lit';
import { describe, expect, it } from 'vitest';

import type { Violation, ViolationAnchor } from '../extensions/validation.js';
import { ViolationDetailWidget } from '../extensions/violation-detail-widget.js';

/**
 * PF7's badge, bracket band and bubble are DOM drawn into the widgets
 * container, which an embedding host may have CSS-scaled (`viewScale`, upstream
 * #14074 / #14862). Everything in there states its placement the way
 * `GfxBlockComponent.getCSSTransform` does — in the container's already scaled
 * space — so `viewport.toViewCoord`, which answers in real screen pixels, would
 * have the container scale the marks a second time and walk them off the
 * elements they accuse.
 *
 * The invariant these tests are really about: at `viewScale === 1` — the whole
 * standalone editor — not one number moves.
 */
type Viewport = {
  viewportX: number;
  viewportY: number;
  zoom: number;
  viewScale: number;
  width: number;
  height: number;
};

function anchorAt(markAt: [number, number], bound: Bound): ViolationAnchor {
  return { id: 'anchor-1', bound, kind: 'node', markAt, violations: [] };
}

/**
 * Enough of the widget for the three placement methods to run: the real
 * prototype, so `_badgeAt` is the one under test, and own properties for the
 * state and the neighbouring renderers a placement does not depend on.
 */
function stubWidget(viewport: Viewport, estimatedBubbleHeight = 100) {
  // `gfx` and the reactive state are accessors on the prototype, so the stand
  // ins have to be DEFINED over them rather than assigned.
  const values: Record<string, unknown> = {
    gfx: { viewport },
    std: { getOptional: () => undefined },
    _openAnchorId: null,
    _swallow: () => {},
    _toggle: () => () => {},
    _open: () => () => {},
    _estimateBubbleHeight: () => estimatedBubbleHeight,
    _renderEntry: () => null,
  };
  const stub = Object.create(ViolationDetailWidget.prototype) as object;
  for (const [key, value] of Object.entries(values)) {
    Object.defineProperty(stub, key, { value, writable: true });
  }
  return stub;
}

function renderMethod(
  name: '_renderBadge' | '_renderBracketHit' | '_renderBubble',
  stub: ReturnType<typeof stubWidget>,
  ...args: unknown[]
): HTMLElement {
  const container = document.createElement('div');
  const method = (
    ViolationDetailWidget.prototype as unknown as Record<
      string,
      (this: unknown, ...rest: unknown[]) => unknown
    >
  )[name];
  render(method.apply(stub, args) as never, container);
  return container;
}

function badgeStyle(viewport: Viewport, anchor: ViolationAnchor) {
  const badge = renderMethod(
    '_renderBadge',
    stubWidget(viewport),
    anchor,
    'label'
  ).querySelector<HTMLElement>('.violation-badge');
  const dot = badge?.querySelector<HTMLElement>('.violation-badge-dot');
  return {
    left: badge?.style.left,
    top: badge?.style.top,
    dotWidth: dot?.style.width,
  };
}

const unscaled: Viewport = {
  viewportX: 100,
  viewportY: 50,
  zoom: 2,
  viewScale: 1,
  width: 800,
  height: 600,
};

describe('the PF7 marks in a scaled host', () => {
  describe('the badge', () => {
    it('sits on its anchor when the host applies no scale', () => {
      // (150 - 100) * 2 = 100, (100 - 50) * 2 = 100; dot 16 model units * 2.
      expect(
        badgeStyle(unscaled, anchorAt([150, 100], new Bound(0, 0, 1, 1)))
      ).toEqual({ left: '100px', top: '100px', dotWidth: '32px' });
    });

    it('states its placement in the space the host scales, not in screen pixels', () => {
      // The same anchor, in a host that blows the editor up four times: the
      // container multiplies whatever is written here by 4, so the badge has to
      // ask for a quarter of the screen figure to land in the same place.
      const scaled = { ...unscaled, viewScale: 4 };
      expect(
        badgeStyle(scaled, anchorAt([150, 100], new Bound(0, 0, 1, 1)))
      ).toEqual({ left: '25px', top: '25px', dotWidth: '8px' });
    });
  });

  describe('the bracket hit band', () => {
    const anchor = anchorAt([0, 0], new Bound(150, 100, 40, 20));

    function firstStrip(viewport: Viewport) {
      const strip = renderMethod(
        '_renderBracketHit',
        stubWidget(viewport),
        anchor,
        'label'
      ).querySelector<HTMLElement>('.violation-bracket-hit');
      return { left: strip?.style.left, top: strip?.style.top };
    }

    it('hugs the bracket when the host applies no scale', () => {
      // Bound left 150, minus the 6 units of mark padding: (144 - 100) * 2 = 88,
      // minus the 22px band.
      expect(firstStrip(unscaled)).toEqual({ left: '66px', top: '66px' });
    });

    it('follows the bracket the container has scaled', () => {
      // (144 - 100) * 2 / 2 = 44, minus the band.
      expect(firstStrip({ ...unscaled, viewScale: 2 })).toEqual({
        left: '22px',
        top: '22px',
      });
    });
  });

  describe('the bubble', () => {
    const violations: Violation[] = [
      {
        ruleId: 'rule-1',
        elementIds: ['a'],
        severity: 'warning',
        messageKey: 'com.labre.test.message',
      },
    ];

    function flipped(viewport: Viewport, x: number, y: number) {
      const bubble = renderMethod(
        '_renderBubble',
        stubWidget(viewport),
        violations,
        x,
        y
      ).querySelector<HTMLElement>('.violation-bubble');
      // Flipped horizontally means the bubble was placed to the LEFT of the
      // badge, i.e. before it.
      return {
        flipX: Number.parseFloat(bubble?.style.left ?? '0') < x,
        flipY: bubble?.dataset.flipY === 'true',
      };
    }

    it('flips at the edge of an unscaled viewport', () => {
      expect(flipped(unscaled, 400, 300)).toEqual({
        flipX: false,
        flipY: false,
      });
      // 780 + 12 + 280 > 800, and 580 + 12 + 100 > 600.
      expect(flipped(unscaled, 780, 580)).toEqual({ flipX: true, flipY: true });
    });

    it('reads the edges in the units it is placed in', () => {
      // A host scaling the editor by 2 leaves the container 400x300 wide in its
      // own pixels. A bubble at 390,290 in that space is at the far edge and
      // must flip, where a screen-pixel comparison against 800x600 would leave
      // it hanging off the viewport.
      const scaled = { ...unscaled, viewScale: 2 };
      expect(flipped(scaled, 390, 290)).toEqual({ flipX: true, flipY: true });
      expect(flipped(scaled, 40, 40)).toEqual({ flipX: false, flipY: false });
    });
  });
});
