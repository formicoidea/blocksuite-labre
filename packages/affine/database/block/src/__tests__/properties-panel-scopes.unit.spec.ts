/**
 * GUARD — a database view's "Properties" follows the host panel's `scopes`
 * (issue #708, ADR 0035 amendment of 2026-11-22).
 *
 * What it would have caught: one `PropertiesPanelProvider` deciding for the
 * title band AND every database view of an editor, so a host that keeps
 * its panel for the page sheet (`scopes: ['page']`) could not leave a
 * view's "Properties" to the data-view's own menu; a panel without
 * `scopes` no longer opening for a view (the 4.1 behaviour). This spec holds
 * `openDatabasePropertiesPanel`; the block's own condition (the opener set
 * only for `'source'`) is held in a real editor by
 * `integration-test/…/page/database-seams.spec.ts`.
 */
import type { DatabaseBlockModel } from '@labre/affine-model';
import {
  PropertiesPanelProvider,
  type PropertiesPanelService,
} from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { describe, expect, test, vi } from 'vitest';

import { openDatabasePropertiesPanel } from '../service/properties-panel.js';

const MODEL = {
  id: 'block-1',
  store: { id: 'doc-1' },
  props: { views: [{ id: 'v-1', sourceId: 's-1' }] },
} as unknown as DatabaseBlockModel;

function stdWith(panel: PropertiesPanelService | null) {
  return {
    getOptional: (id: unknown) =>
      id === PropertiesPanelProvider ? panel : null,
  } as unknown as BlockStdScope;
}

describe('openDatabasePropertiesPanel and scopes', () => {
  test('a panel without scopes opens on the view, as in 4.1', () => {
    const panel = { open: vi.fn(), close: vi.fn() };
    expect(openDatabasePropertiesPanel(stdWith(panel), MODEL, 'v-1')).toBe(
      true
    );
    expect(panel.open).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'source',
        blockId: 'block-1',
        viewId: 'v-1',
      })
    );
  });

  test("a panel answering 'page' only is not opened: the caller keeps its menu", () => {
    const panel = { open: vi.fn(), close: vi.fn(), scopes: ['page'] as const };
    expect(openDatabasePropertiesPanel(stdWith(panel), MODEL, 'v-1')).toBe(
      false
    );
    expect(panel.open).not.toHaveBeenCalled();
  });

  test("a panel answering 'source' opens", () => {
    const panel = {
      open: vi.fn(),
      close: vi.fn(),
      scopes: ['source'] as const,
    };
    expect(openDatabasePropertiesPanel(stdWith(panel), MODEL, 'v-1')).toBe(
      true
    );
  });
});
