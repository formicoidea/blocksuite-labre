import {
  EdgelessCRUDIdentifier,
  generateElementId,
  validationToolbarConfig,
} from '@labre/affine-block-surface';
import { createAutoLegend, dddLegendIcon } from '@labre/affine-gfx-ddd-shared';
import {
  UmlDiagramElementModel,
  UmlFragmentElementModel,
  UmlPartitionElementModel,
  type UmlPartitionOrientation,
  UmlRegionElementModel,
} from '@labre/affine-model';
import {
  ActionPlacement,
  BOARD_ADD_BAND,
  BOARD_LEGEND_NOTATION,
  BOARD_ORIENTATION_TOGGLE,
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

import {
  UML_DIAGRAM_KIND_MENU,
  UML_FRAGMENT_OPERATOR_MENU,
  type UmlDiagramKindOption,
  type UmlFragmentOperatorOption,
} from '../kinds.js';
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

/* ── Phase 2: the two banded frames of the behaviour diagrams ───────────── */

/**
 * The two arrows of the orientation toggle — the bands turned a quarter turn.
 *
 * Drawn inline, as every other glyph on this row is and for the same reason:
 * `@labre/affine-components` is not a dependency of this package and two paths
 * are not worth making it one.
 */
const OrientationIcon = html`<svg
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.6"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M4 4h5v16H4zM15 4h5v16h-5z" />
  <path d="M11.5 9.5l1 1 1-1M12.5 10.5v3" />
</svg>`;

/**
 * The resize toggle, for a frame that is neither the diagram nor the subject.
 *
 * Written once for the two phase-2 backgrounds rather than a third time inline:
 * a partition and a region toggle the very same declared field on the very same
 * primitive, and the only thing that differs between their two rows is which
 * model class the selection is filtered by.
 *
 * `a.` sorts it first, exactly as it does on the diagram's row, so the merged
 * row reads the same wherever the modules were registered.
 */
function resizeToggle<
  T extends abstract new (...args: never[]) => {
    id: string;
    resizeEnabled: boolean;
  },
>(klass: T) {
  return {
    id: 'a.toggle-resize',
    tooltipWording: BOARD_RESIZE_TOGGLE,
    icon: ResizeIcon,
    active(ctx: ToolbarContext) {
      const models = ctx.getSurfaceModelsByType(klass);
      return models.length > 0 && models.every(model => model.resizeEnabled);
    },
    run(ctx: ToolbarContext) {
      const models = ctx.getSurfaceModelsByType(klass);
      if (!models.length) return;
      const enable = !models.every(model => model.resizeEnabled);
      ctx.std.store.captureSync();
      const crud = ctx.std.get(EdgelessCRUDIdentifier);
      for (const model of models) {
        crud.updateElement(model.id, { resizeEnabled: enable });
      }
    },
  };
}

/**
 * The ACTIVITY PARTITION's row: the resize toggle, and the one thing a swimlane
 * can be said differently — which way its bands run.
 *
 * ## Why the orientation toggle is ALWAYS-ON
 *
 * It writes a stored field, so it is not obviously tooling — and that is exactly
 * the question `docs/adr/0009` makes people ask. The answer is the one the
 * resize toggle already gives: this is a GESTURE ON A SELECTED ELEMENT, not a
 * way to put a new one on the canvas. A partition drawn while the `uml` flag was
 * on must stay usable with it off — moved, stretched, renamed, and turned the
 * right way round for the sheet it sits on — because every one of those is
 * something the author does to a thing that is already there.
 *
 * The line the ADR actually draws is between the ways to CREATE and the ways to
 * work with what exists. `resizeEnabled` writes content too (it is a field of
 * the model, undoable like any other); so does the rename on a double-click; so
 * does dragging the frame. What the flag takes away is the button that adds a
 * partition in the first place, and the menu it lives in.
 *
 * ## Why a toggle and not a two-option dropdown
 *
 * §15.6.4 gives the orientation no meaning: a partition drawn in columns and the
 * same partition drawn in rows say the same thing, and the choice is made
 * against the sheet — a wide activity diagram wants rows, a tall one wants
 * columns. Two mutually exclusive values with no semantics between them are a
 * flip, and a dropdown would spend a menu on a question whose two answers are
 * "this way" and "the other way". The C4 level picker is a dropdown because
 * there are four levels and each MEANS something.
 *
 * `active` reports HORIZONTAL — the value that is not the default — so the
 * button reads as pressed exactly when the author has turned the bands.
 *
 * ponytail: the flip writes `orientation` and nothing else. It does not swap the
 * frame's width and height, so a tall partition turned horizontal is a wide band
 * stack in a tall box until the author drags it — the notation has nothing to
 * say about the box, and guessing a new one is a gesture the user did not ask
 * for and cannot half-undo.
 */
export const umlPartitionToolbarConfig = {
  actions: [
    resizeToggle(UmlPartitionElementModel),
    {
      // After the resize toggle, before anything a later phase hangs off the
      // `custom:` twin — the row reads resize, then orientation.
      id: 'b.orientation',
      tooltipWording: BOARD_ORIENTATION_TOGGLE,
      icon: OrientationIcon,
      active(ctx: ToolbarContext) {
        const models = ctx.getSurfaceModelsByType(UmlPartitionElementModel);
        return (
          models.length > 0 &&
          models.every(model => model.orientation === 'horizontal')
        );
      },
      run(ctx: ToolbarContext) {
        const models = ctx.getSurfaceModelsByType(UmlPartitionElementModel);
        if (!models.length) return;
        // One click, one answer for the whole selection: turn them all
        // horizontal unless they already all are, in which case turn them back.
        // The same rule the resize toggle follows, and the reason a mixed
        // selection converges instead of alternating.
        const next: UmlPartitionOrientation = models.every(
          model => model.orientation === 'horizontal'
        )
          ? 'vertical'
          : 'horizontal';
        ctx.std.store.captureSync();
        const crud = ctx.std.get(EdgelessCRUDIdentifier);
        for (const model of models) {
          crud.updateElement(model.id, { orientation: next });
        }
      },
    },
  ],
  when: (ctx: ToolbarContext) =>
    ctx.getSurfaceModelsByType(UmlPartitionElementModel).length > 0,
} as const satisfies ToolbarModuleConfig;

export const umlPartitionToolbarExtension = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('affine:surface:umlPartition'),
  config: umlPartitionToolbarConfig,
});

