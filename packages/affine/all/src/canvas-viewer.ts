import {
  StoreExtensionManager,
  ViewExtensionManager,
} from '@labre/affine-ext-loader';
import { panByWheel, pinchStep, zoomAtPointer } from '@labre/affine-block-root';
import { ViewportElementExtension } from '@labre/affine-shared/services';
import {
  isSafeLinkUrl,
  isTouchPadPinchEvent,
} from '@labre/affine-shared/utils';
import { BlockStdScope, LifeCycleWatcher } from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import { type ExtensionType, WorkspaceImpl } from '@labre/store';
import type { BlobSource } from '@labre/sync';
import { combinedLightCssVariables } from '@toeverything/theme';
import {
  type AffineThemeKeyV2,
  lightThemeV2,
  themeToVar,
} from '@toeverything/theme/v2';
import * as Y from 'yjs';

import { getInternalStoreExtensions } from './extensions/store.js';
import { getInternalViewExtensions } from './extensions/view.js';

/**
 * `@labre/affine/canvas-viewer` — a read-only canvas a host mounts from a
 * stored Y.Doc state, with no editor around it (ADR 0050). Labre Sites mounts
 * it as the client-side island of a published canvas page.
 *
 * It is the `preview-edgeless` scope the surface reference and the frame panel
 * already draw, plus one runtime extension that gives the picture back its
 * hands: pan (drag, wheel, two fingers), zoom (ctrl+wheel, trackpad pinch, two
 * fingers, the controller's buttons) and a click on a link. Nothing edits: the
 * store is opened `readonly`, and every pointer, wheel and click event stops
 * on the viewer's own container, in capture, before the blocks see it.
 *
 * **Cost.** It imports the whole view graph, as the ADR measured: a host loads
 * this entry with a dynamic `import()` on a page that holds a canvas. Making it
 * lighter means splitting `getInternalViewExtensions`, a separate decision.
 */

export type CanvasViewerOptions = {
  /**
   * The reader clicked something linked to a page of the workspace: an inline
   * page reference, a linked or synced doc card. Without it, nothing happens.
   */
  onOpenDoc?: (docId: string) => void;
  /**
   * The reader clicked an external link (an inline link, a bookmark, an embed
   * card); the URL has passed `isSafeLinkUrl`. Without it, the page navigates.
   */
  onLinkClick?: (url: string) => void;
  /**
   * Reads a blob the canvas shows (an image). Without it, nothing is fetched
   * and an image keeps its placeholder.
   */
  getBlob?: (blobId: string) => Promise<Blob | null>;
};

export type CanvasViewer = {
  zoomIn(): void;
  zoomOut(): void;
  /** Frames every element of the canvas; also done once at mount. */
  fit(): void;
  /** Unmounts the viewer and empties its container. Idempotent. */
  dispose(): void;
};

/** A zoom button's step: the editor's own zoom bar uses the same ratio. */
const ZOOM_STEP_RATIO = 1.25;

/** Past this distance, in CSS pixels, a press is a pan, not a click. */
const CLICK_SLOP_PX = 4;

/** The flavours a click opens as a page of the workspace. */
const DOC_CARD_FLAVOURS = new Set([
  'affine:embed-linked-doc',
  'affine:embed-synced-doc',
]);

function readOnlyBlobSource(
  read: (blobId: string) => Promise<Blob | null>
): BlobSource {
  return {
    name: 'canvas-viewer',
    readonly: true,
    get: read,
    set: () => Promise.reject(new Error('the canvas viewer is read-only')),
    delete: () => Promise.resolve(),
    list: () => Promise.resolve([]),
  };
}

/** The page a click lands on, or the external URL, read from the DOM path. */
function linkOf(
  path: EventTarget[],
  blockModel: (id: string) => { flavour: string; props: object } | undefined
): { docId: string } | { url: string } | null {
  for (const target of path) {
    if (!(target instanceof HTMLElement)) continue;
    if (target.tagName === 'AFFINE-REFERENCE') {
      const pageId = (
        target as HTMLElement & {
          referenceInfo?: { pageId?: string };
        }
      ).referenceInfo?.pageId;
      if (pageId) return { docId: pageId };
    }
    if (target instanceof HTMLAnchorElement && target.href) {
      return { url: target.href };
    }
    const blockId = target.dataset.blockId;
    if (!blockId) continue;
    const model = blockModel(blockId);
    if (!model) continue;
    const props = model.props as { pageId?: unknown; url?: unknown };
    if (
      DOC_CARD_FLAVOURS.has(model.flavour) &&
      typeof props.pageId === 'string'
    ) {
      return { docId: props.pageId };
    }
    if (typeof props.url === 'string' && props.url) return { url: props.url };
  }
  return null;
}

/**
 * Opens `state` read-only and mounts the canvas in `host`, which the viewer
 * fills (give it a size). Throws when the state holds no page: a host shows
 * its fallback then.
 */
