import { type ReadonlySignal, signal } from '@preact/signals-core';
import { describe, expect, expectTypeOf, it } from 'vitest';

import type {
  TitleBandProperty,
  TitleBandService,
} from '../../services/title-band-service.js';

/**
 * The title band seam only widens (docs/lessons.md 33): a host written
 * against 0.48 keeps compiling and keeps its behaviour. 0.49 adds the
 * definition write for a select's options (product owner, 2026-10-14):
 * `TitleBandService.setData?` and `TitleBandProperty.dataWritable?`, both
 * optional, both absent in the literals below.
 *
 * What it would have caught: either field made required (every 0.48 host a
 * compile error at upgrade), or `setData` folded into `set` (a value write and
 * a definition write are two different rights on the host side).
 * 0.61 adds `children$?` (labre ADR-0045 amended 2026-10-27: a child's own
 * card drops the link arrow), optional and absent below.
 *
 * `yarn build` typechecks it; the runtime half is in
 * `fragments/doc-title/src/__tests__/title-band.unit.spec.ts` and
 * `blocks/embed-doc/src/__tests__/child-card-icon.unit.spec.ts`.
 */

/** A property exactly as a 0.48 host builds it. */
const property048 = {
  id: 'status',
  namespace: 'workspace' as const,
  name: 'Status',
  type: 'select',
  data: { options: [{ id: 'a', value: 'Doing', color: 'red' }] },
  value: 'a',
  readonly: false,
} satisfies TitleBandProperty;

/** A service exactly as a 0.48 host builds it. */
const service048 = {
  sheet$: () => signal({ status: 'ready' as const, properties: [property048] }),
  set: async () => {},
  add: () => {},
  collapsed$: () => signal(false),
  setCollapsed: () => {},
  notShown$: () => signal([]),
} satisfies TitleBandService;

describe('TitleBandService only widens', () => {
  it('takes a 0.48 property and a 0.48 service as they were', () => {
    expectTypeOf(property048).toMatchTypeOf<TitleBandProperty>();
    expectTypeOf(service048).toMatchTypeOf<TitleBandService>();
    expect(service048.sheet$().value.status).toBe('ready');
  });

  it('keeps the definition write optional and apart from the value write', () => {
    expectTypeOf<TitleBandService['setData']>().toEqualTypeOf<
      | ((
          docId: string,
          propertyId: string,
          data: Record<string, unknown>
        ) => Promise<void>)
      | undefined
    >();
    expectTypeOf<TitleBandProperty['dataWritable']>().toEqualTypeOf<
      boolean | undefined
    >();
  });

  it('keeps the children optional', () => {
    expectTypeOf<TitleBandService['children$']>().toEqualTypeOf<
      ((docId: string) => ReadonlySignal<readonly string[]>) | undefined
    >();
  });
});