/**
 * The REGION's row: the resize toggle, and nothing else.
 *
 * A region is a composite state's inside (§14.2.4) — one rounded rectangle with
 * one name compartment and sub-states drawn in it. It has no orientation: its
 * band is its name compartment, which §14.2.4 puts at the top and nowhere else,
 * and there is no second reading of the same picture to flip to. So the row is
 * the one entry every framework background carries, and the rename is on the
 * band under a double-click (`element-view.ts`) as it is on all the others.
 *
 * Registered as its own module rather than folded into the partition's because
 * `renderToolbar` merges BY FLAVOUR: these are two element types, so two rows.
 */
export const umlRegionToolbarConfig = {
  actions: [resizeToggle(UmlRegionElementModel)],
  when: (ctx: ToolbarContext) =>
    ctx.getSurfaceModelsByType(UmlRegionElementModel).length > 0,
} as const satisfies ToolbarModuleConfig;

export const umlRegionToolbarExtension = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('affine:surface:umlRegion'),
  config: umlRegionToolbarConfig,
});

/* ── Phase 3: the COMBINED FRAGMENT's two rows (§17.6.4) ────────────────── */

/**
 * The COMBINED FRAGMENT's always-on row: the resize toggle, and nothing else.
 *
 * The same argument the region's makes, and the same one entry: a fragment is a
 * rectangle drawn round part of an interaction, and a document that holds one
 * must keep it movable and stretchable with the UML button switched off
 * (`docs/adr/0009`). What the flag takes away is the two gestures below.
 */
