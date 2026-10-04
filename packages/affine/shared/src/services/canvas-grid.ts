import { LifeCycleWatcher } from '@labre/std';
import {
  GfxControllerIdentifier,
  type SurfaceBlockModel,
} from '@labre/std/gfx';
import { computed, type ReadonlySignal, signal } from '@preact/signals-core';

import { EditPropsStore } from './edit-props-store.js';
import { EditorSettingProvider } from './editor-setting-service.js';

/** Who decided the grid this viewer sees (ADR 0031 §11). */
export type CanvasGridSource = 'local' | 'document' | 'host' | 'library';

/**
 * The four levels of ADR 0031 §11, nearest decision first: the viewer's own
 * override, the document's "saved for everyone" setting, the host's default
 * (`edgelessShowGrid`), and the library default — on. `undefined` at a level
 * means "nobody decided here".
 */
export function resolveCanvasGrid(levels: {
  local?: boolean;
  document?: boolean;
  host?: boolean;
}): { visible: boolean; source: CanvasGridSource } {
  if (levels.local !== undefined) {
    return { visible: levels.local, source: 'local' };
  }
  if (levels.document !== undefined) {
    return { visible: levels.document, source: 'document' };
  }
  if (levels.host !== undefined) {
    return { visible: levels.host, source: 'host' };
  }
  return { visible: true, source: 'library' };
}

/**
 * What a surface stored for everyone, read reactively. Previews (the
 * read-only edgeless preview, a surface-ref) follow THIS and the library
 * default only: they are a picture of the document, not a viewer's session,
 * so neither a viewer override nor a host default reaches them.
 */
export function documentShowsGrid(
  surface: SurfaceBlockModel | null | undefined
): boolean {
  return surface?.props.showGrid$.value !== false;
}

/**
 * The canvas grid as THIS viewer sees it (ADR 0031 §11).
 *
 * - **The toggle is local**: it writes the viewer's override, an
 *   `EditPropsStore` `localStorage` prop keyed by document id like the
 *   viewport, so it survives a reload and produces no Yjs update — a reader
 *   may toggle it too.
 * - **"Save for everyone"** writes the current state into the surface's
 *   `showGrid` and clears the saver's override, so they see what everyone
 *   sees. Refused on a read-only store; writes nothing when the document
 *   already says the same.
 *
 * Both containers that paint the grid (the edgeless root's background and
 * the surface container) and the PNG export read `visible$`.
 */
export class CanvasGrid extends LifeCycleWatcher {
  static override key = 'canvas-grid';

  private readonly _local$ = signal<boolean | undefined>(undefined);

  private readonly _resolved$ = computed(() =>
    resolveCanvasGrid({
      local: this._local$.value,
      document: this._surface()?.props.showGrid$.value,
      host: this.std.getOptional(EditorSettingProvider)?.setting$.value
        .edgelessShowGrid,
    })
  );

  /** Whether this viewer sees the grid. */
  readonly visible$: ReadonlySignal<boolean> = computed(
    () => this._resolved$.value.visible
  );

  /** Which level decided `visible$`. */
  readonly source$: ReadonlySignal<CanvasGridSource> = computed(
    () => this._resolved$.value.source
  );

  private _surface(): SurfaceBlockModel | null {
    return this.std.get(GfxControllerIdentifier).surface$.value;
  }

  /**
   * Flip the grid for this viewer only. Answers the new visibility.
   */
  toggle(): boolean {
    const visible = !this.visible$.peek();
    this._local$.value = visible;
    this.std.getOptional(EditPropsStore)?.setStorage('localShowGrid', visible);
    return visible;
  }

  /**
   * Store what this viewer sees as the document's setting, and drop their
   * override. Answers the saved value, or `null` when nothing was written
   * (read-only store, no surface, or the document already said so).
   */
  saveForEveryone(): boolean | null {
    const surface = this._surface();
    if (!surface || this.std.store.readonly) return null;
    const visible = this.visible$.peek();
    this._clearLocal();
    if (surface.props.showGrid === visible) return null;
    this.std.store.captureSync();
    this.std.store.transact(() => {
      surface.props.showGrid = visible;
    });
    this.std.store.captureSync();
    return visible;
  }

  private _clearLocal() {
    if (this._local$.peek() === undefined) return;
    this._local$.value = undefined;
    this.std.getOptional(EditPropsStore)?.removeStorage('localShowGrid');
  }

  override mounted() {
    super.mounted();
    const stored = this.std
      .getOptional(EditPropsStore)
      ?.getStorage('localShowGrid');
    this._local$.value = stored ?? undefined;
  }
}
