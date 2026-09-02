import type { ToolbarContext } from '@labre/affine-shared/services';
import type { C4BoardLevel } from '@labre/affine-model';
import { render, type TemplateResult } from 'lit';
import { afterEach, describe, expect, it } from 'vitest';

import { C4_BOARD_LEVEL_MENU } from '../levels';
import { c4BoardToolingToolbarConfig } from '../toolbar/config';
import { fakeBoard } from './board-stub';

/**
 * How the C4 level dropdown READS (PO recette of 02/09/2026).
 *
 * The picker's behaviour — what it writes, what it clears, what it reports —
 * belongs to the integration suite and to `levels.ts`. What is pinned here is
 * the row shape the whole editor now shares: the native one, from the
 * Regular/Semibold panel and the size dropdowns. Label on the left, tick on the
 * right and only on the option in force, no gutter held open for a tick that is
 * not there, and `data-option` on the row — which is what carries the primary
 * colour, in `editor-menu-action`'s own stylesheet.
 *
 * Three home-made dropdowns restated the opposite shape (this one, the tag
 * qualifier, the validation profile), so all three are pinned the same way and
 * drift in any one of them fails a test rather than a recette.
 */
describe('the C4 level dropdown reads like the native menus', () => {
  const hosts: HTMLElement[] = [];
  afterEach(() => {
    while (hosts.length) hosts.pop()!.remove();
  });

  /** The rendered rows for a board declared at `level`. */
  function rows(level: C4BoardLevel | undefined): HTMLElement[] {
    const board = fakeBoard('board', [0, 0, 400, 300], 'Payments');
    Object.defineProperty(board, 'level', { value: level, configurable: true });

    const ctx = {
      std: { getOptional: () => undefined },
      getSurfaceModels: () => [board],
    } as unknown as ToolbarContext;

    const action = c4BoardToolingToolbarConfig.actions.find(
      candidate => candidate.id === 'c.level'
    ) as { content: (c: ToolbarContext) => TemplateResult | null };
    const template = action.content(ctx);
    expect(template).not.toBeNull();

    const host = document.createElement('div');
    document.body.append(host);
    hosts.push(host);
    render(template, host);
    return Array.from(
      host.querySelectorAll<HTMLElement>('[data-testid="c4-level-option"]')
    );
  }

  it('opts every row into the native option shape', () => {
    const offered = rows('container');
    expect(offered).toHaveLength(C4_BOARD_LEVEL_MENU.options.length);
    for (const row of offered) {
      expect(row.hasAttribute('data-option'), row.dataset.level).toBe(true);
    }
  });

  it('draws the tick AFTER the label, and only on the level in force', () => {
    for (const row of rows('container')) {
      const children = Array.from(row.children);
      // The label opens every row — a tick on the left is the non-native shape
      // this PR undid, and the hole it left on the other rows is what read as a
      // missing icon.
      expect(children[0].className, row.dataset.level).toBe('label');
      const on = row.dataset.level === 'container';
      expect(row.dataset.selected, row.dataset.level).toBe(
        on ? 'true' : undefined
      );
      expect(children.length, row.dataset.level).toBe(on ? 2 : 1);
      if (on) expect(children[1].tagName.toLowerCase()).toBe('svg');
    }
  });

  it('ticks the free-sketch row on a board that declares nothing', () => {
    // The default is reachable and is a CHOICE, so it is ticked like any other
    // — the one row whose value is the absence of one.
    const offered = rows(undefined);
    const sketch = offered.find(row => row.dataset.level === 'none')!;
    expect(sketch.dataset.selected).toBe('true');
    expect(sketch.querySelector('svg')).not.toBeNull();
    for (const row of offered.filter(candidate => candidate !== sketch)) {
      expect(row.querySelector('svg'), row.dataset.level).toBeNull();
    }
  });
});
