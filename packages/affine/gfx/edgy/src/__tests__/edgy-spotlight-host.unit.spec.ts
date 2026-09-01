import {
  findSpotlightHost,
  SpotlightHostIdentifier,
} from '@labre/affine-block-surface';
import { Container } from '@labre/global/di';
import { Bound } from '@labre/global/gfx';
import type { ExtensionType } from '@labre/store';
import { describe, expect, it } from 'vitest';

import { edgyBoardToolbarConfig, edgyToolbarConfig } from '../toolbar/config';
import { EdgyRenderViewExtension } from '../view';

/**
 * The EDGY Venn ("Enterprise Design Facets", element type `edgy`) is a DRAWING.
 * The hover spotlight is BOARD logic and belongs to the EDGY board
 * (`edgyBoard`) alone — the Venn only carries appearance (#195).
 *
 * Two things have to hold, and they are different things: the Venn must no
 * longer be REGISTERED as a spotlight host (so no element laid on it is ever
 * granted the behavior), and the toggle that used to say otherwise must be gone
 * from its toolbar (so the UI does not promise a behavior that no longer runs).
 */

/** The element types EDGY registers as spotlight hosts, read out of a real DI. */
function registeredSpotlightHosts(): string[] {
  const extensions: ExtensionType[] = [];
  new EdgyRenderViewExtension().setup({
    scope: 'edgeless',
    register(ext) {
      extensions.push(...(Array.isArray(ext) ? ext : [ext]));
      return this;
    },
  });
  const container = new Container();
  for (const ext of extensions) ext.setup?.(container);
  return Array.from(
    container.provider().getAll(SpotlightHostIdentifier).values()
  );
}

describe('the hover spotlight is hosted by the EDGY board only', () => {
  it('registers `edgyBoard` as a spotlight host and not `edgy`', () => {
    const hosts = registeredSpotlightHosts();
    expect(hosts).toContain('edgyBoard');
    expect(hosts).not.toContain('edgy');
  });

  // The behavior itself: `findSpotlightHost` is what decides, on every
  // pointermove, whether a hovered element is granted the spotlight. Fed the
  // host types EDGY now registers, a Venn grants nothing and a board grants.
  const node = { elementBound: new Bound(100, 100, 40, 40) };
  const venn = { type: 'edgy', elementBound: new Bound(0, 0, 1020, 600) };
  const board = { type: 'edgyBoard', elementBound: new Bound(0, 0, 1020, 600) };

  it('does not engage on an element laid on a facets Venn', () => {
    expect(findSpotlightHost(node, [venn], ['edgyBoard'])).toBeNull();
  });

  it('engages on an element laid on an EDGY board', () => {
    expect(findSpotlightHost(node, [board], ['edgyBoard'])).toBe(board);
  });

  it('ignores `spotlightEnabled: true` left on a stored Venn', () => {
    // Documents written before #195 carry the field; it is inert now, and a
    // Venn sitting under the pointer must not resurrect the behavior.
    const stored = { ...venn, spotlightEnabled: true };
    expect(findSpotlightHost(node, [stored], ['edgyBoard'])).toBeNull();
  });

  it('still honours a board that opted out from its toolbar', () => {
    const off = { ...board, spotlightEnabled: false };
    expect(findSpotlightHost(node, [off], ['edgyBoard'])).toBeNull();
  });
});

describe('the two EDGY toolbars after the split', () => {
  const ids = (config: { actions: readonly { id: string }[] }) =>
    config.actions.map(action => action.id);

  it('the facets Venn offers no spotlight toggle', () => {
    expect(ids(edgyToolbarConfig).some(id => id.includes('spotlight'))).toBe(
      false
    );
  });

  it('the facets Venn keeps its appearance toggles and its legend', () => {
    expect(ids(edgyToolbarConfig)).toEqual([
      'a.toggle-resize',
      'b.toggle-labels',
      'c.legend',
    ]);
  });

  it('the board keeps its spotlight toggle', () => {
    expect(ids(edgyBoardToolbarConfig)).toContain('b.toggle-spotlight');
  });
});
