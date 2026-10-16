/**
 * The default `@` menu references, it does not create (PO, 2026-10-14: "the
 * @ name refers to an existing page, the /page creates a new one").
 *
 * Would have caught: the default `getMenus` still appending the "New Doc"
 * group (create + import), so a host without its own `getMenus` — the
 * playground — offered to create a page from `@` while the Labre app did not.
 * The creation group itself stays exported (`LinkedWidgetUtils`) for a host
 * that wants it back.
 */
import { DocModeProvider } from '@labre/affine-shared/services';
import type { AffineInlineEditor } from '@labre/affine-shared/types';
import type { BlockStdScope, EditorHost } from '@labre/std';
import { describe, expect, test } from 'vitest';

import { getMenus, LinkedWidgetUtils } from '../config.js';

function fakeEditorHost(): EditorHost {
  const docMetas = [
    { id: 'current-doc', title: 'Here' },
    { id: 'other', title: 'Roadmap' },
  ];
  const std = {
    get: (id: unknown) => {
      if (id === DocModeProvider) {
        return { getPrimaryMode: () => 'page' as const };
      }
      throw new Error('unexpected std.get in test fake');
    },
    getOptional: () => undefined,
  } as unknown as BlockStdScope;
  return {
    store: { id: 'current-doc', workspace: { meta: { docMetas } } },
    std,
  } as unknown as EditorHost;
}

describe('default @ menu', () => {
  test('lists existing pages only, with no creation group', async () => {
    const groups = await getMenus(
      'Road',
      () => {},
      fakeEditorHost(),
      {} as AffineInlineEditor
    );
    expect(groups).toHaveLength(1);
    const items = groups[0]!.items;
    const keys = (Array.isArray(items) ? items : items.value).map(i => i.key);
    expect(keys).toEqual(['other']);
    expect(keys).not.toContain('create');
    expect(keys).not.toContain('import');
  });

  test('a query matching nothing offers nothing to create', async () => {
    const groups = await getMenus(
      'Nothing like this',
      () => {},
      fakeEditorHost(),
      {} as AffineInlineEditor
    );
    const items = groups.flatMap(g => (Array.isArray(g.items) ? g.items : []));
    expect(items).toEqual([]);
  });

  test('the creation group is still exported for a host that wants it', () => {
    expect(typeof LinkedWidgetUtils.createNewDocMenuGroup).toBe('function');
  });
});
