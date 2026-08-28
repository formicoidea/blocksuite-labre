import { renderPickerMenu } from '@labre/affine-components/toolbar';
import { MindmapElementModel } from '@labre/affine-model';
import {
  type ToolbarContext,
  type ToolbarModuleConfig,
  translateKey,
} from '@labre/affine-shared/services';
import { getMostCommonValue } from '@labre/affine-shared/utils';
import type { FrameworkId } from '@labre/std';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';
import type { TemplateResult } from 'lit';

/**
 * **Morph** — a framework element becomes a NEARBY kind of itself, from its own
 * contextual toolbar, without being replaced.
 *
 * A user task is a task that says who performs it; a timer start is a start
 * event that says what triggers it. Discovering mid-draft that the rectangle
 * should have been a user task is not a modelling mistake, it is modelling —
 * and today the only way through it is delete, re-draw, re-connect, re-type.
 * That gesture loses the geometry, every sequence flow attached to the node and
 * the label somebody wrote; this one writes `kind`, `role` and the target's
 * preset APPEARANCE, and touches nothing else. The appearance is deliberately
 * in that list — see {@link MorphSpec.propsOf}: a morph resets styling to what
 * the target kind is born as, so a morphed artefact and a freshly drawn one are
 * the same element.
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
 * that it returns NEITHER `type`, NOR `xywh`, NOR `text`. {@link applyMorph}
 * strips those three from whatever the spec hands back, so the contract is
 * ENFORCED here rather than merely asked for.
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
 *
 * ## One element, or a composite of several
 *
 * A BPMN node is one element: what the user selects, what carries `kind` and
 * what the patch lands on are the same object. A C4 component is not — it is a
 * native `group` holding the shape and its three lines of words — and two
 * optional hooks are the whole of the difference: {@link MorphSpec.resolveTarget}
 * says which element inside the selection the kind is written on (and refuses
 * every group that is not one of this framework's components), and
 * {@link MorphSpec.afterMorph} writes whatever else the artefact owes the
 * change, inside the same undo step. Both default to nothing, so a framework
 * whose artefact is one element declares neither.
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
  /**
   * The element the kind is actually WRITTEN on, given what the user selected.
   *
   * Identity by default, which is the whole of BPMN's case: a node is one
   * element, it is what the selection holds and it is what the patch lands on.
   *
   * A COMPOSITE artefact is the reason this exists. A C4 component is a native
   * `group` holding the `c4Node` shape and its three lines of words: one click
   * selects the group, the `kind` lives on the shape, and a patch written to
   * the group would put `kind` and `role` on a wrapper that means nothing (see
   * `gfx/c4/src/roles.ts` on why the group is deliberately role-less). So the
   * spec maps the selection to the element it is about, and everything
   * downstream — {@link kindOf}, the patch, the clears — speaks about THAT.
   *
   * Returning `undefined` is a REFUSAL and the main gate a composite framework
   * has: a plain group somebody drew round three shapes, a group belonging to
   * another framework, a group holding two components — none of them resolves,
   * so none of them is offered the menu. It is checked per element, so a
   * selection mixing a C4 component with a Wardley one offers nothing at all.
   */
  resolveTarget?(
    model: GfxPrimitiveElementModel
  ): GfxPrimitiveElementModel | undefined;
  /**
   * This element's current kind, or `undefined` when it carries none.
   *
   * Asked of the RESOLVED element ({@link resolveTarget}), never of the
   * selection.
   */
  kindOf(model: GfxPrimitiveElementModel): K | undefined;
  /**
   * Anything else the morph owes the artefact, written in the SAME gesture.
   *
   * Called once per element actually changed, inside the one `captureSync`, so
   * whatever it writes is part of the same single ctrl+z as the patch — and
   * called with the SELECTED model, because what it has to reach is the rest of
   * the composite rather than the shape the patch just landed on.
   *
   * C4 is the one caller today: a component's type line reads `[Container:
   * Java]`, and the bracketed word is the NOTATION's — derived from `kind` —
   * while the technology after the colon is the author's. A kind rewritten
   * without that line rewritten with it is a picture that contradicts its own
   * caption. Both kinds are handed over because the decision needs the one the
   * element is leaving as much as the one it is arriving at: only a line that
   * still says what the SOURCE kind derived may be rewritten, and a line the
   * author typed over is theirs.
   */
  afterMorph?(model: GfxPrimitiveElementModel, from: K, to: K): void;
  /** The role a kind means — the `from` / `to` of the telemetry, ids only. */
  roleOf(kind: K): string;
  /**
   * The WHOLE patch a kind is worth: `kind`, `role`, and every preset the
   * target's own appearance depends on.
   *
   * Must NOT contain `type` (the element is not being re-typed), `xywh` (the
   * geometry is the user's) or `text` (the words are the user's). Those three
   * are stripped by {@link applyMorph} whatever the spec returns, so this is a
   * contract the module enforces and not one it trusts.
   *
   * ## Why the whole preset, and not just `{kind, role}`
   *
   * Because the appearance of a framework artefact is written by the preset of
   * the kind it was CREATED as, and nothing else will ever rewrite it. BPMN has
   * one shipped pair where that bites today: `subProcess` → `callActivity`
   * differ only in `strokeWidth` (2 ⇄ 4), and the thick border IS what tells a
   * reader that this box stands for a process defined elsewhere. A two-key
   * patch would produce a call activity indistinguishable from the sub-process
   * it no longer is.
   *
   * Every other shipped BPMN family currently shares one preset across its
   * members, so for those the full patch is a no-op — and that is the second
   * reason to require it rather than to optimise it away. It is insurance for
   * the day a family gains a member whose preset differs (a family is DATA and
   * grows by declaration, with no code change to prompt the question), and it
   * is the guarantee that a morphed artefact and one freshly drawn from the
   * palette are byte-for-byte the same element. A framework that derives this
   * from its creation builder — as BPMN's `bpmnMorphProps` does — cannot let
   * the two drift apart.
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

/** One selected element, resolved to what the morph is actually about. */
interface MorphEntry<K extends string> {
  /** What the SELECTION holds — a node, or the group of a composite. */
  selected: GfxPrimitiveElementModel;
  /** Where the patch lands: the same element, unless the spec redirected it. */
  target: GfxPrimitiveElementModel;
  /** The kind {@link target} currently carries. */
  kind: K;
}

