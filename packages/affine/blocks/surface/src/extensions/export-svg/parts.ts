import { LEGEND_ROLE } from '../legend.js';

/**
 * What "Export SVG" puts in the file — the three switches of its options menu,
 * all on by default (ADR 0025, amendment of 2026-10-04).
 */
export interface BoardSvgExportOptions {
  /** The board, its framework's artefacts and its generated legend. */
  framework: boolean;
  /** Every other canvas element that is not a text: shapes, connectors, strokes. */
  shapes: boolean;
  /** Every other text: canvas texts, and the edgeless text blocks. */
  texts: boolean;
}

export type BoardSvgExportPart = keyof BoardSvgExportOptions;

export const DEFAULT_BOARD_SVG_EXPORT_OPTIONS: Readonly<BoardSvgExportOptions> =
  Object.freeze({ framework: true, shapes: true, texts: true });

/**
 * The options a command invocation carries, re-validated: the palette and the
 * agent pass nothing and get everything, and only an explicit `false` switches
 * a part off — a stray value never empties a file.
 */
export function boardSvgExportOptions(params: unknown): BoardSvgExportOptions {
  const given = (
    params !== null && typeof params === 'object' ? params : {}
  ) as Partial<Record<BoardSvgExportPart, unknown>>;
  return {
    framework: given.framework !== false,
    shapes: given.shapes !== false,
    texts: given.texts !== false,
  };
}

/**
 * The stored facts the rule reads, and nothing else: an element's `role` and
 * `type`, and a group's `childElements`. Structural, so the rule runs over a
 * real model and over a recorded creation alike.
 */
export interface SvgExportCandidate {
  readonly role?: string;
  readonly type?: string;
  readonly childElements?: readonly SvgExportCandidate[];
}

/** `'wardley:component'` → `'wardley'`; nothing for a missing or empty role. */
const namespaceOf = (role: string | undefined) =>
  role?.split(':')[0] || undefined;

/**
 * Which switch an element on `board` answers to.
 *
 * - **Framework elements**: the board itself; anything whose role shares the
 *   board's role namespace (`wardley:map` owns `wardley:component`,
 *   `wardley:label`, `wardley:dependency`…); the generated legend
 *   (`core:legend`, ADR 0026) and every glyph in it; and a ROLE-LESS element
 *   grouped with any of those. The last clause is what a framework artefact is
 *   made of: an EDGY person and its name, a Wardley market and its three dots,
 *   a Core Domain sub-domain and its title are one group in which only one
 *   member carries the role.
 * - **Other texts**: any other `text` element — a plain one, or one of ANOTHER
 *   framework lying on this board, which is a text like any other here.
 * - **Other shapes and strokes**: everything else — plain shapes, plain
 *   connectors, brush and highlighter strokes, mind maps, another framework's
 *   shapes, and a plain group (which paints nothing of its own in an export).
 *
 * Read off the namespace rather than a `FrameworkId` on purpose: three DDD
 * frameworks spell their roles `es:`, `core-domain:` and `context-map:`, and
 * the board says which one it speaks. A board with no role (Cynefin, which
 * paints its domains itself) owns itself and nothing else. Edgeless text
 * BLOCKS never reach this function: they carry no role and are always "other
 * texts" ({@link selectBoardSvgParts}).
 */
export function boardSvgExportPartOf(
  board: SvgExportCandidate,
  element: SvgExportCandidate,
  groups: readonly SvgExportCandidate[]
): BoardSvgExportPart {
  if (element === board) return 'framework';

  const own = namespaceOf(board.role);
  const owned = (role: string | undefined) =>
    role === LEGEND_ROLE || (own !== undefined && namespaceOf(role) === own);

  if (owned(element.role)) return 'framework';
  if (element.role === undefined) {
    const enclosing = element.childElements ? [element, ...groups] : groups;
    const ownedGroup = enclosing.some(
      group =>
        owned(group.role) ||
        group.childElements?.some(child => owned(child.role))
    );
    if (ownedGroup) return 'framework';
  }
  return element.type === 'text' ? 'texts' : 'shapes';
}

/**
 * What the file draws under `options`: the canvas elements, in the paint order
 * they came in, and the edgeless text blocks, which are all "other texts".
 */
export function selectBoardSvgParts<E extends SvgExportCandidate, B>(
  board: SvgExportCandidate,
  elements: readonly E[],
  textBlocks: readonly B[],
  options: Readonly<BoardSvgExportOptions>,
  groupsOf: (element: E) => readonly SvgExportCandidate[]
): { elements: E[]; textBlocks: B[] } {
  return {
    elements: elements.filter(
      element =>
        options[boardSvgExportPartOf(board, element, groupsOf(element))]
    ),
    textBlocks: options.texts ? [...textBlocks] : [],
  };
}
