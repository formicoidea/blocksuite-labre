import type { ToolbarContext } from '@labre/affine-shared/services';
import {
  TelemetryProvider,
  TranslationProvider,
} from '@labre/affine-shared/services';
import type { GfxModel } from '@labre/std/gfx';
import { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import { ValidationManager } from '../extensions/validation.js';
import type {
  AnchoredException,
  RevokedException,
  ValidationProfile,
} from '../extensions/validation.js';
import {
  validationExceptionToolbarConfig,
  validationToolbarConfig,
} from '../extensions/validation-toolbar.js';

/**
 * PF9 recette follow-up: the profile selector moved from a canvas chip — which
 * the contextual toolbar overlapped and hid — into that toolbar.
 *
 * This suite owns WHEN the entry stands up, which is the whole of the config's
 * own logic. What only a real editor can answer — that it renders on a selected
 * map, writes the right thing and disappears with the flag — is in
 * `packages/integration-test/.../wardley-validation-profiles.spec.ts`.
 */

const profile = (id: string, isDefault?: boolean): ValidationProfile => ({
  id,
  framework: 'test',
  labelKey: `com.labre.test.profile.${id}`,
  ...(isDefault ? { isDefault: true } : {}),
  rules: {},
});

const SKETCH = profile('test.sketch', true);
const STRICT = profile('test.strict');

/**
 * An element that passes the engine's `instanceof` gate without dragging a
 * surface, a Y.Doc and a renderer into a unit test. The config reads nothing
 * off it — it hands it straight to {@link ValidationManager.profilesFor} — so
 * the prototype is the entire contract here.
 */
function element(): GfxModel {
  // Bare prototype, no fields: `id` and the rest are getters on the real class,
  // and the fact that none of them can be read here is the point.
  return Object.create(GfxPrimitiveElementModel.prototype) as GfxModel;
}

/**
 * A toolbar context over a stubbed manager. `profilesFor` and `hasMapQuality`
 * are the ONLY two questions the config asks about an element — never its type,
 * never its framework, never its role — so stubbing them is stubbing the whole
 * boundary.
 */
function context(
  models: GfxModel[],
  profiles: readonly ValidationProfile[] | null,
  mapQuality = false
): ToolbarContext {
  const manager =
    profiles === null
      ? null
      : {
          profilesFor: () => profiles,
          profileOf: () => profiles.find(p => p.isDefault) ?? profiles[0],
          hasMapQuality: () => mapQuality,
          openMapQuality: () => {},
        };

  return {
    std: { getOptional: (id: unknown) => (id === ValidationManager ? manager : null) },
    getSurfaceModels: () => models,
  } as unknown as ToolbarContext;
}

const stands = (ctx: ToolbarContext) => {
  const { when } = validationToolbarConfig;
  return typeof when === 'function' ? when(ctx) : Boolean(when);
};

describe('when the validation entry stands up', () => {
  it('does, on a single instance with a choice to make', () => {
    expect(stands(context([element()], [SKETCH, STRICT]))).toBe(true);
  });

  it('does not, when the framework registered no profile', () => {
    // Flag off: the gated view extension registered neither rules nor
    // profiles, so there is nothing to choose between.
    expect(stands(context([element()], []))).toBe(false);
  });

  it('does not, when there is only one profile', () => {
    // A picker with a single entry is chrome that decides nothing.
    expect(stands(context([element()], [SKETCH]))).toBe(false);
  });

  it('does not, when validation is not mounted at all', () => {
    expect(stands(context([element()], null))).toBe(false);
  });

  it('does not, on an empty selection', () => {
    expect(stands(context([], [SKETCH, STRICT]))).toBe(false);
  });

  it('does not, on a multi-selection', () => {
    // A profile is one decision about one instance; two maps on two levels
    // have no honest "current" value to show.
    expect(
      stands(context([element(), element()], [SKETCH, STRICT]))
    ).toBe(false);
  });

  it('does not, on something that is not a surface element', () => {
    // A note or a frame reaches the same toolbar; only a primitive element can
    // carry a `validationProfile`.
    const block = { id: 'note' } as unknown as GfxModel;
    expect(stands(context([block], [SKETCH, STRICT]))).toBe(false);
  });
});

describe('the entry is generic', () => {
  it('asks the engine, never the element, what it is', () => {
    // The stub answers `profilesFor` for ANY element, of any type, carrying any
    // role — and the entry stands up. Nothing in the config names a framework,
    // a shape type or a role: swap Wardley for BPMN and this is unchanged.
    expect(stands(context([element()], [SKETCH, STRICT]))).toBe(
      true
    );
  });

  it('places itself after a framework’s own per-instance toggles', () => {
    // `z.` so a framework's `a.` … `d.` toggles keep the left of the toolbar:
    // the level of requirement is a setting of the instance, read last.
    expect(validationToolbarConfig.actions[0].id).toBe('z.validation');
  });
});

/**
 * PF7.11: Map quality is a SECOND SECTION of the same dropdown, not a second
 * button. The two sections appear on their own merits, which is what lets a
 * framework ship a checklist and no second profile — or the other way round —
 * without either of them dragging the other onto the toolbar.
 */
describe('the Map quality section', () => {
  it('stands the dropdown up on its own, with a single profile', () => {
    // One profile is not a choice, so the profile section stays away — and the
    // dropdown appears anyway, because map quality has something to say.
    expect(stands(context([element()], [SKETCH], true))).toBe(true);
  });

  it('stands the dropdown up with no profile registered at all', () => {
    expect(stands(context([element()], [], true))).toBe(true);
  });

  it('does not stand up on an instance with neither', () => {
    expect(stands(context([element()], [SKETCH], false))).toBe(false);
  });

  it('does not stand up on a multi-selection', () => {
    // A checklist is one decision about one instance, exactly like a profile.
    expect(
      stands(context([element(), element()], [SKETCH, STRICT], true))
    ).toBe(false);
  });

  it('does not stand up with no validation manager at all', () => {
    expect(stands(context([element()], null, true))).toBe(false);
  });

  it('asks the engine, never the element, whether there is a panel', () => {
    // The stub answers `hasMapQuality` for ANY element of any type carrying any
    // role, and the section appears. Nothing in the config names a framework —
    // which is the whole of PF7.11's "generic" acceptance criterion.
    const seen: unknown[] = [];
    const ctx = context([element()], [], true);
    const manager = ctx.std.getOptional(ValidationManager) as {
      hasMapQuality: (el: unknown) => boolean;
    };
    const spy = manager.hasMapQuality.bind(manager);
    manager.hasMapQuality = (el: unknown) => {
      seen.push(el);
      return spy(el);
    };

    expect(stands(ctx)).toBe(true);
    expect(seen).toHaveLength(1);
  });
});

/**
 * The "Revoke exception" entry (PF8, PO acceptance of 01/08), which shares this
 * file with the Validation dropdown above because it shares the toolbar with it.
 *
 * Its own logic is what is tested here — when it offers itself, what it asks
 * the manager to do, and what it reports. Turning a `ToolbarModuleConfig` into
 * a button is BlockSuite's toolbar machinery; what an element ANSWERS FOR is
 * the manager's job, and it is tested against real groups in
 * `packages/integration-test/.../wardley-revoke-exception.spec.ts`.
 */

const [revokeAction] = validationExceptionToolbarConfig.actions;

/**
 * Like {@link element}, but with `id` and `type` readable: the revoke entry
 * hands the model to the manager AND the assertions below identify it.
 */
const namedElement = (id: string): GfxPrimitiveElementModel => {
  const stub = Object.create(GfxPrimitiveElementModel.prototype);
  // `id` and `type` are prototype GETTERS, so they are shadowed rather than
  // assigned.
  Object.defineProperties(stub, {
    id: { get: () => id },
    type: { get: () => 'wardleyNode' },
  });
  return stub as GfxPrimitiveElementModel;
};

type ExceptionManagerStub = {
  revocableExceptionsOn: (
    element: GfxPrimitiveElementModel
  ) => AnchoredException[];
  revokeExceptionsOn: (
    element: GfxPrimitiveElementModel
  ) => RevokedException[];
};

/**
 * A toolbar context reduced to what the revoke entry touches: the selection,
 * the DI lookups behind `translateKey` and the manager, `captureSync` and
 * `track`.
 */
function exceptionContext(options: {
  selection?: GfxPrimitiveElementModel[];
  manager?: ExceptionManagerStub | null;
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
    store: { captureSync: () => {} },
  };

  return {
    std,
    getSurfaceModels: () => selection,
    track,
  } as unknown as ToolbarContext;
}

const anException = (
  el: GfxPrimitiveElementModel,
  ruleId = 'wardley.change-arrow-against-evolution'
): AnchoredException => ({ element: el, ruleId });

const exceptionManagerWith = (
  anchored: AnchoredException[],
  revoked: RevokedException[] = []
): ExceptionManagerStub => ({
  revocableExceptionsOn: () => anchored,
  revokeExceptionsOn: () => revoked,
});

const offersRevoke = (ctx: ToolbarContext) =>
  typeof revokeAction.when === 'function' ? revokeAction.when(ctx) : false;

describe('when the revoke entry offers itself', () => {
  it('shows on an element that answers for an exception', () => {
    const el = namedElement('n1');
    expect(
      offersRevoke(
        exceptionContext({
          selection: [el],
          manager: exceptionManagerWith([anException(el)]),
        })
      )
    ).toBe(true);
  });

  it('stays away from an element carrying nothing', () => {
    expect(
      offersRevoke(
        exceptionContext({
          selection: [namedElement('n1')],
          manager: exceptionManagerWith([]),
        })
      )
    ).toBe(false);
  });

  it('stays away when nothing is selected', () => {
    const el = namedElement('n1');
    expect(
      offersRevoke(
        exceptionContext({
          selection: [],
          manager: exceptionManagerWith([anException(el)]),
        })
      )
    ).toBe(false);
  });

  it('stays away on a multiple selection', () => {
    // "Revoke the exception" has no honest meaning across a mixed bag: the
    // entry is one arbitration, on one thing.
    const a = namedElement('n1');
    const b = namedElement('n2');
    expect(
      offersRevoke(
        exceptionContext({
          selection: [a, b],
          manager: exceptionManagerWith([anException(a)]),
        })
      )
    ).toBe(false);
  });

  it('stays away with no validation manager at all', () => {
    expect(
      offersRevoke(
        exceptionContext({ selection: [namedElement('n1')], manager: null })
      )
    ).toBe(false);
  });
});

describe('what the revoke entry says', () => {
  it('falls back to English chrome with no catalogue', () => {
    const el = namedElement('n1');
    const ctx = exceptionContext({
      selection: [el],
      manager: exceptionManagerWith([anException(el)]),
    });
    const action = revokeAction.generate(ctx);

    expect(action?.label).toBe('Revoke exception');
    // Words, not a glyph: taking back a recorded decision is not something to
    // guess at from an icon.
    expect(action?.showLabel).toBe(true);
    expect(action?.tooltip).toBe('Revoke exception');
  });

  it('resolves the label through the host catalogue', () => {
    const el = namedElement('n1');
    const ctx = exceptionContext({
      selection: [el],
      manager: exceptionManagerWith([anException(el)]),
      catalogue: {
        'com.labre.validation.action.revoke-exception': "Lever l'exception",
      },
    });

    expect(revokeAction.generate(ctx)?.label).toBe("Lever l'exception");
  });

  it('sorts before the framework’s Validation dropdown', () => {
    // Both entries land on the toolbar of a framework background — one from
    // `custom:affine:surface:*`, one from `custom:affine:surface:wardley` — and
    // the toolbar orders the merged list by id.
    expect(revokeAction.id < validationToolbarConfig.actions[0].id).toBe(true);
  });
});

describe('what the revoke entry does', () => {
  it('asks the manager to revoke, on the selected element', () => {
    const el = namedElement('n1');
    const calls: GfxPrimitiveElementModel[] = [];
    const manager = {
      ...exceptionManagerWith([anException(el)]),
      revokeExceptionsOn: (target: GfxPrimitiveElementModel) => {
        calls.push(target);
        return [] as RevokedException[];
      },
    };
    const ctx = exceptionContext({ selection: [el], manager });

    revokeAction.generate(ctx)?.run?.(ctx);

    expect(calls).toEqual([el]);
  });

  it('reports one arbitration per rule and scope written', () => {
    const el = namedElement('bg');
    const tracked: { name: string; props: Record<string, unknown> }[] = [];
    const manager = exceptionManagerWith(
      [anException(el)],
      [
        {
          ruleId: 'wardley.change-arrow-against-evolution',
          framework: 'wardley',
          scope: 'map',
          elementCount: 1,
        },
      ]
    );
    const ctx = exceptionContext({
      selection: [el],
      manager,
      track: (name, props) => tracked.push({ name, props }),
    });

    revokeAction.generate(ctx)?.run?.(ctx);

    expect(tracked).toEqual([
      {
        name: 'ValidationExceptionRevoked',
        props: {
          control: 'revoke exception',
          ruleId: 'wardley.change-arrow-against-evolution',
          framework: 'wardley',
          scope: 'map',
          elementCount: 1,
        },
      },
    ]);
  });

  it('reports nothing when the gesture wrote nothing', () => {
    const el = namedElement('n1');
    const tracked: unknown[] = [];
    const ctx = exceptionContext({
      selection: [el],
      manager: exceptionManagerWith([anException(el)], []),
      track: (...args) => tracked.push(args),
    });

    revokeAction.generate(ctx)?.run?.(ctx);

    expect(tracked).toEqual([]);
  });
});
