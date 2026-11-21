/**
 * GUARD — `HostedSourceUnavailable`, the answer a host's resolver returns
 * for a source the reader may not read, only WIDENS in a minor (CLAUDE.md,
 * "Review, scope and delivery"; docs/lessons.md 33).
 *
 * 2.4 shipped `'unshared'` and `'trashed'`, 2.4.1 `'loading'`; issue #693
 * appends `'not-open'` (ADR 0035 amendment of 2026-11-20). A host typing
 * its answers against the previous shape must keep compiling, and the new
 * reason must type. The literals below are typechecked by `yarn build`
 * (tests included): a reason renamed, removed or narrowed fails the build.
 * `'unknown'` is what the library draws for a reason it does not know, never
 * a reason a host sends: it must stay out of the host's type.
 */
import { describe, expect, expectTypeOf, test } from 'vitest';

import {
  type HostedSourceUnavailable,
  type HostedSourceUnavailableReason,
  type HostedSourceUnavailableState,
  isHostedSourceUnavailable,
  type ResolveHostedSource,
} from '../external-data-source.js';

/** A 4.0 host's answers, verbatim. Compile or the build fails. */
const UNSHARED: HostedSourceUnavailable = { unavailable: 'unshared' };
const TRASHED: HostedSourceUnavailable = { unavailable: 'trashed' };
const LOADING: HostedSourceUnavailable = { unavailable: 'loading' };
const PREVIOUS = [UNSHARED, TRASHED, LOADING];

/** The answer issue #693 adds. */
const NOT_OPEN: HostedSourceUnavailable = { unavailable: 'not-open' };

/** A 4.0 resolver of one argument still types as the current one. */
const legacyResolver: ResolveHostedSource = (sourceId: string | undefined) =>
  sourceId ? NOT_OPEN : UNSHARED;

describe('HostedSourceUnavailable only widens', () => {
  test('the previous reasons and the new one type', () => {
    expectTypeOf<
      'unshared' | 'trashed' | 'loading' | 'not-open'
    >().toMatchTypeOf<HostedSourceUnavailableReason>();
    expectTypeOf<'unknown'>().not.toMatchTypeOf<HostedSourceUnavailableReason>();
    expectTypeOf<HostedSourceUnavailableReason>().toMatchTypeOf<HostedSourceUnavailableState>();
    expect(legacyResolver('s')).toBe(NOT_OPEN);
  });

  test('every reason a host may send is recognised at run time', () => {
    [...PREVIOUS, NOT_OPEN].forEach(answer =>
      expect(isHostedSourceUnavailable(answer)).toBe(true)
    );
    expect(isHostedSourceUnavailable({ unavailable: 'unknown' } as never)).toBe(
      false
    );
  });
});
