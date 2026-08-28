import { EditorChevronDown } from '@labre/affine-components/toolbar';
import { MindmapElementModel } from '@labre/affine-model';
import {
  type ToolbarContext,
  type ToolbarModuleConfig,
  translateKey,
} from '@labre/affine-shared/services';
import { getMostCommonValue } from '@labre/affine-shared/utils';
import type { FrameworkId } from '@labre/std';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { html, type TemplateResult } from 'lit';

/**
 * **Morph** — a framework element becomes a NEARBY kind of itself, from its own
 * contextual toolbar, without being replaced.
 *
 * A user task is a task that says who performs it; a timer start is a start
 * event that says what triggers it. Discovering mid-draft that the rectangle
 * should have been a user task is not a modelling mistake, it is modelling —
 * and today the only way through it is delete, re-draw, re-connect, re-type.
 * That gesture loses the geometry, every sequence flow attached to the node and
 * the label somebody wrote; this one changes `kind` and `role` and touches
 * nothing else.
 *
 * ## Why this is not "Switch shape type"
 *
 * The shape toolbar's dropdown (`gfx/shape/src/toolbar/config.ts`, `c.switch-type`)
 * is the visual template and deliberately not the mechanism. It offers EVERY
 * shape to every shape, because a rectangle and an ellipse mean nothing and are
 * therefore interchangeable. A framework artefact means something: a task is not
 * an end event, and a menu that offered the swap would be a menu that invites
 * nonsense. So the reachable set is DATA the framework declares — an explicit
 * table of families, not a derivation from the role tree, from the icon set or
 * from anything else clever. `roleIsA` would have made `bpmn:task` reach
 * `bpmn:activity` and thence the sub-process and the call activity, which is one
 * inference too many: a task and a sub-process are not the same size of thing,
 * and only a human knows which pairs a reader would accept as "the same artefact,
 * said more precisely".
 *
 * ## What a morph is NOT
 *
 * It is not a creation: nothing is inserted, nothing is deleted, no id changes.
 * `xywh`, every connector endpoint pointing at the element, and the text it
 * carries are all untouched — see {@link MorphSpec.propsOf}, whose contract is
 * that it returns NEITHER `type`, NOR `xywh`, NOR `text`.
 *
 * It is also not a style change, which is why it is not `FrameworkElementAdded`
 * that reports it. `FrameworkElementMorphed` is its own event for the reason
 * `FrameworkElementPromoted` is: a creation event emitted where nothing was
 * created inflates "elements added per framework" forever.
 *
 * ## Generic in shape, framework-registered — like `tags-toolbar.ts`
 *
 * Nothing in this file names a framework, a kind or a role. Everything it needs
 * arrives in one {@link MorphSpec}, which a framework's own FLAG-GATED view
 * extension registers against its element flavour — morph is TOOLING, so the
 * flag takes the menu away and leaves every stored document loading, painting
 * and round-tripping exactly as before (`docs/adr/0009`).
 */

/** A piece of chrome's wording: the host's key, and the English behind it. */
export interface MorphLabel {
  /** `com.labre.*` key handed to `TranslationProvider.t`, when there is one. */
  key?: string;
  /** What a standalone editor shows. */
  fallback: string;
}

/**
 * One wording, key and English adjacent.
 *
 * A two-argument helper rather than an object literal at the declaration site,
 * because that is the shape the manifest's drift guard reads: it pairs two
 * adjacent literals in one argument list, so a key restated in
 * `affine/all/src/translations.ts` is confirmed against the wording actually
 * shipped instead of joining the unpairable residue.
 */
export const morphLabel = (key: string, fallback: string): MorphLabel => ({
  key,
  fallback,
});

/**
 * Everything the module needs, and nothing it could ask a registry for.
 *
 * DI-free on purpose, exactly like `tagsToolbarConfig(roles)`: the kind
 * vocabularies are lib-side data modules owned by the framework that renders
 * them, and ADR 0007 § 2bis kept them out of the DI registry. A second framework
 * gets this dropdown by registering its own spec.
 */
