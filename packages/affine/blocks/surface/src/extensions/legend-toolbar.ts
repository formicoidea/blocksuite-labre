import {
  BOARD_LEGEND_NOTATION,
  TelemetryProvider,
  type ChromeWording,
  type FrameworkElementEvent,
  type ToolbarAction,
  type ToolbarContext,
} from '@labre/affine-shared/services';
import type { BlockStdScope, CommandOwner } from '@labre/std';
import { html, type TemplateResult } from 'lit';

import { createBoardLegend } from './legend.js';

/**
 * The legend BUTTON — one factory and one emitter for every framework that has
 * a legend, where there were seven copies of the same twenty lines.
 *
 * The legend deliberately stays a BUTTON and never becomes a command (PO
 * arbitration of 27/08/2026, R6 of `docs/add-a-framework/02-framework-rules.md`):
 * generating one belongs to a board you have SELECTED and to nothing else, so
 * it is absent from the catalogue, the palette and Settings › Shortcuts — and
 * the command registry's per-framework counts must not move because of it.
 *
 * The cost of staying outside `runCommand` is that the telemetry it owes is
 * emitted by hand. {@link trackLegendCreated} is where, once, so the wire
 * values cannot drift apart across seven files again.
 */

/**
 * The HISTORICAL PostHog value of the `framework` dimension — `context-map`,
 * not `ddd-context-map`, and `event-storming`, not `ddd-event-storming`. Taken
 * from the event's own closed union rather than restated, so a framework that
 * never joined the taxonomy cannot be passed here by mistake.
 */
export type LegendFramework = FrameworkElementEvent['framework'];

/**
 * Contextual-toolbar glyph — "generate the legend of what is on this board".
 * One icon because it is one gesture; the Core Domain chart has drawn this exact
 * box-and-rows since its legend button shipped and the others borrowed it.
 *
 * `html` rather than `svg`: a toolbar action's `icon` is rendered as a
 * standalone template, unlike the senior-button glyphs that are interpolated
 * into an outer `<svg>`.
 */
export const legendIcon = html`<svg
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
>
  <rect
    x="3"
    y="4"
    width="18"
    height="16"
    rx="2"
    stroke="currentColor"
    stroke-width="1.6"
  />
  <circle cx="7" cy="9" r="1.6" fill="currentColor" />
  <circle cx="7" cy="14" r="1.6" fill="currentColor" />
  <path d="M11 9 H18 M11 14 H18" stroke="currentColor" stroke-width="1.4" />
</svg>`;

/**
 * The ONE `FrameworkLegendCreated` emission, with the wire values every
 * framework's own button has been sending.
 *
 * `framework` is the HISTORICAL PostHog value (`FrameworkDescriptor.
 * telemetryKey`): `context-map`, not `ddd-context-map`. It is a parameter and
 * not derived from anything, because the two spellings differ for three of the
 * eight frameworks and a prefix rule would quietly rename a metric.
 */
export function trackLegendCreated(
  std: BlockStdScope,
  framework: LegendFramework,
  module: string
): void {
  std.getOptional(TelemetryProvider)?.track('FrameworkLegendCreated', {
    framework,
    element: 'legend',
    page: 'whiteboard editor',
    segment: 'element toolbar',
    module,
  });
}

export interface LegendToolbarActionOptions<M extends { xywh: string }> {
  /**
   * Sort key inside the row, and NOT a constant across frameworks: the toolbar
   * orders lexicographically by id, so a legend that must land after "remove a
   * lane" is `c.legend` while C4's is `b.legend` and Wardley's `d.legend`.
   * Defaults to `b.legend`, the commonest.
   */
  id?: string;
  /** The board element this button documents — how it finds it in the selection. */
  Model: abstract new (...args: any[]) => M;
  /** Whose commands the rows are derived from. See {@link createBoardLegend}. */
  owner: CommandOwner;
  /** The HISTORICAL telemetry value. See {@link trackLegendCreated}. */
  framework: LegendFramework;
  /**
   * The `module` dimension. Defaults to `` `${framework} toolbar` ``, which is
   * what six of the seven buttons send; UML's is `uml toolbox` and says so.
   */
  module?: string;
  tooltipWording?: ChromeWording;
  icon?: TemplateResult;
}

/**
 * The shared legend entry of a board's contextual toolbar.
 *
 * Registered by each framework in its OWN flag-gated module
 * (`custom:affine:surface:<board>`), merged with `validationToolbarConfig`'s
 * actions: a flavour may carry exactly one toolbar module, and generating a
 * legend is tooling a flag may take away. What the gesture already WROTE is
 * document content and keeps being painted with the flag off — the box is made
 * of plain shapes, text and the framework's own always-on renderers.
 */
export function legendToolbarAction<M extends { xywh: string }>({
  id = 'b.legend',
  Model,
  owner,
  framework,
  module = `${framework} toolbar`,
  tooltipWording = BOARD_LEGEND_NOTATION,
  icon = legendIcon,
}: LegendToolbarActionOptions<M>): ToolbarAction {
  const boardOf = (ctx: ToolbarContext) =>
    ctx.getSurfaceModelsByType(Model)[0] as unknown as
      | { xywh: string }
      | undefined;
  return {
    id,
    tooltipWording,
    icon,
    run(ctx: ToolbarContext) {
      if (ctx.std.store.readonly) return;
      // The FIRST selected board and no other: a legend is placed relative to
      // one board, and two of them would put two boxes on top of whatever sits
      // in that corner.
      const board = boardOf(ctx);
      if (!board) return;
      createBoardLegend(ctx.std, board, owner);
      trackLegendCreated(ctx.std, framework, module);
    },
    when: (ctx: ToolbarContext) => boardOf(ctx) !== undefined,
  };
}
