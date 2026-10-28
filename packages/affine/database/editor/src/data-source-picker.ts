import {
  menu,
  type MenuConfig,
  type MenuHandler,
  popMenu,
  type PopupTarget,
} from '@labre/affine-components/context-menu';
import {
  type DataSourcePickerDatabase,
  type DataSourcePickerService,
  DOC_UNTITLED,
  translateKey,
} from '@labre/affine-shared/services';
import { DatabaseTableViewIcon, PlusIcon } from '@blocksuite/icons/lit';
import type { BlockStdScope } from '@labre/std';

import {
  PICKER_EMPTY,
  PICKER_NEW_DATABASE,
  PICKER_NEW_SOURCE,
  PICKER_TITLE,
} from './translations.js';

/** What the user picked: a source of a database, existing or just created. */
export interface DataSourceChoice {
  database: DataSourcePickerDatabase;
  sourceId: string;
  /** `'existing'`, or `'new'` when the host created it for this pick. */
  source: 'existing' | 'new';
}

export interface DataSourcePickerOptions {
  /**
   * Offer the sources of this database only (the "+ view" of a database):
   * they are listed flat, with "New source". Absent, every database the host
   * lists, each a sub-menu of its sources, and "New database".
   */
  databaseId?: string;
  onPick: (choice: DataSourceChoice) => void;
  /**
   * Offer "New database" and "New source" where the host creates them;
   * `true` when absent. The creation popover passes `false`: its own "New
   * empty source" is the way to create, its "Link an existing source" only
   * links (ADR 0035 amendment of 2026-10-28).
   */
  offerCreate?: boolean;
}

function sourceItems(
  std: BlockStdScope,
  picker: DataSourcePickerService,
  database: DataSourcePickerDatabase,
  onPick: DataSourcePickerOptions['onPick'],
  offerCreate: boolean
): MenuConfig[] {
  const t = (wording: readonly [string, string]) =>
    translateKey(std, wording[0], wording[1]);
  const items: MenuConfig[] = database.sources.map(source =>
    menu.action({
      name: source.title || t(DOC_UNTITLED),
      prefix: DatabaseTableViewIcon(),
      testId: `data-source-picker-source-${source.id}`,
      select: () =>
        onPick({ database, sourceId: source.id, source: 'existing' }),
    })
  );
  const createSource = picker.createSource;
  if (createSource && offerCreate && !std.store.readonly) {
    items.push(
      menu.action({
        name: t(PICKER_NEW_SOURCE),
        prefix: PlusIcon(),
        testId: 'data-source-picker-new-source',
        select: () => {
          createSource
            .call(picker, database.id)
            .then(created => {
              if (!created) return;
              onPick({
                database: {
                  ...database,
                  sources: [...database.sources, created],
                },
                sourceId: created.id,
                source: 'new',
              });
            })
            .catch(console.error);
        },
      })
    );
  }
  return items;
}

/**
 * The menu items of the picker, read from `picker.list()` each time the menu
 * draws (`menu.dynamic`), so a list the host fills late shows up open.
 */
export function dataSourcePickerItems(
  std: BlockStdScope,
  picker: DataSourcePickerService,
  options: DataSourcePickerOptions
): MenuConfig[] {
  const t = (wording: readonly [string, string]) =>
    translateKey(std, wording[0], wording[1]);
  const { onPick, databaseId, offerCreate = true } = options;
  const list = picker.list();
  if (databaseId !== undefined) {
    return [
      menu.dynamic(() => {
        const database = list.value.find(d => d.id === databaseId);
        return database
          ? sourceItems(std, picker, database, onPick, offerCreate)
          : [];
      }),
    ];
  }
  const items: MenuConfig[] = [
    menu.dynamic(() => {
      const databases = list.value;
      if (databases.length === 0 && !(offerCreate && picker.createDatabase)) {
        return [
          menu.action({
            name: t(PICKER_EMPTY),
            testId: 'data-source-picker-empty',
            select: () => false,
          }),
        ];
      }
      return databases.map(database =>
        menu.subMenu({
          name: database.title || t(DOC_UNTITLED),
          prefix: DatabaseTableViewIcon(),
          options: {
            items: sourceItems(std, picker, database, onPick, offerCreate),
          },
        })
      );
    }),
  ];
  const createDatabase = offerCreate ? picker.createDatabase : undefined;
  if (createDatabase && !std.store.readonly) {
    items.push(
      menu.group({
        items: [
          menu.action({
            name: t(PICKER_NEW_DATABASE),
            prefix: PlusIcon(),
            testId: 'data-source-picker-new-database',
            select: () => {
              createDatabase
                .call(picker)
                .then(database => {
                  const first = database?.sources[0];
                  if (!database || !first) return;
                  onPick({ database, sourceId: first.id, source: 'new' });
                })
                .catch(console.error);
            },
          }),
        ],
      })
    );
  }
  return items;
}

/**
 * Pop the data-source picker (ADR 0035 §9c, issue B12) at `target`: an
 * existing source, or a new one the host creates. The one picker every
 * caller opens: the "Linked view of a database" slash entry and the
 * "+ view" of the view bar. The host lists and creates; the library only
 * reports the choice.
 */
export function popDataSourcePicker(
  std: BlockStdScope,
  picker: DataSourcePickerService,
  target: PopupTarget,
  options: DataSourcePickerOptions
): MenuHandler {
  return popMenu(target, {
    options: {
      title: { text: translateKey(std, ...PICKER_TITLE) },
      testId: 'data-source-picker',
      items: dataSourcePickerItems(std, picker, options),
    },
  });
}
