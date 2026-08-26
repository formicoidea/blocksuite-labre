import {
  type EditorMenuButton,
  type EditorToolbar,
  renderToolbarSeparator,
} from '@labre/affine-components/toolbar';
import {
  ActionPlacement,
  planToolbarLayout,
  TOOLBAR_SETTLE_DELAY,
  type ToolbarAction,
  type ToolbarActions,
  type ToolbarContext,
  toolbarDegradationSteps,
  type ToolbarLayoutItem,
  type ToolbarLayoutStep,
  type ToolbarMetrics,
  type ToolbarPlacement,
  toolbarRoomChanged,
} from '@labre/affine-shared/services';
import { nextTick } from '@labre/global/utils';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import { MoreVerticalIcon } from '@blocksuite/icons/lit';
import type {
  AutoUpdateOptions,
  ComputePositionConfig,
  ReferenceElement,
  SideObject,
} from '@floating-ui/dom';
import {
  autoUpdate,
  computePosition,
  flip,
  hide,
  inline,
  limitShift,
  offset,
  shift,
  size,
} from '@floating-ui/dom';
import { html, render } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { join } from 'lit/directives/join.js';
import { keyed } from 'lit/directives/keyed.js';
import { repeat } from 'lit/directives/repeat.js';
import groupBy from 'lodash-es/groupBy';
import mergeWith from 'lodash-es/mergeWith';
import orderBy from 'lodash-es/orderBy';
import partition from 'lodash-es/partition';
import toPairs from 'lodash-es/toPairs';

export const sideMap = new Map([
  // includes frame element
  ['affine:surface:frame', { top: 28 }],
  // includes group element
  ['affine:surface:group', { top: 20 }],
  // has only one shape element
  ['affine:surface:shape', { top: 26, bottom: -26 }],
]);

export function autoUpdatePosition(
  signal: AbortSignal,
  toolbar: EditorToolbar,
  referenceElement: ReferenceElement,
  flavour: string,
  placement: ToolbarPlacement,
  sideOptions: Partial<SideObject> | null,
  options: AutoUpdateOptions = { elementResize: false },
  /**
   * Called whenever the room the row has just changed. This is the only place
   * that knows it: `size` is what writes the cap, and it re-runs on every
   * scroll, resize and flip.
   */
  onAvailableWidth?: () => void
) {
  const isInline = flavour === 'affine:note';
  const hasSurfaceScope = flavour.includes('surface');
  const isInner = placement === 'inner';
  const offsetTop = sideOptions?.top ?? 0;
  const offsetBottom = sideOptions?.bottom ?? 0;
  const offsetY = offsetTop + (hasSurfaceScope ? 2 : 0);
  const config: Partial<ComputePositionConfig> = isInner
    ? {
        placement: 'top-start',
        middleware: [
          offset(({ rects }) => -rects.floating.height),
          size({
            apply: ({ elements }) => {
              const { width } = elements.reference.getBoundingClientRect();
              elements.floating.style.width = `${width}px`;
            },
          }),
        ],
      }
    : {
        placement,
        middleware: [
          offset(10 + offsetY),
          size({
            padding: 10,
            apply: ({ elements, availableWidth }) => {
              elements.floating.style.width = 'fit-content';
              // The room the row has. The toolbar never wraps and never
              // scrolls: past this width its entries give way, in the order
              // they declared, into the "⋮" menu — see `ToolbarFitter`.
              const capped = `${availableWidth}px`;
              if (elements.floating.style.maxWidth !== capped) {
                elements.floating.style.maxWidth = capped;
                onAvailableWidth?.();
              }
            },
          }),
          isInline ? inline() : undefined,
          shift(state => ({
            padding: {
              top: 10,
              right: 10,
              bottom: 150,
              left: 10,
            },
            crossAxis: state.placement.includes('bottom'),
            limiter: limitShift(),
          })),
          // `flip` answers ONE question here — above or below — so both of its
          // sideways ideas are off. Left on (their default), they teleport the
          // row: on a reference far wider than the screen, every alignment
          // overflows somewhere, `bestFit` picks between `-start` and `-end`
          // by a margin of a few pixels, and under a zoom that verdict changes
          // from one frame to the next — the row jumps between the LEFT clamp
          // and the RIGHT clamp of the very same geometry (PO recette of
          // 25/08/2026, third video: the map background's row). Horizontal
          // placement belongs to `shift`, which slides — it never teleports.
          flip({ padding: 10, crossAxis: false, flipAlignment: false }),
          hide(),
        ],
      };
  const update = async () => {
    await Promise.race([
      new Promise(resolve => {
        signal.addEventListener('abort', () => resolve(signal.reason), {
          once: true,
        });

        if (signal.aborted) return;

        resolve(null);
      }),
      isInline ? toolbar.updateComplete.then(nextTick) : toolbar.updateComplete,
    ]);

    if (signal.aborted) return;

    const result = await computePosition(referenceElement, toolbar, config);

    // The gesture may have aborted this loop while the position was being
    // computed. A dying loop that still writes is a second anchor on screen.
    if (signal.aborted) return;

    const { x, middlewareData, placement: currentPlacement } = result;
    const y =
      result.y -
      (currentPlacement.includes('top') ? 0 : offsetTop + offsetBottom);

    toolbar.style.transform = `translate3d(${x}px, ${y}px, 0)`;

    if (middlewareData.hide) {
      if (toolbar.dataset.open) {
        if (middlewareData.hide.referenceHidden) {
          delete toolbar.dataset.open;
          // Closes dropdown menus
          toolbar
            .querySelector<EditorMenuButton>('editor-menu-button[data-open]')
            ?.hide();
        }
      } else {
        toolbar.dataset.open = 'true';
      }
    }
  };

  return autoUpdate(
    referenceElement,
    toolbar,
    () => {
      update().catch(console.error);
    },
    // Only a canvas anchor moves without a scroll or a resize to announce it,
    // so only a canvas anchor pays for a per-frame re-measure.
    { animationFrame: hasSurfaceScope, ...options }
  );
}