export function mountCanvasViewer(
  host: HTMLElement,
  state: Uint8Array,
  options: CanvasViewerOptions = {}
): CanvasViewer {
  const workspace = new WorkspaceImpl({
    id: 'canvas-viewer',
    ...(options.getBlob
      ? { blobSources: { main: readOnlyBlobSource(options.getBlob) } }
      : {}),
  });
  workspace.storeExtensions = new StoreExtensionManager(
    getInternalStoreExtensions()
  ).get('store');
  workspace.meta.initialize();
  const doc = workspace.createDoc('canvas-viewer');
  Y.applyUpdate(doc.spaceDoc, state);
  const store = doc.getStore({ readonly: true });
  store.load();
  if (!store.root) {
    workspace.dispose();
    throw new Error('the canvas viewer was given a state with no page');
  }

  const container = document.createElement('div');
  container.dataset.labreCanvasViewer = '';
  const box = container.style;
  box.position = 'relative';
  box.width = '100%';
  box.height = '100%';
  box.overflow = 'hidden';
  box.touchAction = 'none';
  box.userSelect = 'none';
  // The light theme, on this container only: the page around keeps its own.
  // Built from names already in the theme contract (`theme-imports.unit.spec`):
  // a host that substitutes the theme package needs to export nothing more.
  Object.entries(combinedLightCssVariables).forEach(([name, value]) =>
    box.setProperty(name, value)
  );
  (Object.keys(lightThemeV2) as AffineThemeKeyV2[]).forEach(key =>
    box.setProperty(themeToVar(key), lightThemeV2[key])
  );
  // The preview root turns pointer events off on itself (a picture, ADR 0050);
  // the viewer reads the path of a click, so they come back, here only.
  const style = document.createElement('style');
  style.textContent =
    '[data-labre-canvas-viewer] affine-edgeless-root-preview{pointer-events:auto}';
  container.append(style);

  let std: BlockStdScope | null = null;

  class CanvasViewerUnlock extends LifeCycleWatcher {
    static override key = 'canvas-viewer-unlock';

    override mounted() {
      // After `EdgelessLocker`: this viewer moves, the other previews do not.
      this.std.get(GfxControllerIdentifier).viewport.locked = false;
      requestAnimationFrame(() => viewer.fit());
    }
  }

  const extensions: ExtensionType[] = [
    ...new ViewExtensionManager(getInternalViewExtensions()).get(
      'preview-edgeless'
    ),
    // The viewport is this container, as `.ref-viewport` is the surface
    // reference's: the preview root measures it and follows its resizes.
    ViewportElementExtension('[data-labre-canvas-viewer]'),
    CanvasViewerUnlock,
  ];
  std = new BlockStdScope({ store, extensions });
  const editorHost = std.render();
  container.append(editorHost);
  host.append(container);

  const gfx = () => std?.get(GfxControllerIdentifier);
  const pointers = new Map<number, { x: number; y: number }>();
  let travelled = 0;

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const viewport = gfx()?.viewport;
    if (!viewport) return;
    if (isTouchPadPinchEvent(e)) {
      zoomAtPointer(viewport, e, container.getBoundingClientRect());
    } else {
      panByWheel(viewport, e);
    }
  };

  const local = (e: PointerEvent) => {
    const rect = container.getBoundingClientRect();
    return { x: e.clientX - rect.x, y: e.clientY - rect.y };
  };

  const onPointerDown = (e: PointerEvent) => {
    e.stopPropagation();
    if (pointers.size === 0) travelled = 0;
    pointers.set(e.pointerId, local(e));
    container.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent) => {
    e.stopPropagation();
    const last = pointers.get(e.pointerId);
    const viewport = gfx()?.viewport;
    if (!last || !viewport) return;
    const next = local(e);
    const delta = { x: next.x - last.x, y: next.y - last.y };
    travelled += Math.abs(delta.x) + Math.abs(delta.y);
    pointers.set(e.pointerId, next);

    if (pointers.size === 1) {
      viewport.applyDeltaCenter(
        -delta.x / viewport.zoom,
        -delta.y / viewport.zoom
      );
      return;
    }
    const [other] = [...pointers].find(([id]) => id !== e.pointerId) ?? [];
    const second = other === undefined ? undefined : pointers.get(other);
    if (!second) return;
    pinchStep(
      viewport,
      { ...next, delta },
      { ...second, delta: { x: 0, y: 0 } }
    );
  };

  const onPointerUp = (e: PointerEvent) => {
    e.stopPropagation();
    pointers.delete(e.pointerId);
  };

  const onClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (travelled > CLICK_SLOP_PX) return;
    const link = linkOf(e.composedPath(), id => {
      const model = store.getBlock(id)?.model;
      return model ? { flavour: model.flavour, props: model.props } : undefined;
    });
    if (!link) return;
    if ('docId' in link) {
      options.onOpenDoc?.(link.docId);
      return;
    }
    if (!isSafeLinkUrl(link.url)) return;
    if (options.onLinkClick) options.onLinkClick(link.url);
    else window.location.assign(link.url);
  };

  const listeners: [string, EventListener][] = [
    ['wheel', onWheel as EventListener],
    ['pointerdown', onPointerDown as EventListener],
    ['pointermove', onPointerMove as EventListener],
    ['pointerup', onPointerUp as EventListener],
    ['pointercancel', onPointerUp as EventListener],
    ['click', onClick as EventListener],
    // Nothing reaches the blocks: no double-click edit, no context menu.
    ['dblclick', (e: Event) => e.stopPropagation()],
    ['contextmenu', (e: Event) => e.stopPropagation()],
  ];
  listeners.forEach(([type, listener]) =>
    container.addEventListener(type, listener, {
      capture: true,
      passive: false,
    })
  );

  const zoomBy = (ratio: number) => {
    const viewport = gfx()?.viewport;
    if (!viewport) return;
    viewport.setZoom(viewport.zoom * ratio);
  };

  const viewer: CanvasViewer = {
    zoomIn: () => zoomBy(ZOOM_STEP_RATIO),
    zoomOut: () => zoomBy(1 / ZOOM_STEP_RATIO),
    fit: () => gfx()?.fitToScreen(),
    dispose: () => {
      if (!std) return;
      listeners.forEach(([type, listener]) =>
        container.removeEventListener(type, listener, { capture: true })
      );
      container.remove();
      std = null;
      workspace.dispose();
    },
  };
  return viewer;
}
