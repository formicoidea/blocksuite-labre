import {
  type ImageBlockModel,
  type ImageCrop,
  type ImageCropMask,
  readImageCrop,
} from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';
import { computed, signal } from '@preact/signals-core';
import { html, nothing } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';

import {
  type CropRect,
  maskRatio,
  presetCrop,
  WHOLE_IMAGE,
  wholeImageFrame,
} from './crop-math.js';
import { writeImageCrop } from './write-crop.js';

/** What the controller needs from the block it serves, page or canvas. */
export interface CroppableImageBlock {
  readonly model: ImageBlockModel;
  querySelector<E extends Element = Element>(selectors: string): E | null;
}

/**
 * The « Rogner » state of one image block (ADR 0036), shared by the page and
 * the canvas components: which preset the crop frame is open on, if any, and
 * the gestures that write. The frame is local UI and never stored.
 */
export class ImageCropController {
  /** The mask the crop frame is open on, `null` when it is closed. */
  readonly editing$ = signal<ImageCropMask | null>(null);

  readonly crop$ = computed(() =>
    readImageCrop(this._block.model.props.crop$.value)
  );

  constructor(
    private readonly _block: CroppableImageBlock,
    private readonly _onCanvas: boolean
  ) {}

  /**
   * The source's proportions: the loaded `<img>`'s pixel size, else what the
   * block stores. Only the ratio matters to the crop, and an SVG without an
   * intrinsic size loads with none: a canvas box is the cropped share of the
   * whole picture, a page `width`/`height` is the whole picture.
   */
  natural(): { width: number; height: number } | null {
    const img = this._block.querySelector<HTMLImageElement>('img.drag-target');
    if (img?.naturalWidth && img.naturalHeight) {
      return { width: img.naturalWidth, height: img.naturalHeight };
    }
    const { model } = this._block;
    const crop = this.crop$.peek() ?? WHOLE_IMAGE;
    if (this._onCanvas) {
      const bound = Bound.deserialize(model.xywh);
      if (bound.w <= 0 || bound.h <= 0) return null;
      return { width: bound.w / crop.w, height: bound.h / crop.h };
    }
    const { width, height } = model.props;
    return width && height ? { width, height } : null;
  }

  /**
   * Open the frame on a preset. A ratio preset first writes its largest
   * centred window — unless the crop already uses that preset, which keeps
   * the author's adjustment. Free opens on the current crop and writes
   * nothing until a drag.
   */
  choose(mask: ImageCropMask) {
    const { model } = this._block;
    if (model.store.readonly) return;
    if (mask !== 'free' && this.crop$.peek()?.mask !== mask) {
      const natural = this.natural();
      if (!natural) return;
      this.commit(presetCrop(mask, natural.width, natural.height), mask);
    }
    this.editing$.value = mask;
  }

  commit(rect: CropRect, mask = this.editing$.peek() ?? 'free') {
    return writeImageCrop(this._block.model, rect, mask, this._onCanvas);
  }

  /** « Image d'origine »: removes the crop; the bytes never changed. */
  restoreOriginal() {
    this.editing$.value = null;
    return writeImageCrop(this._block.model, undefined, 'free', this._onCanvas);
  }

  stop() {
    this.editing$.value = null;
  }

  /** The frame, or nothing when it is closed or the page is readonly. */
  renderOverlay(src: string | null | undefined, rotate = 0) {
    const mask = this.editing$.value;
    if (mask === null || !src || this._block.model.store.readonly) {
      return nothing;
    }
    const crop: CropRect = this.crop$.value ?? WHOLE_IMAGE;
    const natural = this.natural();
    const ratio = natural
      ? maskRatio(mask, natural.width, natural.height)
      : null;
    return html`<affine-image-crop-overlay
      data-testid="image-crop-overlay"
      style=${styleMap(wholeImageFrame(crop))}
      .src=${src}
      .crop=${crop}
      .ratio=${ratio}
      .rotate=${rotate}
      .onCommit=${(rect: CropRect) => {
        this.commit(rect);
      }}
      .onExit=${() => this.stop()}
    ></affine-image-crop-overlay>`;
  }
}

/** Inline styles of an `<img>` showing `crop` of its source in its box. */
export function croppedImageStyle(crop: ImageCrop) {
  return styleMap({
    position: 'absolute',
    maxWidth: 'none',
    ...wholeImageFrame(crop),
  });
}
