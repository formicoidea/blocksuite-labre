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
  options: AutoUpdateOptions = { elementResize: false, animationFrame: true },
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
          flip({ padding: 10 }),
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
    options
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

/** What one render of the row tells the fitter about its own room to give. */
export interface ToolbarFit {
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
  layout: ToolbarLayout = emptyToolbarLayout()
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
      shrinkable: plain && Boolean(action.icon && action.showLabel && action.label),
      collapsible: plain,
    };
  });
  const steps = toolbarDegradationSteps(items);

  // Entries the last measurement sent into the menu lead it: they came off the
  // row, so they are the first thing the user looks for after opening it.
  const collapsed = primaryActionGroup.filter(a => layout.collapsed.has(a.id));
  const primary = primaryActionGroup.filter(a => !layout.collapsed.has(a.id));
  const more = [...collapsed, ...moreActionGroup];

  const innerToolbar = context.placement$.value === 'inner';
  let hasMenu = false;

  if (more.length) {
    const moreMenuItems = renderActions(more, context, renderMenuActionItem);
    if (moreMenuItems.length) {
      const key = `${context.getCurrentModel()?.id}`;
      hasMenu = true;

      primary.push({
        id: 'more',
        content: html`${keyed(
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
      renderActions(primary, context, renderActionItem, layout.shrunk),
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

  return { steps, hasMenu };
}

function renderActions(
  actions: ToolbarActions,
  context: ToolbarContext,
  render = renderActionItem,
  shrunk?: ReadonlySet<string>
) {
  return actions
    .map(action => {
      if ('content' in action) {
        if (typeof action.content === 'function') {
          return action.content(context);
        } else {
          return action.content ?? null;
        }
      }

      if ('actions' in action && action.actions.length) {
        const combined = combine(action.actions, context);

        if (!combined.length) return null;

        const ordered = orderBy(combined, ['id', 'score'], ['asc', 'asc']);

        return repeat(
          ordered,
          a => a.id,
          a => {
            if ('content' in a) {
              if (typeof a.content === 'function') {
                return a.content(context);
              } else {
                return a.content ?? null;
              }
            }
            return render(a, context, shrunk?.has(a.id) ?? false);
          }
        );
      }

      if ('run' in action && action.run) {
        return render(action, context, shrunk?.has(action.id) ?? false);
      }

      return null;
    })
    .filter(action => action !== null);
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
 * The row is measured ONCE per selection, while it is still whole. Every later
 * resize replans from those numbers instead of flashing the row back to its
 * full width just to measure it again — which is also what makes the collapse
 * reversible: widen the editor and the plan simply spends fewer steps.
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
    renderToolbar(this.toolbar, this.#context!, this.#flavour, next);
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
   * Renders the row whole — synchronously, so nothing about the first paint
   * changes — then measures it and spends what it must.
   */
  render(context: ToolbarContext, flavour: string) {
    const token = ++this.#token;

    // A new selection is a new row: whatever the old one was waiting for no
    // longer describes anything, and it is measured whole again from here.
    this.#cancelSettle();

    this.#context = context;
    this.#flavour = flavour;
    this.#layout = emptyToolbarLayout();
    this.#metrics = null;
    this.#steps = [];

    const fit = renderToolbar(this.toolbar, context, flavour, this.#layout);
    if (!fit || fit.steps.length === 0) return;

    this.#steps = fit.steps;
    this.#hasMenu = fit.hasMenu;

    void this.#measure(token);
  }

  /** The toolbar is going away: stop measuring it. */
  reset() {
    this.#token++;
    this.#cancelSettle();
    this.#context = null;
    this.#metrics = null;
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
