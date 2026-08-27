import {
  EdgelessCRUDIdentifier,
  validationToolbarConfig,
} from '@labre/affine-block-surface';
import { dddLegendIcon } from '@labre/affine-gfx-ddd-shared';
import { C4BoardElementModel } from '@labre/affine-model';
import {
  TelemetryProvider,
  type ToolbarContext,
  type ToolbarModuleConfig,
  ToolbarModuleExtension,
} from '@labre/affine-shared/services';
import { BlockFlavourIdentifier } from '@labre/std';
import { html } from 'lit';

import { createC4Legend } from '../actions';

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

/**
 * The selected C4 board's contextual toolbar: the resize toggle, and the
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
