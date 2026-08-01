import {
  BpmnRenderViewExtension,
  BpmnViewExtension,
} from '@labre/affine-gfx-bpmn/view';
import {
  BrushRenderViewExtension,
  BrushViewExtension,
} from '@labre/affine-gfx-brush/view';
import {
  CynefinEstuarineRenderViewExtension,
  CynefinEstuarineViewExtension,
} from '@labre/affine-gfx-cynefin-estuarine/view';
import {
  EdgyRenderViewExtension,
  EdgyViewExtension,
} from '@labre/affine-gfx-edgy/view';
import {
  WardleyRenderViewExtension,
  WardleyViewExtension,
} from '@labre/affine-gfx-wardley/view';
import { describe, expect, test } from 'vitest';

import { getInternalStoreExtensions } from '../../extensions/store.js';
import { getInternalViewExtensions } from '../../extensions/view.js';
import { type BlockFlags, OPTIONAL_BLOCKS } from '../../flags.js';
import { AffineSchemas, getAffineSchemas } from '../../schemas.js';
import { getShortcutManifest } from '../../shortcuts.js';

const ALL_OFF = Object.fromEntries(
  OPTIONAL_BLOCKS.map(block => [block, false])
) as BlockFlags;

const flavours = (flags?: BlockFlags) =>
  getAffineSchemas(flags).map(schema => schema.model.flavour);

/**
 * The reversed flag contract (docs/adr/0009): flags gate tooling, never
 * content. The content side of the three assembly points must be completely
 * flag-insensitive.
 */
describe('reversed flag contract — content side is never gated', () => {
  test('schemas are identical whatever the flags say', () => {
    expect(getAffineSchemas()).toEqual(AffineSchemas);
    expect(getAffineSchemas({})).toEqual(AffineSchemas);
    expect(getAffineSchemas(ALL_OFF)).toEqual(AffineSchemas);
  });

  test('every optional block keeps its schema with every flag off', () => {
    const names = flavours(ALL_OFF);
    // core
    expect(names).toContain('affine:page');
    expect(names).toContain('affine:note');
    expect(names).toContain('affine:paragraph');
    expect(names).toContain('affine:surface');
    // optional blocks whose flag is off — still registered, so a stored
    // document containing them still validates and loads.
    expect(names).toContain('affine:database');
    expect(names).toContain('affine:code');
    expect(names).toContain('affine:image');
    expect(names).toContain('affine:latex');
    expect(names).toContain('affine:embed-youtube');
    expect(names).toContain('affine:embed-linked-doc');
    expect(names).toContain('affine:embed-synced-doc');
    expect(names).toContain('affine:edgeless-text');
  });

  test('store extensions are identical whatever the flags say', () => {
    const all = getInternalStoreExtensions();
    expect(getInternalStoreExtensions({})).toEqual(all);
    expect(getInternalStoreExtensions({ database: false })).toEqual(all);
    expect(getInternalStoreExtensions({ latex: false })).toEqual(all);
    expect(getInternalStoreExtensions(ALL_OFF)).toEqual(all);
  });

  test('framework rendering is registered even with every flag off', () => {
    const off = getInternalViewExtensions(ALL_OFF);
    expect(off).toContain(BrushRenderViewExtension);
    expect(off).toContain(WardleyRenderViewExtension);
    expect(off).toContain(EdgyRenderViewExtension);
    expect(off).toContain(CynefinEstuarineRenderViewExtension);
    expect(off).toContain(BpmnRenderViewExtension);
  });
});

describe('reversed flag contract — tooling side is gated', () => {
  test('no flags registers everything, in the legacy order', () => {
    expect(getInternalViewExtensions({})).toEqual(getInternalViewExtensions());
  });

  test.each([
    ['wardley', WardleyViewExtension, WardleyRenderViewExtension],
    ['edgy', EdgyViewExtension, EdgyRenderViewExtension],
    ['cynefin-estuarine', CynefinEstuarineViewExtension, CynefinEstuarineRenderViewExtension],
    ['bpmn', BpmnViewExtension, BpmnRenderViewExtension],
    ['brush', BrushViewExtension, BrushRenderViewExtension],
  ] as const)(
    'the %s flag removes the tooling extension and keeps the render one',
    (flag, tooling, render) => {
      const on = getInternalViewExtensions();
      expect(on).toContain(tooling);
      expect(on).toContain(render);

      const off = getInternalViewExtensions({ [flag]: false });
      expect(off).not.toContain(tooling);
      expect(off).toContain(render);
      // exactly one extension dropped: a single switch per framework
      expect(off).toHaveLength(on.length - 1);
    }
  );

  test('a framework switch also removes its shortcuts from the manifest', () => {
    const on = getShortcutManifest().map(e => e.id);
    expect(on.some(id => id.startsWith('wardley.'))).toBe(true);

    const off = getShortcutManifest({ wardley: false }).map(e => e.id);
    expect(off.some(id => id.startsWith('wardley.'))).toBe(false);
    // core shortcuts are untouched
    expect(off).toContain('undo');
  });

  test('every optional flag off still leaves a usable editor', () => {
    expect(getInternalStoreExtensions(ALL_OFF).length).toBeGreaterThan(0);
    expect(getInternalViewExtensions(ALL_OFF).length).toBeGreaterThan(0);
  });

  test('frame gates both the block view and the frame panel fragment', () => {
    const all = getInternalViewExtensions();
    expect(getInternalViewExtensions({ frame: false })).toHaveLength(
      all.length - 2
    );
  });
});