export const umlFragmentToolbarConfig = {
  actions: [resizeToggle(UmlFragmentElementModel)],
  when: (ctx: ToolbarContext) =>
    ctx.getSurfaceModelsByType(UmlFragmentElementModel).length > 0,
} as const satisfies ToolbarModuleConfig;

export const umlFragmentToolbarExtension = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('affine:surface:umlFragment'),
  config: umlFragmentToolbarConfig,
});

/** One operand of a fragment, as the model stores it — read off the model. */
type UmlFragmentOperand = NonNullable<
  UmlFragmentElementModel['operands']
>[number];

/**
 * The fragments an operand gesture acts on: every one of the current selection
 * that is not locked, on an editable document.
 *
 * Lifted from `bpmnPoolsForLaneEdit`, filter for filter and for the same
 * reasons: EVERY selected fragment rather than the single one (a gesture that
 * says what it did on each beats an entry that vanishes on a lasso), and the
 * read-only and lock filters because this is about to write.
 */
function umlFragmentsForOperandEdit(
  ctx: ToolbarContext
): UmlFragmentElementModel[] {
  if (ctx.std.store.readonly) return [];
  return ctx
    .getSurfaceModelsByType(UmlFragmentElementModel)
    .filter(model => !model.isLocked());
}

/** A fragment's operand list, as an array whatever the document holds. */
const operandsOf = (
  model: UmlFragmentElementModel
): readonly UmlFragmentOperand[] =>
  Array.isArray(model.operands) ? model.operands : [];

/**
 * Append an operand to every selected fragment — the second branch of an
 * `alt`, the `else` of a `par`, the next case of a fragment that has one
 * (§17.6.4).
 *
 * ## Why the first click writes TWO
 *
 * Because §17.6.4's picture is unambiguous and BPMN's lane gesture is the wrong
 * analogy here. A pool with no lanes is a pool; a pool with one lane is a pool
 * with a lane drawn in it, and both are legal BPMN. A combined fragment with no
 * `operands` is the ONE-operand fragment §17.6.4 draws — a box with a tag and
 * no dashed rule — and what an author asks for by pressing this is the SECOND
 * branch, with the separator between the two. Writing one zone would divide the
 * fragment into a single band and draw nothing at all.
 *
 * So the first press seeds the operand that was implicit plus the new one, and
 * every press after it appends a single band. Equal shares throughout: the
 * average of what is there is the weight that leaves the existing operands the
 * same size relative to each other, and gives the newcomer the room a typical
 * one has.
 *
 * ## No guard is invented, and the operator is not restated
 *
 * A new band arrives with no `name` at all, which is the decision the model
 * records for the fragment's own guard and the same one for the same reason:
 * §17.6.4 writes a condition in an operand's corner only where there is one,
 * and a band born carrying `[condition]` would be a guard the author never
 * wrote. The first operand, made explicit here, carries whatever guard the
 * fragment already had — nothing is invented and nothing is lost.
 *
 * Nothing here touches `operator` either: which kind of fragment this is is one
 * statement about the whole box, and the picker beside this button is where it
 * is made.
 *
 * ## Nothing moves
 *
 * Messages already drawn inside the fragment do NOT move. Membership here is
 * geometric — an occurrence is "in" an operand because it falls in that band —
 * so the bands simply redraw around what is there, and the line an author drew
 * still lands where they drew it. The same promise `removeBpmnLane` makes, for
 * the same reason.
 */
function addUmlOperand(ctx: ToolbarContext): void {
  const fragments = umlFragmentsForOperandEdit(ctx);
  if (fragments.length === 0) return;

  // Before the writes: one capture for the whole gesture is what makes several
  // fragments take their operand in a single undo step.
  ctx.std.store.captureSync();
  const crud = ctx.std.get(EdgelessCRUDIdentifier);

  for (const model of fragments) {
    const operands = operandsOf(model);
    const size = operands.length
      ? operands.reduce((sum, operand) => sum + operand.size, 0) /
        operands.length
      : 1;
    // The implicit first operand, made explicit — see the header. A fragment
    // that already declares its zones simply gains one.
    const existing = operands.length
      ? operands
      : [{ id: generateElementId(), name: model.name || undefined, size }];
    crud.updateElement(model.id, {
      operands: [...existing, { id: generateElementId(), size }],
    });
  }
}

