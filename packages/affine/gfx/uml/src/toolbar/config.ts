import {
  EdgelessCRUDIdentifier,
  validationToolbarConfig,
} from '@labre/affine-block-surface';
import { createAutoLegend, dddLegendIcon } from '@labre/affine-gfx-ddd-shared';
import { UmlDiagramElementModel } from '@labre/affine-model';
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

import { UML_DIAGRAM_KIND_MENU, type UmlDiagramKindOption } from '../kinds.js';
import { UML_AUTO_LEGEND } from '../legend.js';

import { umlExportPlantumlIcon, umlExportXmiIcon } from './icons.js';

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
 * The two glyphs the kind picker needs, drawn inline rather than pulled from
 * `@labre/affine-components` — a dependency this package does not have and which
 * is not worth adding for two paths. The same call the C4 board's row makes for
 * its own, and the same call {@link ResizeIcon} above already makes.
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

/** The tick on the kind in force — rendered at the END of the row. */
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
 * does — the shape `docs/adr/0010` M3 introduced, and the reason an export has
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
 * Lifted verbatim from the C4 board's row, where `c4.exportMermaid` sits in
 * exactly this position.
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
 * The selected UML diagram frame's contextual toolbar: the resize toggle, and
 * the two exports in the "⋮".
 *
 * ## Why the exports sit in the ALWAYS-ON half
 *
 * `ActionPlacement.More` partitions an entry out of the row and into the
 * overflow menu, and the entries it collects come from EVERY module contributing
 * to this element — so a slice adds itself there without owning this file. The
 * two interchange exports are the rarest thing anybody does to a frame, and the
 * `y.` / `z.` id prefixes are the sort keys that keep them last, in that order:
 * PlantUML is what an architect pastes into a renderer, XMI is what they hand to
 * another tool.
 *
 * They are declared HERE, in the always-on module, rather than beside the legend
 * in the flag-gated one — which is exactly where the C4 board puts its own
 * export. The two kinds of entry look alike and are gated by different
 * mechanisms, and that is the point: the legend button CALLS an action directly,
 * so nothing but the module's registration can hide it, while these ask the
 * registry for a command that only the flag-gated half registers and hide
 * themselves when it is not there. With the `uml` button off the row is the
 * resize toggle alone either way, and nothing on it can be clicked into a no-op.
 *
 * Declaring them in the always-on module is what makes that guard the SINGLE
 * thing deciding whether an export is offered — the same rule the palette, the
 * catalogue and the agent read — instead of the guard plus a second registration
 * that could one day disagree with it.
 *
 * There is no rename entry, and there is nothing missing: both UML frames edit
 * their one word in place on a double-click (`element-view.ts`).
 */
export const umlDiagramToolbarConfig = {
  actions: [
    {
      id: 'a.toggle-resize',
      tooltipWording: BOARD_RESIZE_TOGGLE,
      icon: ResizeIcon,
      active(ctx: ToolbarContext) {
        const models = ctx.getSurfaceModelsByType(UmlDiagramElementModel);
        return models.length > 0 && models.every(model => model.resizeEnabled);
      },
      run(ctx: ToolbarContext) {
        const models = ctx.getSurfaceModelsByType(UmlDiagramElementModel);
        if (!models.length) return;
        const enable = !models.every(model => model.resizeEnabled);
        ctx.std.store.captureSync();
        const crud = ctx.std.get(EdgelessCRUDIdentifier);
        for (const model of models) {
          crud.updateElement(model.id, { resizeEnabled: enable });
        }
      },
    },
    // …and, in the "⋮", the two things you do to a finished diagram rather than
    // to the frame it is drawn on: take it away as a file.
    commandMoreAction(
      'y.export-plantuml',
      'uml.exportPlantuml',
      'com.labre.commands.uml.exportPlantuml',
      'Export as PlantUML',
      umlExportPlantumlIcon
    ),
    commandMoreAction(
      'z.export-xmi',
      'uml.exportXmi',
      'com.labre.commands.uml.exportXmi',
      'Export as XMI',
      umlExportXmiIcon
    ),
  ],
  when: (ctx: ToolbarContext) =>
    ctx.getSurfaceModelsByType(UmlDiagramElementModel).length > 0,
} as const satisfies ToolbarModuleConfig;

export const umlDiagramToolbarExtension = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('affine:surface:umlDiagram'),
  config: umlDiagramToolbarConfig,
});

/**
 * The frame the kind picker is about, or `null`.
 *
 * ONE frame, deliberately: a kind is one statement about one sheet, and a
 * selection spanning two frames has no honest current value to show — the same
 * call the C4 level picker and the generic Validation dropdown both make.
 */
function selectedDiagram(ctx: ToolbarContext): UmlDiagramElementModel | null {
  const models = ctx.getSurfaceModels();
  if (models.length !== 1) return null;
  const [model] = models;
  return model instanceof UmlDiagramElementModel ? model : null;
}

