import { HostedDataSourceBase } from '@labre/affine-block-database';
import { menu, type MenuConfig } from '@labre/affine-components/context-menu';
import {
  type ChromeWording,
  translateKey,
} from '@labre/affine-shared/services';
import type { AddViewMenu, AddViewMenuContext } from '@labre/data-view';
import { PlusIcon } from '@blocksuite/icons/lit';
import { html } from 'lit';

import {
  DATABASE_ADD_VIEW_EXISTING_SOURCE,
  DATABASE_ADD_VIEW_NEW_SOURCE,
  DATABASE_ADD_VIEW_UNTITLED_SOURCE,
} from '../translations.js';
import { addViewOnSource } from './add-view-on-source.js';
import { type AddViewSource, existingSources } from './add-view-sources.js';

/**
 * What the data-source picker seam (ADR 0035 §9c, B12) gives "+ view", as
 * this menu reads it. Both optional: without `createSource` there is no
 * "With a new source"; without `extraSourceIds` only the sources the views
 * already read are listed (the seams table's "When absent").
 */
export interface AddViewSourcePicker {
  /** Sources of this database that no view reads yet. */
  extraSourceIds?(dataSource: HostedDataSourceBase): readonly string[];
  /** Creates a source in this database; resolves to its id, or nothing. */
  createSource?(dataSource: HostedDataSourceBase): Promise<string | undefined>;
}

/**
 * What "+ view" draws, decided from the sources alone (pure, held by
 * `add-view-menu.unit.spec.ts`): the presets themselves when there is
 * nothing to choose (one source, no way to create one), otherwise the
 * entries, "On an existing source" only when there is one.
 */
export type AddViewMenuShape =
  | { kind: 'presets'; source: AddViewSource | undefined }
  | { kind: 'entries'; existing: AddViewSource[]; newSource: boolean };

export function addViewMenuShape(
  sources: AddViewSource[],
  canCreateSource: boolean
): AddViewMenuShape {
  if (!canCreateSource && sources.length <= 1) {
    return { kind: 'presets', source: sources[0] };
  }
  return { kind: 'entries', existing: sources, newSource: canCreateSource };
}

/**
 * The "+ view" menu of a database whose views read named sources (ADR 0035
 * §1, §7, B11; labre ADR-0046 §5 and PRD REQ-DB-7: "+ view has three
 * entries"):
 *
 * 1. "On an existing source": the creatable presets, on one of the sources
 *    the views read (`existingSources`), a sub-menu per source when there
 *    are several. With one source and nothing else to offer, the presets
 *    are the menu itself, as in 0.48.
 * 2. "With a new source": asks the picker for a source, then adds a table on
 *    it. Absent without the picker's `createSource`: that is the host's kill
 *    switch on creating sources (labre ADR-0046 §10).
 * 3. "Import a view from another database" (labre REQ-DB-2) has no library
 *    seam in ADR 0035: not drawn.
 *
 * A data source that does not resolve sources (an inline database, a 0.48
 * host source) has one implicit source: the bar keeps its presets list.
 *
 * ponytail: 3 waits for an ADR 0035 amendment that gives the picker an
 * import verb (vague 3, « Cette vue » et import de vue); the picker itself is
 * B12's `DataSourcePickerExtension`, adapted to `AddViewSourcePicker` where
 * the tooling extension registers this menu (`../view.ts`).
 */
export function databaseAddViewMenu(
  picker: (context: AddViewMenuContext) => AddViewSourcePicker | null
): AddViewMenu {
  return {
    items: context => {
      const { dataSource } = context;
      if (!(dataSource instanceof HostedDataSourceBase)) return;
      if (!dataSource.resolvesSources) return;
      const wording = (w: ChromeWording) =>
        context.std ? translateKey(context.std, ...w) : w[1];
      const sourcePicker = picker(context);
      const sources = existingSources({
        viewSourceIds: dataSource.viewDataList$
          .peek()
          .map(view => (view as { sourceId?: string }).sourceId),
        resolve: sourceId => {
          const schema = dataSource.sourceOf(sourceId)?.schema;
          return schema
            ? { schemaId: schema.id, title: schema.props.title.toString() }
            : null;
        },
        extraSourceIds: sourcePicker?.extraSourceIds?.(dataSource),
      });
      const presetsOn = (source: AddViewSource | undefined) =>
        dataSource.viewMetas.map(meta =>
          menu.action({
            name: meta.model.defaultName,
            testId: 'database-add-view-preset',
            prefix: html`<uni-lit .uni=${meta.renderer.icon}></uni-lit>`,
            select: () => {
              addViewOnSource(context, dataSource, meta.type, source?.sourceId);
            },
          })
        );
      const createSource = sourcePicker?.createSource?.bind(sourcePicker);
      const shape = addViewMenuShape(sources, createSource !== undefined);
      if (shape.kind === 'presets') {
        return presetsOn(shape.source);
      }
      const { existing } = shape;
      const items: MenuConfig[] = [];
      if (existing.length > 0) {
        items.push(
          menu.subMenu({
            name: wording(DATABASE_ADD_VIEW_EXISTING_SOURCE),
            options: {
              items:
                existing.length === 1
                  ? presetsOn(existing[0])
                  : existing.map(source =>
                      menu.subMenu({
                        name:
                          source.title ||
                          wording(DATABASE_ADD_VIEW_UNTITLED_SOURCE),
                        options: { items: presetsOn(source) },
                      })
                    ),
            },
          })
        );
      }
      if (shape.newSource && createSource) {
        items.push(
          menu.action({
            name: wording(DATABASE_ADD_VIEW_NEW_SOURCE),
            prefix: PlusIcon(),
            testId: 'database-add-view-new-source',
            select: () => {
              createSource(dataSource)
                .then(sourceId => {
                  // The source arrived after a round trip: the page may have
                  // turned read-only meanwhile.
                  if (sourceId === undefined || dataSource.readonly$.peek()) {
                    return;
                  }
                  addViewOnSource(context, dataSource, 'table', sourceId);
                })
                .catch(error => {
                  console.error(error);
                });
            },
          })
        );
      }
      return items;
    },
  };
}
