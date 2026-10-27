import {
  type ImageBlockModel,
  type ImageCrop,
  type ImageCropMask,
  readImageCrop,
} from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';
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
  /** Read on the canvas only, to take the selection and the viewport. */
  readonly std: Pick<BlockStdScope, 'get'>;
  querySelector<E extends Element = Element>(selectors: string): E | null;
}

/**
 * The « Rogner » state of one image block (ADR 0037), shared by the page and
 * the canvas components: which preset the crop frame is open on, if any, and
 * the gestures that write. The frame is local UI and never stored.
 *
 * On the canvas the open frame owns the pointer and the wheel: the image is
 * selected in EDITING state, which hides the selected-rect handles that
 * would otherwise sit on the frame's corners, and the viewport is locked,
 * so the wheel zooms the picture inside the frame rather than the canvas.
 * Both are taken by one open path and given back by one `stop`, whatever
 * closes the frame (Escape, Enter, a press elsewhere, the toolbar, the block
 * leaving the DOM, the selection moving elsewhere), so they cannot drift.
 */
export class ImageCropController {
  /** The mask the crop frame is open on, `null` when it is closed. */
  readonly editing$ = signal<ImageCropMask | null>(null);

  readonly crop$ = computed(() =>
    readImageCrop(this._block.model.props.crop$.value)
  );

  /** Gives the canvas back; set while the frame is open on the canvas. */
  private _release: (() => void) | null = null;

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
    this._open(mask);
  }

  private _open(mask: ImageCropMask) {
    this.editing$.value = mask;
    if (!this._onCanvas || this._release) return;

    const { selection, viewport } = this._block.std.get(
      GfxControllerIdentifier
    );
    const { id, store } = this._block.model;
    const wasLocked = viewport.locked;
    viewport.locked = true;
    selection.set({ elements: [id], editing: true });
    // Another selection (a shortcut, the selection pane, a peer's undo
    // removing the block) closes the frame instead of leaving it orphaned.
    const watch = selection.slots.updated.subscribe(() => {
      if (!selection.editing || !selection.has(id)) this.stop();
    });
    this._release = () => {
      watch.unsubscribe();
      viewport.locked = wasLocked;
      if (selection.editing && selection.has(id) && store.hasBlock(id)) {
        selection.set({ elements: [id], editing: false });
      }
    };
  }

  commit(rect: CropRect, mask = this.editing$.peek() ?? 'free') {
    return writeImageCrop(this._block.model, rect, mask, this._onCanvas);
  }

  /** « Image d'origine »: removes the crop; the bytes never changed. */
  restoreOriginal() {
    this.stop();
    return writeImageCrop(this._block.model, undefined, 'free', this._onCanvas);
  }

  /** Closes the frame and gives the canvas back; harmless when closed. */
  stop() {
    const release = this._release;
    this._release = null;
    release?.();
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
        this.commit(rect, mask);
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
