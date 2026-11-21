import type { Clipboard } from '@labre/std';
import { signal } from '@preact/signals-core';
import { describe, expect, test } from 'vitest';

import type { DataSource } from '../core/data-source/index.js';
import { DataViewRootUILogic } from '../core/data-view.js';

/**
 * A host that builds its own `DataViewRootUILogic` keeps compiling: the
 * renderer config only WIDENS in a minor (CLAUDE.md, docs/lessons.md 33).
 *
 * 4.1 (ADR 0035 amendment of 2026-11-20) added two optional members,
 * `noViewHeader` (what of the caller's header to draw above the empty state
 * of a source with no view) and `onChangeView` (a view added from it). A
 * required member, or a member whose type narrowed, would have broken every
 * host passing the 4.0 shape. `fourZeroConfig` below is that literal, typed
 * against the current config by `yarn build` (tests included).
 */

type RendererConfig = ConstructorParameters<typeof DataViewRootUILogic>[0];

/** The config as a 4.0 host wrote it, member for member. */
const fourZeroConfig = (dataSource: DataSource): RendererConfig => ({
  clipboard: {} as Clipboard,
  notification: { toast: () => {} },
  virtualPadding$: signal(0),
  headerWidget: undefined,
  handleEvent: () => ({ dispose: () => {} }),
  bindHotkey: () => ({ dispose: () => {} }),
  dataSource,
  selection$: signal(undefined),
  setSelection: () => {},
  eventTrace: () => {},
  viewPlaceholder: () => undefined,
  detailPanelConfig: { openDetailPanel: () => Promise.resolve() },
});

describe('the renderer config keeps its 4.0 shape', () => {
  test('a 4.0 config builds a root, with neither new member', () => {
    const dataSource = {
      viewManager: { currentViewId$: signal(undefined) },
    } as unknown as DataSource;
    const root = new DataViewRootUILogic(fourZeroConfig(dataSource));

    expect(root.config.noViewHeader).toBeUndefined();
    expect(root.config.onChangeView).toBeUndefined();
    expect(root.currentViewId$.value).toBeUndefined();
  });
});