export function combine(actions: ToolbarActions, context: ToolbarContext) {
  const grouped = group(actions);

  const generated = grouped.map(action => {
    const newAction = {
      ...action,
      placement: action.placement ?? ActionPlacement.Normal,
    };

    if ('generate' in action && typeof action.generate === 'function') {
      // TODO(@fundon): should delete `generate` fn
      return {
        ...newAction,
        ...action.generate(context),
      };
    }

    return newAction;
  });

  const filtered = generated.filter(action => {
    if (typeof action.when === 'function') return action.when(context);
    return action.when ?? true;
  });

  return filtered;
}

function group(actions: ToolbarAction[]): ToolbarAction[] {
  const grouped = groupBy(actions, a => a.id);

  const paired = toPairs(grouped).map(([_, items]) => {
    if (items.length === 1) return items[0];
    const [first, ...others] = items;
    if (others.length === 1) return merge({ ...first }, others[0]);
    return others.reduce(merge, { ...first });
  });

  return paired;
}

const merge = (a: any, b: any) =>
  mergeWith(a, b, (obj, src) =>
    Array.isArray(obj) ? group(obj.concat(src)) : src
  );

/**
 * How much of the row an entry has given up, decided by {@link ToolbarFitter}
 * and re-applied by every render until the room changes again.
 */
export interface ToolbarLayout {
  /** Entries rendered as their icon alone, with the label as tooltip. */
  shrunk: Set<string>;
  /** Entries rendered as entries of the "⋮" menu instead of the row. */
  collapsed: Set<string>;
}

export function emptyToolbarLayout(): ToolbarLayout {
  return { shrunk: new Set(), collapsed: new Set() };
}

/**
 * What the row is, in two values — the question the plan is asked by.
 *
 * The split is the whole of the second half of the PO's recette of 25/08/2026,
 * and it is the difference between the two things a re-render can invalidate:
 *
 * - {@link entries} is WHICH ENTRIES the row has, with their words, their
 *   icons, their priorities and whether the widget can move them into the "⋮".
 *   It is what makes a PLAN applicable: a plan is a list of entry ids, and it
 *   describes this row only for as long as this list holds.
 * - {@link state} is WHAT THOSE ENTRIES SAY. It changes nothing about which
 *   degradations exist, and everything about what they are worth: the same
 *   dropdown naming `Strict` instead of `Sketch` is ten pixels narrower, and a
 *   group that gained a member is a button wider. It is what makes a
 *   MEASUREMENT applicable.
 *
 * A row whose entries changed is a new row and is planned from scratch. A row
 * whose state changed keeps the plan it is wearing — the eye sees nothing — and
 * is only re-measured. A row where neither moved is free, which is what makes
 * a gesture's re-renders cost nothing at all.
 */
export interface ToolbarRow {
  entries: string;
  state: string;
}

/**
 * Where the row's plan comes from, asked for by {@link ToolbarRow}.
 *
 * Called once per render, AFTER the entries are resolved and BEFORE anything
 * reaches the DOM — which is the whole point. The mode an entry reads in is a
 * datum of its render, so the plan has to be in hand before the first
 * character is written; a plan applied afterwards is a plan the eye has
 * already seen the row without.
 */
export type ToolbarLayoutSource = (row: ToolbarRow) => ToolbarLayout;

/** What one render of the row tells the fitter about its own room to give. */
export interface ToolbarFit extends ToolbarRow {
  /** Every degradation available, in the order they must be spent. */
  steps: ToolbarLayoutStep[];
  /** Whether the rendered row already carries a "⋮" button. */
  hasMenu: boolean;
}

/**
 * Whether the widget can render this action as an entry of the "⋮" menu.
 *
 * Mirrors {@link renderActions}' own precedence exactly: an action that brings
 * its own template (`content`) or its own sub-actions is opaque — the widget
 * has no honest way to turn it into a menu line, and a dropdown nested inside a
 * dropdown is worse than a dropdown that stayed. Those keep their place on the
 * row, which is also what the PO asked for the two qualification dropdowns.
 */
function isPlainAction(action: ToolbarAction): boolean {
  if ('content' in action) return false;
  if ('actions' in action) return false;
  return typeof action.run === 'function';
}

/** One child of a group entry, with its own template already resolved. */
interface ResolvedChild {
  action: ToolbarAction;
  /** Set when the child brings its own template; `undefined` for a plain one. */
  template?: unknown;
}

/**
 * One entry of the row, RESOLVED: what it is about to draw, before it draws it.
 *
 * The row's signature has to know what the row will SAY, and an entry that
 * brings its own template only says it once `content(context)` has been called.
 * So the call happens here, once, and both the signature and the render read
 * the same answer — calling it twice would be one evaluation of somebody else's
 * code per render for nothing, and two answers that could disagree.
 */
