import { Container } from '@labre/global/di';
import { describe, expect, it, vi } from 'vitest';

import {
  PageDropExtension,
  PageDropProvider,
  type PageDropService,
  pageDropVerdict,
} from '../../services/page-drop-service.js';

/**
 * The page-drop seam mounts without a provider (labre P7, the seams table in
 * `docs/integrate/04-host-seams.md`).
 *
 * Absent, a page dragged from the host is any other foreign drag: the verdict
 * is `'ignore'`, so the editor's file drop draws its line as before and the
 * drop watcher places nothing. A library default slipped into the identifier
 * would make every foreign drag a page drop.
 */

function resolve(extensions: { setup: (di: Container) => void }[]) {
  const container = new Container();
  for (const extension of extensions) extension.setup(container);
  return container.provider().getOptional(PageDropProvider);
}

const service = (): PageDropService => ({
  verdict: () => 'accept',
  drop: vi.fn(() => null),
});

describe('PageDropExtension', () => {
  it('answers nothing when the host registers no page drop', () => {
    expect(resolve([])).toBeFalsy();
  });

  it("answers the host's service, and a later registration wins", () => {
    const first = service();
    const second = service();
    expect(resolve([PageDropExtension(first)])).toBe(first);
    expect(resolve([PageDropExtension(first), PageDropExtension(second)])).toBe(
      second
    );
  });

  it('ignores every drag without a host', () => {
    const std = {
      getOptional: () => null,
      store: { id: 'd', readonly: false },
    };
    const dataTransfer = { types: ['application/x-host-page'] };
    expect(
      pageDropVerdict(std as never, dataTransfer as unknown as DataTransfer)
    ).toBe('ignore');
  });
});
