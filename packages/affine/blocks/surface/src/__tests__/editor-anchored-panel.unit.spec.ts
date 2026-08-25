import { describe, expect, it } from 'vitest';

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
 * decision ("same left edge, same width") is that conversion being exact.
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
  const stub = {
    gfx: { viewport: options.editor },
    getBoundingClientRect: () => new DOMRect(originX, originY, 0, 0),
    anchorBar: () =>
      options.bar
        ? { getBoundingClientRect: () => new DOMRect(...options.bar) }
        : null,
  };
  return (
    EditorAnchoredPanel.prototype as unknown as {
      anchorBox(this: unknown): AnchoredPanelBox;
    }
  ).anchorBox.call(stub);
}

describe('the editor-anchored panel (ADR 0011)', () => {
  describe('one pattern, not two copies', () => {
    it('is the base class of both info panels', () => {
      // The decision names a shared component, and this is what "shared" means
      // in a language with prototypes: a second copy of the geometry would
      // still pass every visual assertion and fail this one.
      expect(
        Object.getPrototypeOf(ReadingProposalWidget) as unknown
      ).toBe(EditorAnchoredPanel);
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
});