type ResolvedEntry =
  | { kind: 'template'; action: ToolbarAction; template: unknown }
  | { kind: 'group'; action: ToolbarAction; children: ResolvedChild[] }
  | { kind: 'action'; action: ToolbarAction };

function resolveContent(action: ToolbarAction, context: ToolbarContext) {
  if (!('content' in action)) return undefined;
  if (typeof action.content === 'function') return action.content(context);
  return action.content ?? null;
}

/**
 * Resolves every entry of the row, in order, dropping the ones that render
 * nothing — the same precedence {@link renderResolvedActions} then applies.
 */
function resolveActions(
  actions: ToolbarActions,
  context: ToolbarContext
): ResolvedEntry[] {
  const resolved: ResolvedEntry[] = [];

  for (const action of actions) {
    if ('content' in action) {
      const template = resolveContent(action, context);
      if (template === null || template === undefined) continue;
      resolved.push({ kind: 'template', action, template });
      continue;
    }

    if ('actions' in action && action.actions.length) {
      const combined = combine(action.actions, context);
      if (!combined.length) continue;

      const ordered = orderBy(combined, ['id', 'score'], ['asc', 'asc']);
      resolved.push({
        kind: 'group',
        action,
        children: ordered.map(child => ({
          action: child,
          template: resolveContent(child, context),
        })),
      });
      continue;
    }

    if ('run' in action && action.run) {
      resolved.push({ kind: 'action', action });
    }
  }

  return resolved;
}

/**
 * A stable name for one template, by the only thing about it that is stable.
 *
 * A tagged template literal hands the SAME frozen strings array to every
 * evaluation of its call site — that array IS which template this is, and it is
 * what Lit itself diffs on. The `TemplateResult` wrapped around it, on the other
 * hand, is a fresh object every single render, which is precisely why an entry's
 * template can never be compared by identity.
 */
const templateNames = new WeakMap<object, string>();
let templateCount = 0;

function templateName(strings: object) {
  let name = templateNames.get(strings);
  if (name === undefined) {
    name = `t${++templateCount}`;
    templateNames.set(strings, name);
  }
  return name;
}

/** How deep a template may nest before the digest stops caring. */
const MAX_DIGEST_DEPTH = 8;

/**
 * What a template SAYS, as values.
 *
 * Only the things that end up as characters on the row are collected — the
 * words and the numbers, plus a name for each template so that a different
 * shape reads differently. Everything else is deliberately dropped:
 *
 * - **Functions** are event handlers. A fresh closure per render is the normal
 *   way to write one, and it changes nothing the eye can see.
 * - **Booleans** are attributes (`?active`, `?disabled`). They change how an
 *   entry LOOKS, never how wide it is, and a row does not need re-planning
 *   because a toggle went blue.
 * - **Anything else** — a model, a context, a DOM node — is an object whose
 *   identity says nothing about the row.
 *
 * That asymmetry is the whole point: same words, same digest, whatever objects
 * were built to carry them.
 */
function digestValue(value: unknown, out: string[], depth = 0): void {
  if (depth > MAX_DIGEST_DEPTH || value === null || value === undefined) return;

  switch (typeof value) {
    case 'string':
    case 'number':
    case 'bigint':
      out.push(String(value));
      return;
    case 'boolean':
    case 'function':
    case 'symbol':
      return;
    default:
      break;
  }

  if (Array.isArray(value)) {
    for (const item of value) digestValue(item, out, depth + 1);
    return;
  }

  // A `TemplateResult` (`strings` + `values`) or a directive result (`values`
  // alone: `repeat`, `join`, `keyed`, `ifDefined`…). Both are walked the same
  // way, and anything shaped like neither contributes nothing.
  const parts = value as { strings?: unknown; values?: unknown };
  if (Array.isArray(parts.strings)) out.push(templateName(parts.strings));
  if (Array.isArray(parts.values)) {
    for (const item of parts.values) digestValue(item, out, depth + 1);
  }
}

/**
 * What the row SAYS, entry by entry — the half of its signature that the
 * entries' own state decides.
 *
 * The other half ({@link renderToolbar}'s list of ids, priorities, words and
 * icons) describes the entries the widget itself draws, and for a row made of
 * nothing else it is a complete description: same list, same widths. A row that
 * carries OPAQUE entries — a dropdown that names the profile in force, a group
 * whose members come and go with the element they are about — is not described
 * by that list at all, and two rows it calls identical can be twenty pixels
 * apart. This is what closes that gap.
 *
 * Plain entries add nothing here: their word and their icon are already in the
 * other half, and repeating them would only make the string longer.
 */
function digestEntries(entries: readonly ResolvedEntry[]): string {
  const out: string[] = [];

  for (const entry of entries) {
    if (entry.kind === 'action') continue;

    out.push(entry.action.id);

    if (entry.kind === 'template') {
      digestValue(entry.template, out, 0);
      continue;
    }

    for (const child of entry.children) {
      out.push(child.action.id);
      if (child.template !== undefined) {
        digestValue(child.template, out, 0);
        continue;
      }
      // A plain member of a group: the widget draws it, so what it will say is
      // known without resolving anything.
      out.push(
        child.action.showLabel && child.action.label
          ? String(child.action.label)
          : ''
      );
      out.push(child.action.icon ? 'i' : '');
    }
  }

  return out.join('');
}

