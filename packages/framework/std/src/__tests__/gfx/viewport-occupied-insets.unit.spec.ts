import { Bound } from '@labre/global/gfx';
import { effect } from '@preact/signals-core';
import { afterEach, describe, expect, it } from 'vitest';

import {
  MIN_VISIBLE_SIZE,
  paddingWithInsets,
  Viewport,
} from '../../gfx/viewport.js';

/**
 * The viewport's occupied insets (issue #433): the library's side panels (the
 * selection pane, the artefact catalogue) float over the canvas without
 * shrinking the editor, so the container rect alone said the canvas under
 * them was visible — the auto-pan band sat under the pane, fit to screen
 * centred content behind it.
 *
 * What this would have caught:
 * - two panels docked on the same side ADDING their widths instead of
 *   overlapping (the catalogue and the pane may both be open);
 * - a withdrawal leaving its inset behind, or a stale withdrawal removing the
 *   owner's newer declaration;
 * - a visible rect that collapses to nothing when a panel covers most of a
 *   phone (85vw), or that changes anything when no panel is declared;
 * - a fit that centres on the container instead of the visible area.
 */
describe('Viewport occupied insets', () => {
  const hosts: HTMLElement[] = [];

  afterEach(() => {
    hosts.forEach(host => host.remove());
    hosts.length = 0;
  });

  function mount(width = 1000, height = 600) {
    const host = document.createElement('div');
    Object.assign(host.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: `${width}px`,
      height: `${height}px`,
    });
    document.body.append(host);
    hosts.push(host);
    const viewport = new Viewport();
    viewport.setShellElement(host);
    return viewport;
  }

  it('is all zeros, and the visible rect the container, with nothing declared', () => {
    const viewport = mount();

    expect(viewport.occupiedInsets$.value).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
    expect(viewport.visibleRect).toEqual({
      left: viewport.left,
      top: viewport.top,
      width: viewport.width,
      height: viewport.height,
    });
    expect(paddingWithInsets(viewport, [1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
  });

  it('combines declarations with the max per side, not the sum', () => {
    const viewport = mount();
    viewport.setOccupiedInset('pane', { left: 320 });
    viewport.setOccupiedInset('catalogue', { left: 280, top: 40 });

    expect(viewport.occupiedInsets$.value).toEqual({
      top: 40,
      right: 0,
      bottom: 0,
      left: 320,
    });
  });

  it('withdraws one declaration and keeps the others', () => {
    const viewport = mount();
    const withdrawPane = viewport.setOccupiedInset('pane', { left: 320 });
    const withdrawCatalogue = viewport.setOccupiedInset('catalogue', {
      left: 280,
    });

    withdrawPane();
    expect(viewport.occupiedInsets$.value.left).toBe(280);

    withdrawCatalogue();
    expect(viewport.occupiedInsets$.value.left).toBe(0);
  });

  it('a stale withdrawal leaves the same owner’s newer declaration in place', () => {
    const viewport = mount();
    const stale = viewport.setOccupiedInset('pane', { left: 320 });
    viewport.setOccupiedInset('pane', { left: 200 });

    stale();
    expect(viewport.occupiedInsets$.value.left).toBe(200);
  });

  it('ignores negative and non-finite values', () => {
    const viewport = mount();
    viewport.setOccupiedInset('odd', {
      left: -10,
      right: Number.NaN,
      top: Number.POSITIVE_INFINITY,
    });

    expect(viewport.occupiedInsets$.value).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
  });

  it('notifies readers on a change, and not on a declaration that changes nothing', () => {
    const viewport = mount();
    let runs = 0;
    const stop = effect(() => {
      void viewport.occupiedInsets$.value;
      runs++;
    });

    viewport.setOccupiedInset('pane', { left: 320 });
    expect(runs).toBe(2);
    // A smaller panel on the same side is hidden by the larger one.
    viewport.setOccupiedInset('catalogue', { left: 100 });
    expect(runs).toBe(2);
    stop();
  });

  it('deducts the insets from the visible rect', () => {
    const viewport = mount(1000, 600);
    viewport.setOccupiedInset('pane', { left: 320 });

    expect(viewport.visibleRect).toEqual({
      left: viewport.left + 320,
      top: viewport.top,
      width: 680,
      height: 600,
    });
  });

  it('never shrinks the visible rect below the minimum, and keeps it inside the container', () => {
    const viewport = mount(375, 600);
    // A panel at 85vw on a phone.
    viewport.setOccupiedInset('pane', { left: 319 });

    const rect = viewport.visibleRect;
    expect(rect.width).toBe(MIN_VISIBLE_SIZE);
    expect(rect.left + rect.width).toBe(viewport.left + 375);
  });

  it('fits content in the centre of the visible area', () => {
    const viewport = mount(1000, 600);
    viewport.setOccupiedInset('pane', { left: 300 });
    const bound = new Bound(0, 0, 200, 100);

    const { zoom, centerX, centerY } = viewport.getFitToScreenData(
      bound,
      paddingWithInsets(viewport),
      1,
      100
    );
    viewport.setViewport(zoom, [centerX, centerY]);

    const [x, y] = viewport.toViewCoord(bound.center[0], bound.center[1]);
    // The visible area runs from 300 to 1000: its centre is 650, not 500.
    expect(x).toBeCloseTo(650, 5);
    expect(y).toBeCloseTo(300, 5);
  });
});
