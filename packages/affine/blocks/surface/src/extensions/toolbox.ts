import type { SerializedElementProps } from './interchange.js';

/**
 * A framework's TOOLBOX, with no editor behind it (`docs/adr/0045`): every
 * item of its toolbar as a pure builder, so a host with no editor — the Labre
 * workspace connector, labre-mcp — places the very elements a user places
 * from the toolbar, never shapes that imitate them.
 *
 * ## The same contract as a reader's result
 *
 * A builder returns what an import capability returns (ADR 0012 D3): element
 * props in painting order, each composite's members before the group that
 * holds them, and LOCAL `id`s the group's `children` and a link's ends name.
 * `surface.addElement` mints the real ids and the materializer
 * (`materializeInterchangeImport`) rewrites the references, so one writer
 * serves a whole file read by a reader and one item built here.
 *
 * ## What a builder does not do
 *
 * It places ONE item at the point it is given: where things go on a board is
 * the caller's. It writes the texts it is given, or the English seed: a seed
 * in the host's language is resolved by the editor's creation site, which has
 * the catalogue (ADR 0023). It persists nothing.
 */

/** Where an item lands: the top-left of its box, in canvas units. */
export interface ToolboxPoint {
  x: number;
  y: number;
}

/** One toolbar item that places elements. */
export interface ToolboxItem {
  /** Stable within the framework, kebab-case: `container`, `system-boundary`. */
  readonly id: string;
  /** The toolbar command's own label, so a host names it as the toolbar does. */
  readonly labelKey: string;
  readonly labelFallback: string;
  /** The text slots `build` fills, in reading order (`title`, `description`…). */
  readonly texts: readonly string[];
  /** The box the item is born with. */
  readonly size: { readonly w: number; readonly h: number };
  /**
   * The elements, with local ids and the group last. `local` prefixes those
   * ids, so two items built for one batch never share a name.
   */
  build(
    at: ToolboxPoint,
    texts?: Readonly<Record<string, string>>,
    local?: string
  ): SerializedElementProps[];
}

/** One relation style of the framework: a connector between two elements. */
export interface ToolboxLink {
  readonly id: string;
  readonly labelKey: string;
  readonly labelFallback: string;
  /** The connector props; `from` and `to` are element ids or local ids. */
  build(from: string, to: string, label?: string): SerializedElementProps;
}

export interface FrameworkToolbox {
  /** The framework's descriptor id (`c4`, `bpmn`…). */
  readonly framework: string;
  readonly items: readonly ToolboxItem[];
  readonly links: readonly ToolboxLink[];
}
