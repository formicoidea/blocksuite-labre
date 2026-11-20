import { Container, createIdentifier } from '@labre/global/di';
import { describe, expect, test } from 'vitest';

import { DataSourceBase } from '../core/index.js';

/**
 * `DataSourceBase.serviceGet(key)` answers `null`, as its `T | null` type
 * says, for a key nothing registered (#682).
 *
 * It returned the DI's optional read unconverted, and the DI answers
 * `undefined` for a missing service. A host inherits this method through
 * `HostedDataSourceBase`, so a `!== null` test written against the declared
 * type took a missing service for a present one. `toBeNull()` fails on
 * `undefined`.
 *
 * The data source is built bare from the prototype: `serviceGet` reads only
 * the source's own container and its parent provider.
 */

const Registered = createIdentifier<{ name: string }>('ServiceGetRegistered');
const Missing = createIdentifier<{ name: string }>('ServiceGetMissing');

function bareSource(): DataSourceBase {
  const source = Object.create(DataSourceBase.prototype) as DataSourceBase;
  Object.defineProperty(source, 'container', { value: new Container() });
  Object.defineProperty(source, 'parentProvider', {
    value: new Container().provider(),
  });
  return source;
}

describe('DataSourceBase.serviceGet', () => {
  test('answers null, not undefined, for a key nothing registered', () => {
    expect(bareSource().serviceGet(Missing)).toBeNull();
  });

  test('answers the registered value', () => {
    const source = bareSource();
    const value = { name: 'registered' };
    source.serviceSet(Registered, value);
    expect(source.serviceGet(Registered)).toBe(value);
  });
});
