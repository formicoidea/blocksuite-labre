import { Container } from '@labre/global/di';
import { signal } from '@preact/signals-core';
import { describe, expect, it, vi } from 'vitest';

import {
  ThreadMarksExtension,
  ThreadMarksProvider,
} from '../../services/thread-marks-service.js';

/**
 * The thread-marks seam mounts without a provider (ADR 0038, the seams table
 * in `docs/integrate/04-host-seams.md`).
 *
 * The absent story is "no mark and no Discuss button", which only holds if
 * `getOptional` answers nothing both when the host registers nothing and
 * when it passes `null`. A `di.addImpl` in place of `di.override`, or a
 * library default slipped in, would make one of them answer and a button
 * would come back opening nothing.
 */

function resolve(extensions: { setup: (di: Container) => void }[]) {
  const container = new Container();
  for (const extension of extensions) extension.setup(container);
  return container.provider().getOptional(ThreadMarksProvider);
}

const service = () => ({ marks$: signal([]), openThread: vi.fn() });

describe('ThreadMarksExtension', () => {
  it('answers nothing when the host registers no thread marks', () => {
    expect(resolve([])).toBeFalsy();
  });

  it('answers nothing when the host passes null', () => {
    expect(resolve([ThreadMarksExtension(null)])).toBeFalsy();
  });

  it("answers the host's service, and a later registration wins", () => {
    const first = service();
    const second = service();

    expect(resolve([ThreadMarksExtension(first)])).toBe(first);
    expect(
      resolve([ThreadMarksExtension(first), ThreadMarksExtension(second)])
    ).toBe(second);
    expect(
      resolve([ThreadMarksExtension(first), ThreadMarksExtension(null)])
    ).toBeFalsy();
  });
});
