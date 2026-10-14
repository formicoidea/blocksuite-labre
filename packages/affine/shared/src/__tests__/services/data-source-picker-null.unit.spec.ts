import { Container } from '@labre/global/di';
import { signal } from '@preact/signals-core';
import { describe, expect, it } from 'vitest';

import {
  DataSourcePickerExtension,
  DataSourcePickerProvider,
  type DataSourcePickerService,
} from '../../services/data-source-picker-service.js';

/**
 * The data-source picker seam mounts without a provider (ADR 0035 §9c,
 * issue B12; the seams table in `docs/integrate/04-host-seams.md`).
 *
 * Absent or `null` is "the 0.48 entries": no "Linked view of a database",
 * and "Table View" / "Kanban View" insert a native inline database. That only
 * holds if `getOptional` answers nothing in both cases; a `di.addImpl`, or a
 * library default, would make the creating entries wait on a host that never
 * creates anything.
 */

function resolve(extensions: { setup: (di: Container) => void }[]) {
  const container = new Container();
  for (const extension of extensions) extension.setup(container);
  return container.provider().getOptional(DataSourcePickerProvider);
}

describe('DataSourcePickerExtension', () => {
  it('answers nothing without a provider, or with null', () => {
    expect(resolve([])).toBeFalsy();
    expect(resolve([DataSourcePickerExtension(null)])).toBeFalsy();
  });

  it("answers the host's picker, and a later registration wins", () => {
    const list = signal([]);
    const first: DataSourcePickerService = { list: () => list };
    const second: DataSourcePickerService = { list: () => list };
    expect(resolve([DataSourcePickerExtension(first)])).toBe(first);
    expect(
      resolve([
        DataSourcePickerExtension(first),
        DataSourcePickerExtension(second),
      ])
    ).toBe(second);
    expect(
      resolve([
        DataSourcePickerExtension(first),
        DataSourcePickerExtension(null),
      ])
    ).toBeFalsy();
  });
});
