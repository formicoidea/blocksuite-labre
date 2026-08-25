/**
 * **Priority collapse** — how a contextual toolbar stays on ONE line.
 *
 * The PO's arbitration of 02/08/2026 killed the previous answer, which was to
 * let the toolbar wrap onto a second row: the "⋮" button ended up alone on a
 * line of its own, and a toolbar whose height changes with the selection is a
 * toolbar that moves under the cursor. The replacement is the one every desktop
 * toolbar has used for thirty years — when the row runs out of room, the least
 * important entries give way, in that order, into the overflow menu that is
 * already there.
 *
 * ## Why the algorithm lives here and not in the widget
 *
 * Nothing below touches the DOM. It takes the entries' DECLARED priority and a
 * handful of measured widths and answers "which entries give way, and how" —
 * which makes it a pure function the unit suite can pin down entirely, and
 * leaves the widget with only the two things that genuinely need a browser:
 * measuring, and re-rendering.
 *
 * It also keeps the rule where the rule belongs. `priority` is a field of
 * {@link ToolbarAction}, so an entry decides its own fate from its own config
 * file; the widget never learns that a framework exists.
 *
 * ## The two ways an entry gives way, in order
 *
 * 1. **Icon only.** An entry that renders an icon AND a label drops its label
 *    first, keeping the label as its tooltip. A wordy entry costs three times
 *    an icon, and losing the word to a hover is a far smaller loss than losing
 *    the entry to a menu.
 * 2. **Into the "⋮" menu.** Only then does the entry leave the row, keeping its
 *    full label and its behaviour as an entry of the menu.
 *
 * Every entry that CAN shrink shrinks before any entry moves — a row of icons
 * is still a row of things you can click, and a menu is not.
 *
 * ## When a plan is worth remaking
 *
 * The arithmetic above answers "what should the row look like at this width".
 * It does NOT answer "is this width worth answering for", and the PO's second
 * pass of 02/08/2026 is about that second question: during a zoom the room the
 * row has moves sixty times a second, and a row that replans on every one of
 * those frames visibly hesitates between several compositions — and, since its
 * width is what the positioner anchors, between several places.
 *
 * Two answers are refused, both of them pure and both of them here:
 * {@link toolbarRoomChanged} refuses a change too small to mean anything, and
 * {@link TOOLBAR_SETTLE_DELAY} is how long the room must hold still before the
 * widget bothers to ask at all.
 */

/**
 * How much the room must move before the row is worth re-composing, in pixels.
 *
 * A few pixels, deliberately: less than the narrowest thing the row could give
 * up, so no real degradation is ever delayed by it, and more than the noise the
 * measurements carry — a fractional zoom, a rounded rect, a scrollbar coming
 * and going. Two measurements that differ by a hair are the same measurement,
 * and treating them as two is how a composition ends up alternating forever.
 */
export const TOOLBAR_ROOM_HYSTERESIS = 4;

/**
 * How long the room must hold still before the row is replanned, in ms.
 *
 * Long enough to bridge the frames of a gesture — a zoom, a pan, a window being
 * dragged — so the row keeps ONE composition for the whole of it, and short
 * enough that letting go feels like the row simply followed.
 */
export const TOOLBAR_SETTLE_DELAY = 150;

/**
 * Whether the room the row has really changed since the plan on screen.
 *
 * `Infinity` is a value like any other here: a row nothing has positioned yet
 * has all the room in the world, and going from that to a finite cap (or back)
 * is always a change, however large the numbers are.
 */
export function toolbarRoomChanged(
  planned: number,
  measured: number,
  threshold: number = TOOLBAR_ROOM_HYSTERESIS
): boolean {
  if (planned === measured) return false;
  if (!Number.isFinite(planned) || !Number.isFinite(measured)) return true;
  return Math.abs(measured - planned) > threshold;
}

/** One entry of the row, as the planner sees it. */
export interface ToolbarLayoutItem {
  id: string;
  /**
   * Higher stays on the row longer. `0` unless the entry says otherwise; among
   * equals the one rendered LAST gives way first, so leaving every entry alone
   * reproduces the order the toolbar already has.
   */
  priority: number;
  /** Renders an icon and a label today, so it has a label to drop. */
  shrinkable: boolean;
  /** The widget knows how to re-render it as an entry of the "⋮" menu. */
  collapsible: boolean;
}

/** One degradation, applied to one entry. */
export type ToolbarLayoutStep =
  | { kind: 'shrink'; id: string }
  | { kind: 'collapse'; id: string };

/** What the row currently measures, in CSS pixels. */
export interface ToolbarMetrics {
  /** Width the entries occupy when nothing has given way yet. */
  content: number;
  /** Width they may occupy. `Infinity` when nothing constrains the row. */
  available: number;
  /** Width freed by dropping an entry's label, by action id. */
  label: Readonly<Record<string, number>>;
  /** Width freed by moving an entry into the menu, by action id. */
  entry: Readonly<Record<string, number>>;
  /** What the "⋮" button costs on a row that has none yet. */
  menuCost: number;
  /** Whether the row already carries a "⋮" button. */
  hasMenu: boolean;
}

/**
 * Every degradation available for this row, in the order they must be spent.
 *
 * All the shrinks first, then all the collapses; within each phase, the least
 * important entry first. An entry that can do both appears twice — which is
 * exactly the arbitration's "icon only BEFORE it is a candidate for the ⋮".
 */
export function toolbarDegradationSteps(
  items: readonly ToolbarLayoutItem[]
): ToolbarLayoutStep[] {
  const order = items
    .map((item, index) => ({ item, index }))
    // Least important first: by declared priority, then — for the entries that
    // declared nothing, which is most of them — by reverse rendered order.
    .sort((a, b) => a.item.priority - b.item.priority || b.index - a.index);

  return [
    ...order
      .filter(({ item }) => item.shrinkable)
      .map(({ item }): ToolbarLayoutStep => ({ kind: 'shrink', id: item.id })),
    ...order
      .filter(({ item }) => item.collapsible)
      .map(({ item }): ToolbarLayoutStep => ({
        kind: 'collapse',
        id: item.id,
      })),
  ];
}

/**
 * The shortest prefix of `steps` that brings the row back within `available`.
 *
 * Spends steps one at a time, cheapest loss first, and stops the moment the row
 * fits — a toolbar that collapses more than it must is a toolbar that hides
 * things for nothing. A step that would free nothing is skipped rather than
 * spent: dropping a label of zero width, or opening a "⋮" that costs more than
 * the entry it swallows, is a change with no benefit.
 *
 * Returns `[]` when the row already fits, and may return fewer steps than are
 * needed when the row cannot fit at all — the caller renders what it can and
 * the row stays one line, which is the whole point.
 */
export function planToolbarLayout(
  steps: readonly ToolbarLayoutStep[],
  metrics: ToolbarMetrics
): ToolbarLayoutStep[] {
  const { available } = metrics;
  let width = metrics.content;
  if (width <= available) return [];

  let hasMenu = metrics.hasMenu;
  const applied: ToolbarLayoutStep[] = [];

  for (const step of steps) {
    if (width <= available) break;

    if (step.kind === 'shrink') {
      const saved = metrics.label[step.id] ?? 0;
      if (saved <= 0) continue;
      width -= saved;
    } else {
      const saved =
        (metrics.entry[step.id] ?? 0) - (hasMenu ? 0 : metrics.menuCost);
      if (saved <= 0) continue;
      width -= saved;
      hasMenu = true;
    }

    applied.push(step);
  }

  return applied;
}
