import type { SliderSelectEvent } from '@labre/affine-components/slider';
import { unsafeCSSVar, unsafeCSSVarV2 } from '@labre/affine-shared/theme';
import { styleMap, WithDisposable } from '@labre/global/lit';
import { css, html, LitElement, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';

import {
  type CropCorner,
  type CropRect,
  type CropSide,
  CROP_ZOOM_MAX,
  CROP_ZOOM_MIN,
  cropWheelZoom,
  cropZoomOf,
  panCrop,
  resizeCrop,
  resizeCropSide,
  WHOLE_IMAGE,
  zoomCropAt,
} from './crop-math.js';
import type { CropKeep } from './write-crop.js';

const CORNERS: readonly CropCorner[] = ['nw', 'ne', 'sw', 'se'];

const SIDES: readonly CropSide[] = ['n', 's', 'e', 'w'];

const isCorner = (grip: CropCorner | CropSide): grip is CropCorner =>
  grip.length === 2;

/** Quiet time after the last wheel or slider key that ends one zoom. */
const ZOOM_COMMIT_DELAY_MS = 150;

/** One slider step: a hundredth of the zoom, smooth to the eye. */
const ZOOM_STEP = 0.01;

const ZOOM_RANGE = { min: CROP_ZOOM_MIN, max: CROP_ZOOM_MAX, step: ZOOM_STEP };

const ZOOM_SLIDER_STYLE = { width: '120px' };

type Grip = 'pan' | CropCorner | CropSide;

const rectStyle = (rect: CropRect) =>
  styleMap({
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.w * 100}%`,
    height: `${rect.h * 100}%`,
  });

/**
 * The crop frame (ADR 0037, amendment of 2026-11-04): the WHOLE source as it
 * is stored, laid over the block at the place it would occupy uncropped (the
 * parent sizes this element with `wholeImageFrame` of the stored crop), dimmed
 * outside the window.
 *
 * The window is the block's box and stays put: dragging a corner resizes it
 * (the opposite corner pinned, the ratio held when `ratio` is set), dragging
 * a side resizes one dimension (the opposite side pinned; with a ratio, the
 * other dimension follows about its centre line), and these handles are the
 * only way to change it. Everything else moves the PICTURE behind it:
 * dragging inside the window pans the image with the hand, the slider above
 * the window and the wheel zoom it about the window's centre (1x is the
 * widest window of the frame's ratio). The picture always covers the window:
 * the crop never leaves the source.
 *
 * `draft` is the crop being edited and `_frame` where the window is drawn,
 * both in fractions of this element; the picture is drawn so that `draft`
 * fills `_frame`. A handle drag moves both together (the picture holds
 * still); a pan or a zoom moves `draft` alone.
 *
 * One gesture is one write: a drag commits at release; the slider commits at
 * release, or once its keys have been quiet for a moment, like the wheel; a
 * pending zoom is committed at once when a drag starts or the frame is left
 * by Escape, Enter or a press elsewhere. A frame closed by anything else (the
 * toolbar, the block leaving) drops a zoom still pending rather than write
 * after it. A handle commits `'image'` (the box follows the window), a pan
 * or a zoom `'frame'` (the box stays where it is).
 *
 * Pointer and wheel events never reach the editor while the frame is open: a
 * press on the frame would otherwise start a canvas drag or a page
 * selection, a wheel would zoom or scroll the canvas. Escape, Enter or a
 * press anywhere else calls `onExit`.
 */
export class ImageCropOverlay extends WithDisposable(LitElement) {
  static override styles = css`
    :host {
      position: absolute;
      z-index: 1;
      display: block;
      touch-action: none;
      user-select: none;
    }

    .clip {
      position: absolute;
      inset: 0;
      overflow: hidden;
    }

    img {
      position: absolute;
      display: block;
      max-width: none;
      pointer-events: none;
    }

    .shade {
      position: absolute;
      box-shadow: 0 0 0 100000px
        ${unsafeCSSVarV2('layer/background/modal', 'rgba(0, 0, 0, 0.7)')};
      pointer-events: none;
    }

    .window {
      position: absolute;
      box-sizing: border-box;
      border: 1px solid ${unsafeCSSVarV2('button/primary')};
      cursor: grab;
    }

    .window[data-panning] {
      cursor: grabbing;
    }

    .handle {
      position: absolute;
      width: 12px;
      height: 12px;
      box-sizing: border-box;
      border: 1px solid ${unsafeCSSVarV2('button/primary')};
      border-radius: 2px;
      background: ${unsafeCSSVarV2('layer/pureWhite')};
    }

    /* A wider grip than the mark drawn. */
    .handle::before {
      content: '';
      position: absolute;
      inset: -10px;
    }

    /* A finger gets a 44px target, whatever the mark drawn (P4-7). */
    @media (pointer: coarse) {
      .handle::before {
        inset: auto;
        left: 50%;
        top: 50%;
        width: 44px;
        height: 44px;
        transform: translate(-50%, -50%);
      }
    }

    /* One dimension only: a bar along the side, drawn under the corners. */
    .handle[data-side='n'],
    .handle[data-side='s'] {
      left: calc(50% - 10px);
      width: 20px;
      height: 8px;
      cursor: ns-resize;
    }

    .handle[data-side='n'] {
      top: -4px;
    }

    .handle[data-side='s'] {
      bottom: -4px;
    }

    .handle[data-side='e'],
    .handle[data-side='w'] {
      top: calc(50% - 10px);
      width: 8px;
      height: 20px;
      cursor: ew-resize;
    }

    .handle[data-side='e'] {
      right: -4px;
    }

    .handle[data-side='w'] {
      left: -4px;
    }

    .handle[data-corner='nw'] {
      left: -6px;
      top: -6px;
      cursor: nwse-resize;
    }

    .handle[data-corner='ne'] {
      right: -6px;
      top: -6px;
      cursor: nesw-resize;
    }

    .handle[data-corner='sw'] {
      left: -6px;
      bottom: -6px;
      cursor: nesw-resize;
    }

    .handle[data-corner='se'] {
      right: -6px;
      bottom: -6px;
      cursor: nwse-resize;
    }

    /* Above the window, at screen size whatever the canvas zoom. */
    .zoom {
      position: absolute;
      transform-origin: 50% 100%;
      padding-bottom: 8px;
    }

    .zoom-panel {
      display: flex;
      align-items: center;
      padding: 4px 12px;
      border-radius: 8px;
      background: ${unsafeCSSVarV2('layer/background/overlayPanel')};
      box-shadow: ${unsafeCSSVar('overlayPanelShadow')};
    }
  `;

  @property({ attribute: false })
  accessor src = '';

  /** The stored crop the frame opens on; the whole image when uncropped. */
  @property({ attribute: false })
  accessor crop: CropRect = WHOLE_IMAGE;

  /** Normalised `w / h` to hold while resizing, `null` for a free crop. */
  @property({ attribute: false })
  accessor ratio: number | null = null;

  /** The block's rotation in degrees (canvas only), for pointer deltas. */
  @property({ attribute: false })
  accessor rotate = 0;

  /** The slider's accessible name and tooltip, already translated. */
  @property({ attribute: false })
  accessor zoomLabel = '';

  @property({ attribute: false })
  accessor onCommit: (rect: CropRect, keep: CropKeep) => void = () => {};

  @property({ attribute: false })
  accessor onExit: () => void = () => {};

  /** The crop being edited. */
  @state()
  accessor draft: CropRect = WHOLE_IMAGE;

  /** Where the window is drawn: the stored crop, or a handle drag's draft. */
  @state()
  private accessor _frame: CropRect = WHOLE_IMAGE;

  /** Client pixels per layout pixel, so the slider keeps its screen size. */
  @state()
  private accessor _screenScale = 1;

  /** The drag under way, if any. */
  @state()
  private accessor _grip: Grip | null = null;

  /** Set while the pointer holds the slider: its release is the commit. */
  private _sliding = false;

  /** The pending end of a wheel or key zoom, `null` when none is under way. */
  private _zoomTimer: ReturnType<typeof setTimeout> | null = null;

  /** Removes the listeners of the gesture in progress, if any. */
  private _releaseGesture: (() => void) | null = null;

  private readonly _stop = (event: Event) => event.stopPropagation();

  private readonly _onOutsidePointer = (event: PointerEvent) => {
    if (event.composedPath().includes(this)) return;
    this._commitZoom();
    this.onExit();
  };

  private readonly _onKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' && event.key !== 'Enter') return;
    event.preventDefault();
    event.stopPropagation();
    this._commitZoom();
    this.onExit();
  };

  /** Ends the zoom under way, if any, with its one write. */
  private _commitZoom() {
    if (this._zoomTimer === null) return;
    clearTimeout(this._zoomTimer);
    this._zoomTimer = null;
    this.onCommit(this.draft, 'frame');
  }

  private _dropZoom() {
    if (this._zoomTimer === null) return;
    clearTimeout(this._zoomTimer);
    this._zoomTimer = null;
  }

  /**
   * The picture at `zoom` behind the window. Held by the pointer, the slider
   * commits at release; otherwise the zoom ends once quiet for a moment.
   */
  private _zoomTo(zoom: number) {
    this.draft = zoomCropAt(this.draft, zoom);
    if (this._sliding) return;
    if (this._zoomTimer !== null) clearTimeout(this._zoomTimer);
    this._zoomTimer = setTimeout(
      () => this._commitZoom(),
      ZOOM_COMMIT_DELAY_MS
    );
  }

  private readonly _onWheel = (event: WheelEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (this._grip !== null || this._sliding) return;
    // A line or page delta (Firefox) counts as one full step per unit.
    const deltaY = event.deltaMode === 0 ? event.deltaY : event.deltaY * 100;
    this._zoomTo(cropWheelZoom(cropZoomOf(this.draft), deltaY));
  };

  private readonly _onSliderSelect = (event: SliderSelectEvent) => {
    event.stopPropagation();
    this._zoomTo(event.detail.value);
  };

  private readonly _onSliderPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    this._commitZoom();
    this._sliding = true;
    const end = () => {
      this._releaseGesture?.();
      this._sliding = false;
      this.onCommit(this.draft, 'frame');
    };
    this._releaseGesture?.();
    window.addEventListener('pointerup', end, true);
    window.addEventListener('pointercancel', end, true);
    this._releaseGesture = () => {
      window.removeEventListener('pointerup', end, true);
      window.removeEventListener('pointercancel', end, true);
      this._releaseGesture = null;
    };
  };

  /**
   * The document-wide listeners (a press elsewhere, Escape, Enter) live only
   * as long as this element: the frame is rendered while it is open and
   * removed when it closes, which disposes them.
   */
  override connectedCallback() {
    super.connectedCallback();
    this.disposables.add(() => this._releaseGesture?.());
    this.disposables.add(() => this._dropZoom());
    this.disposables.addFromEvent(this, 'pointerdown', this._stop);
    this.disposables.addFromEvent(this, 'click', this._stop);
    this.disposables.addFromEvent(this, 'dblclick', this._stop);
    this.disposables.addFromEvent(this, 'wheel', this._onWheel, {
      passive: false,
    });
    this.disposables.addFromEvent(
      document,
      'pointerdown',
      this._onOutsidePointer,
      true
    );
    this.disposables.addFromEvent(document, 'keydown', this._onKeydown, true);
  }

  override willUpdate(changed: PropertyValues<this>) {
    if (!changed.has('crop')) return;
    if (this._grip === 'pan') {
      // A zoom committed as the pan began lands now: the window is the
      // stored crop again, the picture still follows the hand.
      this._frame = this.crop;
      return;
    }
    if (this._grip !== null || this._sliding) return;
    // A crop written meanwhile (a preset, a peer) wins over a pending zoom.
    this._dropZoom();
    this.draft = this.crop;
    this._frame = this.crop;
  }

  override firstUpdated() {
    // Read once laid out, outside the update cycle: the viewport is locked
    // while the frame is open, so the scale does not change after.
    requestAnimationFrame(() => {
      if (!this.isConnected) return;
      const { scale } = this._geometry();
      if (scale !== this._screenScale) this._screenScale = scale;
    });
  }

  /**
   * Client pixels per layout pixel, read from the rendered box: the canvas
   * zoom and any CSS scale, without asking the viewport. The bounding box of
   * a rotated element is wider than the element, hence the trigonometry.
   */
  private _geometry() {
    const width = this.offsetWidth;
    const height = this.offsetHeight;
    const t = (this.rotate * Math.PI) / 180;
    const cos = Math.cos(t);
    const sin = Math.sin(t);
    const span = width * Math.abs(cos) + height * Math.abs(sin);
    const scale = span > 0 ? this.getBoundingClientRect().width / span : 1;
    return { width, height, cos, sin, scale: scale || 1 };
  }

  private _startGesture(event: PointerEvent, grip: Grip) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    this._commitZoom();

    const start = this.draft;
    const originX = event.clientX;
    const originY = event.clientY;
    if (this.offsetWidth <= 0 || this.offsetHeight <= 0) return;
    this._grip = grip;

    const onMove = (move: PointerEvent) => {
      move.preventDefault();
      move.stopPropagation();
      // Read afresh: a zoom committed as the drag began resizes this element
      // on the next render, before the pointer has moved.
      const { width, height, cos, sin, scale } = this._geometry();
      if (width <= 0 || height <= 0) return;
      const cdx = move.clientX - originX;
      const cdy = move.clientY - originY;
      const lx = (cdx * cos + cdy * sin) / scale;
      const ly = (-cdx * sin + cdy * cos) / scale;
      if (grip === 'pan') {
        // The window shows `start.w` of the source across its own width.
        const frame = this._frame;
        this.draft = panCrop(
          start,
          (lx / (width * frame.w)) * start.w,
          (ly / (height * frame.h)) * start.h
        );
        return;
      }
      const next = isCorner(grip)
        ? resizeCrop(start, grip, lx / width, ly / height, this.ratio)
        : resizeCropSide(start, grip, lx / width, ly / height, this.ratio);
      this.draft = next;
      this._frame = next;
    };
    const finish = (end: PointerEvent, commit: boolean) => {
      end.preventDefault();
      end.stopPropagation();
      this._releaseGesture?.();
      this._grip = null;
      if (commit) {
        this.onCommit(this.draft, grip === 'pan' ? 'frame' : 'image');
      } else {
        this.draft = this.crop;
        this._frame = this.crop;
      }
    };
    const onUp = (end: PointerEvent) => finish(end, true);
    const onCancel = (end: PointerEvent) => finish(end, false);

    this._releaseGesture?.();
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onCancel, true);
    this._releaseGesture = () => {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onCancel, true);
      this._releaseGesture = null;
    };
  }

  /** The whole picture placed so that `draft` fills the window. */
  private _pictureStyle() {
    const { draft, _frame: frame } = this;
    const sx = frame.w / draft.w;
    const sy = frame.h / draft.h;
    return styleMap({
      left: `${(frame.x - draft.x * sx) * 100}%`,
      top: `${(frame.y - draft.y * sy) * 100}%`,
      width: `${sx * 100}%`,
      height: `${sy * 100}%`,
    });
  }

  private _zoomStyle() {
    const frame = this._frame;
    return styleMap({
      left: `${(frame.x + frame.w / 2) * 100}%`,
      top: `${frame.y * 100}%`,
      transform: `translate(-50%, -100%) scale(${1 / this._screenScale})`,
    });
  }

  override render() {
    const frame = this._frame;
    return html`
      <div class="clip">
        <img
          src=${this.src}
          draggable="false"
          alt=""
          style=${this._pictureStyle()}
        />
        <div class="shade" style=${rectStyle(frame)}></div>
      </div>
      <div
        class="window"
        data-testid="image-crop-window"
        ?data-panning=${this._grip === 'pan'}
        style=${rectStyle(frame)}
        @pointerdown=${(event: PointerEvent) =>
          this._startGesture(event, 'pan')}
      >
        ${repeat(
          SIDES,
          side => side,
          side => html`
            <div
              class="handle"
              data-side=${side}
              data-testid=${`image-crop-handle-${side}`}
              @pointerdown=${(event: PointerEvent) => {
                event.stopPropagation();
                this._startGesture(event, side);
              }}
            ></div>
          `
        )}
        ${repeat(
          CORNERS,
          corner => corner,
          corner => html`
            <div
              class="handle"
              data-corner=${corner}
              data-testid=${`image-crop-handle-${corner}`}
              @pointerdown=${(event: PointerEvent) => {
                event.stopPropagation();
                this._startGesture(event, corner);
              }}
            ></div>
          `
        )}
      </div>
      <div class="zoom" style=${this._zoomStyle()}>
        <div class="zoom-panel">
          <affine-slider
            data-testid="image-crop-zoom"
            .range=${ZOOM_RANGE}
            .value=${Math.min(cropZoomOf(this.draft), CROP_ZOOM_MAX)}
            .tooltip=${this.zoomLabel}
            .sliderStyle=${ZOOM_SLIDER_STYLE}
            @pointerdown=${this._onSliderPointerDown}
            @select=${this._onSliderSelect}
          ></affine-slider>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-image-crop-overlay': ImageCropOverlay;
  }
}
