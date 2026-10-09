import { Container } from '@labre/global/di';
import { describe, expect, it, vi } from 'vitest';

import {
  OutlinePanelExtension,
  OutlinePanelProvider,
} from '../../services/outline-panel-service.js';

/**
 * The outline panel seam mounts without a provider (ADR 0034 §1, the
 * seams table in `docs/integrate/04-host-seams.md`).
 *
 * Every seam documents what disappears when it is absent, and proves the
 * editor mounts that way. Here the absent story is "the note toast offers no
 * 'View in TOC' link", which only holds if `getOptional` answers nothing both
 * when the host registers no outline and when it passes `null`. A
 * `di.addImpl` in place of `di.override`, or a library default slipped in,
 * would make one of the two answer and the link would come back opening
 * nothing.
 */

function resolve(extensions: { setup: (di: Container) => void }[]) {
  const container = new Container();
  for (const extension of extensions) extension.setup(container);
  return container.provider().getOptional(OutlinePanelProvider);
}

describe('OutlinePanelExtension', () => {
  it('answers nothing when the host registers no outline panel', () => {
    expect(resolve([])).toBeFalsy();
  });

  it('answers nothing when the host passes null', () => {
    expect(resolve([OutlinePanelExtension(null)])).toBeFalsy();
  });

  it("answers the host's panel, and a later registration wins", () => {
    const first = { open: vi.fn(), close: vi.fn() };
    const second = { open: vi.fn(), close: vi.fn() };

    expect(resolve([OutlinePanelExtension(first)])).toBe(first);
    expect(
      resolve([OutlinePanelExtension(first), OutlinePanelExtension(second)])
    ).toBe(second);
    expect(
      resolve([OutlinePanelExtension(first), OutlinePanelExtension(null)])
    ).toBeFalsy();
  });
});
