import type { Viewport } from '@labre/std/gfx';
import { describe, expect, test } from 'vitest';

import { DockedPanelInset } from '../docked-panel-inset.js';

/**
 * How the selection pane and the artefact catalogue tell the viewport what
 * they cover (issue #433). Both widgets call `sync` after every render, so
 * this is the whole of their side of the contract.
 *
 * What this would have caught:
 * - an inset measured from the window instead of the editor container (a host
 *   that offsets the editor would get a panel wider than drawn);
 * - a closed panel leaving its inset declared, or a re-render re-declaring an
 *   unchanged width (every reader would repaint on every render);
 * - a withdrawal that does not withdraw.
 */
describe('DockedPanelInset', () => {
  /** The calls a viewport receives, and its combined left inset. */
  function fakeViewport(left: number) {
    const declared = new Map<string, number>();
    let declarations = 0;
    const viewport = {
      left,
      setOccupiedInset(owner: string, insets: { left?: number }) {
        declarations++;
        declared.set(owner, insets.left ?? 0);
        return () => declared.delete(owner);
      },
    } as unknown as Viewport;
    return {
      viewport,
      declared,
      declarations: () => declarations,
    };
  }

  function panel(right: number) {
    const element = document.createElement('div');
    element.getBoundingClientRect = () =>
      ({
        right,
        left: 0,
        top: 0,
        bottom: 0,
        width: right,
        height: 0,
      }) as DOMRect;
    return element;
  }

  test('declares the panel from the container left edge to its right edge', () => {
    const { viewport, declared } = fakeViewport(40);
    const inset = new DockedPanelInset('pane');

    inset.sync(viewport, panel(360));

    expect(declared.get('pane')).toBe(320);
  });

  test('does not re-declare an unchanged width, and follows a new one', () => {
    const { viewport, declared, declarations } = fakeViewport(0);
    const inset = new DockedPanelInset('pane');

    inset.sync(viewport, panel(320));
    inset.sync(viewport, panel(320));
    expect(declarations()).toBe(1);

    inset.sync(viewport, panel(280));
    expect(declarations()).toBe(2);
    expect(declared.get('pane')).toBe(280);
  });

  test('withdraws when the panel is no longer rendered, and on dispose', () => {
    const { viewport, declared } = fakeViewport(0);
    const inset = new DockedPanelInset('pane');

    inset.sync(viewport, panel(320));
    inset.sync(viewport, null);
    expect(declared.has('pane')).toBe(false);

    inset.sync(viewport, panel(320));
    inset.withdraw();
    expect(declared.has('pane')).toBe(false);
  });
});
