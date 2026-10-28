import {
  DatabaseBlockSchemaExtension,
  type DatabaseBlockModel,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import { getSelectedModelsCommand } from '@labre/affine-shared/commands';
import {
  DataSourcePickerProvider,
  type DataSourcePickerService,
  FeatureFlagService,
  TelemetryProvider,
} from '@labre/affine-shared/services';
import type { SlashMenuActionItem } from '@labre/affine-widget-slash-menu';
import type { BlockStdScope, Command } from '@labre/std';
import { type BlockModel, type Store, Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { signal } from '@preact/signals-core';
import { describe, expect, it, vi } from 'vitest';

import { databaseSlashMenuConfig } from '../configs/slash-menu.js';
import {
  type DatabaseCreationMenu,
  DatabaseCreationMenuIdentifier,
} from '../creation-menu.js';

/**
 * GUARD — who creates a database (ADR 0035 §5, B12, amendment of 2026-10-28):
 * with the data-source picker the host does, through `createDatabase`, which
 * is also its kill switch; without the picker the library inserts a native
 * inline database, as in 0.48. With the picker and the bundle's creation
 * menu, the entry inserts a native database with no row at once and opens the
 * menu over it, which connects it to a source.
 *
 * What it would have caught: "Table View" and "Kanban View" still offered by
 * a host whose picker has no `createDatabase` (a database created behind the
 * host's kill switch), or gone from a host that never registered a picker;
 * the entry still waiting on `createDatabase` (nothing on the page until the
 * host answers) when the bundle's popover is there, or the popover opened
 * with another block, without the block's element, or over a database that
 * already has its 3 empty rows; a core-only host (picker, no bundle) losing
 * the 0.61 path; `BlockCreated` reported twice or not at all.
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
const tableView = creating.find(item => item.name === 'Table View')!;

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

/** A page with one empty line, the slash entry's, selected. */
function page() {
  const collection = new TestWorkspace({ id: 'creating-entries' });
  collection.meta.initialize();
  const doc = collection.createDoc('doc0');
  doc.load();
  const store = doc.getStore({
    extensions: [
      RootBlockSchemaExtension,
      NoteBlockSchemaExtension,
      ParagraphBlockSchemaExtension,
      DatabaseBlockSchemaExtension,
      FeatureFlagService,
    ],
  });
  const rootId = store.addBlock('affine:page', { title: new Text('page') });
  const noteId = store.addBlock('affine:note', {}, rootId);
  const lineId = store.addBlock('affine:paragraph', {}, noteId);
  return { store, noteId, line: store.getModelById(lineId)! };
}

/**
 * Just enough editor for the entry: the real store and commands, the
 * selection being the line (`getSelectedModelsCommand` reads the DOM's
 * selection, which this suite has none of).
 */
function editor(
  store: Store,
  line: BlockModel,
  services: Map<unknown, unknown>
) {
  const anchor = document.createElement('div');
  const track = vi.fn();
  services.set(TelemetryProvider, { track });
  const run = (command: Command, ctx: Record<string, unknown>) => {
    let out: Record<string, unknown> | undefined;
    if (command === (getSelectedModelsCommand as unknown)) {
      out = { selectedModels: [line] };
    } else {
      command(ctx as never, (next?: object) => {
        out = { ...next };
      });
    }
    return out;
  };
  const std = {
    store,
    host: { updateComplete: Promise.resolve(true) },
    view: { getBlock: () => anchor },
    getOptional: (id: unknown) => services.get(id) ?? null,
    command: {
      exec: (command: Command, input?: object) => {
        const out = run(command, { std, ...input });
        return [!!out, { std, ...out }];
      },
      chain: () => {
        const steps: Array<[Command, object | undefined]> = [];
        const chain = {
          pipe: (command: Command, input?: object) => {
            steps.push([command, input]);
            return chain;
          },
          run: () => {
            let ctx: Record<string, unknown> = { std };
            for (const [command, input] of steps) {
              const out = run(command, { ...ctx, ...input });
              if (!out) return [false, ctx];
              ctx = { ...ctx, ...out };
            }
            return [true, ctx];
          },
        };
        return chain;
      },
    },
  } as unknown as BlockStdScope;
  return { std, anchor, track };
}

const databasesOf = (store: Store, noteId: string) =>
  store
    .getModelById(noteId)!
    .children.filter(
      child => child.flavour === 'affine:database'
    ) as DatabaseBlockModel[];

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('what "Table View" inserts', () => {
  it('without a picker: a native database with 3 rows, no menu asked', async () => {
    const { store, noteId, line } = page();
    const open = vi.fn();
    const services = new Map<unknown, unknown>([
      [DatabaseCreationMenuIdentifier, { open } satisfies DatabaseCreationMenu],
    ]);
    const { std, track } = editor(store, line, services);

    tableView.action({ std, model: line });
    await flush();

    const [database] = databasesOf(store, noteId);
    expect(database?.children).toHaveLength(3);
    expect(database?.props.externalSourceId).toBeUndefined();
    expect(open).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('BlockCreated', {
      blockType: 'affine:database',
    });
    // The slash entry's empty line made way for the database.
    expect(store.getModelById(line.id)).toBeNull();
  });

  it('with a picker and the creation menu: a database with no row, at once, and the menu over it', async () => {
    const { store, noteId, line } = page();
    const open = vi.fn<DatabaseCreationMenu['open']>();
    const createDatabase = vi.fn(async () => null);
    const services = new Map<unknown, unknown>([
      [DataSourcePickerProvider, { list: () => signal([]), createDatabase }],
      [DatabaseCreationMenuIdentifier, { open } satisfies DatabaseCreationMenu],
    ]);
    const { std, anchor, track } = editor(store, line, services);

    tableView.action({ std, model: line });
    // Inserted before anything is awaited: the reader sees it at once.
    const [database] = databasesOf(store, noteId);
    expect(database).toBeDefined();
    expect(database!.children).toHaveLength(0);
    expect(database!.props.views).toHaveLength(1);
    expect(database!.props.views[0]!.mode).toBe('table');
    await flush();

    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith({ std, blockId: database!.id, anchor });
    expect(createDatabase).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledTimes(1);
  });

  it("with a picker alone: the host's createDatabase first, as in 0.61", async () => {
    const { store, noteId, line } = page();
    const createDatabase = vi.fn(async () => null);
    const services = new Map<unknown, unknown>([
      [DataSourcePickerProvider, { list: () => signal([]), createDatabase }],
    ]);
    const { std, track } = editor(store, line, services);

    tableView.action({ std, model: line });
    await flush();

    expect(createDatabase).toHaveBeenCalledTimes(1);
    // The host cancelled: nothing written, the line stays.
    expect(databasesOf(store, noteId)).toHaveLength(0);
    expect(store.getModelById(line.id)).not.toBeNull();
    expect(track).not.toHaveBeenCalled();
  });
});
