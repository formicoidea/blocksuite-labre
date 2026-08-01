import type { ToolbarContext } from '@labre/affine-shared/services';
import {
  TelemetryProvider,
  TranslationProvider,
} from '@labre/affine-shared/services';
import { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { describe, expect, it, vi } from 'vitest';

import type { AnchoredException, RevokedException } from '../extensions/validation.js';
import { ValidationManager } from '../extensions/validation.js';
import { validationExceptionToolbarConfig } from '../extensions/validation-toolbar.js';

/**
 * The "Revoke exception" toolbar entry (PF8, PO acceptance of 01/08).
 *
 * The entry's own logic is what is tested here — when it offers itself, what it
 * asks the manager to do, and what it reports. Turning a `ToolbarModuleConfig`
 * into a button is BlockSuite's toolbar machinery, driven by the real editor
 * and out of this spec's hands; what an element ANSWERS FOR is the manager's
 * job, and it is tested against real groups in
 * `packages/integration-test/.../wardley-revoke-exception.spec.ts`.
 */

const [revokeAction] = validationExceptionToolbarConfig.actions;

/**
 * Built on the real prototype, because the entry narrows the selection with
 * `instanceof GfxPrimitiveElementModel` — a plain object would be filtered out
 * and every assertion below would pass for the wrong reason.
 */
const element = (id: string): GfxPrimitiveElementModel => {
  const stub = Object.create(GfxPrimitiveElementModel.prototype);
  // `id` and `type` are prototype GETTERS, so they are shadowed rather than
  // assigned.
  Object.defineProperties(stub, {
    id: { get: () => id },
    type: { get: () => 'wardleyNode' },
  });
  return stub as GfxPrimitiveElementModel;
};

type ManagerStub = {
  revocableExceptionsOn: (
    element: GfxPrimitiveElementModel
  ) => AnchoredException[];
  revokeExceptionsOn: (
    element: GfxPrimitiveElementModel
  ) => RevokedException[];
};

/**
 * A toolbar context reduced to what the entry actually touches: the selection,
 * the DI lookups behind `translateKey` and the manager, and `track`.
 */
function context(options: {
  selection?: GfxPrimitiveElementModel[];
  manager?: ManagerStub | null;
  catalogue?: Record<string, string>;
  track?: (name: string, props: Record<string, unknown>) => void;
}): ToolbarContext {
  const {
    selection = [],
    manager = null,
    catalogue = {},
    track = () => {},
  } = options;

  const std = {
    getOptional: (identifier: unknown) => {
      if (identifier === ValidationManager) return manager;
      if (identifier === TranslationProvider) {
        return { t: (key: string) => catalogue[key] };
      }
      if (identifier === TelemetryProvider) return { track };
      return null;
    },
  };

  return {
    std,
    getSurfaceModels: () => selection,
    track,
  } as unknown as ToolbarContext;
}

const exception = (
  el: GfxPrimitiveElementModel,
  ruleId = 'wardley.component-outside-map'
): AnchoredException => ({ element: el, ruleId });

const managerWith = (
  anchored: AnchoredException[],
  revoked: RevokedException[] = []
): ManagerStub => ({
  revocableExceptionsOn: () => anchored,
  revokeExceptionsOn: () => revoked,
});

const shows = (ctx: ToolbarContext) =>
  typeof revokeAction.when === 'function' ? revokeAction.when(ctx) : false;

describe('when the revoke entry offers itself', () => {
  it('shows on an element that answers for an exception', () => {
    const el = element('n1');
    expect(
      shows(context({ selection: [el], manager: managerWith([exception(el)]) }))
    ).toBe(true);
  });

  it('stays away from an element carrying nothing', () => {
    expect(
      shows(context({ selection: [element('n1')], manager: managerWith([]) }))
    ).toBe(false);
  });

  it('stays away when nothing is selected', () => {
    const el = element('n1');
    expect(
      shows(context({ selection: [], manager: managerWith([exception(el)]) }))
    ).toBe(false);
  });

  it('stays away on a multiple selection', () => {
    // "Revoke the exception" has no honest meaning across a mixed bag: the
    // entry is one arbitration, on one thing.
    const a = element('n1');
    const b = element('n2');
    expect(
      shows(
        context({ selection: [a, b], manager: managerWith([exception(a)]) })
      )
    ).toBe(false);
  });

  it('stays away with no validation manager at all', () => {
    const el = element('n1');
    expect(shows(context({ selection: [el], manager: null }))).toBe(false);
  });
});

describe('what the entry says', () => {
  it('falls back to English chrome with no catalogue', () => {
    const el = element('n1');
    const ctx = context({
      selection: [el],
      manager: managerWith([exception(el)]),
    });
    const action = revokeAction.generate(ctx);

    expect(action?.label).toBe('Revoke exception');
    // Words, not a glyph: taking back a recorded decision is not something to
    // guess at from an icon.
    expect(action?.showLabel).toBe(true);
    expect(action?.tooltip).toBe('Revoke exception');
  });

  it('resolves the label through the host catalogue', () => {
    const el = element('n1');
    const ctx = context({
      selection: [el],
      manager: managerWith([exception(el)]),
      catalogue: {
        'com.labre.validation.action.revoke-exception': "Lever l'exception",
      },
    });

    expect(revokeAction.generate(ctx)?.label).toBe("Lever l'exception");
  });
});

describe('what the entry does', () => {
  it('asks the manager to revoke, on the selected element', () => {
    const el = element('n1');
    const revokeExceptionsOn = vi.fn(() => [] as RevokedException[]);
    const manager = { ...managerWith([exception(el)]), revokeExceptionsOn };
    const ctx = context({ selection: [el], manager });

    revokeAction.generate(ctx)?.run?.(ctx);

    expect(revokeExceptionsOn).toHaveBeenCalledWith(el);
  });

  it('reports one arbitration per rule and scope written', () => {
    const el = element('bg');
    const track = vi.fn();
    const manager = managerWith(
      [exception(el)],
      [
        {
          ruleId: 'wardley.component-outside-map',
          framework: 'wardley',
          scope: 'map',
          elementCount: 1,
        },
      ]
    );
    const ctx = context({ selection: [el], manager, track });

    revokeAction.generate(ctx)?.run?.(ctx);

    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('ValidationExceptionRevoked', {
      control: 'revoke exception',
      ruleId: 'wardley.component-outside-map',
      framework: 'wardley',
      scope: 'map',
      elementCount: 1,
    });
  });

  it('reports nothing when the gesture wrote nothing', () => {
    const el = element('n1');
    const track = vi.fn();
    const ctx = context({
      selection: [el],
      manager: managerWith([exception(el)], []),
      track,
    });

    revokeAction.generate(ctx)?.run?.(ctx);

    expect(track).not.toHaveBeenCalled();
  });
});