/**
 * The two arrows and the rule between them: an operand being added under the
 * one that is there.
 *
 * Drawn inline like every other glyph on this row, for the reason
 * {@link ResizeIcon} and {@link OrientationIcon} give — this package does not
 * depend on `@labre/affine-components`, and one path is not worth making it.
 */
const AddOperandIcon = html`<svg
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.6"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M4 4h16v16H4z" />
  <path d="M4 12h16" stroke-dasharray="2.5 2.5" />
  <path d="M12 14.5v4M10 16.5h4" />
</svg>`;

/**
 * Which kind of combined fragment this is — the operator picker (§17.6.4).
 *
 * The same control as the diagram frame's kind picker, on the other frame, and
 * it is the same argument: a closed set of mutually exclusive values with a
 * current one is a MENU, not a row of buttons, and the trigger names the value
 * in force so a reader of the row knows what the box claims without opening
 * anything. `UML_FRAGMENT_OPERATOR_MENU` is DATA (`operators.ts`), walked by the
 * translation manifest exactly as the diagram's table is.
 *
 * ## Why the operator is a picker and not a morph
 *
 * A morph retypes an ELEMENT — it rewrites the props that make a rectangle look
 * like an interface rather than a class. An operator changes one field of one
 * element and changes no prop at all: the box is the same box, the border is
 * the same border, and what moves is the word in the pentagon. There is nothing
 * for a family declaration to declare.
 *
 * ## `ref` is in the menu, and that is deliberate
 *
 * An interaction use is this element with `ref` in the tag (§17.7.4), so it is
 * one of the values the field takes and hiding it here would mean an author who
 * drew an `alt` and meant a `ref` has to delete the box and draw another. The
 * command that creates one is separate because it is a different modelling act
 * (`actions.ts`); the field is one field.
 */
