import { afterEach, describe, expect, it } from 'vitest';

import { Viewport } from '../../gfx/viewport.js';

/**
 * `Viewport.viewScale` reports the CSS scale an outer container puts on the
 * whole editor — the nested editor case, where the host is drawn smaller than
 * it is laid out. It reads that scale as painted width over laid out width,
 * and the laid out width (`offsetWidth`) only comes back as an integer.
 *
 * So a host that is simply a fraction of a pixel wide — a window on a HiDPI
 * screen, a flex remainder — used to report a scale of ~1.0001 while nothing
 * was scaled at all. Everything downstream divides by it: a pointer drag of
 * 100px turned into a move of 99.986.
 */
describe('Viewport.viewScale', () => {
  const hosts: HTMLElement[] = [];

  afterEach(() => {
    hosts.forEach(host => host.remove());
    hosts.length = 0;
  });

  function mount(styles: Partial<CSSStyleDeclaration>) {
    const host = document.createElement('div');
    Object.assign(host.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      height: '100px',
      ...styles,
    });
    document.body.append(host);
    hosts.push(host);

    const viewport = new Viewport();
    viewport.setShellElement(host);
    return viewport;
  }

  it('reads no scale on a host with a whole pixel width', () => {
    expect(mount({ width: '600px' }).viewScale).toBe(1);
  });

  it('reads no scale on a host whose layout width is fractional', () => {
    const viewport = mount({ width: '600.4px' });

    expect(viewport.boundingClientRect.width).toBeCloseTo(600.4, 1);
    expect(viewport.viewScale).toBe(1);
  });

  it('reads the scale an outer container puts on the editor', () => {
    const viewport = mount({
      width: '600px',
      transform: 'scale(0.5)',
      transformOrigin: '0 0',
    });

    expect(viewport.viewScale).toBeCloseTo(0.5, 5);
  });

  it('answers 1 while the host is not measured yet', () => {
    expect(new Viewport().viewScale).toBe(1);
  });
});