/**
 * Renders toolbar
 *
 * Merges the following configs:
 * 1. `affine:note`
 * 2. `custom:affine:note`
 * 3. `affine:*`
 * 4. `custom:affine:*`
 */
export function renderToolbar(
  toolbar: EditorToolbar,
  context: ToolbarContext,
  flavour: string,
  source: ToolbarLayoutSource = () => emptyToolbarLayout()
): ToolbarFit | null {
  const hasSurfaceScope = flavour.includes('surface');
  const toolbarRegistry = context.toolbarRegistry;

  const actions = [
    flavour,
    `custom:${flavour}`,
    hasSurfaceScope ? ['affine:surface:*', 'custom:affine:surface:*'] : [],
    'affine:*',
    'custom:affine:*',
  ]
    .flat()
    .map(key => toolbarRegistry.modules.get(key))
    .filter(module => !!module)
    .filter(module =>
      typeof module.config.when === 'function'
        ? module.config.when(context)
        : (module.config.when ?? true)
    )
    .map<ToolbarActions>(module => module.config.actions)
    .flat();

  const combined = combine(actions, context);

  const ordered = orderBy(
    combined,
    ['placement', 'id', 'score'],
    ['asc', 'asc', 'asc']
  );

  const [moreActionGroup, primaryActionGroup] = partition(
    ordered,
    a => a.placement === ActionPlacement.More
  );

  // Resets
  if (primaryActionGroup.length === 0) {
    context.reset();
    return null;
  }

  // What this row could give up if it ran out of width, decided entirely by
  // what the entries declare — the widget never names a block or a framework.
  const items: ToolbarLayoutItem[] = primaryActionGroup.map(action => {
    const plain = isPlainAction(action);
    return {
      id: action.id,
      priority: action.priority ?? 0,
      shrinkable:
        plain && Boolean(action.icon && action.showLabel && action.label),
      collapsible: plain,
    };
  });
  const steps = toolbarDegradationSteps(items);

  // Resolved BEFORE the plan is asked for, and drawn from this same answer: an
  // entry that brings its own template only says what it says once it has been
  // called, and the signature below has to know.
  const resolved = resolveActions(primaryActionGroup, context);

  // What this row IS, before anything about how it is currently degraded — in
  // the two halves {@link ToolbarRow} describes. Both are VALUES: nothing that
  // varies with the objects a render happens to allocate — a fresh template, a
  // fresh event handler — reaches either string, which is what keeps them
  // identical across two identical rebuilds.
  //
  // The words are in the first half, not just the ids: an entry that changes
  // its label ("Add exception" becoming "Revoke exception") changes what the
  // row costs, and a plan measured on the old words no longer describes it.
  const row: ToolbarRow = {
    entries: [
      flavour,
      ...primaryActionGroup.map(action =>
        [
          action.id,
          action.priority ?? 0,
          action.showLabel && action.label ? action.label : '',
          action.icon ? 'i' : '',
          isPlainAction(action) ? 'p' : 'o',
        ].join('~')
      ),
    ].join('|'),
    state: digestEntries(resolved),
  };

  const layout = source(row);

  // Entries the last measurement sent into the menu lead it: they came off the
  // row, so they are the first thing the user looks for after opening it.
  const collapsed = primaryActionGroup.filter(a => layout.collapsed.has(a.id));
  const primary = resolved.filter(
    entry => !layout.collapsed.has(entry.action.id)
  );
  const more = [...collapsed, ...moreActionGroup];

  const innerToolbar = context.placement$.value === 'inner';
  let hasMenu = false;

  if (more.length) {
    const moreMenuItems = renderActions(more, context, renderMenuActionItem);
    if (moreMenuItems.length) {
      const key = `${context.getCurrentModel()?.id}`;
      hasMenu = true;

      primary.push({
        kind: 'template',
        // Not an entry of the row's signature: the "⋮" is DERIVED from the
        // plan, and a row is never re-planned because its own plan opened one.
        action: { id: 'more' } as ToolbarAction,
        template: html`${keyed(
          `${flavour}:${key}`,
          html`
            <editor-menu-button
              aria-label="More menu"
              .contentPadding="${'8px'}"
              .button=${html`
                <editor-icon-button
                  aria-label="More"
                  .tooltip="${'More'}"
                  .iconContainerPadding=${innerToolbar ? 4 : 2}
                  .iconSize=${innerToolbar ? '16px' : undefined}
                >
                  ${MoreVerticalIcon()}
                </editor-icon-button>
              `}
            >
              <div
                data-size=${innerToolbar ? '' : 'large'}
                data-orientation="vertical"
              >
                ${join(moreMenuItems, renderToolbarSeparator('horizontal'))}
              </div>
            </editor-menu-button>
          `
        )}`,
      });
    }
  }

  render(
    join(
      renderResolvedActions(primary, context, renderActionItem, layout.shrunk),
      innerToolbar ? null : renderToolbarSeparator()
    ),
    toolbar
  );

  // Avoids shaking
  if (flavour === 'affine:note' && context.std.range.value) {
    if (!('inline' in toolbar.dataset)) {
      toolbar.dataset.inline = '';
    } else {
      toolbar.dataset.inline = 'true';
    }
  } else {
    delete toolbar.dataset.inline;
  }

  if (!toolbar.dataset.open) {
    toolbar.dataset.open = 'true';
  }

  return { steps, hasMenu, ...row };
}

