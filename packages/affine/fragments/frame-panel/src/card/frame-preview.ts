import { ViewExtensionManagerIdentifier } from '@labre/affine-ext-loader';
import type { FrameBlockModel } from '@labre/affine-model';
import {
  DocModeExtension,
  DocModeProvider,
  ViewportElementExtension,
} from '@labre/affine-shared/services';
import { DisposableGroup } from '@labre/global/disposable';
import { Bound, deserializeXYWH } from '@labre/global/gfx';
import { WithDisposable } from '@labre/global/lit';
import {
  BlockStdScope,
  type EditorHost,
  LifeCycleWatcher,
  ShadowlessElement,
} from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import { type ExtensionType, type Query, type Store } from '@labre/store';
import { css, html, nothing, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { guard } from 'lit/directives/guard.js';
import { styleMap } from 'lit/directives/style-map.js';
import debounce from 'lodash-es/debounce';

import { fluidPreviewSize } from './preview-size.js';

const DEFAULT_PREVIEW_CONTAINER_WIDTH = 280;
const DEFAULT_PREVIEW_CONTAINER_HEIGHT = 166;

const styles = css`
  frame-preview[data-fluid] {
    display: block;
    width: 100%;
  }

  .frame-preview-container {
    display: block;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    position: relative;
  }

  .frame-preview-surface-container {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    overflow: hidden;
  }

  .frame-preview-viewport {
    max-width: 100%;
    box-sizing: border-box;
    margin: 0 auto;
    position: relative;
    overflow: hidden;
    pointer-events: none;
    user-select: none;
  }

  .frame-preview-viewport
    > editor-host
    > affine-edgeless-root-preview
    > .edgeless-background {
    background-color: transparent;
    background-image: none;
  }
`;

export const AFFINE_FRAME_PREVIEW = 'frame-preview';

export class FramePreview extends WithDisposable(ShadowlessElement) {
  static override styles = styles;

  private readonly _clearFrameDisposables = () => {
    this._frameDisposables?.dispose();
    this._frameDisposables = null;
  };

  private readonly _docFilter: Query = {
    mode: 'loose',
    match: [
      {
        flavour: 'affine:frame',
        viewType: 'hidden',
      },
    ],
  };

  private _frameDisposables: DisposableGroup | null = null;

  private _previewDoc: Store | null = null;

  private _runtimePreviewExt: ExtensionType[] = [];

  private get _viewExtensionManager() {
    return this.std.get(ViewExtensionManagerIdentifier);
  }

  private get _previewSpec() {
    return this._viewExtensionManager.get('preview-edgeless');
  }

  private _resizeObserver: ResizeObserver | null = null;

  private readonly _updateFrameViewportWH = () => {
    const [, , w, h] = deserializeXYWH(this.frame.xywh);
    if (this.fluid) {
      const box = fluidPreviewSize(this._containerWidth, w, h);
      this.surfaceWidth = box.width;
      this.surfaceHeight = box.height;
    }

    let scale = 1;
    if (this.fillScreen) {
      scale = Math.max(this.surfaceWidth / w, this.surfaceHeight / h);
    } else {
      scale = Math.min(this.surfaceWidth / w, this.surfaceHeight / h);
    }

    this.frameViewportWH = {
      width: w * scale,
      height: h * scale,
    };
  };

  get _originalDoc() {
    return this.frame.store;
  }

  private _initPreviewDoc() {
    const doc = this._originalDoc.workspace.getDoc(this._originalDoc.id);
    this._previewDoc =
      doc?.getStore({ readonly: true, query: this._docFilter }) ?? null;
    this.disposables.add(() => {
      this._originalDoc.doc.removeStore({ query: this._docFilter });
    });
  }

  private _initSpec() {
    const refreshViewport = this._refreshViewport.bind(this);
    class FramePreviewWatcher extends LifeCycleWatcher {
      static override key = 'frame-preview-watcher';

      override mounted() {
        const std = this.std;
        const { view } = std;
        view.viewUpdated.subscribe(payload => {
          if (
            payload.type !== 'block' ||
            payload.method !== 'add' ||
            payload.view.model.flavour !== 'affine:page'
          ) {
            return;
          }
          // Every size, not only the first: a fluid preview follows its
          // panel's width, and the mini editor's viewport settles on the new
          // size (debounced) after the box has changed — fitting then is what
          // keeps the frame filling it. The subject completes with the
          // viewport, which ends the subscription.
          const viewport = std.get(GfxControllerIdentifier).viewport;
          viewport.sizeUpdated.subscribe(() => {
            refreshViewport();
          });
        });
      }
    }

    const docModeService = this.std.get(DocModeProvider);
    this._runtimePreviewExt = [
      ViewportElementExtension('.frame-preview-viewport'),
      FramePreviewWatcher,
      DocModeExtension(docModeService),
    ];
  }

  private _refreshViewport() {
    const previewEditorHost = this.previewEditor;

    if (!previewEditorHost) return;

    const { viewport } = previewEditorHost.std.get(GfxControllerIdentifier);
    const frameBound = Bound.deserialize(this.frame.xywh);
    viewport.setViewportByBound(frameBound);
  }

  private _renderSurfaceContent() {
    const { width, height } = this.frameViewportWH;

    const _previewSpec = this._previewSpec.concat(this._runtimePreviewExt);
    return html`<div
      class="frame-preview-surface-container"
      style=${styleMap({
        width: `${this.surfaceWidth}px`,
        height: `${this.surfaceHeight}px`,
      })}
    >
      <div
        class="frame-preview-viewport"
        style=${styleMap({
          width: `${width}px`,
          height: `${height}px`,
        })}
      >
        ${guard([this._previewDoc, this.frame], () => {
          if (!this._previewDoc || !this.frame) return nothing;
          return new BlockStdScope({
            store: this._previewDoc,
            extensions: _previewSpec,
          }).render();
        })}
      </div>
    </div>`;
  }

  private _setFrameDisposables(frame: FrameBlockModel) {
    this._clearFrameDisposables();
    this._frameDisposables = new DisposableGroup();
    this._frameDisposables.add(
      frame.propsUpdated.subscribe(
        debounce(this._updateFrameViewportWH, 10, { leading: true })
      )
    );
  }

  override connectedCallback() {
    super.connectedCallback();
    this._initSpec();
    this._initPreviewDoc();
    this._updateFrameViewportWH();
    this._setFrameDisposables(this.frame);
    this._observeWidth();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._clearFrameDisposables();
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
  }

  /** A fluid preview follows its own width: the panel's, as it is resized. */
  private _observeWidth() {
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    if (!this.fluid || typeof ResizeObserver === 'undefined') return;
    this._resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const width = Math.floor(entry.contentRect.width);
      if (width !== this._containerWidth) this._containerWidth = width;
    });
    this._resizeObserver.observe(this);
  }

  override willUpdate(changed: PropertyValues) {
    if (changed.has('fluid')) {
      this.toggleAttribute('data-fluid', this.fluid);
      if (this.isConnected) this._observeWidth();
    }
    // The box was only read at connect and on a frame's own update, so a host
    // that resized it after mounting kept the old scale.
    if (
      changed.has('fluid') ||
      changed.has('_containerWidth') ||
      changed.has('surfaceWidth') ||
      changed.has('surfaceHeight') ||
      changed.has('fillScreen')
    ) {
      this._updateFrameViewportWH();
    }
  }

  override render() {
    const { frame } = this;
    // A fluid preview builds its mini editor once it knows its width, never
    // at the default box first.
    const noContent =
      !frame || !frame.xywh || (this.fluid && this._containerWidth === 0);

    return html`<div class="frame-preview-container">
      ${noContent ? nothing : this._renderSurfaceContent()}
    </div>`;
  }

  override updated(_changedProperties: PropertyValues) {
    if (_changedProperties.has('frame')) {
      this._setFrameDisposables(this.frame);
    }
    if (_changedProperties.has('frameViewportWH')) {
      this._refreshViewport();
    }
  }

  @property({ attribute: false })
  accessor std!: BlockStdScope;

  /** The width a fluid preview measured on itself; `0` until laid out. */
  @state()
  private accessor _containerWidth = 0;

  @state()
  accessor fillScreen = false;

  /**
   * Take the container's width and the frame's proportions (recette 1,
   * P0-1.2): the box grows and shrinks with the panel, never taller than
   * wide, and `surfaceWidth` / `surfaceHeight` are computed, not read.
   */
  @property({ attribute: false })
  accessor fluid = false;

  @property({ attribute: false })
  accessor frame!: FrameBlockModel;

  @state()
  accessor frameViewportWH = {
    width: 0,
    height: 0,
  };

  @query('editor-host')
  accessor previewEditor: EditorHost | null = null;

  @property({ attribute: false })
  accessor surfaceHeight: number = DEFAULT_PREVIEW_CONTAINER_HEIGHT;

  @property({ attribute: false })
  accessor surfaceWidth: number = DEFAULT_PREVIEW_CONTAINER_WIDTH;
}