export interface MorphSpec<K extends string = string> {
  /** Telemetry segment — the WIRE value, as `reportCommandTelemetry` sends it. */
  framework: FrameworkId;
  /**
   * The morphable sets, declared. Each inner array is one family whose members
   * are mutually reachable, and DECLARATION ORDER IS MENU ORDER. A kind in no
   * family can never be morphed and never offers the menu — which is how a BPMN
   * group and a text annotation stay out of it.
   */
  families: readonly (readonly K[])[];
  /** Filters the selection, via `getSurfaceModelsByType`. */
  modelType: abstract new (...args: never[]) => GfxPrimitiveElementModel;
  /** This element's current kind, or `undefined` when it carries none. */
  kindOf(model: GfxPrimitiveElementModel): K | undefined;
  /** The role a kind means — the `from` / `to` of the telemetry, ids only. */
  roleOf(kind: K): string;
  /**
   * The WHOLE patch a kind is worth: `kind`, `role`, and every preset the
   * target's own appearance depends on.
   *
   * Must NOT contain `type` (the element is not being re-typed), `xywh` (the
   * geometry is the user's) or `text` (the words are the user's). Returning the
   * presets is not optional politeness: a `{kind, role}` patch alone leaves a
   * task morphed into a data object still filled and still stroked, because
   * those two props were written by the task's preset and nothing else will
   * rewrite them.
   */
  propsOf(kind: K): Record<string, unknown>;
  /**
   * Field names to DELETE after patching — the keys the target's props do not
   * carry.
   *
   * A patch cannot express absence: a preset that spreads a key conditionally
   * (BPMN's `textVerticalAlign`) simply omits it, and an omitted key leaves the
   * PREVIOUS kind's value sitting in the Y.Map, silently in force. `clearField`
   * removes it, which is the same call `writeLanes` makes for the same reason.
   */
  clearOf?(kind: K): readonly string[];
  /** One menu item's tooltip. */
  labelOf(kind: K): MorphLabel;
  /** One menu item's icon — the framework's own, reused. */
  iconOf(kind: K): TemplateResult;
  /** The dropdown's own name. */
  label: MorphLabel;
}

/** What one selection can be morphed to, when it can be morphed at all. */
interface MorphTarget<K extends string> {
  models: GfxPrimitiveElementModel[];
  /** The one family every selected element belongs to. */
  family: readonly K[];
  /** The kind shown as current — the most common one in the selection. */
  current: K;
}

/**
 * Mirrors `hasGrouped` in the shape toolbar: a mindmap node's appearance is the
 * mindmap's to decide, so it is not a thing a per-element dropdown may rewrite.
 * A plain canvas group is NOT a refusal — grouping some tasks together says
 * nothing about what any of them is.
 */
function inMindmap(model: GfxPrimitiveElementModel) {
  return model.group instanceof MindmapElementModel;
}

/**
 * The selection, if there is exactly one honest morph to offer for it.
 *
 * Five conditions, and each removes a way for the menu to lie:
 *
 * - the document is editable — this writes to the surface DIRECTLY (see
 *   {@link applyMorph}), so it does not inherit `EdgelessCRUDExtension`'s
 *   read-only refusal and states its own;
 * - the selection is non-empty and HOMOGENEOUS on the spec's model type — a
 *   selection holding a task and a connector has no current value to show;
 * - nothing in it is locked or belongs to a mindmap;
 * - every element's kind is one the spec knows;
 * - and they all belong to the SAME family. Mixed families means the answer
 *   would differ per element, and the simplest correct rule is to offer
 *   nothing rather than to guess which of two menus the user meant.
 */
function morphTarget<K extends string>(
  ctx: ToolbarContext,
  spec: MorphSpec<K>
): MorphTarget<K> | null {
  if (ctx.readonly) return null;

  const models = ctx.getSurfaceModelsByType(spec.modelType);
  if (!models.length) return null;
  if (models.length !== ctx.getSurfaceModels().length) return null;
  if (models.some(model => model.isLocked() || inMindmap(model))) return null;

  const kinds: K[] = [];
  for (const model of models) {
    const kind = spec.kindOf(model);
    if (kind === undefined) return null;
    kinds.push(kind);
  }

  const family = spec.families.find(candidate => candidate.includes(kinds[0]));
  if (!family) return null;
  if (!kinds.every(kind => family.includes(kind))) return null;

  const current =
    getMostCommonValue(
      kinds.map(kind => ({ kind })),
      'kind'
    ) ?? kinds[0];

  return { models, family, current };
}

/**
 * Write one kind onto every element of the selection that is not already it.
 *
 * Exported because it is the WRITE and the menu is only the chrome around it:
 * the unit suite exercises the mutation without a DOM, and the integration
 * suite performs the same gesture a click performs. It re-derives the target
 * itself, so there is no way to reach it with a selection the menu would have
 * refused.
 *
 * ## Straight to the surface, and why not through `EdgelessCRUDIdentifier`
 *
 * `EdgelessCRUDExtension.updateElement` calls `recordLastProps` on its way
 * past, which teaches the editor "the last thing you made looked like this" —
 * and the props here are a WHOLE preset, not the one field a user just changed.
 * For any element type the last-props schema names, morphing one artefact would
 * therefore restyle the next one drawn from the palette: pick a data object's
 * unfilled, unstroked preset once and the next task comes out invisible. No
 * BPMN type is in that schema today, so nothing is broken right now — which is
 * exactly the kind of accident that lands the day one is added. This module is
 * generic and must not depend on which types happen to be listed.
 *
 * `surface.updateElement` is the same write without the memory; the read-only
 * refusal the CRUD also carries is restated in {@link morphTarget}.
 *
 * One `updateElement` per element, then its `clearField`s: kind, role and the
 * presets land together, so no repaint and no rule ever sees an element that is
 * half one artefact and half another. `role` is in `VERDICT_PROPS`, so the
 * validation engine re-judges the board on its own within one debounce tick —
 * which is the whole reason role is never written without kind, nor kind
 * without role.
 *
 * One `captureSync` before the loop, so a morph of nine elements is one ctrl+z.
 */
