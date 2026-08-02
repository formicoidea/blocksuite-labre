import { EditorChevronDown } from '@labre/affine-components/toolbar';
import {
  getUniverseRegistry,
  type TagDef,
  type TagValueDef,
  type ToolbarContext,
  type ToolbarModuleConfig,
  translateKey,
} from '@labre/affine-shared/services';
import { getRegisteredCommands, runCommand } from '@labre/std';
import type { RoleDefs } from '@labre/std/gfx';
import {
  elementTagValues,
  GfxGroupLikeElementModel,
  GfxPrimitiveElementModel,
} from '@labre/std/gfx';
import { html, nothing, type TemplateResult } from 'lit';

/** The command this module drives. Spelled once. */
const TAG_SET_ID = 'tag.set';

/**
 * The **type-3 qualification** entry of an element's contextual toolbar
 * (MF3, ADR 0007 § 6, rung "component → materialities").
 *
 * Select a Wardley component and its toolbar gains a dropdown naming the
 * element's nature, and offering the others. Every tag whose `appliesTo`
 * reaches the element's role gets its own titled section in the same dropdown —
 * one more block in the menu, never another toolbar button competing for width.
 *
 * ## Generic in shape, Wardley-only in registration — and why
 *
 * Nothing in this file names a framework, a type or a role: the sections are
 * built from whatever `UniverseTagDefsProvider` was seeded with, resolved
 * against the role vocabulary the REGISTRAR supplies. That parameter is the
 * whole reason this is not registered once for the whole editor: roles are
 * lib-side data modules owned by the framework that renders them
 * (`WARDLEY_ROLES`), and ADR 0007 § 2bis deliberately kept them OUT of the DI
 * registry — so there is no way to ask "which role vocabulary governs this
 * element" without a registry the ADR chose not to build.
 *
 * The honest consequence is stated rather than hidden: a second framework gets
 * this dropdown by registering {@link tagsToolbarConfig} with its own
 * `RoleDefs`, exactly as `validationToolbarConfig` is registered per framework
 * with its own rules. Turning that parameter into a lookup is a change to ADR
 * 0007, not to this file.
 *
 * ## Which element gets the entry
 *
 * The one that CARRIES the role. Framework artefacts on this canvas are
 * composites — a Wardley component is an ellipse and a free text grouped
 * together — so a single click selects the GROUP, which carries no role of its
 * own. Rather than making the user enter the group to find the qualification,
 * the target resolves through the group to its single role-bearing member. Two
 * role-bearing members means the group is not one artefact, and no honest
 * "current value" exists, so there is no entry.
 *
 * ## Gating
 *
 * Registered by a framework's FLAG-GATED view extension, like its rules and its
 * profiles: qualifying is tooling. Flag off, there is no dropdown — and the tag
 * ids already written on an element go unread until the flag comes back, which
 * costs nothing, because they were never needed to load or paint anything.
 */

/** The tick on a selected value, drawn inline like the neighbouring modules'. */
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

/** The single selected element that carries a role, and its applicable tags. */
interface TagTarget {
  element: GfxPrimitiveElementModel;
  role: string;
  tags: TagDef[];
}

/**
 * The elements one selection could possibly be about: the selected element
 * itself, plus — when it is a canvas group — its direct members.
 *
 * One selected element only: a qualification is one decision about one thing,
 * and a multi-selection spanning two roles has no honest current value to show.
 *
 * Descending ONE level into a group is deliberate. Framework artefacts on this
 * canvas are composites — a Wardley component is an ellipse and a free text
 * grouped together — so a single click selects the group, and making the user
 * enter it to find the qualification would bury the affordance. Going deeper,
 * through a group OF components, would ask a question with several right
 * answers.
 */
function candidates(ctx: ToolbarContext): GfxPrimitiveElementModel[] {
  const models = ctx.getSurfaceModels();
  if (models.length !== 1) return [];

  const [model] = models;
  if (!(model instanceof GfxPrimitiveElementModel)) return [];

  const found = model.role ? [model] : [];
  if (model instanceof GfxGroupLikeElementModel) {
    for (const child of model.childElements) {
      if (child instanceof GfxPrimitiveElementModel && child.role) {
        found.push(child);
      }
    }
  }
  return found;
}