/**
 * Put the frame on `option`, and report it.
 *
 * `captureSync` first, so one click is one undo — the rule every write on this
 * toolbar follows. Written through {@link EdgelessCRUDIdentifier} rather than by
 * assigning the field, because the heading is DERIVED from it: the CRUD write is
 * what the surface observes, and the frame has to repaint its tag.
 *
 * A choice that changes nothing writes nothing and reports nothing — an undo
 * checkpoint for a no-op is a click the user has to press twice to get back
 * past.
 *
 * There is no "clear" here, unlike the C4 level picker: a UML frame's kind is
 * required (`UmlDiagramElementModel.kind`), because Annex A's heading is
 * `<kind> <name>` and a frame with no kind has no heading to draw.
 */
function pickKind(ctx: ToolbarContext, option: UmlDiagramKindOption) {
  const diagram = selectedDiagram(ctx);
  if (!diagram) return;
  const previous = diagram.kind;
  if (previous === option.kind) return;

  ctx.std.store.captureSync();
  ctx.std
    .get(EdgelessCRUDIdentifier)
    .updateElement(diagram.id, { kind: option.kind });

  // The same event the C4 level picker emits, with the same wire values: the
  // two frameworks' "the author said which diagram this is" gesture is one
  // metric on a dashboard, and `level` is the field it is reported in.
  ctx.std.getOptional(TelemetryProvider)?.track('FrameworkViewLevelSet', {
    page: 'whiteboard editor',
    segment: 'element toolbar',
    module: 'uml toolbox',
    control: 'kind',
    framework: 'uml',
    level: option.kind,
    previousLevel: previous,
  });
}

/**
 * The kind picker: which of UML's diagrams this frame draws.
 *
 * ## Why it is a DECLARED fact and not a rename
 *
 * A frame's name is free text — "Orders", "Checkout", whatever the author writes
 * — and nothing in it says which kind of diagram it is. The kind is a second,
 * small, closed statement, and picking one leaves the words alone: the author
 * keeps their name, the heading gains its tag, and the exporters get a fact they
 * can write into a file (`<kind>` is what tells PlantUML and XMI what they are
 * looking at).
 *
 * ## Why it is flag-gated tooling
 *
 * Declaring a kind is deciding how the diagram is to be READ, which is exactly
 * what `docs/adr/0009` calls tooling: with the `uml` flag off, a frame already
 * carrying a kind keeps it written, keeps painting its heading and simply stops
 * being offered the choice. Nothing a stored document needs to load or paint is
 * behind it.
 *
 * ## Shape
 *
 * A dropdown: four mutually exclusive options with a current value are a menu,
 * not four buttons competing for a toolbar's width. The trigger NAMES the kind
 * in force, so a reader of the row knows what the sheet claims without opening
 * anything.
 */
