import {
  DataSourcePickerProvider,
  type DataSourcePickerService,
} from '@labre/affine-shared/services';
import type { SlashMenuActionItem } from '@labre/affine-widget-slash-menu';
import type { BlockStdScope } from '@labre/std';
import type { BlockModel } from '@labre/store';
import { signal } from '@preact/signals-core';
import { describe, expect, it } from 'vitest';

import { databaseSlashMenuConfig } from '../configs/slash-menu.js';

/**
 * Who creates a database (ADR 0035 §5, issue B12): with the data-source
 * picker the host does, through `createDatabase`, which is also its kill
 * switch; without the picker the library inserts a native inline database,
 * as in 0.48.
 *
 * What it would have caught: "Table View" and "Kanban View" still offered by
 * a host whose picker has no `createDatabase` (a database created behind the
 * host's kill switch), or gone from a host that never registered a picker.
 */

const model = {
  flavour: 'affine:paragraph',
  store: { getParent: () => null },
} as unknown as BlockModel;

function stdWith(picker: DataSourcePickerService | null): BlockStdScope {
  return {
    getOptional: (id: unknown) =>
      id === DataSourcePickerProvider ? picker : null,
  } as unknown as BlockStdScope;
}

const creating = databaseSlashMenuConfig.items as SlashMenuActionItem[];
const shown = (std: BlockStdScope) =>
  creating.filter(item => item.when?.({ std, model }) ?? true).map(i => i.name);

describe('the slash entries that create a database', () => {
  it('are offered without a picker, as in 0.48', () => {
    expect(shown(stdWith(null))).toEqual(['Table View', 'Kanban View']);
  });

  it('leave with a picker that creates no database', () => {
    expect(shown(stdWith({ list: () => signal([]) }))).toEqual([]);
  });

  it("stay with a picker that creates one, and call the host's", () => {
    const picker: DataSourcePickerService = {
      list: () => signal([]),
      createDatabase: async () => null,
    };
    expect(shown(stdWith(picker))).toEqual(['Table View', 'Kanban View']);
  });
});
