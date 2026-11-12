// First, so its top level runs before any block module evaluates.
import { adoptViewerPageStyles } from './canvas-viewer-styles.js';
import { CodeBlockConfigExtension } from '@labre/affine-block-code';
import { FrameBlockComponent } from '@labre/affine-block-frame';
import {
  getSurfaceBlock,
  getSurfaceComponent,
} from '@labre/affine-block-surface';
import {
  StoreExtensionManager,
  ViewExtensionManager,
  type ViewExtensionProvider,
} from '@labre/affine-ext-loader';
import { FrameBlockModel, GroupElementModel } from '@labre/affine-model';
import {
  CHROME_DELETED_DOC,
  LINKED_DOC_DELETED,
  TranslationExtension,
  translateKey,
  TranslationProvider,
  type TranslationService,
  ViewportElementExtension,
} from '@labre/affine-shared/services';
import { isSafeLinkUrl, normalizeUrl } from '@labre/affine-shared/utils';
import { frameTitleStyleVars } from '@labre/affine-widget-frame-title';
import { Container } from '@labre/global/di';
import { DisposableGroup } from '@labre/global/disposable';
import { Bound } from '@labre/global/gfx';
import { BlockStdScope, LifeCycleWatcher } from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import {
  type ExtensionType,
  type Store,
  Text,
  WorkspaceImpl,
} from '@labre/store';
import type { BlobSource } from '@labre/sync';
import { combinedLightCssVariables } from '@toeverything/theme';
import {
  type AffineThemeKeyV2,
  lightThemeV2,
  themeToVar,
} from '@toeverything/theme/v2';
import * as Y from 'yjs';

import { getInternalStoreExtensions } from './extensions/store.js';
import { getReadOnlyViewExtensions } from './extensions/view.js';

/**
 * `@labre/affine/canvas-viewer` — a published canvas, read-only, on a host's
 * public page (Labre Sites mounts it as the island of a canvas page or of a
 * frame inserted in a page).
 *
 * It is the edgeless editor itself, mounted on a read-only store (ADR 0051):
 * the view registry the editor is built from, plus what the host adds for its
 * own editor (each framework bundle), minus the tooling listed beside the
 * registry in `READ_ONLY_EXCLUDED_VIEW_EXTENSIONS`. It holds no rendering of
 * its own: a block or a notation the editor paints, it paints, and a change to
 * the editor reaches it without touching it. On a read-only store the editor
 * takes the pan tool, so a drag, the wheel, two fingers and the pinch move the
 * canvas as they do in the editor.
 *
 * What is the viewer's: the host's integration (links, the frozen view of a
 * frame, framing, the light theme) and holding under a public page's strict
 * Content-Security-Policy (adopted style sheets, no WebAssembly).
 *
 * **Cost.** It imports the whole view graph: a host loads this entry with a
 * dynamic `import()` on a page that holds a canvas.
 */

export type CanvasViewerOptions = {
  /**
   * What the host adds to the registry for its own editor: each framework
   * bundle's view extensions (`descriptor.extensions[].viewExtension`), the
   * database editing chrome. Without them, a framework's notation is not
   * painted: the published core leaves the frameworks to their bundles.
   */
  viewExtensions?: readonly (typeof ViewExtensionProvider)[];
  /**
   * The reader clicked something linked to a page of the workspace that
   * `docTitles` names: an inline page reference, a linked or synced doc card.
   * A page `docTitles` leaves out is never opened. Without it, nothing
   * happens. The id is whatever the document stores: treat it as untrusted
   * input.
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
  /**
   * Shows one frame or group, as the surface reference block shows it in a
   * page: the view takes the element's proportions (`aspect-ratio`, height
   * `auto`: give the host a width only) and frames its bounds, a frame edge to
   * edge with its border hidden and, when it has a title, its title badge
   * above it as the editor draws it, a group with a 20px margin. Throws when the
   * state holds no element of that kind under that id.
   */
  focus?: CanvasViewerFocus;
  /**
   * Whether the reader pans and zooms. Defaults to `true` without `focus` and
   * `false` with it: a frozen view lets the page scroll over it, follows no
   * link, and calls `onExpand` on a click or on Enter, the way the editor
   * opens a surface reference. The host opens the larger view itself, usually
   * by mounting the same `focus` with `interactive: true`.
   */
  interactive?: boolean;
  /** A frozen view was clicked, or activated from the keyboard. */
  onExpand?: () => void;
  /**
   * The pages the reader may see, by id, with their titles, as a page
   * reference and a linked or synced doc card display them. A page left out
   * (not shared, not public, or deleted: the viewer cannot tell) is named
   * "Access denied" (`com.labre.canvas-viewer.access-denied`) wherever the
   * editor would say it is deleted, a synced doc of it shows no content, and
   * a click on it opens nothing.
   */
  docTitles?: Readonly<Record<string, string>>;
};