const kindPickerAction = {
  // After the legend (`b.`) and before the Validation dropdown (`z.`): the kind
  // is a statement about the sheet, read before the level of requirement
  // applied to it.
  id: 'c.kind',
  when: (ctx: ToolbarContext) => selectedDiagram(ctx) !== null,
  content(ctx: ToolbarContext) {
    const diagram = selectedDiagram(ctx);
    if (!diagram) return null;

    const menuLabel = translateKey(
      ctx.std,
      UML_DIAGRAM_KIND_MENU.labelKey,
      UML_DIAGRAM_KIND_MENU.labelFallback
    );
    const wordsFor = (option: UmlDiagramKindOption) =>
      translateKey(ctx.std, option.labelKey, option.labelFallback);
    // A frame carrying a kind this build does not know — a phase-2 value on a
    // phase-1 build, an import — shows the menu's own heading rather than
    // silently reading as a class diagram.
    const current = UML_DIAGRAM_KIND_MENU.options.find(
      option => option.kind === diagram.kind
    );

    const options = UML_DIAGRAM_KIND_MENU.options.map(option => {
      const selected = option.kind === diagram.kind;
      return html`<editor-menu-action
        data-option
        data-testid="uml-kind-option"
        data-kind=${option.kind}
        data-selected=${selected ? 'true' : nothing}
        aria-label=${wordsFor(option)}
        aria-pressed=${selected}
        @click=${() => pickKind(ctx, option)}
      >
        <span class="label">${wordsFor(option)}</span>
        ${selected ? CheckIcon : nothing}
      </editor-menu-action>`;
    });

    return html`<editor-menu-button
      data-testid="uml-kind-entry"
      .contentPadding=${'8px'}
      .button=${html`
        <editor-icon-button
          data-testid="uml-kind-button"
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
        data-testid="uml-kind-menu"
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
 * The legend button — the flag-gated half of the row.
 *
 * ## The legend is a BUTTON, not a command
 *
 * Every other UML gesture is a registered `CommandDescriptor`, which is the
 * bottleneck `docs/adr/0008` asks for. The legend is the arbitrated exception,
 * carried over from C4 and the Context Map (PO arbitration, 27/08/2026):
 * generating one belongs to a frame you have SELECTED and to nothing else — it
 * is not an artefact to pick off a palette, and an entry in a catalogue of
 * things UML draws would offer it to a user with no diagram in front of them. So
 * there is no `uml.legend` command, this button is the only way to reach it, and
 * the telemetry it owes is emitted BY HAND below.
 *
 * The cost is the one the bottleneck exists to avoid and is accepted knowingly:
 * this `track()` call is a second emitter, and it is on whoever edits it to keep
 * the wire values matching what `reportCommandTelemetry` would have sent.
 *
 * `b.` sorts it after the resize toggle, so the two modules render as the one
 * row a user sees rather than in registration order.
 */
export const umlLegendToolbarConfig = {
  actions: [
    {
      id: 'b.legend',
      tooltipWording: BOARD_LEGEND_NOTATION,
      icon: dddLegendIcon,
      run(ctx: ToolbarContext) {
        // The FIRST selected frame and no other: a legend is placed relative to
        // one background, and two of them would put two boxes on top of
        // whatever sits in that corner. Everything about the gesture — the
        // scan, the placement, the box — is `createAutoLegend`'s; UML
        // contributes `UML_AUTO_LEGEND`, a table.
        if (ctx.std.store.readonly) return;
        const [diagram] = ctx.getSurfaceModelsByType(UmlDiagramElementModel);
        if (!diagram) return;
        createAutoLegend(ctx.std, diagram, UML_AUTO_LEGEND);

        ctx.std
          .getOptional(TelemetryProvider)
          ?.track('FrameworkLegendCreated', {
            // The WIRE values, and they are the ones `reportCommandTelemetry`
            // would have sent for a `kind: 'legend'` command — `framework` from
            // the descriptor's `telemetryKey`, `element: 'legend'` as C4,
            // Wardley and the Context Map all emit, so the four are one metric.
            framework: 'uml',
            element: 'legend',
            page: 'whiteboard editor',
            segment: 'element toolbar',
            module: 'uml toolbox',
          });
      },
    },
  ],
  when: (ctx: ToolbarContext) =>
    ctx.getSurfaceModelsByType(UmlDiagramElementModel).length > 0,
} as const satisfies ToolbarModuleConfig;

/**
 * The frame's flag-gated row, WHOLE: the legend button and the kind picker, in
 * ONE module.
 *
 * ## Why they cannot be two modules
 *
 * `renderToolbar` merges exactly four slots per element — `<flavour>`,
 * `custom:<flavour>`, and the two `affine:surface:*` wildcards — and
 * `ToolbarModuleExtension` binds by DI variant, so a second module claiming
 * `custom:affine:surface:umlDiagram` throws `DuplicateServiceDefinitionError`
 * before the editor finishes setting up. Two slots, and UML has three things to
 * put on a selected frame: the resize toggle (always-on, `<flavour>`), the
 * legend and the kind.
 *
 * Both of the latter are gated by the same flag and appear together or not at
 * all, so one module is the honest grouping rather than a workaround: `uml` off
 * takes away the gesture that CREATES legend elements and the choice of which
 * kind of diagram this sheet is, and leaves the stored frame its handles, its
 * heading and everything already drawn on it.
 *
 * Sorting keeps the row readable across the merge — `b.legend`, `c.kind`, then
 * `z.validation` from {@link validationToolbarConfig} — so the user sees resize,
 * legend, the diagram's KIND, then the level of requirement, whatever order the
 * modules were registered in.
 */
export const umlDiagramToolingToolbarConfig: ToolbarModuleConfig = {
  actions: [
    ...umlLegendToolbarConfig.actions,
    // Which of the four UML diagrams this sheet draws — a fact about the frame,
    // written on the frame, read by `uml.not-admissible-on-kind`.
    kindPickerAction,
    // The generic dropdown, not a UML variant of it: the config names no
    // framework — it reads the registered rules and profiles — so this is the
    // very same object wardley, bpmn, the context map and C4 register.
    ...validationToolbarConfig.actions,
  ],
  when: umlLegendToolbarConfig.when,
};

export const umlDiagramToolingToolbarExtension = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('custom:affine:surface:umlDiagram'),
  config: umlDiagramToolingToolbarConfig,
});

/**
 * The SUBJECT claims no toolbar flavour at all, and that is a decision rather
 * than an omission.
 *
 * The same arbitration the C4 boundary records (PO, 28/08/2026): **the sheet
 * alone arbitrates the checklist.** One diagram, one level of requirement, one
 * place to set it — a second picker on a frame drawn INSIDE the first is a way
 * to make a diagram disagree with itself, and no reader could tell which answer
 * it was being held to. `inheritChosenProfiles` makes a frame that names no
 * profile inherit the innermost containing frame's choice, so a subject drawn on
 * a diagram set to Review checklist is itself on Review checklist.
 *
 * It has no kind picker either, and for a plainer reason: §18.1.4 gives the
 * subject one rectangle with one name and nothing to choose between.
 */
