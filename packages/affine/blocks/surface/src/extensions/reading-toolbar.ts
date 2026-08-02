import {
  ToolbarModuleExtension,
  type ToolbarContext,
  type ToolbarModuleConfig,
  translateKey,
} from '@labre/affine-shared/services';
import {
  BlockFlavourIdentifier,
  getRegisteredCommands,
  runCommand,
} from '@labre/std';
import {
  GfxGroupLikeElementModel,
  GfxPrimitiveElementModel,
} from '@labre/std/gfx';

import { ReadingManager, readingProfileFor } from './reading.js';

/**
 * **The click** — the entry on a selected component's contextual toolbar that
 * asks the tool what it reads (MF3).
 *
 * The PO's arbitration of 01/08/2026 made the trigger a gesture: the reversed
 * reading never runs by itself, never rides on validation, and never writes.
 * This entry is that gesture, and it is deliberately as thin as
 * `tags-toolbar.ts`'s — it resolves WHICH element the reading is about and
 * invokes `element.read` through the registry. Everything else lives behind the
 * command and the manager, so the palette and the agent get the same behaviour
 * with no second implementation.
 *
 * ## Which element gets the entry
 *
 * The one that CARRIES a readable role — resolved through the group when a
 * single click selected the composite, exactly as the qualification dropdown
 * does. A Wardley component is a circle and a free text grouped together, and
 * making the user enter the group to find the reading would bury it. Two
 * readable members means the group is not one artefact, and a proposal about
 * "one of these two" is not a proposal.
 *
 * ## Where it is registered
 *
 * `custom:affine:*` — the next free wildcard slot, one slot out from the
 * `custom:affine:surface:*` the exception entry took (`validation-toolbar.ts`
 * documents the collision rule: two modules on one key, and one of them is
 * silently lost). Registered ONCE, by the surface itself rather than per
 * framework: nothing in this file names a framework, and the entry is gated by
 * whether a registered {@link ReadingProfile} can read the selection — which
 * only a framework's FLAG-GATED view extension provides. Flag off, no profile,
 * no entry, and every element still loads and paints (ADR 0009).
 *
 * The wildcard is merged into the toolbar of every block, canvas or not; on
 * anything that is not a canvas selection `getSurfaceModels()` is empty and the
 * module stands down before doing any work.
 *
 * Not read-only gated: reading a board one cannot edit is exactly as legitimate
 * as reading one you can. What disappears in a read-only document is the
 * panel's CONFIRMATIONS.
 */

const READ_LABEL_KEY = 'com.labre.reading.toolbar.label';
const READ_LABEL_FALLBACK = 'Read this component';

/** The command this module drives. Spelled once. */
const ELEMENT_READ_ID = 'element.read';

/** The single selected element a reading could be about, resolved through groups. */
function readTarget(ctx: ToolbarContext): GfxPrimitiveElementModel | null {
  const manager = ctx.std.getOptional(ReadingManager);
  if (!manager || manager.profiles.length === 0) return null;

  const models = ctx.getSurfaceModels();
  if (models.length !== 1) return null;

  const [model] = models;
  if (!(model instanceof GfxPrimitiveElementModel)) return null;

  const candidates: GfxPrimitiveElementModel[] = [];
  if (readingProfileFor(model, manager.profiles)) candidates.push(model);
  if (model instanceof GfxGroupLikeElementModel) {
    for (const child of model.childElements) {
      if (!(child instanceof GfxPrimitiveElementModel)) continue;
      if (readingProfileFor(child, manager.profiles)) candidates.push(child);
    }
  }

  return candidates.length === 1 ? candidates[0] : null;
}

/**
 * Invoke `element.read` on the resolved target, through the registry rather
 * than by importing the command: this package sits below
 * `@labre/affine-block-root` in the dependency order, and going through
 * `runCommand` is what keeps one gesture one path whatever the surface. A build
 * with the command unregistered simply has no working entry — never a throw.
 *
 * `elementId` is passed EXPLICITLY rather than letting the command fall back to
 * the live selection: the element being read is often a group member, not the
 * group the user clicked.
 */
function openReading(ctx: ToolbarContext, target: GfxPrimitiveElementModel) {
  const command = getRegisteredCommands(ctx.std).find(
    c => c.id === ELEMENT_READ_ID
  );
  if (!command) return;

  runCommand(
    ctx.std,
    command,
    // `'palette'` until `'contextual-toolbar'` joins the `CommandSurface` union
    // with the typed-edge direction slice (ADR 0010 M3) — the invocation shape
    // belongs to the seam, and inventing a member here would fork it.
    { surface: 'palette', source: 'toolbar:general' },
    { elementId: target.id }
  );
}

export const readingToolbarConfig = {
  actions: [
    {
      // After the qualification dropdown (`y.element-tags`) and before
      // `z.validation`: what the tool READS of an element comes after what the
      // element says it is, and before how hard it is checked.
      id: 'y1.element-reading',
      when: (ctx: ToolbarContext) => readTarget(ctx) !== null,
      // `label` is static on a ToolbarAction, so the i18n seam needs the
      // generator form: it is the only shape that receives the context, and
      // `translateKey` needs `std` to reach the host's catalogue.
      generate: (ctx: ToolbarContext) => {
        const label = translateKey(ctx.std, READ_LABEL_KEY, READ_LABEL_FALLBACK);
        return {
          label,
          // Words, not a glyph: "what does the tool make of this?" is not a
          // question anyone should have to guess from an icon.
          showLabel: true,
          tooltip: label,
          run: (runCtx: ToolbarContext) => {
            const target = readTarget(runCtx);
            if (!target) return;
            openReading(runCtx, target);
          },
        };
      },
    },
  ],
} as const satisfies ToolbarModuleConfig;

export const readingToolbarExtension = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('custom:affine:*'),
  config: readingToolbarConfig,
});
