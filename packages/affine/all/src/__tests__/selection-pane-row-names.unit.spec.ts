/**
 * GUARD — a selection pane row never reads as a raw translation key.
 *
 * ## What it would have caught
 *
 * On a Wardley map the pane listed rows named `com.labre.wardley.rol…`: the
 * shape of an anchor, of a component, a loose Wardley element. Those elements
 * carry no text of their own, so the row falls back to its ROLE's wording —
 * and ten Wardley roles and three EDGY ones declared a `labelKey` with no
 * `labelFallback`. With no host catalogue, `translateKey` answers the key
 * itself, and the key is what the row printed. A group next to it read
 * "Component" only because its members carried their own text.
 *
 * ## How it checks
 *
 * By mounting the edgeless view extensions for real (the pattern of
 * `reading-coverage.unit.spec.ts`) and reading the role vocabularies and the
 * reading profiles back from the container, so a role added to any framework
 * is covered without anybody listing it. For every role, a textless element
 * carrying it is named the way the pane names a row, with no catalogue
 * injected — the standalone host, where a missing fallback shows. And the
 * last line of defence is pinned on its own: a role a host registers with a
 * key and no wording reads as its element type, never as its key.
 */
import {
  ReadingManager,
  ReadingProfileIdentifier,
  type SurfaceBlockModel,
} from '@labre/affine-block-surface';
import {
  StoreExtensionManager,
  ViewExtensionManager,
} from '@labre/affine-ext-loader';
import { selectionPaneRowLabel } from '@labre/affine-widget-edgeless-toolbar';
import { Container } from '@labre/global/di';
import type { BlockStdScope } from '@labre/std';
import {
  type GfxPrimitiveElementModel,
  RoleVocabularyExtension,
  RoleVocabularyIdentifier,
  type RoleDefs,
} from '@labre/std/gfx';
import { Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { describe, expect, test } from 'vitest';

import { getInternalStoreExtensions } from '../extensions/store.js';
import { getInternalViewExtensions } from '../extensions/view.js';

const KEY_PREFIX = 'com.labre.';

function createSurface(): SurfaceBlockModel {
  const manager = new StoreExtensionManager(getInternalStoreExtensions({}));
  const collection = new TestWorkspace({ id: 'row-names' });
  collection.storeExtensions = manager.get('store');
  collection.meta.initialize();
  const store = collection.createDoc('row-names').getStore({ id: 'row-names' });
  let surfaceId = '';
  store.load(() => {
    const rootId = store.addBlock('affine:page', { title: new Text('names') });
    surfaceId = store.addBlock('affine:surface', {}, rootId);
  });
  return store.getBlock(surfaceId)!.model as SurfaceBlockModel;
}

/**
 * The edgeless view extensions, mounted for real, behind the two reads the
 * row label makes: `std.provider` for the vocabularies, `std.getOptional` for
 * the reading profiles and the (absent) translation seam.
 */
function stdWith(extra: RoleDefs[] = []) {
  const manager = new ViewExtensionManager(getInternalViewExtensions({}));
  const container = new Container();
  manager.get('edgeless').forEach(ext => ext.setup(container));
  extra.forEach(defs => RoleVocabularyExtension(defs).setup(container));
  const provider = container.provider();
  const reading = {
    profiles: Array.from(provider.getAll(ReadingProfileIdentifier).values()),
  };
  const std = {
    provider,
    getOptional: (identifier: unknown) =>
      identifier === ReadingManager
        ? reading
        : provider.getOptional(identifier as never),
  } as unknown as BlockStdScope;
  const vocabularies = Array.from(
    provider.getAll(RoleVocabularyIdentifier).values()
  ) as RoleDefs[];
  return { std, vocabularies };
}

function textlessShape(surface: SurfaceBlockModel, role: string) {
  const id = surface.addElement({ type: 'shape', xywh: '[0,0,10,10]', role });
  return surface.getElementById(id) as GfxPrimitiveElementModel;
}

describe('a selection pane row never shows a raw key', () => {
  test('every role of every framework names its row in words', () => {
    const { std, vocabularies } = stdWith();
    const surface = createSurface();
    const roles = vocabularies.flatMap(defs => Object.keys(defs));
    expect(roles.length).toBeGreaterThan(100);

    const raw = roles
      .map(role => [
        role,
        selectionPaneRowLabel(std, textlessShape(surface, role)),
      ])
      .filter(([, label]) => label.startsWith(KEY_PREFIX))
      .map(([role, label]) => `${role} → ${label}`);

    expect(raw, 'rows named by a raw key').toEqual([]);
  });

  test('a role with a key and no wording reads as its element type', () => {
    const { std } = stdWith([
      {
        'host:thing': {
          id: 'host:thing',
          kind: 'node',
          labelKey: 'com.labre.host.role.thing',
        },
      },
    ]);
    const surface = createSurface();

    expect(
      selectionPaneRowLabel(std, textlessShape(surface, 'host:thing'))
    ).toBe('Shape');
  });
});