/** What one selection can be morphed to, when it can be morphed at all. */
interface MorphTarget<K extends string> {
  entries: MorphEntry<K>[];
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
 * - every element RESOLVES ({@link MorphSpec.resolveTarget}) and the element it
 *   resolves to is itself unlocked — which for a composite framework is the
 *   whole gate: a plain group, another framework's group and a group holding
 *   two components all resolve to nothing and are all refused here;
 * - every resolved element's kind is one the spec knows;
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

  const entries: MorphEntry<K>[] = [];
  for (const selected of models) {
    // Never `?? selected`: `undefined` is the spec REFUSING this element, and
    // falling back to the selection would write a framework's kind onto the
    // very wrapper the spec just declined.
    const target = spec.resolveTarget ? spec.resolveTarget(selected) : selected;
    // Tested on the resolved element too: a composite's shape can be locked
    // while the group holding it is not, and the write would then be refused
    // after the menu had already offered it.
    if (!target || target.isLocked() || inMindmap(target)) return null;
    const kind = spec.kindOf(target);
    if (kind === undefined) return null;
    entries.push({ selected, target, kind });
  }

  const kinds = entries.map(entry => entry.kind);
  const family = spec.families.find(candidate => candidate.includes(kinds[0]));
  if (!family) return null;
  if (!kinds.every(kind => family.includes(kind))) return null;

  const current =
    getMostCommonValue(
      kinds.map(kind => ({ kind })),
      'kind'
    ) ?? kinds[0];

  return { entries, family, current };
}

/**
 * What a morph may never rewrite, whatever a spec hands back: the element's
 * identity, its geometry, and the user's words.
 */
const NOT_A_MORPH = ['type', 'xywh', 'text'] as const;

/**
 * The spec's patch with those three removed.
 *
 * {@link MorphSpec.propsOf} already promises not to include them, and BPMN's
 * builder honours the promise by construction. This is the second lock, and it
 * belongs here rather than in each framework: a spec is DATA a framework
 * author writes, `propsOf` is most naturally derived from a CREATION builder
 * (which of course emits `type` and `xywh`), and the failure mode of forgetting
 * one strip is a morph that silently moves an element to `[0,0,0,0]` or empties
 * its label. A contract worth stating in the type is worth enforcing at the
 * one place that writes.
 */
