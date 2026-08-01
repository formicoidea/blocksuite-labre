import {
  type ToolbarContext,
  type ToolbarModuleConfig,
  ToolbarModuleExtension,
  translateKey,
} from '@labre/affine-shared/services';
import { BlockFlavourIdentifier } from '@labre/std';
import { GfxPrimitiveElementModel } from '@labre/std/gfx';

import { ValidationManager } from './validation.js';

/**
 * "Revoke the exception", on the contextual toolbar of the element that carries
 * it (PF8, PO acceptance of 01/08).
 *
 * ## Why the toolbar and not the badge
 *
 * PF8 shipped the way back on a grey badge pinned to the canvas: an excused
 * finding kept a marker, and clicking it opened the bubble that could revoke.
 * That put a permanent dot on the board for something the user had explicitly
 * decided to stop caring about — the affordance argued with the decision it was
 * reporting. Selecting the element is the path everybody already knows, so the
 * way back lives where every other thing you can do to an element lives, and
 * the canvas goes quiet. The amber badge of a LIVE violation is untouched: that
 * one is still asking for something (PF7).
 *
 * ## Which element gets the entry
 *
 * Whichever one ANSWERS for the exception, in exactly the sense the canvas mark
 * uses ({@link ValidationManager.revocableExceptionsOn} →
 * `exceptionsAnchoredOn` → `anchorOf`): the outermost enclosing canvas group —
 * i.e. the whole Wardley component built by the senior menu — or the element
 * itself when it is not grouped. Dissolve the group and the entry moves down to
 * the element, with nothing to invalidate. A framework background answers for
 * the map-wide arbitration written on it, so the same entry on the background
 * revokes the map scope.
 *
 * ## Where it is registered
 *
 * `custom:affine:surface:*` — the free wildcard slot, merged into the toolbar
 * of EVERY canvas element (see `renderToolbar`). One registration therefore
 * covers a group, a bare framework element and a background alike, and no
 * framework's own toolbar config is touched: mindmap already uses this pattern
 * to add an action to shapes it does not own. `affine:surface:*` is taken by
 * the root's built-in module, and a second module on one key would collide.
 */

const REVOKE_LABEL_KEY = 'com.labre.validation.action.revoke-exception';
const REVOKE_LABEL_FALLBACK = 'Revoke exception';

/**
 * The single selected canvas element, or `null`.
 *
 * One element only: "revoke the exception" has no honest meaning across a
 * mixed bag of shapes, and the entry is about one arbitration on one thing.
 */
function selectedElement(ctx: ToolbarContext): GfxPrimitiveElementModel | null {
  const models = ctx.getSurfaceModels();
  if (models.length !== 1) return null;
  const [model] = models;
  return model instanceof GfxPrimitiveElementModel ? model : null;
}

function revocableOn(ctx: ToolbarContext) {
  const element = selectedElement(ctx);
  if (!element) return [];
  return ctx.std.getOptional(ValidationManager)?.revocableExceptionsOn(element)
    ?? [];
}

export const validationExceptionToolbarConfig = {
  actions: [
    {
      // Ordered after the framework's own actions, before the built-in ones.
      id: 'c.validation-revoke-exception',
      // No exception answered for by this element — including every board with
      // no framework enabled — means no entry at all.
      when: ctx => revocableOn(ctx).length > 0,
      // `label` is static on a ToolbarAction, so the i18n seam needs the
      // generator form: it is the only shape that receives the context, and
      // `translateKey` needs `std` to reach the host's catalogue.
      generate: ctx => {
        const label = translateKey(
          ctx.std,
          REVOKE_LABEL_KEY,
          REVOKE_LABEL_FALLBACK
        );
        return {
          label,
          // Shown as words, not as a mystery glyph: taking back a recorded
          // decision is not something to guess at from an icon.
          showLabel: true,
          tooltip: label,
          run: (runCtx: ToolbarContext) => {
            const element = selectedElement(runCtx);
            if (!element) return;
            const validation = runCtx.std.getOptional(ValidationManager);
            const revoked = validation?.revokeExceptionsOn(element) ?? [];

            for (const entry of revoked) {
              runCtx.track('ValidationExceptionRevoked', {
                control: 'revoke exception',
                ruleId: entry.ruleId,
                framework: entry.framework,
                scope: entry.scope,
                elementCount: entry.elementCount,
              });
            }
          },
        };
      },
    },
  ],
} as const satisfies ToolbarModuleConfig;

export const validationExceptionToolbarExtension = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('custom:affine:surface:*'),
  config: validationExceptionToolbarConfig,
});
