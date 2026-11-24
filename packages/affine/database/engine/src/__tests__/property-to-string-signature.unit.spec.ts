/**
 * A property type's `rawValue.toString` written against 4.3 keeps compiling,
 * and a 4.3 call keeps compiling too.
 *
 * #742 (upstream toeverything/AFFiNE#15865) gave `toString` a `dataSource`
 * so the database's title and text types resolve a linked doc's title. A
 * host implements this type (its own property types) and calls it (an
 * export of its own), so it may only widen in a minor: the field is
 * optional. This spec would catch it becoming required: the implementation
 * and the call below are written exactly as 4.3 wrote them, typed by the
 * CURRENT `PropertyConfig`, and `yarn build` typechecks tests.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';

import type { PropertyConfig } from '../core/property/types.js';

type Data = { unit: string };
type ToString = PropertyConfig<Data, number, number>['rawValue']['toString'];

/** A 4.3 implementation: it reads only `value` and `data`. */
const TO_STRING_43 = ({ value, data }: { value: number; data: Data }) =>
  `${value} ${data.unit}`;

describe('a 4.3-shaped property toString', () => {
  it('is still a toString', () => {
    expectTypeOf(TO_STRING_43).toMatchTypeOf<ToString>();
    const toString: ToString = TO_STRING_43;
    // The 4.3 call: no data source.
    const weight = 3;
    expect(toString({ value: weight, data: { unit: 'kg' } })).toBe(
      `${weight} kg`
    );
  });
});
