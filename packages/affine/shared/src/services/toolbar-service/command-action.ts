import { getRegisteredCommands, runCommand } from '@labre/std';
import type { TemplateResult } from 'lit';

import { translateKey } from '../translation-service';
import { ActionPlacement, type ToolbarActionGenerator } from './action';
import type { ToolbarContext } from './context';

/** The registered command an entry drives, or `undefined` when it is not. */
const findCommand = (ctx: ToolbarContext, id: string) =>
  getRegisteredCommands(ctx.std).find(candidate => candidate.id === id);

/**
 * A "⋮" entry that INVOKES a registered command instead of restating what it
 * does — the shape `docs/adr/0010` M3 introduced, and the reason an export has
 * one behaviour, one availability rule and one telemetry emission whether it is
 * reached from here, from the catalogue, from the palette, from
 * Settings › Shortcuts or from the agent.
 *
 * Two things the widget imposes: a menu line is drawn from `label` (a tooltip
 * on a line that is already words would be a second copy of them), and
 * `placement: ActionPlacement.More` is what partitions it out of the row in the
 * first place — `renderToolbar` splits on exactly that flag, and the entries it
 * collects come from every module contributing to the element, so a framework
 * can add to the "⋮" without owning it.
 *
 * `generate` rather than a static entry because the i18n seam needs `std`:
 * `translateKey` is what reaches the host's catalogue, and a hard-coded English
 * label would be the one wording a host could not override.
 *
 * ## Why it lives here
 *
 * It was written three times — BPMN's pool row, C4's board row and Wardley's
 * map row — each copy a few words of comment apart from the others, because a
 * framework's toolbar has no layer below it to share with. The generic SVG
 * export (`export.svg`, ADR 0025) is the fourth caller and the first that is
 * not a framework at all, which is what settles the question: the shape belongs
 * to the toolbar service, beside the module registry it plugs into, not to
 * whichever framework happened to need it first.
 *
 * `translateKey` lives in this same package, and `@labre/std` is already a
 * dependency of it, so nothing here closes an import cycle.
 */
export function commandMoreAction(
  id: string,
  commandId: string,
  labelKey: string,
  labelFallback: string,
  icon: TemplateResult
): ToolbarActionGenerator {
  return {
    id,
    placement: ActionPlacement.More,
    when: (ctx: ToolbarContext) => {
      const command = findCommand(ctx, commandId);
      return command !== undefined && (command.when?.(ctx.std) ?? true);
    },
    generate: (ctx: ToolbarContext) => ({
      icon,
      label: translateKey(ctx.std, labelKey, labelFallback),
      run: (runCtx: ToolbarContext) => {
        const command = findCommand(runCtx, commandId);
        if (!command) return;
        // The same `source` the row's own entries report: the "⋮" is a
        // degradation of the row, not a surface of its own, and the
        // `ElementCreationSource` union deliberately names places rather than
        // widths (`docs/adr/0008`).
        runCommand(runCtx.std, command, {
          surface: 'contextual-toolbar',
          source: 'toolbar:general',
        });
      },
    }),
  };
}
