import { html, render, type TemplateResult } from 'lit';
import { afterEach, describe, expect, it } from 'vitest';

import {
  type AnchoredPanelBox,
  EditorAnchoredPanel,
  editorAnchoredPanelStyles,
} from '../extensions/editor-anchored-panel.js';
import { MapQualityWidget } from '../extensions/map-quality-widget.js';
import { ReadingProposalWidget } from '../extensions/reading-widget.js';

/**
 * ADR 0011 — the geometry of an editor-anchored info panel, and the fact that
 * there is exactly ONE of it.
 *
 * The integration suites own the panels in a real editor. This one owns the
 * arithmetic, which is the part that has an off-by-one in it: the bar's rect is
 * in viewport coordinates and the panel's box is in the host's, and the whole
 * decision ("same left edge, same width") is that conversion being exact — and
 * the FRAME, which is measurable here for the same reason: the suite runs in a
 * real browser, so "the title does not move when the body scrolls" is a rect
 * compared against a rect rather than a stylesheet read back to itself.
 */

/**
 * `anchorBox` reads three things off `this` and touches nothing else, so it can
 * be measured against rects that are stated rather than laid out — which is the
 * only way to assert a 1600px editor from a test window of any size.
 */
function boxFor(options: {
  editor: { width: number; height: number };
  /** The zero-sized host: the editor's left edge, and its bottom edge. */
  origin: [number, number];
  /** The senior bar's viewport rect, or `null` when there is none. */
  bar: [number, number, number, number] | null;
}): AnchoredPanelBox {
  const [originX, originY] = options.origin;
  // Read out of the options object: TypeScript cannot narrow a mutable property
  // inside a closure, and the spread below needs the narrowed tuple.
  const bar = options.bar;
  const stub = {
    gfx: { viewport: options.editor },
    getBoundingClientRect: () => new DOMRect(originX, originY, 0, 0),
    anchorBar: () =>
      bar ? { getBoundingClientRect: () => new DOMRect(...bar) } : null,
  };
  return (
    EditorAnchoredPanel.prototype as unknown as {
      anchorBox(this: unknown): AnchoredPanelBox;
    }
  ).anchorBox.call(stub);
}

/** Every harness host mounted by {@link renderPanel}, torn down after each test. */
const mounted: HTMLElement[] = [];

afterEach(() => {
  while (mounted.length) mounted.pop()?.remove();
});

/**
 * The frame, rendered for real: the shared stylesheet in a shadow root and the
 * shared template inside it.
 *
 * `renderAnchoredPanel` reads exactly two things off `this` — the box and the
 * pointer swallower — so it renders against a stub, and the box can be STATED,
 * which is the only way to assert a 200px ceiling from a window of any height.
 */
function renderPanel(options: {
  header: unknown;
  body: unknown;
  maxHeight?: number;
}) {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position: relative; width: 600px; height: 800px;';
  document.body.append(wrapper);
  mounted.push(wrapper);

  // The `:host` rule pins the harness to its wrapper's bottom-left, exactly as
  // it pins the widget to the editor's.
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.adoptedStyleSheets = [editorAnchoredPanelStyles.styleSheet!];
  wrapper.append(host);

  const stub = {
    anchorBox: (): AnchoredPanelBox => ({
      left: 0,
      width: 400,
      bottom: 0,
      maxHeight: options.maxHeight ?? 200,
    }),
    swallow: () => {},
  };

  render(
    (
      EditorAnchoredPanel.prototype as unknown as {
        renderAnchoredPanel(
          this: unknown,
          options: { testid: string; label: string; variant: string },
          header: unknown,
          body: unknown
        ): TemplateResult;
      }
    ).renderAnchoredPanel.call(
      stub,
      { testid: 'harness-panel', label: 'Harness', variant: 'harness-panel' },
      options.header,
      options.body
    ),
    shadow
  );

  const pick = (selector: string) =>
    shadow.querySelector<HTMLElement>(selector)!;

  return {
    panel: pick('.editor-anchored-panel'),
    header: pick('.editor-anchored-panel-header'),
    body: pick('.editor-anchored-panel-body'),
  };
}

/** Enough paragraphs that any sane ceiling is overrun. */
const longBody = html`${Array.from(
  { length: 40 },
  (_, index) => html`<p>Line ${index}</p>`
)}`;

