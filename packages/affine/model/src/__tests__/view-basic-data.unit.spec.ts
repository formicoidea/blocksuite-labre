import { describe, expect, expectTypeOf, test } from 'vitest';

import {
  DATABASE_VIEW_OPEN_IN,
  DatabaseBlockSchema,
  type DatabaseViewOpenIn,
  type ViewBasicDataType,
} from '../index.js';

/**
 * The two stored view-data fields of ADR 0035 §8 (red zone): `sourceId` and
 * `openIn`, appended to `ViewBasicDataType` in 0.49.
 *
 * `props.views` of `affine:database` is the file format, so what this spec
 * pins is that the change is migration-free:
 *
 * - a view literal of the 0.48 shape (`{ id, name, mode }` and a mode's own
 *   data) still types against the current `ViewBasicDataType`: no stored view
 *   becomes invalid, no host that writes the 0.48 shape stops compiling;
 * - both fields are optional (`undefined` allowed), so nothing has to write
 *   them, on load or ever;
 * - the block's default props carry no view, hence no default to write into
 *   every document the first time it opens (`sync-controller.ts` writes any
 *   non-`undefined` schema default);
 * - `openIn` values are append-only: the list below may only grow, never
 *   rename or drop an entry a document may hold.
 *
 * Typechecked by `yarn build` (tests included); the `expectTypeOf` lines fail
 * the build, not the run.
 */

/** A view exactly as 0.48 stored it: the basics and a table's own data. */
const view048 = {
  id: 'view-1',
  name: 'Table View',
  mode: 'table',
  columns: [{ id: 'title', width: 260, hide: false }],
  filter: { type: 'group', op: 'and', conditions: [] },
  header: { titleColumn: 'title' },
} as const;

describe('ViewBasicDataType (ADR 0035 §8)', () => {
  test('a 0.48 view types against the current shape, unchanged', () => {
    const stored: ViewBasicDataType = view048;
    expect(stored).toBe(view048);
    expect('sourceId' in stored).toBe(false);
    expect('openIn' in stored).toBe(false);
    expectTypeOf<{
      id: string;
      name: string;
      mode: string;
    }>().toMatchTypeOf<ViewBasicDataType>();
  });

  test('both new fields are optional and may stay undefined', () => {
    expectTypeOf<ViewBasicDataType['sourceId']>().toEqualTypeOf<
      string | undefined
    >();
    expectTypeOf<ViewBasicDataType['openIn']>().toEqualTypeOf<
      DatabaseViewOpenIn | undefined
    >();
    const hosted: ViewBasicDataType = {
      ...view048,
      sourceId: 'source-1',
      openIn: 'center',
    };
    expect(hosted.sourceId).toBe('source-1');
  });

  test('openIn is append-only: side, center, full, in that order', () => {
    expect([...DATABASE_VIEW_OPEN_IN]).toEqual(['side', 'center', 'full']);
    expectTypeOf<DatabaseViewOpenIn>().toEqualTypeOf<
      'side' | 'center' | 'full'
    >();
  });

  test('the block default holds no view, so nothing is written on open', () => {
    const internal = {
      Text: () => ({}),
      Boxed: (value: unknown) => value,
    };
    const props = DatabaseBlockSchema.model.props?.(internal as never);
    expect(props?.views).toEqual([]);
  });
});
