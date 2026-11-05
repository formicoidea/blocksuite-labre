export type ArrowKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

/**
 * What an arrow keystroke on the canvas does.
 *
 * - `move`: nudge the selection (1px, 10px with Shift), or walk a mind map.
 * - `menu`: step the highlight of the open framework sub-menu.
 * - `toolbar`: step the keyboard highlight along the toolbar's buttons.
 * - `none`: the canvas leaves the keystroke alone (the browser or the editor
 *   that has focus keeps it).
 */
export type ArrowRoute =
  | { kind: 'move'; key: ArrowKey; shift: boolean }
  | { kind: 'menu'; dir: 1 | -1 }
  | { kind: 'toolbar'; dir: 1 | -1 }
  | { kind: 'none' };

export interface ArrowKeyContext {
  key: ArrowKey;
  alt: boolean;
  shift: boolean;
  /** A canvas text editor has the keystroke. */
  editing: boolean;
  /** A framework sub-menu is open on the toolbar. */
  menuOpen: boolean;
}

/**
 * The arrows MOVE what is selected, menu open or not; Alt is what reaches the
 * chrome (PO, recette P7-17, 2026-11-02). The first cut let a plain ←/→ walk an
 * open sub-menu, which took the canvas's own gesture away exactly while the
 * user was placing things from that menu.
 *
 * Alt+↑/↓ is left alone: both the sub-menu and the toolbar are rows, and
 * Mod-Alt-↑/↓ already belongs to the note block.
 */
export function routeArrowKey(ctx: ArrowKeyContext): ArrowRoute {
  if (ctx.editing) return { kind: 'none' };
  if (!ctx.alt) return { kind: 'move', key: ctx.key, shift: ctx.shift };
  if (ctx.shift) return { kind: 'none' };
  if (ctx.key !== 'ArrowLeft' && ctx.key !== 'ArrowRight') {
    return { kind: 'none' };
  }
  const dir = ctx.key === 'ArrowRight' ? 1 : -1;
  return ctx.menuOpen ? { kind: 'menu', dir } : { kind: 'toolbar', dir };
}
