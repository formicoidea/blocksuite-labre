import type { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import { EdgelessCRUDExtension } from '../extensions/crud-extension.js';
import { ValidationManager, type Violation } from '../extensions/validation.js';

/**
 * `store.transact` carries no readonly guard (unlike the store's block CRUD),
 * so every surface-element write path has to refuse on its own. This suite
 * pins the two write layers that gestures reach:
 *
 * - {@link EdgelessCRUDExtension} — the crud bottleneck commands and toolbars
 *   go through (apply-last-style, group, duplicate, …);
 * - {@link ValidationManager} — exceptions and profiles, which write through
 *   `@field()` accessors and bypass crud entirely.
 *
 * The stubs deliberately provide NOTHING beyond `std.store.readonly`: any
 * guarded method that gets past its guard reaches for `std.get` / `this.gfx`
 * and throws, so a regression fails loudly rather than silently passing.
 *
 * "No telemetry" rides on the same returns: every caller gates its `track` on
 * a non-empty / `true` result (`violation-detail-widget._setException`,
 * `validation-toolbar` `pickProfile` and revoke action).
 */

const readonlyStd = {
  store: { readonly: true },
  get: () => {
    throw new Error('a readonly guard must exit before touching the surface');
  },
} as never;

describe('EdgelessCRUDExtension refuses to write a readonly document', () => {
  const crud = new EdgelessCRUDExtension(readonlyStd);

  it('updateElement is a no-op', () => {
    expect(crud.updateElement('el', { fillColor: 'red' })).toBeUndefined();
  });

  it('addElement adds nothing', () => {
    expect(crud.addElement('shape', {})).toBeUndefined();
  });

  it('deleteElements deletes nothing', () => {
    expect(crud.deleteElements([{ id: 'el' } as never])).toBeUndefined();
  });

  it('removeElement removes nothing', () => {
    expect(crud.removeElement('el')).toBeUndefined();
  });

  it('the guard is what stops the write, not a lucky missing surface', () => {
    const writable = new EdgelessCRUDExtension({
      store: { readonly: false },
      get: () => {
        throw new Error('reached past the guard');
      },
    } as never);
    expect(() => writable.updateElement('el', {})).toThrow(
      'reached past the guard'
    );
  });
});

describe('ValidationManager refuses to arbitrate on a readonly document', () => {
  // Prototype calls on a bare stub: the guard is the first statement of each
  // method, so nothing else of the manager's machinery is needed — and any
  // access beyond `std.store.readonly` throws on the missing property.
  const manager = { std: readonlyStd } as unknown as ValidationManager;
  const element = { id: 'el' } as GfxPrimitiveElementModel;
  const violations: Violation[] = [
    {
      ruleId: 'test.rule',
      elementIds: ['el'],
      severity: 'warning',
      messageKey: 'k',
    },
  ];

  it('setException writes nothing and reports nothing', () => {
    expect(
      ValidationManager.prototype.setException.call(
        manager,
        violations,
        'element',
        true
      )
    ).toEqual([]);
  });

  it('setProfile writes nothing and reports nothing', () => {
    expect(
      ValidationManager.prototype.setProfile.call(manager, element, 'p')
    ).toBe(false);
  });

  it('revokeExceptionsOn revokes nothing and reports nothing', () => {
    expect(
      ValidationManager.prototype.revokeExceptionsOn.call(manager, element)
    ).toEqual([]);
  });
});
