import type { ToolbarContext } from '@labre/affine-shared/services';
import type { GfxModel } from '@labre/std/gfx';
import { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import { ValidationManager } from '../extensions/validation.js';
import type { ValidationProfile } from '../extensions/validation.js';
import { validationToolbarConfig } from '../extensions/validation-toolbar.js';

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
 * A toolbar context over a stubbed manager. `profilesFor` is the ONE question
 * the config asks about an element — never its type, never its framework, never
 * its role — so stubbing it is stubbing the whole boundary.
 */
function context(
  models: GfxModel[],
  profiles: readonly ValidationProfile[] | null
): ToolbarContext {
  const manager =
    profiles === null
      ? null
      : {
          profilesFor: () => profiles,
          profileOf: () => profiles.find(p => p.isDefault) ?? profiles[0],
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
