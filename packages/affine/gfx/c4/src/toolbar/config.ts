import {
  EdgelessCRUDIdentifier,
  validationToolbarConfig,
} from '@labre/affine-block-surface';
import { dddLegendIcon } from '@labre/affine-gfx-ddd-shared';
import { C4BoardElementModel } from '@labre/affine-model';
import {
  ActionPlacement,
  TelemetryProvider,
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

import { createC4Legend } from '../actions';

import { c4ExportMermaidIcon } from './icons';

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
 * A "⋮" entry that INVOKES a registered command instead of restating what it
 * does — the shape `docs/adr/0010` M3 introduced, and the reason the export has
 * one behaviour, one availability rule and one telemetry emission whether it is
 * reached from here, from the catalogue, from the palette, from
 * Settings › Shortcuts or from the agent.
 *
 * Two things the widget imposes: a menu line is drawn from `label` (a tooltip on
 * a line that is already words would be a second copy of them), and
 * `placement: ActionPlacement.More` is what partitions it out of the row in the
 * first place — `renderToolbar` splits on exactly that flag, and the entries it
 * collects come from every module contributing to the element, so a framework
 * can add to the "⋮" without owning it.
 *
 * `generate` rather than a static entry because the i18n seam needs `std`:
 * `translateKey` is what reaches the host's catalogue, and a hard-coded English
 * label would be the one wording a host could not override.
 *
 * Lifted from the BPMN pool's row, where `bpmn.exportXml` sits in exactly this
 * position.
 */
function commandMoreAction(
  id: string,
  commandId: string,
  labelKey: string,
  labelFallback: string,
  icon: TemplateResult
) {
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

/**
 * The selected C4 board's contextual toolbar: the resize toggle, and the
function commandMoreAction(
  id: string,
  commandId: string,
  labelKey: string,
  labelFallback: string,
  icon: TemplateResult
) {
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

/**
 * automatic legend of what is actually drawn on the board.
 *
 * ## The legend is a BUTTON, not a command — PO arbitration, 27/08/2026
 *
 * Every other C4 gesture is a registered `CommandDescriptor`, which is the
 * bottleneck `docs/adr/0008` asks for: one behaviour, one availability rule, one
 * telemetry emission, reachable from the sub-menu, the catalogue, the palette,
 * Settings › Shortcuts and the agent. The legend is the arbitrated exception.
 * The PO's call is that generating one belongs to a board you have SELECTED and
 * to nothing else: it is not an artefact to pick off a palette, and an entry in
 * a catalogue of things C4 draws would offer it to a user with no board in front
 * of them. So there is no `c4.legend` command, this button is the only way to
 * reach it, and the telemetry it owes is emitted by hand below.
 *
 * That is the same shape — and the same exception — the Context Map board makes
 * (`ddd-context-map/src/toolbar/board-config.ts`), down to the payload, so the
 * two frameworks' legends stay comparable on one dashboard. The cost is the one
 * the bottleneck exists to avoid and is accepted knowingly: this `track()` call
 * is a second emitter, and it is on whoever edits it to keep the wire values
 * matching what `reportCommandTelemetry` would have sent.
 *
 * ## Two modules on one element, and why
 *
 * The resize toggle is registered ALWAYS-ON, because a stored board must stay
 * usable with the C4 button switched off (`docs/adr/0009`). The legend button is
 * a SECOND module on the same element, through the `custom:` flavour slot, and
 * it is registered by the flag-gated half — which is exactly where it sat while
 * it was a command, and the arbitration changed nothing about that. It is also
 * the shape BPMN, Wardley and the Context Map already use to hang the Validation
 * dropdown off a background whose base row is always-on: `renderToolbar`
 * collects the entries of every module contributing to the element, so the user
 * sees one row either way.
 *
 * There is no rename entry, and there is nothing missing: both C4 frames edit
 * their one word in place on a double-click (`element-view.ts`), which is the
 * gesture the primitive already gives them.
 *
 * ## The "⋮", and why the export sits in the ALWAYS-ON half
 *
 * `ActionPlacement.More` partitions an entry out of the row and into the
 * overflow menu, and the entries it collects come from EVERY module contributing
 * to this element — so a slice adds itself there without owning this file. The
 * mermaid export is the first taker: it is the rarest thing anybody does to a
 * board, and the `z.` id prefix is the sort key that keeps it last.
 *
 * It is declared HERE, in the always-on module, rather than beside the legend in
 * the flag-gated one — which is where BPMN puts its own export
 * (`bpmnPoolToolbarExtension` carries `bpmn.exportXml` and is registered by
 * `BpmnRenderViewExtension`). The two entries look alike and are gated by
 * different mechanisms, and that is the point: the legend button CALLS an action
 * directly, so nothing but the module's registration can hide it, while this one
 * asks the registry for a command that only the flag-gated half registers and
 * hides itself when it is not there. With the C4 button off the row is the resize
 * toggle alone either way, and nothing on it can be clicked into a no-op.
 *
 * Declaring it in the always-on module is what makes that guard the SINGLE thing
 * deciding whether the export is offered — the same rule the palette, the
 * catalogue and the agent read — instead of the guard plus a second registration
 * that could one day disagree with it.
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
    // …and, in the "⋮", the one thing you do to a finished diagram rather than
    // to the board it is drawn on: take it away as a file.
    commandMoreAction(
      'z.export-mermaid',
      'c4.exportMermaid',
      'com.labre.commands.c4.exportMermaid',
      'Export as mermaid',
      c4ExportMermaidIcon
    ),
  ],
  when: (ctx: ToolbarContext) =>
    ctx.getSurfaceModelsByType(C4BoardElementModel).length > 0,
} as const satisfies ToolbarModuleConfig;

export const c4BoardToolbarExtension = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('affine:surface:c4Board'),
  config: c4BoardToolbarConfig,
});

/**
 * The legend button — the flag-gated half of the row (see the note above).
 *
 * `b.` sorts it after the resize toggle, so the two modules render as the one
 * row a user sees rather than in registration order.
 */
export const c4LegendToolbarConfig = {
  actions: [
    {
      id: 'b.legend',
      tooltip: 'Generate the legend (notation present)',
      icon: dddLegendIcon,
      run(ctx: ToolbarContext) {
        createC4Legend(ctx.std);
        ctx.std
          .getOptional(TelemetryProvider)
          ?.track('FrameworkLegendCreated', {
            // The WIRE values, and they are the ones `reportCommandTelemetry`
            // would have sent for a `kind: 'legend'` command — `framework` from
            // the descriptor's `telemetryKey`, `element: 'legend'` as Wardley
            // and the Context Map both emit, so the three are one metric.
            framework: 'c4',
            element: 'legend',
            page: 'whiteboard editor',
            segment: 'element toolbar',
            module: 'c4 toolbar',
          });
      },
    },
  ],
  when: (ctx: ToolbarContext) =>
    ctx.getSurfaceModelsByType(C4BoardElementModel).length > 0,
} as const satisfies ToolbarModuleConfig;

/**
 * The board's flag-gated row, WHOLE: the legend button and the Validation
 * dropdown, in one module.
 *
 * ## Why they cannot be two modules
 *
 * `renderToolbar` merges exactly four slots per element — `<flavour>`,
 * `custom:<flavour>`, and the two `affine:surface:*` wildcards — and
 * `ToolbarModuleExtension` binds by DI variant, so a second module claiming
 * `custom:affine:surface:c4Board` throws `DuplicateServiceDefinitionError`
 * before the editor finishes setting up. Two slots, and C4 has three things to
 * put on a selected board: the resize toggle (always-on, `<flavour>`), the
 * legend and the level of requirement.
 *
 * The last two are gated by the same flag and appear together or not at all, so
 * one module is the honest grouping rather than a workaround: `c4` off takes
 * away both the gesture that CREATES legend elements and the choice of how hard
 * to check the diagram, and leaves the stored board its handles.
 *
 * Sorting keeps the row readable across the merge — `b.legend` from the config
 * above, `z.validation` from {@link validationToolbarConfig} — so the user sees
 * resize, legend, then the level, whatever order the modules were registered in.
 */
export const c4BoardToolingToolbarConfig: ToolbarModuleConfig = {
  actions: [
    ...c4LegendToolbarConfig.actions,
    // The generic dropdown, not a C4 variant of it: the config names no
    // framework — it reads the registered rules and profiles — so this is the
    // very same object wardley, bpmn and the context map register.
    ...validationToolbarConfig.actions,
  ],
  when: c4LegendToolbarConfig.when,
};

export const c4BoardToolingToolbarExtension = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('custom:affine:surface:c4Board'),
  config: c4BoardToolingToolbarConfig,
});

/**
 * The same dropdown on a selected BOUNDARY, and C4 is the first framework to
 * need it in two places.
 *
 * A profile is chosen on the instance a finding is ATTRIBUTED to, and two of the
 * thirteen rules — `c4.homeless-component` and `c4.person-in-boundary` — are
 * framed against the boundary rather than the board (`rules.ts`). Registering
 * only on the board would leave those two judged at the default level for ever
 * whatever the author chose: a picker that silently governs eleven of the
 * thirteen. `profilesFor` already recognises a boundary as a root instance,
 * precisely because a registered rule measures against it.
 *
 * Nothing else claims this flavour today, so the dropdown is the whole module —
 * and it lives here, beside the board's two, so that "which module owns which
 * flavour" stays answerable in one file.
 */
export const c4BoundaryValidationToolbarExtension = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('custom:affine:surface:c4Boundary'),
  config: validationToolbarConfig,
});
