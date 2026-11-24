/**
 * A stored `affine:data-view` block, on a real editor: its placeholder and its
 * only control (issue #745, ADR 0035 amendment of 2026-11-24). The unit side
 * is `database/view-block/src/__tests__/block-mount.unit.spec.ts`.
 *
 * What it would have caught: the block failing to mount in the editor (its
 * unported data source threw on first render); its "⋯" (rename, copy,
 * delete), the only control left under the placeholder, out of the keyboard's
 * reach (it was a `<div>` with a click handler); that control drawn on a
 * read-only document.
 */
import { userEvent } from '@vitest/browser/context';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { addNote } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

const TITLE = 'Imported from AFFiNE';
const OPTIONS = '[data-testid="data-view-block-options"]';
const STATUS = '[data-testid="data-view-block-unavailable"]';

const openMenus = () => [...document.querySelectorAll('affine-menu')];

describe('a stored data-view block', () => {
  let id = '';

  beforeEach(async () => {
    const cleanup = await setupEditor('page');
    id = window.doc.addBlock(
      'affine:data-view',
      { title: TITLE },
      addNote(window.doc)
    );
    return () => {
      window.doc.readonly = false;
      cleanup();
    };
  });

  function block() {
    return document.querySelector<HTMLElement>(`[data-block-id="${id}"]`);
  }

  test('mounts and draws its title and the placeholder', async () => {
    const status = await vi.waitFor(() => {
      const status = block()?.querySelector(STATUS);
      if (!status) throw new Error('no placeholder yet');
      return status;
    });

    expect(status.getAttribute('role')).toBe('status');
    expect(block()?.textContent).toContain(TITLE);
  });

  test('its "⋯" is reached and pressed from the keyboard', async () => {
    const options = await vi.waitFor(() => {
      const options = block()?.querySelector<HTMLButtonElement>(OPTIONS);
      if (!options) throw new Error('no block menu yet');
      return options;
    });

    options.focus();
    expect(document.activeElement).toBe(options);
    expect(options.getAttribute('aria-label')).toBe('Block options');
    await userEvent.keyboard('{Enter}');

    await vi.waitFor(() => expect(openMenus().length).toBe(1));
  });

  test('a read-only document draws no "⋯"', async () => {
    await vi.waitFor(() => {
      if (!block()?.querySelector(STATUS)) throw new Error('no placeholder');
    });
    window.doc.readonly = true;

    await vi.waitFor(() => expect(block()?.querySelector(OPTIONS)).toBeNull());
    expect(block()?.querySelector(STATUS)).not.toBeNull();
  });
});
