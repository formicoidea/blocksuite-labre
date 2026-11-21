import {
  menu,
  popMenu,
  type PopupTarget,
} from '@labre/affine-components/context-menu';
import type {
  DatabaseAllEvents,
  EventTraceFn,
} from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { html } from 'lit';

import type { DataSource } from '../data-source/base.js';
import { viewDefaultName } from '../view/default-name.js';
import {
  type AddViewMenuContext,
  AddViewMenuIdentifier,
  ViewCreationOffKey,
} from './view-creation.js';

/*
 * The views bar's "+" gesture, shared with the empty state of a database
 * with no view (ADR 0035 amendment of 2026-11-20). Engine-internal: both
 * callers live here, so `view-manager/index.ts` does not re-export this
 * file and no host sees it.
 */

/**
 * Whether a view may be added to `dataSource` now: it is writable and its
 * host did not switch view creation off (`ViewCreationOffKey`).
 */
export function canAddView(dataSource: DataSource): boolean {
  return (
    !dataSource.readonly$.value &&
    dataSource.serviceGet(ViewCreationOffKey) !== true
  );
}

/** Who adds a view: the views bar's "+", or the empty state of no view. */
export interface AddViewGesture {
  std: BlockStdScope | undefined;
  dataSource: DataSource;
  eventTrace: EventTraceFn<DatabaseAllEvents>;
  /** After the view is added and made current (the block remembers it). */
  onAdded?: (viewId: string) => void;
}

/**
 * The one "add a view" gesture (ADR 0035 B11): the name is resolved at the
 * gesture and written as is (ADR 0023), the view is made current, and
 * `DatabaseViewAdded` is reported once (B17), `source` saying whether the
 * gesture created the source the view reads. Returns its id.
 */
function addViewOf(gesture: AddViewGesture) {
  return (type: string, source: 'existing' | 'new' = 'existing') => {
    const { dataSource, std } = gesture;
    const manager = dataSource.viewManager;
    const id = manager.viewAdd(
      type,
      viewDefaultName(dataSource.viewMetaGet(type), std)
    );
    manager.setCurrentView(id);
    gesture.onAdded?.(id);
    gesture.eventTrace('DatabaseViewAdded', { viewType: type, source });
    return id;
  };
}

/**
 * Pops what "+" offers: the `AddViewMenu` a package above registers (the
 * `core-database` bundle's sources) when it handles this source, the
 * creatable presets otherwise, as in 0.48.
 */
export function popAddViewMenu(target: PopupTarget, gesture: AddViewGesture) {
  const { std, dataSource } = gesture;
  const addView = addViewOf(gesture);
  const addViewMenu = std?.getOptional(AddViewMenuIdentifier);
  const context: AddViewMenuContext = {
    std,
    dataSource,
    viewManager: dataSource.viewManager,
    addView,
  };
  const items = addViewMenu?.items(context);
  const placeholder = items && addViewMenu?.searchPlaceholder?.(context);
  const presets = () =>
    dataSource.viewMetas.map(meta =>
      menu.action({
        name: viewDefaultName(meta, std),
        testId: 'database-add-view-preset',
        prefix: html`<uni-lit .uni=${meta.renderer.icon}></uni-lit>`,
        select: () => {
          addView(meta.type);
        },
      })
    );
  popMenu(target, {
    options: {
      items: items ?? presets(),
      search: placeholder ? { placeholder } : undefined,
    },
  });
}
