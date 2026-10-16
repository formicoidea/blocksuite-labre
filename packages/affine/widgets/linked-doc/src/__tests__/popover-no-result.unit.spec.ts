/**
 * The `@` popover says "No page found" instead of opening as an empty box.
 *
 * What it would have caught: since `@` references existing pages only (the
 * "New Doc" group left the default menus), a query that matches nothing, or a
 * host `getMenus` whose corpus is not loaded yet, rendered a popover with no
 * line at all, which read as a broken menu (seen on the Labre app, P7).
 */
import { render } from 'lit';
import { describe, expect, it } from 'vitest';

import type { LinkedMenuGroup } from '../config.js';
import { LinkedDocPopover } from '../linked-doc-popover.js';

const TAG = 'test-linked-doc-popover';
if (!customElements.get(TAG)) customElements.define(TAG, LinkedDocPopover);

function rendered(groups: LinkedMenuGroup[]) {
  const popover = new LinkedDocPopover();
  popover.context = {
    std: { getOptional: () => null },
  } as unknown as LinkedDocPopover['context'];
  (
    popover as unknown as { _linkedDocGroup: LinkedMenuGroup[] }
  )._linkedDocGroup = groups;
  const host = document.createElement('div');
  render(popover.render(), host);
  return host;
}

describe('the @ popover with nothing to offer', () => {
  it('says so when every group is empty', () => {
    const host = rendered([{ name: 'Link to Page', items: [] }]);
    expect(
      host.querySelector('[data-testid="linked-doc-no-result"]')?.textContent
    ).toContain('No page found');
  });

  it('says nothing more when a group has a match', () => {
    const host = rendered([
      {
        name: 'Link to Page',
        items: [
          { key: 'a', name: 'A page', icon: null as never, action: () => {} },
        ],
      },
    ]);
    expect(
      host.querySelector('[data-testid="linked-doc-no-result"]')
    ).toBeNull();
  });
});