function morphPatch(props: Record<string, unknown>): Record<string, unknown> {
  const patch = { ...props };
  for (const key of NOT_A_MORPH) delete patch[key];
  return patch;
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
 * therefore restyle the next one drawn from the palette — one morph to a
 * thick-bordered call activity, and the next artefact of that type comes out
 * wearing a border nobody asked for. No BPMN type is in that schema today, so
 * nothing is broken right now, which is exactly the kind of accident that lands
 * the day one is added. This module is generic and must not depend on which
 * types happen to be listed.
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

  const changing = target.entries.filter(entry => entry.kind !== kind);
  // A gesture that changes nothing is not a morph, writes nothing and reports
  // nothing — the rule every arbitration gesture in this repo already follows.
  if (!changing.length) return;

  const props = morphPatch(spec.propsOf(kind));
  const cleared = spec.clearOf?.(kind) ?? [];

  ctx.std.store.captureSync();
  for (const entry of changing) {
    entry.target.surface.updateElement(entry.target.id, props);
    for (const field of cleared) entry.target.clearField(field);
    // Inside the loop and inside the one checkpoint above: whatever the rest of
    // a composite owes this morph — C4's type line — is part of the same single
    // ctrl+z as the kind that made it necessary.
    spec.afterMorph?.(entry.selected, entry.kind, kind);
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

/** One wording, resolved against the host's catalogue when it named a key. */
function wording(ctx: ToolbarContext, { key, fallback }: MorphLabel): string {
  return key ? translateKey(ctx.std, key, fallback) : fallback;
}

/**
 * The toolbar module, parameterized by one framework's morph declaration.
 *
 * The dropdown is `renderPickerMenu` (`@labre/affine-components/toolbar`) — the
 * SAME one-of-many picker "Switch shape type" is, chevron, tooltips, active
 * background and all, so a user meets one affordance rather than two that
 * resemble each other. It lives in the component package and not in
 * `@labre/affine-widget-edgeless-toolbar`, where the picker was first written,
 * because that widget package depends on THIS one: importing it here would
 * close a cycle, and the component package is below both.
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
        //
        // SCOPED by the declaring framework, because `renderToolbar` merges
        // the actions of every module on a row BY ID — `groupBy(a => a.id)`,
        // then a deep merge. One flavour can now carry several morph modules
        // (a group is a C4 component and a Wardley component), and two entries
        // both called `e.morph` would be merged into one whose `content` came
        // from whichever was registered last: a single dropdown, silently
        // answering for one framework and not the other. `e.morph.c4` and
        // `e.morph.wardley` sort adjacently, in the same slot, and never
        // collide. The TESTIDs stay `element-morph` / `element-morph-option`,
        // because the row draws one of these at a time and the DOM handle is
        // about the affordance, not about who declared it.
        id: `e.morph.${spec.framework}`,
        when: (ctx: ToolbarContext) => morphTarget(ctx, spec) !== null,
        content(ctx: ToolbarContext) {
          const target = morphTarget(ctx, spec);
          if (!target) return null;

          // `testId` puts `element-morph` on the host and
          // `element-morph-option` on each line. The host matters: the trigger
          // is handed to `editor-menu-button` as a PROPERTY and rendered into
          // its shadow root, so the host is the only handle the toolbar's own
          // DOM offers.
          return renderPickerMenu({
            testId: 'element-morph',
            label: wording(ctx, spec.label),
            // The current kind's own icon on the closed button, exactly as the
            // shape picker shows the current shape: the dropdown reads as a
            // statement about the selection before it is opened.
            icon: spec.iconOf(target.current),
            items: target.family.map(kind => ({
              key: wording(ctx, spec.labelOf(kind)),
              value: kind,
              icon: spec.iconOf(kind),
            })),
            currentValue: target.current,
            onPick: (picked: K) => applyMorph(ctx, spec, picked),
          });
        },
      },
    ],
    // The whole module stands down unless the selection has something to morph,
    // so a framework registering it pays one resolution per selection change.
    when: (ctx: ToolbarContext) => morphTarget(ctx, spec) !== null,
  };
}
