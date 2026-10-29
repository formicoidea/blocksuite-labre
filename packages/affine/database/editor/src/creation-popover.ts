import {
  connectDatabaseToSource,
  DATABASE_CREATION_TITLE,
  type DatabaseCreationMenu,
  type DatabaseCreationRequest,
} from '@labre/affine-database-block';
import {
  menu,
  type MenuConfig,
  popMenu,
  popupTargetFromElement,
} from '@labre/affine-components/context-menu';
import {
  type DataSourcePickerDatabase,
  DataSourcePickerProvider,
  type DataSourcePickerService,
  translateKey,
} from '@labre/affine-shared/services';
import { LinkIcon, PlusIcon } from '@blocksuite/icons/lit';
import type { BlockStdScope } from '@labre/std';

import { dataSourcePickerItems } from './data-source-picker.js';
import {
  DATABASE_CREATION_LINK_EXISTING,
  DATABASE_CREATION_NEW_SOURCE,
} from './translations.js';

type ConnectedModel = Parameters<typeof connectDatabaseToSource>[1];

/** The block the entry inserted, while it is still a database. */
function databaseModel(
  std: BlockStdScope,
  blockId: string
): ConnectedModel | null {
  const model = std.store.getModelById(blockId);
  return model?.flavour === 'affine:database'
    ? (model as ConnectedModel)
    : null;
}

/**
 * The popover's items, from the picker alone (held by
 * `creation-popover.unit.spec.ts`): "New empty source" when the host creates
 * a database, "Link an existing source" when it lists one, each connecting
 * the block it was opened over (`connectDatabaseToSource`). A cancelled
 * creation (`null`, or a database with no source) writes nothing.
 */
export function databaseCreationItems(
  std: BlockStdScope,
  picker: DataSourcePickerService,
  blockId: string
): MenuConfig[] {
  const t = (wording: readonly [string, string]) =>
    translateKey(std, wording[0], wording[1]);
  const connect = (database: DataSourcePickerDatabase, sourceId: string) => {
    const model = databaseModel(std, blockId);
    if (model) connectDatabaseToSource(std, model, { database, sourceId });
  };
  const createDatabase = picker.createDatabase;
  const list = picker.list();
  return [
    menu.action({
      name: t(DATABASE_CREATION_NEW_SOURCE),
      prefix: PlusIcon(),
      testId: 'database-creation-new-source',
      hide: () => !createDatabase || std.store.readonly,
      select: () => {
        createDatabase
          ?.call(picker)
          .then(database => {
            const source = database?.sources[0];
            if (database && source) connect(database, source.id);
          })
          .catch(console.error);
      },
    }),
    menu.subMenu({
      name: t(DATABASE_CREATION_LINK_EXISTING),
      prefix: LinkIcon(),
      // A sub-menu entry takes no test id: the class names the entry, the
      // test id the menu it opens.
      class: 'database-creation-link-existing',
      hide: () => list.value.length === 0,
      options: {
        testId: 'database-creation-link-existing',
        items: dataSourcePickerItems(std, picker, {
          offerCreate: false,
          onPick: ({ database, sourceId }) => connect(database, sourceId),
        }),
      },
    }),
  ];
}

/**
 * The creation menu of the `core-database` bundle (ADR 0035 §5, amendment of
 * 2026-10-28): "Table View" and "Kanban View" insert a native database at
 * once and open this popover over it, so a host's database is created or
 * linked only when the reader says which. Escape or a click outside closes
 * it and leaves the native database, which renders and stays editable; a
 * host that sets `requireSource` gets it drawn as an empty view whose
 * "Connect a source" reopens this popover (ADR 0035 amendment of
 * 2026-10-29). Closing writes nothing either way. Without a host picker the
 * entries never call it.
 */
export function databaseCreationMenu(): DatabaseCreationMenu {
  return {
    open: ({ std, blockId, anchor }: DatabaseCreationRequest) => {
      const picker = std.getOptional(DataSourcePickerProvider);
      if (!picker) return;
      popMenu(popupTargetFromElement(anchor), {
        options: {
          title: { text: translateKey(std, ...DATABASE_CREATION_TITLE) },
          testId: 'database-creation-popover',
          items: databaseCreationItems(std, picker, blockId),
        },
      });
    },
  };
}