/**
 * The selection, if there is exactly one thing in it to qualify.
 *
 * The discriminator is **applicability, not roledness**. A Wardley component's
 * group holds two roled members — the node and its label — and only one of them
 * is something a nature is a fact about; filtering on "carries a role" would
 * make the entry vanish on the very artefact it exists for. So a candidate
 * counts only when a seeded tag actually applies to its role, and two such
 * candidates means the group is not one artefact and there is no entry.
 *
 * A role with no applicable tag — every role of a framework that seeded no pack
 * — yields nothing either: a picker with nothing in it is chrome that decides
 * nothing.
 */
function tagTarget(ctx: ToolbarContext, roles: RoleDefs): TagTarget | null {
  const registry = getUniverseRegistry(ctx.std);

  const qualifiable = candidates(ctx)
    .map(element => ({
      element,
      role: element.role!,
      tags: registry
        .tagsForRole(element.role!, roles)
        .filter(def => !def.deprecated),
    }))
    .filter(candidate => candidate.tags.length > 0);

  return qualifiable.length === 1 ? qualifiable[0] : null;
}

/**
 * The values offered for one tag: its defined ones, plus anything the element
 * already carries that no def explains.
 *
 * The second half is the point. Defs are runtime configuration and are never
 * persisted, so a document may carry a value whose pack was removed, renamed or
 * never seeded in this deployment. Hiding it would make the element look
 * unqualified and let the next click destroy a colleague's work silently; it is
 * shown as its raw id instead, and stays removable. Deprecated values follow
 * the same rule: out of the picker, still shown when present.
 */
function offeredValues(def: TagDef, selected: string[]): TagValueDef[] {
  const defined = def.values === 'open' ? [] : def.values;
  const offered = defined.filter(
    value => !value.deprecated || selected.includes(value.id)
  );

  const known = new Set(defined.map(value => value.id));
  const unknown = selected
    .filter(id => !known.has(id))
    .map(id => ({ id, label: id }));

  return [...offered, ...unknown];
}

/**
 * Toggle one value of one tag on the target, through the `tag.set` command.
 *
 * The command owns the write, the read-only guard, the undo checkpoint and the
 * telemetry; this is the gesture and nothing else. Going through `runCommand`
 * rather than calling the model directly is what keeps one gesture one event,
 * and what makes the same operation reachable from the palette and the agent.
 */
function toggleValue(
  ctx: ToolbarContext,
  target: TagTarget,
  def: TagDef,
  valueId: string
) {
  const current = elementTagValues(target.element, def.id);
  const selected = current.includes(valueId);

  const values = selected
    ? current.filter(id => id !== valueId)
    : def.cardinality === 'single'
      ? // One tag, one answer: picking a nature replaces the previous one
        // rather than accumulating. Where practitioners disagree, the
        // disagreement is the finding — it must not hide inside the element.
        [valueId]
      : [...current, valueId];

  runTagSet(ctx, target, def.id, values);
}

/**
 * Invoke `tag.set` on the resolved target.
 *
 * Through the registry rather than by importing the command: this package is
 * below `@labre/affine-block-root` in the dependency order, and going through
 * `runCommand` is also what keeps one gesture one telemetry event whatever the
 * surface. A build with the command unregistered simply has no working entry —
 * never a throw on click.
 *
 * `elementIds` is passed EXPLICITLY rather than letting the command fall back
 * to the live selection: the element being qualified is often a group member,
 * not the group the user selected, and the command must write where the toolbar
 * said, not where the canvas points.
 */
function runTagSet(
  ctx: ToolbarContext,
  target: TagTarget,
  tag: string,
  values: string[]
) {
  const command = getRegisteredCommands(ctx.std).find(c => c.id === TAG_SET_ID);
  if (!command) return;

  runCommand(
    ctx.std,
    command,
    { surface: 'palette', source: 'toolbar:general' },
    { tag, values, elementIds: [target.element.id] }
  );
}

