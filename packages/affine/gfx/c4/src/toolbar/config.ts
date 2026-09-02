import {
  EdgelessCRUDIdentifier,
  validationToolbarConfig,
} from '@labre/affine-block-surface';
import { dddLegendIcon } from '@labre/affine-gfx-ddd-shared';
import { C4BoardElementModel } from '@labre/affine-model';
import {
  ActionPlacement,
  BOARD_LEGEND_NOTATION,
  BOARD_RESIZE_TOGGLE,
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
import { html, nothing, type TemplateResult } from 'lit';

import { createC4Legend } from '../actions';
import { C4_BOARD_LEVEL_MENU, type C4BoardLevelOption } from '../levels';

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

/**
 * The two glyphs the level picker needs, drawn inline rather than pulled from
 * `@labre/affine-components` — a dependency this package does not have and
 * which is not worth adding for two paths. The same call
 * `validation-toolbar.ts` makes for its own tick, and the same call
 * {@link ResizeIcon} above already makes.
 */
const ChevronDownIcon = html`<svg
  width="16"
  height="16"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M6 9l6 6 6-6" />
</svg>`;

/**
 * The tick on the level in force — inline, this package carrying no icon
 * dependency. Rendered at the END of the row and only when selected, the row
 * itself wearing `data-option` for the native geometry and the primary colour.
 */
const CheckIcon = html`<svg
  width="20"
  height="20"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M5 12.5l4.5 4.5L19 7.5" />
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
      tooltipWording: BOARD_RESIZE_TOGGLE,
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
 * The board the level picker is about, or `null`.
 *
 * ONE board, deliberately: a level is one statement about one sheet, and a
 * selection spanning two boards has no honest current value to show — the same
 * call the generic Validation dropdown makes about the profile it offers.
 */
function selectedBoard(ctx: ToolbarContext): C4BoardElementModel | null {
  const models = ctx.getSurfaceModels();
  if (models.length !== 1) return null;
  const [model] = models;
  return model instanceof C4BoardElementModel ? model : null;
}

/**
 * Put the board on `option`, and report it.
 *
 * `captureSync` first, so one click is one undo — the rule every write on this
 * toolbar follows. Choosing **Free sketch** CLEARS the field rather than writing
 * a fourth value, which is the very move `ValidationManager.setProfile` makes
 * for the default profile and for its reason: the default must leave a document
 * byte-identical to one drawn before the field existed.
 *
 * A choice that changes nothing writes nothing and reports nothing — an undo
 * checkpoint for a no-op is a click the user has to press twice to get back
 * past.
 */
function pickLevel(ctx: ToolbarContext, option: C4BoardLevelOption) {
  const board = selectedBoard(ctx);
  if (!board) return;
  const previous = board.level;
  if (previous === option.level) return;

  ctx.std.store.captureSync();
  if (option.level === undefined) board.clearField('level');
  else board.level = option.level;

  ctx.std.getOptional(TelemetryProvider)?.track('FrameworkViewLevelSet', {
    page: 'whiteboard editor',
    segment: 'element toolbar',
    module: 'c4 toolbar',
    control: 'level',
    framework: 'c4',
    // The absence is a value the dashboard needs as much as the three others:
    // "put back to a free sketch" is the gesture that says the author changed
    // their mind about what the sheet is.
    level: option.level ?? 'none',
    ...(previous !== undefined ? { previousLevel: previous } : {}),
  });
}

/**
 * The level picker: which of C4's three diagrams this board draws.
 *
 * ## Why it is a DECLARED fact and not a rename
 *
 * A board's title is free text and always was — "Payments", "Internet Banking",
 * whatever the author writes on it — and nothing in it says which of the three
 * sheets it is. The level is a second, small, closed statement sitting beside
 * the title, and picking one leaves the words alone: the author keeps their
 * name, the rules get a fact they can read (`rules.ts`, C15 and C16).
 *
 * ## Why it is flag-gated tooling
 *
 * Declaring a level is deciding how the diagram is to be READ and judged, which
 * is exactly what `docs/adr/0009` calls tooling: with the `c4` flag off, a board
 * already carrying a level keeps it written, keeps painting and simply stops
 * being offered the choice — and stops being checked, because the rules go with
 * the same flag. Nothing a stored document needs to load or paint is behind it.
 *
 * ## Shape
 *
 * A dropdown, like the Validation entry it sits beside, and for the same reason:
 * four mutually exclusive options with a current value are a menu, not four
 * buttons competing for a toolbar's width. The trigger NAMES the level in force,
 * so a reader of the row knows what the sheet claims without opening anything.
 */
const levelPickerAction = {
  // Between the legend (`b.`) and the generic Validation dropdown (`z.`): the
  // level is a statement about the sheet, read before the level of requirement
  // applied to it.
  id: 'c.level',
  when: (ctx: ToolbarContext) => selectedBoard(ctx) !== null,
  content(ctx: ToolbarContext) {
    const board = selectedBoard(ctx);
    if (!board) return null;

    const menuLabel = translateKey(
      ctx.std,
      C4_BOARD_LEVEL_MENU.labelKey,
      C4_BOARD_LEVEL_MENU.labelFallback
    );
    const wordsFor = (option: C4BoardLevelOption) =>
      translateKey(ctx.std, option.labelKey, option.labelFallback);
    const current =
      C4_BOARD_LEVEL_MENU.options.find(
        option => option.level === board.level
      ) ??
      // A board carrying a level this build does not know — a peer on a newer
      // version, an import — names it rather than silently reading as a sketch.
      undefined;

    const options = C4_BOARD_LEVEL_MENU.options.map(option => {
      const selected = option.level === board.level;
      return html`<editor-menu-action
        data-option
        data-testid="c4-level-option"
        data-level=${option.level ?? 'none'}
        data-selected=${selected ? 'true' : nothing}
        aria-label=${wordsFor(option)}
        aria-pressed=${selected}
        @click=${() => pickLevel(ctx, option)}
      >
        <span class="label">${wordsFor(option)}</span>
        ${selected ? CheckIcon : nothing}
      </editor-menu-action>`;
    });

    return html`<editor-menu-button
      data-testid="c4-level-entry"
      .contentPadding=${'8px'}
      .button=${html`
        <editor-icon-button
          data-testid="c4-level-button"
          aria-label=${menuLabel}
          .tooltip=${menuLabel}
          .justify=${'space-between'}
          .labelHeight=${'20px'}
        >
          <span class="label"
            >${current === undefined ? menuLabel : wordsFor(current)}</span
          >
          ${ChevronDownIcon}
        </editor-icon-button>
      `}
    >
      <div
        data-testid="c4-level-menu"
        data-orientation="vertical"
        data-size="large"
      >
        <div
          role="group"
          aria-label=${menuLabel}
          style="display: flex; flex-direction: column;"
        >
          ${options}
        </div>
      </div>
    </editor-menu-button>`;
  },
};

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
      tooltipWording: BOARD_LEGEND_NOTATION,
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
 * The last three — the legend, the LEVEL this board declares and the level of
 * requirement — are gated by the same flag and appear together or not at all, so
 * one module is the honest grouping rather than a workaround: `c4` off takes
 * away the gesture that CREATES legend elements, the choice of which diagram
 * this sheet is, and the choice of how hard to check it, and leaves the stored
 * board its handles and everything already written on it.
 *
 * Sorting keeps the row readable across the merge — `b.legend` and `c.level`
 * from the config above, `z.validation` from {@link validationToolbarConfig} —
 * so the user sees resize, legend, the diagram's level, then the level of
 * requirement, whatever order the modules were registered in.
 */
export const c4BoardToolingToolbarConfig: ToolbarModuleConfig = {
  actions: [
    ...c4LegendToolbarConfig.actions,
    // Which of the three C4 diagrams this sheet draws — a fact about the board,
    // written on the board, read by two of the sixteen rules.
    levelPickerAction,
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
 * The BOUNDARY claims no toolbar flavour at all, and that is a decision rather
 * than an omission.
 *
 * Two of the fourteen rules — `c4.homeless-component` and
 * `c4.person-in-boundary` — are framed against the boundary, so their findings
 * are attributed to it. An earlier draft of this file concluded that the
 * boundary therefore needed a picker of its own, or those two would sit at the
 * default level whatever the author chose.
 *
 * The PO arbitrated the other way on 28/08/2026: **the board alone arbitrates
 * the checklist.** One diagram, one level of requirement, one place to set it —
 * a second picker on a frame drawn INSIDE the first is a way to make a board
 * disagree with itself, and no reader could tell which answer the diagram was
 * being held to.
 *
 * The engine carries the consequence rather than the UI working around it:
 * `inheritChosenProfiles` (`packages/affine/blocks/surface/src/extensions/validation.ts`)
 * makes a frame that names no profile inherit the innermost containing frame's
 * choice, so a boundary drawn on a board set to Review checklist is itself on
 * Review checklist and the two boundary-anchored rules harden with the rest.
 * Nothing here has to know that; the absence of a module is the whole change.
 */