export function applyMorph<K extends string>(
  ctx: ToolbarContext,
  spec: MorphSpec<K>,
  kind: K
) {
  // Re-resolved rather than closed over: the selection may have moved on
  // between the render that drew this line and the click that reached it, and
  // the write must never land somewhere the menu would not have been offered.
  const target = morphTarget(ctx, spec);
  if (!target || !target.family.includes(kind)) return;

  const changing = target.models.filter(model => spec.kindOf(model) !== kind);
  // A gesture that changes nothing is not a morph, writes nothing and reports
  // nothing — the rule every arbitration gesture in this repo already follows.
  if (!changing.length) return;

  const props = spec.propsOf(kind);
  const cleared = spec.clearOf?.(kind) ?? [];

  ctx.std.store.captureSync();
  for (const model of changing) {
    model.surface.updateElement(model.id, props);
    for (const field of cleared) model.clearField(field);
  }

  // The one DIRECT emission in this module, and the arbitrated exception is the
  // same one the C4 legend button makes: there is no command behind this
  // gesture to carry the telemetry for it, because a morph is declared by the
  // element's own toolbar module and reachable from nowhere else. The values
  // must therefore stay aligned by hand with what `reportCommandTelemetry`
  // would send — `framework` is the descriptor's wire key, and `ctx.track`
  // supplies `page` / `segment` / `module` exactly as the other toolbar
  // emitters get them. A morph reachable from the palette one day takes its
  // telemetry from the command and this call goes away.
  ctx.track('FrameworkElementMorphed', {
    framework: spec.framework,
    fromRole: spec.roleOf(target.current),
    toRole: spec.roleOf(kind),
    elementCount: changing.length,
  });
}

/** One line of the dropdown — one kind of the family. */
function renderOption<K extends string>(
  ctx: ToolbarContext,
  spec: MorphSpec<K>,
  target: MorphTarget<K>,
  kind: K
): TemplateResult {
  const { key, fallback } = spec.labelOf(kind);
  const label = key ? translateKey(ctx.std, key, fallback) : fallback;

  return html`<editor-icon-button
    data-testid="element-morph-option"
    data-kind=${kind}
    aria-label=${label}
    .tooltip=${label}
    .active=${kind === target.current}
    .activeMode=${'background'}
    @click=${() => applyMorph(ctx, spec, kind)}
  >
    ${spec.iconOf(kind)}
  </editor-icon-button>`;
}

/**
 * The toolbar module, parameterized by one framework's morph declaration.
 *
 * The markup restates `renderMenu`'s (`@labre/affine-widget-edgeless-toolbar`)
 * rather than calling it, and there is no choice about that: the widget package
 * depends on THIS one, so importing it here would close a cycle. The
 * composition is the widget's — `editor-menu-button` wrapping
 * `editor-icon-button`s, current value shown as `active` — so the dropdown a
 * user meets is the same object as "Switch shape type" next to it.
 */
export function morphToolbarConfig<K extends string>(
  spec: MorphSpec<K>
): ToolbarModuleConfig {
  return {
    actions: [
      {
        // After a framework's own per-instance toggles (`a.` … `d.`), before
        // `y.element-tags` and `z.validation`: WHICH artefact this is reads
        // before how it is qualified, and both read before how hard it is
        // checked.
        id: 'e.morph',
        when: (ctx: ToolbarContext) => morphTarget(ctx, spec) !== null,
        content(ctx: ToolbarContext) {
          const target = morphTarget(ctx, spec);
          if (!target) return null;

          const label = spec.label.key
            ? translateKey(ctx.std, spec.label.key, spec.label.fallback)
            : spec.label.fallback;

          // The testid sits on the HOST as well as on the trigger: the trigger
          // is handed to `editor-menu-button` as a property and rendered into
          // its shadow root, so the host is the only handle the toolbar's own
          // DOM offers.
          return html`<editor-menu-button
            data-testid="element-morph-entry"
            aria-label=${`${label.toLowerCase()}-menu`}
            .button=${html`
              <editor-icon-button
                data-testid="element-morph-button"
                aria-label=${label}
                .tooltip=${label}
              >
                ${spec.iconOf(target.current)} ${EditorChevronDown}
              </editor-icon-button>
            `}
          >
            ${target.family.map(kind => renderOption(ctx, spec, target, kind))}
          </editor-menu-button>`;
        },
      },
    ],
    // The whole module stands down unless the selection has something to morph,
    // so a framework registering it pays one resolution per selection change.
    when: (ctx: ToolbarContext) => morphTarget(ctx, spec) !== null,
  };
}