function renderResolvedActions(
  entries: readonly ResolvedEntry[],
  context: ToolbarContext,
  render = renderActionItem,
  shrunk?: ReadonlySet<string>
) {
  return entries.map(entry => {
    if (entry.kind === 'template') return entry.template;

    if (entry.kind === 'group') {
      return repeat(
        entry.children,
        child => child.action.id,
        child =>
          child.template !== undefined
            ? child.template
            : render(
                child.action,
                context,
                shrunk?.has(child.action.id) ?? false
              )
      );
    }

    return render(entry.action, context, shrunk?.has(entry.action.id) ?? false);
  });
}

function renderActions(
  actions: ToolbarActions,
  context: ToolbarContext,
  render = renderActionItem,
  shrunk?: ReadonlySet<string>
) {
  return renderResolvedActions(
    resolveActions(actions, context),
    context,
    render,
    shrunk
  );
}

// TODO(@fundon): supports templates
function renderActionItem(
  action: ToolbarAction,
  context: ToolbarContext,
  /**
   * The row is tight and this entry has already given up its label. It keeps
   * its icon and its behaviour; the word moves to the tooltip, which is the
   * cheapest thing an entry can lose (see `layout.ts`).
   */
  iconOnly = false
) {
  const innerToolbar = context.placement$.value === 'inner';
  const ids = action.id.split('.');
  const id = ids[ids.length - 1];
  const label = action.label ?? action.tooltip ?? id;
  const actived =
    typeof action.active === 'function'
      ? action.active(context)
      : action.active;
  const disabled =
    typeof action.disabled === 'function'
      ? action.disabled(context)
      : action.disabled;
  const showLabel = Boolean(action.showLabel && action.label) && !iconOnly;

  return html`
    <editor-icon-button
      data-testid=${ifDefined(id)}
      data-toolbar-action-id=${action.id}
      data-icon-only=${ifDefined(iconOnly ? 'true' : undefined)}
      aria-label=${ifDefined(label)}
      ?active=${actived}
      ?disabled=${disabled}
      .tooltip=${action.tooltip ?? (iconOnly ? action.label : undefined)}
      .iconContainerPadding=${innerToolbar ? 4 : 2}
      .iconSize=${innerToolbar ? '16px' : undefined}
      @click=${() => action.run?.(context)}
    >
      ${action.icon}
      ${showLabel ? html`<span class="label">${action.label}</span>` : null}
    </editor-icon-button>
  `;
}

function renderMenuActionItem(action: ToolbarAction, context: ToolbarContext) {
  const innerToolbar = context.placement$.value === 'inner';
  const ids = action.id.split('.');
  const id = ids[ids.length - 1];
  const label = action.label ?? action.tooltip ?? id;
  const actived =
    typeof action.active === 'function'
      ? action.active(context)
      : action.active;
  const disabled =
    typeof action.disabled === 'function'
      ? action.disabled(context)
      : action.disabled;
  const destructive = action.variant === 'destructive' ? 'delete' : undefined;

  return html`
    <editor-menu-action
      data-testid=${ifDefined(id)}
      data-toolbar-action-id=${action.id}
      aria-label=${ifDefined(label)}
      class="${ifDefined(destructive)}"
      ?active=${actived}
      ?disabled=${disabled}
      .tooltip=${ifDefined(action.tooltip)}
      .iconContainerPadding=${innerToolbar ? 4 : 2}
      .iconSize=${innerToolbar ? '16px' : undefined}
      @click=${() => action.run?.(context)}
    >
      ${action.icon}
      ${action.label ? html`<span class="label">${action.label}</span>` : null}
    </editor-menu-action>
  `;
}

/**
 * What a "⋮" button costs a row that has none yet: one icon, no label.
 *
 * Estimated rather than measured, because the button does not exist at the
 * moment the planner has to decide whether opening one pays for itself. The
 * estimate is only ever used for that one comparison, and a round of
 * verification measures the real row right afterwards.
 */
const MENU_BUTTON_WIDTH = 24;

/** How many times the fitter is willing to re-measure before settling. */
const MAX_FIT_ROUNDS = 3;

/**
 * The width the row may occupy, as `size()` wrote it.
 *
 * Two shapes, because the middleware has two: a floating toolbar gets a cap and
 * keeps its natural width under it, while an `inner` toolbar is pinned to the
 * exact width of the block it sits on. Anything else — a row nothing has
 * positioned yet — has all the room in the world and collapses nothing.
 */
function availableWidthOf(toolbar: EditorToolbar) {
  const max = Number.parseFloat(toolbar.style.maxWidth);
  if (Number.isFinite(max)) return max;

  const width = Number.parseFloat(toolbar.style.width);
  return Number.isFinite(width) ? width : Number.POSITIVE_INFINITY;
}

/**
 * Waits until the row is on screen as it was just described.
 *
 * One animation frame: every pending Lit update is a microtask, and microtasks
 * are drained — exhaustively, including the ones those updates queue for their
 * own children — before a frame callback runs. Measuring any earlier reads
 * elements whose shadow root has not rendered yet, which is to say elements
 * that are still zero pixels wide.
 */
