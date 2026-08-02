import type { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EdgelessCRUDExtension } from '../extensions/crud-extension.js';
import { ValidationManager, type Violation } from '../extensions/validation.js';

/**
 * Surface-element writes go through `store.transact`, and each write layer has
 * to refuse on its own. This suite pins the two the toolbars and commands
 * reach:
 *
 * - {@link EdgelessCRUDExtension} — the crud bottleneck (apply-last-style,
 *   group, duplicate, …). `SurfaceBlockModel` underneath it already THROWS on
 *   readonly; the guard's job is to turn that exception into the quiet,
 *   logged refusal the store's own block CRUD performs (`updateBlock` /
 *   `deleteBlock` / `moveBlocks` all `console.error` and return). Hence the
 *   `console.error` assertions below: a silent return would be the only
 *   refusal in the repo with no signal at all.
 * - {@link ValidationManager} — exceptions and profiles, which write through
 *   `@field()` accessors and bypass crud entirely. There the return VALUE is
 *   the contract: every caller gates its `track` on a non-empty / `true`
 *   result (`violation-detail-widget._setException`, `validation-toolbar`
 *   `pickProfile` and revoke action), so no write ⇒ no telemetry.
 *
 * The stubs deliberately provide NOTHING beyond `std.store.readonly`: any
 * guarded method that gets past its guard reaches for `std.get` / `this.gfx`
 * and throws, so a regression fails loudly rather than silently passing.
 */

const readonlyStd = {
  store: { readonly: true },
  get: () => {
    throw new Error('a readonly guard must exit before touching the surface');
  },
} as never;

describe('EdgelessCRUDExtension refuses to write a readonly document', () => {
  const crud = new EdgelessCRUDExtension(readonlyStd);
  let logged: string[];

  beforeEach(() => {
    logged = [];
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      logged.push(args.join(' '));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('updateElement is a no-op, and says so', () => {
    expect(crud.updateElement('el', { fillColor: 'red' })).toBeUndefined();
    expect(logged).toEqual(['cannot update an element in readonly mode']);
  });

  it('addElement adds nothing, and says so', () => {
    expect(crud.addElement('shape', {})).toBeUndefined();
    expect(logged).toEqual(['cannot add an element in readonly mode']);
  });

  it('deleteElements deletes nothing, and says so', () => {
    expect(crud.deleteElements([{ id: 'el' } as never])).toBeUndefined();
    expect(logged).toEqual(['cannot delete elements in readonly mode']);
  });

  it('removeElement removes nothing, and says so', () => {
    expect(crud.removeElement('el')).toBeUndefined();
    expect(logged).toEqual(['cannot remove an element in readonly mode']);
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
