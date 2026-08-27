import { EdgelessCRUDIdentifier } from '@labre/affine-block-surface';
import { dddLegendIcon } from '@labre/affine-gfx-ddd-shared';
import { C4BoardElementModel } from '@labre/affine-model';
import {
  type ToolbarContext,
  type ToolbarModuleConfig,
  ToolbarModuleExtension,
  translateKey,
} from '@labre/affine-shared/services';
import {
  BlockFlavourIdentifier,
  getRegisteredCommands,
  runCommand,
} from '@labre/std';
import { html, type TemplateResult } from 'lit';

const ResizeIcon = html`<svg
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.6"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M9 5H5v4M15 19h4v-4" />
  <path d="M5 5l6 6M19 19l-6-6" />
</svg>`;

const findCommand = (ctx: ToolbarContext, id: string) =>
  getRegisteredCommands(ctx.std).find(candidate => candidate.id === id);

/**
 * A toolbar entry that INVOKES a registered command instead of restating what
 * it does — the shape `docs/adr/0010` M3 introduced, and the reason the legend
 * has one behaviour, one availability rule and one telemetry emission whether
 * it is reached from here, from the catalogue, from the palette, from
 * Settings › Shortcuts or from the agent. The BPMN pool's row is built the same
 * way; this is that helper, not a variant of it.
 *
 * `generate` rather than a static entry because the i18n seam needs `std`:
 * `translateKey` is what reaches the host's catalogue, and a hard-coded English
 * tooltip would be the one wording a host could not override.
 */
function commandAction(
  id: string,
  commandId: string,
  labelKey: string,
  labelFallback: string,
  icon: TemplateResult
) {
  return {
    id,
    when: (ctx: ToolbarContext) => {
      const command = findCommand(ctx, commandId);
      return command !== undefined && (command.when?.(ctx.std) ?? true);
    },
    generate: (ctx: ToolbarContext) => {
      const label = translateKey(ctx.std, labelKey, labelFallback);
      return {
        icon,
        tooltip: label,
        run: (runCtx: ToolbarContext) => {
          const command = findCommand(runCtx, commandId);
          if (!command) return;
          runCommand(runCtx.std, command, {
            surface: 'contextual-toolbar',
            source: 'toolbar:general',
          });
        },
      };
    },
  };
}

/**
 * The selected C4 board's contextual toolbar: the resize toggle and the
 * automatic legend of what is actually drawn on the board.
 *
 * The MODULE is registered always-on ({@link C4RenderViewExtension}), because a
 * stored board must keep its resize toggle with the C4 button switched off
 * (`docs/adr/0009`). The legend COMMAND is not: it is registered by the
 * flag-gated half like every other C4 command, so with the flag off this row is
 * the resize toggle alone.
 *
 * That is a deliberate difference from the Context Map board, whose legend
 * button survives its flag by calling `createAutoLegend` directly and tracking
 * its own event. Both readings of `docs/adr/0009` are defensible — a legend is
 * real editable elements, and it is also a gesture that CREATES them — and the
 * tie is broken by the seam: a command's owner gates it on both sides at once
 * (`isBlockEnabled` decides what a host ENUMERATES, `CommandExtension` what
 * BINDS, and a unit test asserts the two agree), so a legend registered
 * always-on under `owner: 'c4'` would be bindable while absent from every
 * manifest. Declaring it as a command is what buys the rest: one behaviour, one
 * availability rule, and `FrameworkLegendCreated` emitted by the central
 * reporter instead of by a hand-written `track()` here.
 *
 * The entry asks the registry for the command and hides itself when it is not
 * there — the same `when` guard every `commandAction` carries — so nothing on
 * this row can be clicked into a no-op.
 *
 * There is no rename entry, and there is nothing missing: both C4 frames edit
 * their one word in place on a double-click (`element-view.ts`), which is the
 * gesture the primitive already gives them.
 *
 * ## The "⋮"
 *
 * `ActionPlacement.More` partitions an entry out of the row and into the
 * overflow menu, and the entries it collects come from EVERY module
 * contributing to this element — so a later slice (the Mermaid/Structurizr
 * export) adds itself there without owning this file, exactly as
 * `bpmn.exportXml` sits in the pool's "⋮". The `z.` id prefix is the sort key
 * that keeps such an entry last; nothing else about the row changes.
 */
export const c4BoardToolbarConfig = {
  actions: [
    {
      id: 'a.toggle-resize',
      tooltip: 'Enable / lock resizing',
      icon: ResizeIcon,
      active(ctx: ToolbarContext) {
        const models = ctx.getSurfaceModelsByType(C4BoardElementModel);
        return models.length > 0 && models.every(model => model.resizeEnabled);
      },
      run(ctx: ToolbarContext) {
        const models = ctx.getSurfaceModelsByType(C4BoardElementModel);
        if (!models.length) return;
        const enable = !models.every(model => model.resizeEnabled);
        ctx.std.store.captureSync();
        const crud = ctx.std.get(EdgelessCRUDIdentifier);
        for (const model of models) {
          crud.updateElement(model.id, { resizeEnabled: enable });
        }
      },
    },
    commandAction(
      'b.legend',
      'c4.legend',
      'com.labre.commands.c4.legend',
      'Generate the legend',
      dddLegendIcon
    ),
  ],
  when: (ctx: ToolbarContext) =>
    ctx.getSurfaceModelsByType(C4BoardElementModel).length > 0,
} as const satisfies ToolbarModuleConfig;

export const c4BoardToolbarExtension = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('affine:surface:c4Board'),
  config: c4BoardToolbarConfig,
});