/** One titled block of the dropdown — one tag. */
function renderSection(
  ctx: ToolbarContext,
  target: TagTarget,
  def: TagDef
): TemplateResult {
  const selected = elementTagValues(target.element, def.id);
  const label = def.label || def.id;

  const options = offeredValues(def, selected).map(value => {
    const on = selected.includes(value.id);
    const valueLabel = value.label || value.id;
    return html`<editor-menu-action
      data-testid="element-tag-option"
      data-tag-id=${def.id}
      data-value-id=${value.id}
      data-selected=${on ? 'true' : nothing}
      aria-label=${valueLabel}
      aria-pressed=${on}
      @click=${() => toggleValue(ctx, target, def, value.id)}
    >
      ${on ? CheckIcon : html`<span style="width: 20px;"></span>`}
      <span class="label">${valueLabel}</span>
    </editor-menu-action>`;
  });

  return html`<div
    role="group"
    aria-label=${label}
    data-testid="element-tag-section"
    data-tag-id=${def.id}
    style="display: flex; flex-direction: column;"
  >
    <div
      style="padding: 4px 8px; font-size: 12px; color: var(--affine-text-secondary-color);"
    >
      ${label}
    </div>
    ${options}
  </div>`;
}

/**
 * The dropdown's trigger text: the values in force when there are any, so the
 * qualification is readable without opening anything, and the generic label
 * otherwise.
 */
function triggerLabel(ctx: ToolbarContext, target: TagTarget): string {
  const chosen = target.tags.flatMap(def => {
    const selected = elementTagValues(target.element, def.id);
    return offeredValues(def, selected)
      .filter(value => selected.includes(value.id))
      .map(value => value.label || value.id);
  });

  return chosen.length
    ? chosen.join(', ')
    : // One applicable tag names itself ("Nature"); several fall back to the
      // neutral word, since no single tag name is the truth about the element.
      target.tags.length === 1
      ? target.tags[0].label || target.tags[0].id
      : translateKey(ctx.std, 'com.labre.tags.toolbar.label', 'Qualify');
}

/**
 * The toolbar module, parameterized by the framework's role vocabulary.
 *
 * @param roles The registrar's `RoleDefs`. Specialisation is resolved against
 *   it, so a tag declared on `wardley:component` reaches `wardley:market` for
 *   free.
 */
export function tagsToolbarConfig(roles: RoleDefs): ToolbarModuleConfig {
  return {
    actions: [
      {
        // After a framework's own per-instance toggles (`a.` … `d.`) and after
        // the exception entry, before `z.validation`: what an element IS reads
        // before how hard it is checked.
        id: 'y.element-tags',
        when: (ctx: ToolbarContext) => tagTarget(ctx, roles) !== null,
        content(ctx: ToolbarContext) {
          const target = tagTarget(ctx, roles);
          if (!target) return null;

          const label = translateKey(
            ctx.std,
            'com.labre.tags.toolbar.label',
            'Qualify'
          );

          // The testid sits on the HOST as well as on the trigger: the trigger
          // is handed to `editor-menu-button` as a property and rendered into
          // its shadow root, so the host is the only handle from the toolbar's
          // own DOM.
          return html`<editor-menu-button
            data-testid="element-tags-entry"
            .contentPadding=${'8px'}
            .button=${html`
              <editor-icon-button
                data-testid="element-tags-button"
                aria-label=${label}
                .tooltip=${label}
                .justify=${'space-between'}
                .labelHeight=${'20px'}
              >
                <span class="label">${triggerLabel(ctx, target)}</span>
                ${EditorChevronDown}
              </editor-icon-button>
            `}
          >
            <div
              data-testid="element-tags-menu"
              data-orientation="vertical"
              data-size="large"
            >
              ${target.tags.map(def => renderSection(ctx, target, def))}
            </div>
          </editor-menu-button>`;
        },
      },
    ],
    // The whole module stands down unless the selection has something to be
    // qualified with, so a framework registering it pays one resolution per
    // selection change.
    when: (ctx: ToolbarContext) => tagTarget(ctx, roles) !== null,
  };
}
