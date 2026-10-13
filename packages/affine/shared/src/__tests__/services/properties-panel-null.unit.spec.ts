import { Container } from '@labre/global/di';
import { describe, expect, it, vi } from 'vitest';

import {
  PropertiesPanelExtension,
  PropertiesPanelProvider,
} from '../../services/properties-panel-service.js';

/**
 * The properties panel seam mounts without a provider (ADR 0035 §9b, the
 * seams table in `docs/integrate/04-host-seams.md`).
 *
 * The absent story is "the title band draws no panel button", which only
 * holds if `getOptional` answers nothing both when the host registers no
 * panel and when it passes `null`. A `di.addImpl` in place of `di.override`,
 * or a library default slipped in, would make one of the two answer and the
 * button would come back opening nothing.
 */

function resolve(extensions: { setup: (di: Container) => void }[]) {
  const container = new Container();
  for (const extension of extensions) extension.setup(container);
  return container.provider().getOptional(PropertiesPanelProvider);
}

describe('PropertiesPanelExtension', () => {
  it('answers nothing when the host registers no properties panel', () => {
    expect(resolve([])).toBeFalsy();
  });

  it('answers nothing when the host passes null', () => {
    expect(resolve([PropertiesPanelExtension(null)])).toBeFalsy();
  });

  it("answers the host's panel, and a later registration wins", () => {
    const first = { open: vi.fn(), close: vi.fn() };
    const second = { open: vi.fn(), close: vi.fn() };

    expect(resolve([PropertiesPanelExtension(first)])).toBe(first);
    expect(
      resolve([
        PropertiesPanelExtension(first),
        PropertiesPanelExtension(second),
      ])
    ).toBe(second);
    expect(
      resolve([PropertiesPanelExtension(first), PropertiesPanelExtension(null)])
    ).toBeFalsy();
  });
});
