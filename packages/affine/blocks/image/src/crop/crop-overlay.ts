import { unsafeCSSVarV2 } from '@labre/affine-shared/theme';
import { WithDisposable } from '@labre/global/lit';
import { css, html, LitElement, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';

import {
  type CropCorner,
  type CropRect,
  cropWheelFactor,
  moveCrop,
  resizeCrop,
  WHOLE_IMAGE,
  zoomCrop,
} from './crop-math.js';

const CORNERS: readonly CropCorner[] = ['nw', 'ne', 'sw', 'se'];

/** Quiet time after the last wheel event that ends one wheel gesture. */
const WHEEL_COMMIT_DELAY_MS = 150;

const rectStyle = (rect: CropRect) =>
  styleMap({
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.w * 100}%`,
    height: `${rect.h * 100}%`,
  });

/**
 * The crop frame (ADR 0037): the WHOLE source, laid over the block at the
 * place it would occupy uncropped (the parent sizes this element with
 * `wholeImageFrame`), dimmed outside the window being edited.
 *
 * Dragging the window moves it, dragging a corner resizes it, the ratio held
 * when `ratio` is set. The draft lives here while the pointer is down; the
 * release hands it to `onCommit` once — one gesture, one write, one undo
 * step, decided by the caller (`writeImageCrop`).
 *
 * The wheel over the frame zooms the picture inside it: it scales the window
 * about the pointer, the ratio held, inside the image. One scroll is one
 * write: the draft is handed to `onCommit` once the wheel has been quiet for
 * a moment, or at once when a drag starts or the frame is left by Escape,
 * Enter or a press elsewhere. A frame closed by anything else (the toolbar,
 * the block leaving) drops a scroll still pending rather than write after it.
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
      display: block;
      width: 100%;
      height: 100%;
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
      cursor: move;
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

    /* A wider grip than the square drawn, for a finger. */
    .handle::before {
      content: '';
      position: absolute;
      inset: -10px;
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

  @property({ attribute: false })
  accessor onCommit: (rect: CropRect) => void = () => {};

  @property({ attribute: false })
  accessor onExit: () => void = () => {};

  @state()
  accessor draft: CropRect = WHOLE_IMAGE;

  private _dragging = false;

  /** The pending end of a wheel gesture, `null` when none is under way. */
  private _wheelTimer: ReturnType<typeof setTimeout> | null = null;

  /** Removes the listeners of the gesture in progress, if any. */
  private _releaseGesture: (() => void) | null = null;

  private readonly _stop = (event: Event) => event.stopPropagation();

  private readonly _onOutsidePointer = (event: PointerEvent) => {
    if (event.composedPath().includes(this)) return;
    this._commitWheel();
    this.onExit();
  };

  private readonly _onKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' && event.key !== 'Enter') return;
    event.preventDefault();
    event.stopPropagation();
    this._commitWheel();
    this.onExit();
  };

  /** Ends the wheel gesture under way, if any, with its one write. */
  private _commitWheel() {
    if (this._wheelTimer === null) return;
    clearTimeout(this._wheelTimer);
    this._wheelTimer = null;
    this.onCommit(this.draft);
  }

  private _dropWheel() {
    if (this._wheelTimer === null) return;
    clearTimeout(this._wheelTimer);
    this._wheelTimer = null;
  }

  private readonly _onWheel = (event: WheelEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (this._dragging) return;
    const { width, height, cos, sin, scale } = this._geometry();
    if (width <= 0 || height <= 0) return;
    // The pointer in the source's normalised coordinates: the frame is the
    // whole source, possibly rotated about its centre.
    const box = this.getBoundingClientRect();
    const cdx = event.clientX - (box.left + box.width / 2);
    const cdy = event.clientY - (box.top + box.height / 2);
    const px = ((cdx * cos + cdy * sin) / scale + width / 2) / width;
    const py = ((-cdx * sin + cdy * cos) / scale + height / 2) / height;
    // A line or page delta (Firefox) counts as one full step per unit.
    const deltaY = event.deltaMode === 0 ? event.deltaY : event.deltaY * 100;
    this.draft = zoomCrop(
      this.draft,
      cropWheelFactor(deltaY),
      Math.min(Math.max(px, 0), 1),
      Math.min(Math.max(py, 0), 1),
      this.ratio
    );
    if (this._wheelTimer !== null) clearTimeout(this._wheelTimer);
    this._wheelTimer = setTimeout(
      () => this._commitWheel(),
      WHEEL_COMMIT_DELAY_MS
    );
  };

  /**
   * The document-wide listeners (a press elsewhere, Escape, Enter) live only
   * as long as this element: the frame is rendered while it is open and
   * removed when it closes, which disposes them.
   */
  override connectedCallback() {
    super.connectedCallback();
    this.disposables.add(() => this._releaseGesture?.());
    this.disposables.add(() => this._dropWheel());
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
    if (!changed.has('crop') || this._dragging) return;
    // A crop written meanwhile (a preset, a peer) wins over a pending scroll.
    this._dropWheel();
    this.draft = this.crop;
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

  private _startGesture(event: PointerEvent, grip: 'move' | CropCorner) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    this._commitWheel();

    const start = this.draft;
    const originX = event.clientX;
    const originY = event.clientY;
    const { width, height, cos, sin, scale } = this._geometry();
    if (width <= 0 || height <= 0) return;
    this._dragging = true;

    const onMove = (move: PointerEvent) => {
      move.preventDefault();
      move.stopPropagation();
      const cdx = move.clientX - originX;
      const cdy = move.clientY - originY;
      const dx = (cdx * cos + cdy * sin) / scale / width;
      const dy = (-cdx * sin + cdy * cos) / scale / height;
      this.draft =
        grip === 'move'
          ? moveCrop(start, dx, dy)
          : resizeCrop(start, grip, dx, dy, this.ratio);
    };
    const finish = (end: PointerEvent, commit: boolean) => {
      end.preventDefault();
      end.stopPropagation();
      this._releaseGesture?.();
      this._dragging = false;
      if (commit) {
        this.onCommit(this.draft);
      } else {
        this.draft = this.crop;
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

  override render() {
    const draft = this.draft;
    return html`
      <div class="clip">
        <img src=${this.src} draggable="false" alt="" />
        <div class="shade" style=${rectStyle(draft)}></div>
      </div>
      <div
        class="window"
        data-testid="image-crop-window"
        style=${rectStyle(draft)}
        @pointerdown=${(event: PointerEvent) =>
          this._startGesture(event, 'move')}
      >
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
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-image-crop-overlay': ImageCropOverlay;
  }
}