export type CanvasViewerFocus = { kind: 'frame' | 'group'; id: string };

/**
 * The canvas text faces, one per family, weight and style, as the editor
 * offers them; also at `@labre/affine/shared/services`. The viewer loads no
 * face itself: a public page that serves these files itself declares them,
 * with its own URLs, beside the viewer. Re-exported here so that page needs
 * this entry only (Labre Sites reads it).
 */
export { CommunityCanvasTextFonts } from '@labre/affine-shared/services';

export type CanvasViewer = {
  zoomIn(): void;
  zoomOut(): void;
  /**
   * Frames the focused element, or every element of the canvas without
   * `focus`; also done once at mount.
   */
  fit(): void;
  /** Unmounts the viewer and empties its container. Idempotent. */
  dispose(): void;
};

/** A zoom button's step: the editor's own zoom bar uses the same ratio. */
const ZOOM_STEP_RATIO = 1.25;

/** Past this distance, in CSS pixels, a press is a pan, not a click. */
const CLICK_SLOP_PX = 4;

/**
 * The strip a frame's title badge takes above its top edge, in screen pixels:
 * the editor draws the badge there (`frame-title.ts`, a frame not nested in
 * another), so a focused frame keeps that strip in view and shows its badge
 * as the editor does.
 */
const FRAME_BADGE_PX =
  frameTitleStyleVars.height +
  // Its 1px border, top and bottom, outside its content height.
  2 +
  frameTitleStyleVars.nestedFrameOffset;

/** The margin the surface reference block leaves around a group. */
const GROUP_PADDING: [number, number, number, number] = [20, 20, 20, 20];

let viewerSheet: CSSStyleSheet | null = null;

/**
 * What `@blocksuite/icons` binds on each icon as a `style` attribute, which a
 * policy without `style-src-attr 'unsafe-inline'` drops: in an adopted sheet,
 * added once, so an icon never shrinks. The icon of a page reference, inline
 * in its text, also asks for `vertical-align: middle`
 * (`DocDisplayMetaService`'s icons, the subpage icon of `reference-node.ts`):
 * without it the icon sits on the baseline. Their `font-size: inherit` is what
 * an `svg` does anyway, and the subpage icon's `margin-bottom: 0.1em` stays
 * dropped (a tenth of a line).
 */
function adoptViewerStyles(): void {
  if (viewerSheet) return;
  viewerSheet = new CSSStyleSheet();
  viewerSheet.replaceSync(
    '[data-labre-canvas-viewer] svg{user-select:none;flex-shrink:0}' +
      '[data-labre-canvas-viewer] affine-reference svg{vertical-align:middle}'
  );
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, viewerSheet];
}

/**
 * The bounds and the stored title of the focused element, read before
 * anything mounts, so a missing one throws to the host like a bad state.
 */
function resolveFocus(
  store: Store,
  focus: CanvasViewerFocus
): { bound: Bound; title: string } | null {
  if (focus.kind === 'frame') {
    const model = store.getBlock(focus.id)?.model;
    if (!(model instanceof FrameBlockModel)) return null;
    return {
      bound: Bound.deserialize(model.xywh),
      title: model.props.title.toString(),
    };
  }
  const element = getSurfaceBlock(store)?.getElementById(focus.id);
  if (!(element instanceof GroupElementModel)) return null;
  return {
    bound: Bound.deserialize(element.xywh),
    title: element.title.toString(),
  };
}

/**
 * What the editor says of a page that is gone, and what the viewer says
 * instead: it is only given the pages its reader may see, so a page it lacks
 * may be private, unshared or deleted.
 */
