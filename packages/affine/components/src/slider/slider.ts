import { on, once } from '@labre/affine-shared/utils';
import { clamp } from '@labre/global/gfx';
import { WithDisposable } from '@labre/global/lit';
import { PropTypes, requiredProperties } from '@labre/std';
import { html, LitElement, nothing, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';

import { styles } from './styles';
import type {
  SliderContinuousRange,
  SliderRange,
  SliderSelectEvent,
  SliderStyle,
} from './types';
import {
  continuousFraction,
  continuousStep,
  continuousValueAt,
  isContinuousRange,
  isDiscreteRange,
  snapContinuous,
} from './utils';

const defaultSliderStyle: SliderStyle = {
  width: '100%',
  itemSize: 16,
  itemIconSize: 8,
  dragHandleSize: 14,
};

/** Steps one Page Up / Page Down moves a continuous slider. */
const PAGE_STEPS = 10;

type KeyMove = (
  value: number,
  step: number,
  range: SliderContinuousRange
) => number;

/** The keys a continuous slider answers, as the ARIA slider pattern says. */
const CONTINUOUS_KEYS: Record<string, KeyMove | undefined> = Object.assign(
  Object.create(null),
  {
    ArrowRight: (value, step) => value + step,
    ArrowUp: (value, step) => value + step,
    ArrowLeft: (value, step) => value - step,
    ArrowDown: (value, step) => value - step,
    PageUp: (value, step) => value + step * PAGE_STEPS,
    PageDown: (value, step) => value - step * PAGE_STEPS,
    Home: (_value, _step, range) => range.min,
    End: (_value, _step, range) => range.max,
  } satisfies Record<string, KeyMove>
);

/**
 * A slider over a few `points` (discrete: the line widths), or over any
 * value between `min` and `max` (continuous: the image crop's zoom). Both
 * emit `select` with the value under the pointer; the continuous one also
 * answers the arrow keys, Page Up/Down, Home and End, and exposes itself as
 * an ARIA slider labelled by its `tooltip`.
 */
@requiredProperties({
  range: PropTypes.of(
    (range: unknown): range is SliderRange | SliderContinuousRange =>
      isDiscreteRange(range) || isContinuousRange(range)
  ),
})
export class Slider extends WithDisposable(LitElement) {
  static override styles = styles;

  @property({ attribute: false })
  accessor value: number = 0;

  @property({ attribute: true, type: Boolean })
  accessor disabled = false;

  @property({ attribute: false })
  accessor tooltip: string | undefined = undefined;

  @property({ attribute: false })
  accessor range!: SliderRange | SliderContinuousRange;

  @property({ attribute: false })
  accessor sliderStyle: Partial<SliderStyle> | undefined = defaultSliderStyle;

  private get _sliderStyle(): SliderStyle {
    return {
      ...defaultSliderStyle,
      ...this.sliderStyle,
    };
  }

  private _onSelect(value: number) {
    this.dispatchEvent(
      new CustomEvent('select', {
        detail: { value },
        bubbles: true,
        composed: true,
      }) satisfies SliderSelectEvent
    );
  }

  private _updateLineWidthPanelByDragHandlePosition(
    x: number,
    points: number[]
  ) {
    // Calculate the selected size based on the drag handle position.
    // Need to select the nearest size.

    const {
      _sliderStyle: { itemSize },
    } = this;

    const width = this.getBoundingClientRect().width;

    const count = points.length;

    const targetWidth = width - itemSize;
    const halfItemSize = itemSize / 2;
    const offsetX = halfItemSize + (width - itemSize * count) / (count - 1) / 2;
    const selectedSize = points.findLast((_, n) => {
      const cx = halfItemSize + (n / (count - 1)) * targetWidth;
      return x >= cx - offsetX && x < cx + offsetX;
    });
    if (!selectedSize) return;

    this._onSelect(selectedSize);
  }

  private readonly _getDragHandlePosition = (e: PointerEvent) => {
    const width = this.getBoundingClientRect().width;
    return clamp(e.offsetX, 0, width);
  };

  private readonly _onPointerDown = (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isContinuousRange(this.range)) {
      this._onContinuousPointerDown(e, this.range);
      return;
    }
    this._onPointerMove(e);

    const dispose = on(this, 'pointermove', this._onPointerMove);
    this._disposables.add(once(this, 'pointerup', dispose));
    this._disposables.add(once(this, 'pointerleave', dispose));
  };

  private readonly _onPointerMove = (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDiscreteRange(this.range)) return;

    const x = this._getDragHandlePosition(e);

    this._updateLineWidthPanelByDragHandlePosition(x, this.range.points);
  };

  /** Emits `value` when it differs from the one shown. */
  private _selectContinuous(value: number) {
    if (value === this.value) return;
    this._onSelect(value);
  }

  /**
   * The value under a client x: the handle's centre runs from half an item
   * in from each end, as the discrete points do.
   */
  private _continuousValueAtClientX(
    clientX: number,
    range: SliderContinuousRange
  ) {
    const { left, width } = this.getBoundingClientRect();
    const { itemSize } = this._sliderStyle;
    const track = width - itemSize;
    if (track <= 0) return this.value;
    return continuousValueAt(range, (clientX - left - itemSize / 2) / track);
  }

  /**
   * A drag keeps the slider while the pointer wanders off it (pointer
   * capture): the zoom it drives is under the pointer, not along the track.
   */
  private _onContinuousPointerDown(
    e: PointerEvent,
    range: SliderContinuousRange
  ) {
    if (e.button !== 0) return;
    try {
      this.setPointerCapture(e.pointerId);
    } catch {
      // A synthetic event has no active pointer to capture; the drag then
      // ends when the pointer leaves the slider, like the discrete one.
    }
    this._selectContinuous(this._continuousValueAtClientX(e.clientX, range));
    const dispose = on(this, 'pointermove', (move: PointerEvent) => {
      move.preventDefault();
      move.stopPropagation();
      if (!isContinuousRange(this.range)) return;
      this._selectContinuous(
        this._continuousValueAtClientX(move.clientX, this.range)
      );
    });
    this._disposables.add(once(this, 'pointerup', dispose));
    this._disposables.add(once(this, 'pointercancel', dispose));
    this._disposables.add(once(this, 'lostpointercapture', dispose));
  }

  private readonly _onKeydown = (e: KeyboardEvent) => {
    const range = this.range;
    if (this.disabled || !isContinuousRange(range)) return;
    const move = CONTINUOUS_KEYS[e.key];
    if (!move) return;
    // The editor would otherwise move the selection or the caret.
    e.preventDefault();
    e.stopPropagation();
    this._selectContinuous(
      snapContinuous(range, move(this.value, continuousStep(range), range))
    );
  };

  override connectedCallback() {
    super.connectedCallback();

    this._disposables.addFromEvent(this, 'pointerdown', this._onPointerDown);
    this._disposables.addFromEvent(this, 'keydown', this._onKeydown);
    this._disposables.addFromEvent(this, 'click', e => {
      e.stopPropagation();
    });
  }

  override willUpdate(changedProperties: PropertyValues<this>) {
    const { style } = this;
    if (changedProperties.has('sliderStyle')) {
      const {
        _sliderStyle: { width, itemSize, itemIconSize, dragHandleSize },
      } = this;
      style.setProperty('--width', width);
      style.setProperty('--item-size', `${itemSize}px`);
      style.setProperty('--item-icon-size', `${itemIconSize}px`);
      style.setProperty('--drag-handle-size', `${dragHandleSize}px`);
    }
    const range = this.range;
    if (changedProperties.has('range')) {
      // A continuous track is the discrete one with two ends; the cursor is
      // then the fraction of the way from the first to the second.
      const count = isContinuousRange(range) ? 2 : range.points.length;
      style.setProperty('--count', `${count}`);
    }
    if (changedProperties.has('value') || changedProperties.has('range')) {
      const cursor = isContinuousRange(range)
        ? continuousFraction(range, this.value)
        : range.points.findIndex(p => p === this.value);
      style.setProperty('--cursor', `${cursor}`);
    }
  }

  private _renderContinuous(range: SliderContinuousRange) {
    return html`<div
      class="slider-container"
      data-continuous
      role="slider"
      tabindex=${this.disabled ? -1 : 0}
      aria-label=${this.tooltip ?? nothing}
      aria-valuemin=${range.min}
      aria-valuemax=${range.max}
      aria-valuenow=${this.value}
      aria-disabled=${this.disabled ? 'true' : 'false'}
    >
      <div class="drag-handle"></div>
      <div class="bottom-line"></div>
      <div class="slider-selected-overlay"></div>
      ${this.tooltip
        ? html`<affine-tooltip .offset=${8}>${this.tooltip}</affine-tooltip>`
        : nothing}
    </div>`;
  }

  override render() {
    const range = this.range;
    if (isContinuousRange(range)) return this._renderContinuous(range);
    return html`<div class="slider-container">
      ${repeat(
        range.points,
        w => w,
        (w, n) =>
          html`<div
            class="point-button"
            aria-label=${w}
            data-index=${n}
            ?data-selected=${w <= this.value}
          >
            <div class="point-circle"></div>
          </div>`
      )}
      <div class="drag-handle"></div>
      <div class="bottom-line"></div>
      <div class="slider-selected-overlay"></div>
      ${this.tooltip
        ? html`<affine-tooltip .offset=${8}>${this.tooltip}</affine-tooltip>`
        : nothing}
    </div>`;
  }
}
