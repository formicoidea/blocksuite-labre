/**
 * On a phone a destructive menu entry is drawn in the error colour at rest,
 * label included (#677).
 *
 * `MobileMenuButton` painted the row red but aimed its label rule at
 * `.mobile-menu-action-text`, a class no entry carries: the label is
 * `.affine-menu-action-text`, whose own rule kept it in the primary text
 * colour, so only the icon turned red. The desktop twin of this check is
 * `context-menu-danger-radius.unit.spec.ts`.
 */
import { beforeAll, describe, expect, test, vi } from 'vitest';

vi.mock('@labre/global/env', async importOriginal => ({
  ...(await importOriginal<typeof import('@labre/global/env')>()),
  IS_MOBILE: true,
}));

import { DeleteIcon } from '@blocksuite/icons/lit';

import { effects } from '../context-menu/index.js';
import { Menu } from '../context-menu/menu.js';
import { menu } from '../context-menu/menu-all.js';

const ERROR = 'rgb(201, 12, 34)';
const TEXT = 'rgb(17, 18, 19)';

beforeAll(() => {
  effects();
  document.documentElement.style.setProperty('--affine-error-color', ERROR);
  document.documentElement.style.setProperty(
    '--affine-text-primary-color',
    TEXT
  );
});

const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise(r => setTimeout(r, 0));
};

describe('mobile context menu, destructive entry (#677)', () => {
  test('label and icon take the error colour at rest', async () => {
    const m = new Menu({
      items: [
        menu.action({
          name: 'Delete',
          prefix: DeleteIcon(),
          select: () => {},
          class: { 'delete-item': true },
          testId: 'delete',
        }),
      ],
    });
    document.body.append(m.menuElement);
    await settle();

    const row = document.querySelector<HTMLElement>('[data-testid="delete"]');
    expect(row?.classList.contains('mobile-menu-button')).toBe(true);
    const label = row!.querySelector<HTMLElement>('.affine-menu-action-text')!;
    const icon = row!.querySelector<SVGElement>('svg')!;

    expect(getComputedStyle(label).color).toBe(ERROR);
    expect(getComputedStyle(icon).color).toBe(ERROR);
  });
});