const DENIED_WORDINGS = new Map<string, readonly [string, string]>([
  [
    CHROME_DELETED_DOC[0],
    ['com.labre.canvas-viewer.access-denied', 'Access denied'],
  ],
  [
    LINKED_DOC_DELETED[0],
    [
      'com.labre.canvas-viewer.access-denied.description',
      'You do not have access to this page.',
    ],
  ],
]);

/**
 * The host's translation, if one of its providers registers it, read from a
 * container of its own before the viewer's: the viewer wraps it rather than
 * replace it.
 */
function hostTranslationOf(
  providers: readonly (typeof ViewExtensionProvider)[] = []
): TranslationService | null {
  if (!providers.length) return null;
  const container = new Container();
  new ViewExtensionManager([...providers])
    .get('edgeless')
    .forEach(extension => extension.setup(container));
  return container.provider().getOptional(TranslationProvider);
}

/** The host's translation, with "Access denied" where the editor says deleted. */
function accessDeniedTranslation(
  host: TranslationService | null
): TranslationService {
  return {
    t: (key, params) => {
      const denied = DENIED_WORDINGS.get(key);
      if (!denied) return host?.t(key, params);
      const [deniedKey, fallback] = denied;
      return host?.t(deniedKey, params) || fallback;
    },
    get language() {
      return host?.language;
    },
  };
}

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
  Object.entries(options.docTitles ?? {}).forEach(([id, title]) => {
    workspace.meta.addDocMeta({ id, title, tags: [], createDate: 0 });
    // The viewer knows a listed page by its title only. Without a root, a
    // synced-doc card of it waits forever for a page block that never comes;
    // an empty page with the title lets it settle.
    const page = workspace.getDoc(id)?.getStore();
    page?.load(() => {
      page.addBlock('affine:page', { title: new Text(title) });
    });
  });
  const doc = workspace.createDoc('canvas-viewer');
  Y.applyUpdate(doc.spaceDoc, state);
  const store = doc.getStore({ readonly: true });
  store.load();
  if (!store.root) {
    workspace.dispose();
    throw new Error('the canvas viewer was given a state with no page');
  }
  const { focus } = options;
  const focused = focus ? resolveFocus(store, focus) : null;
  if (focus && !focused) {
    workspace.dispose();
    throw new Error('the canvas viewer found no element to focus on');
  }
  const interactive = options.interactive ?? !focus;
  const docTitles = options.docTitles ?? {};
  // A focused frame with a title keeps its badge's strip above it.
  const badgePx =
    focus?.kind === 'frame' && focused?.title.trim() ? FRAME_BADGE_PX : 0;

  const container = document.createElement('div');
  container.dataset.labreCanvasViewer = '';
  const box = container.style;
  box.position = 'relative';
  box.width = '100%';
  box.overflow = 'hidden';
  box.userSelect = 'none';
  if (interactive) box.touchAction = 'none';
  // The element's proportions, as the surface reference's `.ref-viewport`,
  // plus the badge's strip, whose height is in screen pixels: it is read
  // again from the width each time the host resizes the view.
  const proportions = () => {
    if (!focused) return;
    const { w, h } = focused.bound;
    const width = container.getBoundingClientRect().width;
    const strip = width > 0 ? (badgePx * w) / width : 0;
    box.aspectRatio = `${w} / ${(h || 1) + strip}`;
  };
  if (focused && !interactive) {
    proportions();
  } else {
    box.height = '100%';
  }
  if (!interactive && options.onExpand) {
    box.cursor = 'pointer';
    container.tabIndex = 0;
    container.setAttribute('role', 'button');
  }
  // The light theme, on this container only: the page around keeps its own.
  // Built from names already in the theme contract (`theme-imports.unit.spec`):
  // a host that substitutes the theme package needs to export nothing more.
  Object.entries(combinedLightCssVariables).forEach(([name, value]) =>
    box.setProperty(name, value)
  );
  (Object.keys(lightThemeV2) as AffineThemeKeyV2[]).forEach(key =>
    box.setProperty(themeToVar(key), lightThemeV2[key])
  );
  adoptViewerPageStyles();
  adoptViewerStyles();

  let std: BlockStdScope | null = null;

  class CanvasViewerMount extends LifeCycleWatcher {
    static override key = 'canvas-viewer-mount';

    private readonly _disposables = new DisposableGroup();

    override mounted() {
      const { viewport } = this.std.get(GfxControllerIdentifier);
      // The editor's own wheel, pan and pinch handlers stand still on a
      // locked viewport: a frozen view is a picture.
      viewport.locked = !interactive;
      requestAnimationFrame(() => viewer.fit());
      // A frozen view keeps its proportions and its framing through the
      // host's resizes.
      if (!interactive) {
        this._disposables.add(
          viewport.sizeUpdated.subscribe(() => {
            proportions();
            viewer.fit();
          })
        );
      }
      // The viewer loads no face: a public page declares its own, which may
      // arrive after the canvas painted its text with a fallback. Paint
      // again each time the page's faces finish loading, as the editor does
      // once `FontLoaderService`'s are in.
      const fonts = document.fonts as FontFaceSet | undefined;
      if (fonts) {
        const repaint = () => getSurfaceComponent(this.std)?.refresh();
        fonts.addEventListener('loadingdone', repaint);
        this._disposables.add(() =>
          fonts.removeEventListener('loadingdone', repaint)
        );
      }
      if (focus?.kind !== 'frame') return;
      // The frame is the picture's edge: no border, as in the surface reference.
      const hideBorder = (view: unknown) => {
        if (view instanceof FrameBlockComponent) view.showBorder = false;
      };
      hideBorder(this.std.view.getBlock(focus.id));
      this._disposables.add(
        this.std.view.viewUpdated.subscribe(({ id, method, view }) => {
          if (id === focus.id && method === 'add') hideBorder(view);
        })
      );
    }

    override unmounted() {
      this._disposables.dispose();
    }
  }

  const extensions: ExtensionType[] = [
    ...getReadOnlyViewExtensions(options.viewExtensions),
    // The viewport is this container, as `.ref-viewport` is the surface
    // reference's: the editor measures it and follows its resizes.
    ViewportElementExtension('[data-labre-canvas-viewer]'),
    // Code highlighted by shiki's JavaScript engine: a public page's policy
    // has no WebAssembly to spare.
    CodeBlockConfigExtension({ engine: 'javascript' }),
    // After the host's own, which it wraps.
    TranslationExtension(
      accessDeniedTranslation(hostTranslationOf(options.viewExtensions))
    ),
    CanvasViewerMount,
  ];
  try {
    std = new BlockStdScope({ store, extensions });
    if (!interactive && options.onExpand) {
      // A button needs a name, the element's title or none: a host with no
      // translation reads the English fallback.
      const title = focused?.title.trim();
      container.setAttribute(
        'aria-label',
        title
          ? translateKey(
              std,
              'com.labre.canvas-viewer.open-titled',
              'Open canvas: {{title}}',
              { title }
            )
          : translateKey(std, 'com.labre.canvas-viewer.open', 'Open canvas')
      );
    }
    const editorHost = std.render();
    // A frozen view is one button: nothing inside it takes focus, keys or
    // pointers (the editor host would otherwise be a second tab stop, and
    // its keyboard handler would wake on focus).
    if (!interactive) editorHost.inert = true;
    container.append(editorHost);
    host.append(container);
    if (focused && !interactive) proportions();
  } catch (error) {
    container.remove();
    workspace.dispose();
    throw error;
  }

  const gfx = () => std?.get(GfxControllerIdentifier);

  // The editor pans on a drag; a press that moved is no click.
  let pressAt: { x: number; y: number } | null = null;
  let moved = false;
  const onPointerDown = (e: PointerEvent) => {
    pressAt = { x: e.clientX, y: e.clientY };
    moved = false;
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!pressAt) return;
    const travel =
      Math.abs(e.clientX - pressAt.x) + Math.abs(e.clientY - pressAt.y);
    if (travel > CLICK_SLOP_PX) moved = true;
  };

  const onClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // A click from the keyboard (`detail` 0) never follows a drag.
    const dragged = moved && e.detail !== 0;
    moved = false;
    pressAt = null;
    if (dragged) return;
    // A note on the canvas lies under its mask (`.affine-note-mask`), so the
    // click's own path never holds the link: the elements under the pointer
    // do, down to the first block (a card hidden under another note is not
    // what the reader clicked).
    const root = container.getRootNode() as Document | ShadowRoot;
    const stack = (root.elementsFromPoint?.(e.clientX, e.clientY) ?? []).filter(
      element => container.contains(element)
    );
    const hit = stack.findIndex(
      element => element instanceof HTMLElement && element.dataset.blockId
    );
    const under = hit < 0 ? stack : stack.slice(0, hit + 1);
    const link = linkOf([...e.composedPath(), ...under], id => {
      const model = store.getBlock(id)?.model;
      return model ? { flavour: model.flavour, props: model.props } : undefined;
    });
    if (!link) return;
    if ('docId' in link) {
      // A page the host did not name is not the reader's to open.
      if (!Object.prototype.hasOwnProperty.call(docTitles, link.docId)) return;
      options.onOpenDoc?.(link.docId);
      return;
    }
    // As the bookmark block opens its link: a stored `example.com` is
    // `https://example.com`, never a path on the host's site.
    const url = normalizeUrl(link.url);
    if (!isSafeLinkUrl(url)) return;
    if (options.onLinkClick) options.onLinkClick(url);
    else window.location.assign(url);
  };

  // A frozen view is a picture with one gesture, like the surface reference
  // under its event mask: the wheel and touch scroll the page, a click or
  // Enter expands it, nothing else reaches the blocks.
  const onExpand = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    options.onExpand?.();
  };
  const onExpandKey = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    onExpand(e);
  };
  const stop = (e: Event) => e.stopPropagation();

  const listeners: [string, EventListener][] = interactive
    ? [
        ['pointerdown', onPointerDown as EventListener],
        ['pointermove', onPointerMove as EventListener],
        ['click', onClick as EventListener],
        // Links are the viewer's: no double-click into a note, no menu.
        ['dblclick', stop],
        ['contextmenu', stop],
      ]
    : [
        ['wheel', stop],
        ['pointerdown', stop],
        ['click', onExpand],
        ['keydown', onExpandKey as EventListener],
        ['dblclick', stop],
        ['contextmenu', stop],
      ];
  listeners.forEach(([type, listener]) =>
    container.addEventListener(type, listener, {
      capture: true,
      passive: false,
    })
  );

  // The editor's keymap listens on `document` and wakes when the pointer
  // merely rests on the canvas: `v` would switch to selection, `Mod-a` and
  // `Mod-=` would take the page's own select-all and zoom. A reader has no
  // shortcut to type, so for each key the viewer's dispatcher is paused
  // before the page sees it and resumed after: the page keeps every key
  // (Escape to close the host's dialog, select-all, browser zoom), the editor
  // none. The same dispatcher carries the pointer and the wheel, so the pause
  // ends with the key: in its bubble phase, and in any case on the next task,
  // which a listener calling `stopPropagation()` on the way cannot prevent (a
  // microtask would run between two listeners, before the editor's own).
  let paused = false;
  const pauseKeys = () => {
    const dispatcher = std?.event;
    if (!dispatcher?.active) return;
    paused = true;
    dispatcher.active = false;
    setTimeout(resumeKeys, 0);
  };
  const resumeKeys = () => {
    if (!paused) return;
    paused = false;
    if (std) std.event.active = true;
  };
  const keyListeners: [string, EventListener, boolean][] = interactive
    ? [
        ['keydown', pauseKeys, true],
        ['keydown', resumeKeys, false],
        ['keyup', pauseKeys, true],
        ['keyup', resumeKeys, false],
      ]
    : [];
  keyListeners.forEach(([type, listener, capture]) =>
    window.addEventListener(type, listener, { capture })
  );

  const zoomBy = (ratio: number) => {
    const viewport = gfx()?.viewport;
    if (!viewport) return;
    viewport.setZoom(viewport.zoom * ratio);
  };

  const viewer: CanvasViewer = {
    zoomIn: () => zoomBy(ZOOM_STEP_RATIO),
    zoomOut: () => zoomBy(1 / ZOOM_STEP_RATIO),
    fit: () => {
      const controller = gfx();
      if (!controller) return;
      if (!focused) {
        controller.fitToScreen();
        return;
      }
      controller.viewport.setViewportByBound(
        focused.bound,
        focus?.kind === 'group' ? GROUP_PADDING : [badgePx, 0, 0, 0]
      );
    },
    dispose: () => {
      if (!std) return;
      listeners.forEach(([type, listener]) =>
        container.removeEventListener(type, listener, { capture: true })
      );
      keyListeners.forEach(([type, listener, capture]) =>
        window.removeEventListener(type, listener, { capture })
      );
      container.remove();
      std = null;
      workspace.dispose();
    },
  };
  return viewer;
}
