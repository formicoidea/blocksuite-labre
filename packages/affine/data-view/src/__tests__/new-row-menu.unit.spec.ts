import { signal } from '@preact/signals-core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { coreEffects } from '../core/effect.js';
import {
  type NewRowMenuOpener,
  NewRowMenuOpenerKey,
} from '../core/view-manager/new-row-menu-opener.js';
import type { DataViewUILogicBase } from '../core/view/data-view-base.js';
import { DataViewHeaderToolsAddRow } from '../widget-presets/tools/presets/table-add-row/add-row.js';

/**
 * The header's "New" of every view (table, kanban, gallery, list, calendar,
 * and the full page, which draws the same block) and the host menu beside it
 * (ADR 0035 amendment of 2026-10-14).
 *
 * What it would have caught:
 * - a chevron drawn when the block set no opener, so a host that fills no
 *   seam would see a control opening nothing, or "New" drawn differently;
 * - the main part routed to the host's menu instead of `addRow`, which is
 *   where a host applies its default template;
 * - the chevron also adding a row (its click bubbling to "New");
 * - the chevron without its accessible name, or not saying which view asked;
 * - a read-only view offering either.
 */

beforeAll(() => {
  if (!customElements.get('uni-lit')) coreEffects();
  if (!customElements.get('data-view-header-tools-add-row')) {
    customElements.define(
      'data-view-header-tools-add-row',
      DataViewHeaderToolsAddRow
    );
  }
});

afterEach(() => {
  document.body.innerHTML = '';
});

function setup(options: { opener?: NewRowMenuOpener; readonly?: boolean }) {
  const addRow = vi.fn();
  const view = {
    id: 'view-1',
    readonly$: signal(options.readonly ?? false),
    serviceGet: (key: unknown) =>
      key === NewRowMenuOpenerKey ? (options.opener ?? null) : null,
  };
  const logic = { view, addRow } as unknown as DataViewUILogicBase;
  return { addRow, logic };
}

async function mount(logic: DataViewUILogicBase) {
  const tool = document.createElement('data-view-header-tools-add-row');
  tool.dataViewLogic = logic;
  document.body.append(tool);
  await tool.updateComplete;
  return tool;
}

const chevronOf = (tool: HTMLElement) =>
  tool.querySelector<HTMLElement>('[data-testid="database-new-record-more"]');

const newOf = (tool: HTMLElement) =>
  tool.querySelector<HTMLElement>('data-view-component-button.new-record')!;

describe('"New" without a host menu', () => {
  it('is the single button, which adds a row', async () => {
    const { addRow, logic } = setup({});
    const tool = await mount(logic);
    expect(chevronOf(tool)).toBeNull();
    expect(tool.querySelector('.new-record-split')).toBeNull();
    newOf(tool).click();
    expect(addRow).toHaveBeenCalledWith('start');
  });
});

describe('"New" with a host menu', () => {
  it('keeps adding a row, and the chevron opens the menu', async () => {
    const opener = {
      label: () => 'Templates and options',
      open: vi.fn<NewRowMenuOpener['open']>(),
    };
    const { addRow, logic } = setup({ opener });
    const tool = await mount(logic);

    newOf(tool).click();
    expect(addRow).toHaveBeenCalledTimes(1);
    expect(opener.open).not.toHaveBeenCalled();

    const chevron = chevronOf(tool)!;
    expect(chevron.getAttribute('aria-label')).toBe('Templates and options');
    expect(chevron.getAttribute('title')).toBe('Templates and options');
    chevron.click();
    expect(opener.open).toHaveBeenCalledWith(chevron, 'view-1');
    expect(addRow).toHaveBeenCalledTimes(1);
  });

  it('draws nothing on a read-only view', async () => {
    const opener = { label: () => 'x', open: vi.fn() };
    const { logic } = setup({ opener, readonly: true });
    const tool = await mount(logic);
    expect(chevronOf(tool)).toBeNull();
    expect(tool.querySelector('data-view-component-button')).toBeNull();
  });
});