const operatorPickerAction = {
  // After the add-operand button (`b.`) and before the Validation dropdown
  // (`z.`), which is the diagram frame's own ordering: what the frame IS, then
  // the level of requirement applied to it.
  id: 'c.operator',
  when: (ctx: ToolbarContext) => selectedFragment(ctx) !== null,
  content(ctx: ToolbarContext) {
    const fragment = selectedFragment(ctx);
    if (!fragment) return null;

    const menuLabel = translateKey(
      ctx.std,
      UML_FRAGMENT_OPERATOR_MENU.labelKey,
      UML_FRAGMENT_OPERATOR_MENU.labelFallback
    );
    const wordsFor = (option: UmlFragmentOperatorOption) =>
      translateKey(ctx.std, option.labelKey, option.labelFallback);
    // A fragment carrying an operator this build does not know — an import, a
    // later phase's value — shows the menu's own heading rather than silently
    // reading as an `alt`.
    const current = UML_FRAGMENT_OPERATOR_MENU.options.find(
      option => option.operator === fragment.operator
    );

    const options = UML_FRAGMENT_OPERATOR_MENU.options.map(option => {
      const selected = option.operator === fragment.operator;
      return html`<editor-menu-action
        data-option
        data-testid="uml-operator-option"
        data-operator=${option.operator}
        data-selected=${selected ? 'true' : nothing}
        aria-label=${wordsFor(option)}
        aria-pressed=${selected}
        @click=${() => pickOperator(ctx, option)}
      >
        <span class="label">${wordsFor(option)}</span>
        ${selected ? CheckIcon : nothing}
      </editor-menu-action>`;
    });

    return html`<editor-menu-button
      data-testid="uml-operator-entry"
      .contentPadding=${'8px'}
      .button=${html`
        <editor-icon-button
          data-testid="uml-operator-button"
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
        data-testid="uml-operator-menu"
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
 * The fragment the operator picker is about, or `null` — ONE of them, for the
 * reason {@link selectedDiagram} gives: an operator is one statement about one
 * box, and a selection spanning two has no honest current value to show.
 */
function selectedFragment(ctx: ToolbarContext): UmlFragmentElementModel | null {
  const models = ctx.getSurfaceModels();
  if (models.length !== 1) return null;
  const [model] = models;
  return model instanceof UmlFragmentElementModel ? model : null;
}

/**
 * Put the fragment on `option`, and report it.
 *
 * The same three rules `pickKind` follows: `captureSync` first so one click is
 * one undo, written through {@link EdgelessCRUDIdentifier} because the tag is
 * DERIVED from the field and the surface has to repaint it, and a choice that
 * changes nothing writes nothing and reports nothing.
 *
 * The guard is NOT rewritten. `name` holds the author's own `[condition]` (or
 * the name of the interaction a `ref` points at), and a picker that cleared it
 * on the way from `alt` to `opt` would be taking away words somebody typed —
 * the very rule the node morph's `afterMorph` is written round.
 */
function pickOperator(ctx: ToolbarContext, option: UmlFragmentOperatorOption) {
  const fragment = selectedFragment(ctx);
  if (!fragment) return;
  const previous = fragment.operator;
  if (previous === option.operator) return;

  ctx.std.store.captureSync();
  ctx.std
    .get(EdgelessCRUDIdentifier)
    .updateElement(fragment.id, { operator: option.operator });

  // The same event and the same wire values the diagram's kind picker emits:
  // "the author said which kind of thing this frame is" is one metric on a
  // dashboard, and `level` is the field it is reported in. `control` is what
  // separates the two — `kind` for the sheet, `operator` for the fragment.
  ctx.std.getOptional(TelemetryProvider)?.track('FrameworkViewLevelSet', {
    page: 'whiteboard editor',
    segment: 'element toolbar',
    module: 'uml toolbox',
    control: 'operator',
    framework: 'uml',
    level: option.operator,
    previousLevel: previous,
  });
}

/**
 * The fragment's FLAG-GATED row: add an operand, pick the operator, and the
 * generic Validation dropdown.
 *
 * ## Why the two gestures are here and the resize toggle is not
 *
 * The line `docs/adr/0009` draws is between the ways to CREATE and the ways to
 * work with what already exists, and these two fall on the creating side of it:
 * adding an operand puts a band on the canvas that was not there (the same
 * thing `bpmn.addLane` does, and BPMN gates it with its own flag through the
 * command registry), and the operator picker declares how the drawing is to be
 * READ — which is what the ADR calls tooling in as many words, and where the
 * diagram frame's kind picker already sits.
 *
 * With the `uml` flag off a stored fragment keeps its operator written, keeps
 * painting its pentagon and its dashed rules, keeps every band it has and keeps
 * its handles. What goes away is the button that adds a band and the menu that
 * changes the word.
 *
 * ## One module, for the reason the diagram's row is one module
 *
 * `renderToolbar` merges four slots per element and `ToolbarModuleExtension`
 * binds by DI variant, so a second module claiming
 * `custom:affine:surface:umlFragment` throws before the editor finishes setting
 * up. Both entries are gated by the same flag and appear together or not at
 * all, so one module is the honest grouping rather than a workaround.
 */
export const umlFragmentToolingToolbarConfig: ToolbarModuleConfig = {
  actions: [
    {
      // After the resize toggle (`a.`, from the always-on module) and before
      // the operator picker — the row reads resize, add a branch, say which
      // kind of branching this is.
      id: 'b.add-operand',
      tooltipWording: BOARD_ADD_BAND,
      icon: AddOperandIcon,
      run: addUmlOperand,
    },
    operatorPickerAction,
    // The generic dropdown, not a UML variant of it — the very same object
    // every framework frame registers.
    ...validationToolbarConfig.actions,
  ],
  when: (ctx: ToolbarContext) =>
    ctx.getSurfaceModelsByType(UmlFragmentElementModel).length > 0,
};

export const umlFragmentToolingToolbarExtension = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('custom:affine:surface:umlFragment'),
  config: umlFragmentToolingToolbarConfig,
});