function settled() {
  return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

/**
 * Reads what the row costs, entry by entry.
 *
 * Only the entries the widget itself rendered ({@link renderActionItem}) carry
 * an id, and they are exactly the entries that can give way — anything opaque
 * stays on the row, so its width is counted into the total and never offered as
 * a saving.
 */
function measureToolbar(
  toolbar: EditorToolbar,
  hasMenu: boolean
): ToolbarMetrics {
  const style = getComputedStyle(toolbar);
  const gap = Number.parseFloat(style.columnGap) || 0;
  const children = Array.from(toolbar.children) as HTMLElement[];

  // Separators are uniform, and an entry that leaves the row takes one with it.
  const separator = children.find(
    child => child.localName === 'editor-toolbar-separator'
  );
  const separatorCost = separator ? separator.offsetWidth + gap : 0;

  const label: Record<string, number> = {};
  const entry: Record<string, number> = {};
  let content = 0;

  for (const child of children) {
    content += child.offsetWidth + gap;

    const id = child.dataset.toolbarActionId;
    if (!id) continue;

    entry[id] = child.offsetWidth + gap + separatorCost;
    label[id] = child.querySelector<HTMLElement>('.label')?.offsetWidth ?? 0;
  }

  if (children.length) content -= gap;

  return {
    content,
    available: availableWidthOf(toolbar),
    label,
    entry,
    menuCost: MENU_BUTTON_WIDTH + gap + separatorCost,
    hasMenu,
  };
}

/**
 * The WHOLE row's measurements, read from the row as it is currently DRAWN.
 *
 * A state change — a dropdown naming a different profile, a group that gained
 * a member — invalidates the widths the plan was made from. It does not
 * invalidate the plan itself: the entries are the same entries and they give
 * way in the same order. So the row must be re-measured, and the one thing it
 * must not do to be re-measured is appear undegraded for a frame, which is the
 * flash the PO reported and the second pass removed.
 *
 * It does not have to. The row is measured wearing its plan, and what the plan
 * took off is added back from the numbers that made it — an entry that is not
 * on the row is not on screen, so nothing about it can have moved under it.
 * What comes out is the row whole, measured without ever having been shown
 * whole.
 */
function wholeRowMetrics(
  drawn: ToolbarMetrics,
  previous: ToolbarMetrics,
  layout: ToolbarLayout
): ToolbarMetrics {
  const label: Record<string, number> = { ...previous.label, ...drawn.label };
  const entry: Record<string, number> = { ...previous.entry, ...drawn.entry };
  let content = drawn.content;

  // An entry drawn as its icon alone: it is on the row, so its icon was just
  // measured; the word it is not wearing is worth what it was worth.
  for (const id of layout.shrunk) {
    const word = previous.label[id] ?? 0;
    label[id] = word;
    entry[id] = (drawn.entry[id] ?? previous.entry[id] ?? 0) + word;
    content += word;
  }

  // An entry in the "⋮": nothing of it is on the row, so it costs the row what
  // it cost the last time the row carried it.
  for (const id of layout.collapsed) {
    const cost = previous.entry[id] ?? 0;
    entry[id] = cost;
    label[id] = previous.label[id] ?? 0;
    content += cost;
  }

  // And the "⋮" the plan opened is not part of the row it opened it for.
  if (layout.collapsed.size > 0 && !previous.hasMenu) {
    content -= drawn.menuCost;
  }

  return {
    content,
    available: drawn.available,
    label,
    entry,
    menuCost: drawn.menuCost,
    // What the row carries on its OWN account, which the plan never changed.
    hasMenu: previous.hasMenu,
  };
}

function stepKey(step: ToolbarLayoutStep) {
  return `${step.kind}:${step.id}`;
}

function sameLayout(a: ToolbarLayout, b: ToolbarLayout) {
  if (a.shrunk.size !== b.shrunk.size) return false;
  if (a.collapsed.size !== b.collapsed.size) return false;
  for (const id of a.shrunk) if (!b.shrunk.has(id)) return false;
  for (const id of a.collapsed) if (!b.collapsed.has(id)) return false;
  return true;
}

/**
 * Keeps the contextual toolbar on ONE line.
 *
 * Owns the two halves the pure planner cannot: MEASURING the row, and
 * RE-RENDERING it once the planner has said which entries give way. The order
 * they give way in is not decided here — it comes from what the entries
 * declared (`priority`, `icon`, `label`), so this class never learns that a
 * block or a framework exists.
 *
 * The row is measured ONCE per ROW, while it is still whole. Every later
 * resize replans from those numbers instead of flashing the row back to its
 * full width just to measure it again — which is also what makes the collapse
 * reversible: widen the editor and the plan simply spends fewer steps.
 *
 * "Per row", not per render: the widget re-renders for reasons that have
 * nothing to do with width, and a re-render is not a new row. Which row it is
 * is answered by {@link ToolbarRow}, and a row that has not changed keeps the
 * plan it is wearing — see {@link ToolbarFitter.render}.
 *
 * A row that changed only what it SAYS keeps it too, and is simply re-measured
 * where it stands ({@link ToolbarFitter.#remeasure}). That is the generalisation
 * the PO's recette of 25/08/2026 asked for: the components' row is made
 * entirely of entries the widget draws itself, so the list of entries is a
 * complete description of it and the first half of {@link ToolbarRow} was
 * enough; a framework background's row is mostly OPAQUE — toggles grouped by
 * the framework, a dropdown naming the level of requirement in force — and for
 * that row the list says nothing about what it costs.
 *
 * And it replans only at the ACCALMIE. While the room is still moving — a zoom,
 * a pan, a window being dragged — the plan on screen is frozen: see
 * {@link ToolbarFitter.resize}.
 */
export class ToolbarFitter {
  #context: ToolbarContext | null = null;

  #flavour = '';

  #hasMenu = false;

  #layout = emptyToolbarLayout();

  /** The whole row, measured once. `null` until the first frame lands. */
  #metrics: ToolbarMetrics | null = null;

  /** The room the row is waiting to be replanned for, once it holds still. */
  #pending: number | null = null;

  /** Armed while the room is still moving; fires at the accalmie. */
  #settleTimer: ReturnType<typeof setTimeout> | null = null;

  /** Which entries the row on screen has. `''` when there is no row. */
  #entries = '';

  /** What those entries currently say. See {@link ToolbarRow}. */
  #state = '';

  #steps: readonly ToolbarLayoutStep[] = [];

  /** Bumped by anything that invalidates a measurement still in flight. */
  #token = 0;

  constructor(private readonly toolbar: EditorToolbar) {}

  /** Nothing is waiting on the room any more. */
  #cancelSettle() {
    if (this.#settleTimer !== null) {
      clearTimeout(this.#settleTimer);
      this.#settleTimer = null;
    }
    this.#pending = null;
  }

  #apply(plan: readonly ToolbarLayoutStep[]) {
    const next = emptyToolbarLayout();
    for (const step of plan) {
      if (step.kind === 'shrink') next.shrunk.add(step.id);
      else next.collapsed.add(step.id);
    }

    if (sameLayout(next, this.#layout)) return false;

    this.#layout = next;
    renderToolbar(this.toolbar, this.#context!, this.#flavour, () => next);
    return true;
  }

  /**
   * Applies a plan, then checks the row against the estimates that produced it.
   *
   * A plan is arithmetic on measured widths, but a rendered row is not: a
   * dropped label frees a little more or a little less than its own span, and
   * the "⋮" that appears is the width it turns out to be. So the row is read
   * back and, while it still overflows, the next unspent steps are added — at
   * most {@link MAX_FIT_ROUNDS} times, after which the row keeps what it has
   * and stays, above all, one line.
   */
  async #converge(plan: ToolbarLayoutStep[], token: number) {
    for (let round = 0; round < MAX_FIT_ROUNDS; round++) {
      if (token !== this.#token || !this.#context) return;
      // An empty plan is the answer when the room came back: it restores the
      // whole row, and there is then nothing left to verify.
      if (!this.#apply(plan) || plan.length === 0) return;

      await settled();
      if (token !== this.#token || !this.#context) return;

      const now = measureToolbar(
        this.toolbar,
        this.#hasMenu || this.#layout.collapsed.size > 0
      );
      if (now.content <= now.available) return;

      const spent = new Set(plan.map(stepKey));
      const extra = planToolbarLayout(
        this.#steps.filter(step => !spent.has(stepKey(step))),
        now
      );
      if (extra.length === 0) return;

      plan = [...plan, ...extra];
    }
  }

  /**
   * Spends the room the last measurement was waiting on.
   *
   * The hysteresis is checked a second time here, against the plan that is
   * actually on screen: a gesture that wandered away and came back has changed
   * nothing, and a row is not rebuilt to arrive where it already is.
   */
  #replan() {
    const metrics = this.#metrics;
    const available = this.#pending;
    this.#pending = null;

    if (!metrics || available === null || !this.#context) return;
    if (!toolbarRoomChanged(metrics.available, available)) return;

    this.#metrics = { ...metrics, available };
    void this.#converge(
      planToolbarLayout(this.#steps, this.#metrics),
      ++this.#token
    );
  }

  /**
   * Waits for the room to hold still, then replans once.
   *
   * Re-armed by every further change, so a gesture of any length spends exactly
   * one plan — the one for the width it ended on.
   */
  #settle() {
    if (this.#settleTimer !== null) clearTimeout(this.#settleTimer);

    this.#settleTimer = setTimeout(() => {
      this.#settleTimer = null;

      // A wheel zoom breathes: between two notches the room can hold still for
      // longer than the delay and the gesture still be under way. The viewport
      // knows it is, and says so for as long as it lasts.
      if (this.#zooming()) {
        this.#settle();
        return;
      }

      this.#replan();
    }, TOOLBAR_SETTLE_DELAY);
  }

  /**
   * Whether a zoom gesture is under way, as the viewport itself reports it.
   *
   * Only the zoom. A pan changes the room on every frame of the drag, so the
   * delay above already spans it whole; and `panning$` is raised by every
   * programmatic recentring too, which would freeze the row for gestures no one
   * is making. In page mode there is no viewport at all, and the delay is then
   * the only signal there is — which is all it needs to be.
   */
  #zooming() {
    const gfx = this.#context?.std.getOptional(GfxControllerIdentifier);
    return gfx?.viewport.zooming$.value === true;
  }

  async #measure(token: number) {
    await settled();
    if (token !== this.#token || !this.#context) return;

    const metrics = measureToolbar(this.toolbar, this.#hasMenu);
    this.#metrics = metrics;
    if (metrics.content <= metrics.available) return;

    await this.#converge(planToolbarLayout(this.#steps, metrics), token);
  }

  /**
   * The row said something new. Measure it again, wearing what it is wearing.
   *
   * The plan is untouched — the entries are the same entries — so this never
   * draws the whole row, and the eye sees the row change at most once: when the
   * new widths genuinely no longer fit the same plan.
   */
  async #remeasure(token: number) {
    await settled();
    if (token !== this.#token || !this.#context) return;

    const previous = this.#metrics;
    const drawn = measureToolbar(
      this.toolbar,
      this.#hasMenu || this.#layout.collapsed.size > 0
    );
    const metrics = previous
      ? wholeRowMetrics(drawn, previous, this.#layout)
      : drawn;

    this.#metrics = metrics;

    await this.#converge(planToolbarLayout(this.#steps, metrics), token);
  }

  /**
   * Renders the row, in the mode the plan on screen says.
   *
   * The widget re-renders for a great many reasons that have nothing to do
   * with the row's width — an element updated anywhere on the canvas, a block
   * updated, a selection re-emitted, something hovered — and any of them can
   * land on any frame of a gesture. So this asks a question first: is the row
   * about to be drawn the row already on screen?
   *
   * - **Yes** (same {@link ToolbarRow}, both halves): it is drawn wearing the
   *   plan it is already wearing, entry by entry, and nothing is measured.
   *   The DOM does not change, so there is nothing to see — which is the
   *   PO's recette of 25/08/2026. Before, every one of these re-renders threw
   *   the plan away, painted the whole row, and only then measured and
   *   degraded it again: one flash of "Read this component" per re-render,
   *   plus a full replan at whatever width the gesture happened to be at,
   *   straight through the freeze the accalmie was supposed to give.
   * - **The same entries, saying something new** — a dropdown naming another
   *   profile, a group that gained a member: the PLAN still describes the row
   *   and stays on it, so again there is nothing to see. Only the widths it was
   *   made from are out of date, and {@link ToolbarFitter.#remeasure} reads
   *   them back off the row as it is drawn.
   * - **No**: a different row. Then, and only then, it is rendered whole,
   *   measured, and spends what it must.
   */
  render(context: ToolbarContext, flavour: string) {
    this.#context = context;
    this.#flavour = flavour;

    // Answered while the entries are resolved and before they are drawn: the
    // mode an entry reads in is an argument of its own render, never a fixup.
    let change: 'none' | 'state' | 'row' = 'none';
    const fit = renderToolbar(this.toolbar, context, flavour, row => {
      if (row.entries !== this.#entries) {
        change = 'row';
        this.#entries = row.entries;
        this.#state = row.state;
        this.#layout = emptyToolbarLayout();
        return this.#layout;
      }

      if (row.state !== this.#state) {
        change = 'state';
        this.#state = row.state;
      }

      // Either way the row keeps what it is wearing: a plan is a list of
      // entries, and this is the same list.
      return this.#layout;
    });

    if (!fit) {
      this.reset();
      return;
    }

    // The same row saying the same things: it is already right, and a
    // measurement now would be a measurement of a room that is still moving.
    if (change === 'none') return;

    const token = ++this.#token;
    this.#cancelSettle();

    if (change === 'state') {
      // The entries did not move, so neither did what they can give up nor
      // whether the row carries a "⋮" of its own. Only the numbers changed.
      if (this.#steps.length === 0) return;
      void this.#remeasure(token);
      return;
    }

    // A new row. Whatever the old one was waiting for describes nothing.
    this.#metrics = null;
    this.#steps = fit.steps;
    this.#hasMenu = fit.hasMenu;

    if (fit.steps.length === 0) return;

    void this.#measure(token);
  }

  /** The toolbar is going away: stop measuring it. */
  reset() {
    this.#token++;
    this.#cancelSettle();
    this.#context = null;
    this.#metrics = null;
    this.#layout = emptyToolbarLayout();
    this.#steps = [];
    this.#hasMenu = false;
    // The row that comes back is measured from scratch: `#metrics` went with
    // it, and a plan with nothing behind it could never be revised.
    this.#entries = '';
    this.#state = '';
  }

  /**
   * The room the row has may have changed.
   *
   * Two answers are refused before anything is replanned, and the PO's second
   * pass of 02/08/2026 is about both:
   *
   * 1. **A change too small to mean anything.** Two measurements a pixel apart
   *    are the same measurement, and a row that believes them alternates
   *    between two compositions for as long as they alternate.
   * 2. **A change that is still happening.** A zoom moves the room on every
   *    frame; replanning on each of them re-composes the row under the cursor,
   *    and every new width moves the anchoring with it — which is the toolbar
   *    "hesitating between anchor points" the PO reported. The plan on screen
   *    is FROZEN for the whole gesture and spent once, when the viewport lands.
   *
   * The room is remembered as it goes by, so the plan that is finally made is
   * the one for the width the gesture ended on, not the width it started from.
   */
  resize() {
    if (!this.#metrics || !this.#context) return;

    const available = availableWidthOf(this.toolbar);
    if (!toolbarRoomChanged(this.#metrics.available, available)) return;

    this.#pending = available;
    this.#settle();
  }
}