describe('the editor-anchored panel (ADR 0011)', () => {
  describe('one pattern, not two copies', () => {
    it('is the base class of both info panels', () => {
      // The decision names a shared component, and this is what "shared" means
      // in a language with prototypes: a second copy of the geometry would
      // still pass every visual assertion and fail this one.
      expect(Object.getPrototypeOf(ReadingProposalWidget) as unknown).toBe(
        EditorAnchoredPanel
      );
      expect(Object.getPrototypeOf(MapQualityWidget) as unknown).toBe(
        EditorAnchoredPanel
      );
    });

    it('gives both of them the same stylesheet for the box and the layer', () => {
      // A lit component that declares `static styles` REPLACES its base's, so
      // the composition is the contract: the shared sheet first, the panel's
      // own content styles after it.
      for (const widget of [ReadingProposalWidget, MapQualityWidget]) {
        const styles = widget.styles as unknown[];
        expect(Array.isArray(styles)).toBe(true);
        expect(styles[0]).toBe(editorAnchoredPanelStyles);
      }
    });
  });

  describe('the box it computes', () => {
    it('takes the bar’s left edge and the bar’s width, exactly', () => {
      const box = boxFor({
        editor: { width: 1200, height: 800 },
        origin: [100, 700],
        // A bar 500 wide, starting 200px into the editor.
        bar: [300, 600, 500, 64],
      });

      // The two red rules of the recette capture: same left edge, same right.
      expect(box.left).toBe(200);
      expect(box.width).toBe(500);
      // …and clear of the bar's TOP, not of the editor's bottom, so the gap
      // survives a taller bar or a theme with more padding.
      expect(box.bottom).toBe(700 - 600 + 12);
    });

    it('follows the bar when the editor is resized under it', () => {
      // The same editor, narrower: the toolbar re-lays out and the bar is
      // 320 wide starting 40px in. Nothing in the panel's box is a constant.
      const box = boxFor({
        editor: { width: 400, height: 800 },
        origin: [0, 800],
        bar: [40, 700, 320, 64],
      });

      expect(box.left).toBe(40);
      expect(box.width).toBe(320);
      // Deliberately NOT floored to a minimum width: where the bar is measured,
      // "the same width as the bar" is exact. A panel that quietly stopped
      // matching under some width is the bug the ADR exists to remove.
      expect(box.width).toBeLessThan(480);
    });

    it('centres a comfortable measure when there is no bar to measure', () => {
      // A read-only board renders no toolbar at all.
      const box = boxFor({
        editor: { width: 1200, height: 800 },
        origin: [0, 800],
        bar: null,
      });

      expect(box.width).toBe(480);
      expect(box.left).toBe((1200 - 480) / 2);
      expect(box.bottom).toBe(96);
    });

    it('keeps a floor on the fallback, which has nothing to agree with', () => {
      const box = boxFor({
        editor: { width: 200, height: 800 },
        origin: [0, 800],
        bar: null,
      });

      expect(box.width).toBe(240);
      expect(box.left).toBe(16);
    });

    it('clamps its height to what is left above the bar', () => {
      const short = boxFor({
        editor: { width: 1200, height: 300 },
        origin: [0, 300],
        bar: [300, 200, 500, 64],
      });
      // 300 tall, panel bottom at 112 → 172 of room, minus the top margin.
      expect(short.maxHeight).toBe(300 - 112 - 16);

      const tall = boxFor({
        editor: { width: 1200, height: 2000 },
        origin: [0, 2000],
        bar: [300, 1900, 500, 64],
      });
      // A panel that grows with the window is a panel nobody finishes reading.
      expect(tall.maxHeight).toBe(420);
    });

    it('never lets the box invert on an editor with no room at all', () => {
      const box = boxFor({
        editor: { width: 1200, height: 80 },
        origin: [0, 80],
        bar: [300, 10, 500, 64],
      });
      expect(box.maxHeight).toBe(160);
      expect(box.bottom).toBeGreaterThan(0);
    });
  });

  /**
   * The chrome, as the PO found it on 02/09: an 8px box against a 16px
   * toolbar, a title that scrolled away with the text it named, the browser's
   * default scrollbar, and a 12px padding that belonged to the scrolling box
   * so the words ran into the rounded edge.
   */
  describe('the frame it wears', () => {
    it('rounds at the toolbar’s radius, not at half of it', () => {
      const { panel } = renderPanel({ header: 'Title', body: 'Body' });
      const style = getComputedStyle(panel);

      // 16, the measure `edgeless-toolbar` and every menu that slides out of it
      // already use (#199). One family of chrome, one corner.
      expect(style.borderTopLeftRadius).toBe('16px');
      expect(style.borderBottomRightRadius).toBe('16px');
    });

    it('clips at the frame and scrolls one level in', () => {
      const { panel, body } = renderPanel({ header: 'Title', body: longBody });

      // The box that owns the corners is the box that must clip: anything
      // scrolling in the panel itself paints over the arc.
      expect(getComputedStyle(panel).overflow).toBe('hidden');
      expect(getComputedStyle(body).overflowY).toBe('auto');
      expect(body.scrollHeight).toBeGreaterThan(body.clientHeight);
    });

    it('keeps the title still while the body moves under it', () => {
      const { body, header } = renderPanel({
        header: html`<div class="reading-title">What this map says</div>`,
        body: longBody,
      });

      // The fault itself: the whole panel used to be the scrolling box, so a
      // reading long enough to scroll scrolled its own heading off the top.
      const before = header.getBoundingClientRect().top;
      body.scrollTop = body.scrollHeight;

      expect(body.scrollTop).toBeGreaterThan(0);
      expect(header.getBoundingClientRect().top).toBe(before);
      // …and the heading is not merely sticky: it is not in that box at all.
      expect(body.contains(header)).toBe(false);
      expect(body.textContent).not.toContain('What this map says');
    });

    it('counts the header inside the measured ceiling', () => {
      const { panel, header, body } = renderPanel({
        header: 'Title',
        body: longBody,
        maxHeight: 200,
      });

      // `anchorBox` measures the room above the bar for the PANEL. Splitting it
      // in two must not let the pair grow past it.
      expect(panel.getBoundingClientRect().height).toBeLessThanOrEqual(200);
      expect(header.getBoundingClientRect().height).toBeGreaterThan(0);
      expect(body.getBoundingClientRect().height).toBeGreaterThan(0);
    });

    it('ends the scrolling box clear of the bottom arc', () => {
      const { panel, body } = renderPanel({ header: 'Title', body: longBody });

      // An inner box inset by less than r × (1 − 1/√2) ≈ 4.7 has its corners
      // cut by a 16px radius — which is what a scrollbar running to the very
      // bottom edge looked like.
      const gap =
        panel.getBoundingClientRect().bottom -
        body.getBoundingClientRect().bottom;
      expect(gap).toBeGreaterThanOrEqual(5);
    });

    it('gives the scrollbar a lane of its own, overflow or not', () => {
      const short = renderPanel({ header: 'Title', body: 'One line' });
      const tall = renderPanel({ header: 'Title', body: longBody });

      // `scrollbar-gutter: stable`: the text sits at the same distance from the
      // right edge whether the body scrolls or not, so a panel that grows a
      // section does not shove its own words sideways.
      const gutter = (element: HTMLElement) =>
        element.offsetWidth - element.clientWidth;
      expect(gutter(short.body)).toBe(gutter(tall.body));
      expect(gutter(tall.body)).toBeGreaterThan(0);
    });

    it('declares the house scrollbar rather than the browser’s', () => {
      // The pseudo-element is unreachable from `getComputedStyle`, so this is
      // the sheet read back — the same values `table-block-css` and the
      // data-view scrollers use: 8px, invisible at rest, drawn on hover.
      const sheet = editorAnchoredPanelStyles.cssText;

      expect(sheet).toContain('.editor-anchored-panel-body::-webkit-scrollbar');
      expect(sheet).toContain('width: 8px');
      expect(sheet).toMatch(
        /-webkit-scrollbar-thumb\s*{[^}]*background-color:\s*transparent/
      );
      expect(sheet).toMatch(
        /:hover::-webkit-scrollbar-thumb\s*{[^}]*var\(--affine-black-30\)/
      );
      expect(sheet).toMatch(
        /:hover::-webkit-scrollbar-track\s*{[^}]*var\(--affine-hover-color\)/
      );
    });
  });
});
