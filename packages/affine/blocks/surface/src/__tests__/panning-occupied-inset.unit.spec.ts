import type { PointerEventState } from '@labre/std';
import { Viewport } from '@labre/std/gfx';
import { afterEach, describe, expect, it } from 'vitest';

import { calPanDelta } from '../tool/panning-utils.js';

/**
 * Edge auto-pan (`calPanDelta`) measures its 20 px band on the VISIBLE canvas
 * (issue #433). The selection pane and the artefact catalogue are docked over
 * the left of the canvas in overlay; the band used to be measured on the
 * container rect, so with a panel open the band that pans left sat under the
 * panel and could not be reached.
 *
 * What this would have caught:
 * - the band still read off the container rect while a left inset is declared
 *   (a pointer at the panel's edge does not pan);
 * - the band moved when nothing is declared (a behaviour change for every
 *   board without an open panel);
 * - the band staying at the panel's edge once the inset is withdrawn.
 */
describe('calPanDelta with an occupied inset', () => {
  const hosts: HTMLElement[] = [];

  afterEach(() => {
    hosts.forEach(host => host.remove());
    hosts.length = 0;
  });

  function mount() {
    const host = document.createElement('div');
    Object.assign(host.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '1000px',
      height: '600px',
    });
    document.body.append(host);
    hosts.push(host);
    const viewport = new Viewport();
    viewport.setShellElement(host);
    return viewport;
  }

  /** A pointer at `x`, `y` in the container, as the default tool sees it. */
  function pointerAt(x: number, y: number) {
    return { x, y, containerOffset: { x: 0, y: 0 } } as PointerEventState;
  }

  it('pans left from the visible edge of a docked panel', () => {
    const viewport = mount();
    // Just right of a 320 px panel: on the canvas, in the band.
    const pointer = pointerAt(325, 300);
    expect(calPanDelta(viewport, pointer)).toBeNull();

    viewport.setOccupiedInset('pane', { left: 320 });
    const delta = calPanDelta(viewport, pointer);
    expect(delta).not.toBeNull();
    expect(delta![0]).toBeLessThan(0);
    expect(delta![1]).toBe(0);
  });

  it('leaves the band at the container edge when nothing is declared', () => {
    const viewport = mount();

    expect(calPanDelta(viewport, pointerAt(5, 300))).toEqual([-15, 0]);
    expect(calPanDelta(viewport, pointerAt(500, 300))).toBeNull();
    expect(calPanDelta(viewport, pointerAt(995, 300))).toEqual([15, 0]);
  });

  it('puts the band back at the container edge once withdrawn', () => {
    const viewport = mount();
    const withdraw = viewport.setOccupiedInset('pane', { left: 320 });
    withdraw();

    expect(calPanDelta(viewport, pointerAt(325, 300))).toBeNull();
    expect(calPanDelta(viewport, pointerAt(5, 300))).toEqual([-15, 0]);
  });
});
