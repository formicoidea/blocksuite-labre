import type { FrameBlockModel } from '@labre/affine-model';
import { WithDisposable } from '@labre/global/lit';
import { type BlockStdScope, ShadowlessElement } from '@labre/std';
import { css, html, nothing } from 'lit';
import { property, query } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';

export type ReorderEvent = CustomEvent<{
  currentNumber: number;
  targetNumber: number;
  realIndex: number;
}>;

export type SelectEvent = CustomEvent<{
  id: string;
  selected: boolean;
  index: number;
  multiselect: boolean;
}>;

/** A press on a card's body, handed to the panel's drag controller. */
export type DragEvent = CustomEvent<{
  event: PointerEvent;
}>;

export type FitViewEvent = CustomEvent<{
  block: FrameBlockModel;
}>;

const styles = css`
  :host {
    display: block;
  }

  /*
    The card takes the panel's width and its preview the frame's proportions
    (recette 1, P0-1.2): widening the sidebar grows every card, so fewer fit
    on screen. No fixed size anywhere; a ghost gets its width from the card it
    copies.
  */
  .frame-card-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    gap: 8px;

    position: relative;
  }

  .frame-card-body {
    display: flex;
    width: 100%;
    box-sizing: border-box;
    justify-content: center;
    align-items: center;
    border-radius: 8px;
    border: 1px solid var(--affine-border-color);
    background: var(--affine-background-primary-color);
    box-shadow: 0px 0px 12px 0px rgba(66, 65, 73, 0.18);
    cursor: pointer;
    position: relative;
  }

  /* A ring, not a thicker border: the preview inside keeps its width. */
  .frame-card-container.selected .frame-card-body {
    border-color: var(--affine-primary-color);
    box-shadow: 0 0 0 1px var(--affine-primary-color);
  }

  .frame-card-body > frame-preview {
    border-radius: 7px;
    overflow: hidden;
  }

  .frame-card-container.dragging {
    pointer-events: none;
    transform-origin: 16px 8px;
    position: fixed;
    top: 0;
    left: 0;
    z-index: calc(var(--affine-z-index-popover, 0) + 3);
  }

  .frame-card-container.dragging frame-card-title {
    display: none;
  }

  /* The copy stacked behind draws no preview: it keeps a card's shape. */
  .frame-card-container.dragging .frame-card-body {
    aspect-ratio: 16 / 9;
  }

  .frame-card-container.dragging .dragging-card-number {
    position: absolute;
    bottom: 0;
    left: 0;
    transform: translate(-30%, 30%);

    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--affine-black);
    color: var(--affine-white);
    font-size: 15px;
    line-height: 24px;
    text-align: center;
    font-weight: 400;
  }

  .frame-card-container.placeholder {
    opacity: 0.5;
  }
`;

export const AFFINE_FRAME_CARD = 'affine-frame-card';

export class FrameCard extends WithDisposable(ShadowlessElement) {
  static override styles = styles;

  /**
   * Hand the press to the panel body: the threshold, the selection and the
   * drag itself belong to the side panels' one controller, which the body
   * holds (`createPanelReorderDrag`, ADR 0034).
   */
  private _dispatchDragEvent(e: PointerEvent) {
    e.preventDefault();
    if (e.button !== 0) return;

    const event: DragEvent = new CustomEvent('drag', {
      detail: { event: e },
    });
    this.dispatchEvent(event);
  }

  private _dispatchFitViewEvent(e: MouseEvent) {
    e.stopPropagation();

    const event = new CustomEvent('fitview', {
      detail: {
        block: this.frame,
      },
    });

    this.dispatchEvent(event);
  }

  private _dispatchSelectEvent(e: MouseEvent) {
    e.stopPropagation();
    const event = new CustomEvent('select', {
      detail: {
        id: this.frame.id,
        selected: this.status !== 'selected',
        index: this.cardIndex,
        multiselect: e.shiftKey,
      },
    }) as SelectEvent;

    this.dispatchEvent(event);
  }

  private _DraggingCardNumber() {
    if (this.draggingCardNumber === undefined) return nothing;

    return html`<div class="dragging-card-number">
      ${this.draggingCardNumber}
    </div>`;
  }

  override render() {
    const { pos, stackOrder, width } = this;
    const containerStyle = styleMap(
      this.status === 'dragging'
        ? {
            transform: `${
              stackOrder === 0
                ? `translate(${pos.x - 16}px, ${pos.y - 8}px)`
                : `translate(${pos.x - 10}px, ${pos.y - 16}px) scale(0.96)`
            }`,
            width: width ? `${width}px` : undefined,
          }
        : {}
    );
    return html`<div
      class="frame-card-container ${this.status ?? ''}"
      style=${containerStyle}
    >
      ${this.status === 'dragging'
        ? nothing
        : html`<affine-frame-card-title
            .cardIndex=${this.cardIndex}
            .frame=${this.frame}
            .std=${this.std}
          ></affine-frame-card-title>`}
      <div
        class="frame-card-body"
        @click=${this._dispatchSelectEvent}
        @dblclick=${this._dispatchFitViewEvent}
        @pointerdown=${this._dispatchDragEvent}
      >
        ${this.status === 'dragging' && stackOrder !== 0
          ? nothing
          : html`<frame-preview
              .frame=${this.frame}
              .std=${this.std}
              .fluid=${true}
            ></frame-preview>`}
        ${this._DraggingCardNumber()}
      </div>
    </div>`;
  }

  @property({ attribute: false })
  accessor std!: BlockStdScope;

  @property({ attribute: false })
  accessor cardIndex!: number;

  @query('.frame-card-container')
  accessor containerElement!: HTMLElement;

  @property({ attribute: false })
  accessor draggingCardNumber: number | undefined = undefined;

  @property({ attribute: false })
  accessor frame!: FrameBlockModel;

  @property({ attribute: false })
  accessor frameIndex!: string;

  @property({ attribute: false })
  accessor pos!: { x: number; y: number };

  @property({ attribute: false })
  accessor stackOrder!: number;

  @property({ attribute: false })
  accessor status: 'selected' | 'dragging' | 'placeholder' | 'none' = 'none';

  @property({ attribute: false })
  accessor width: number | undefined = undefined;
}

declare global {
  interface HTMLElementTagNameMap {
    [AFFINE_FRAME_CARD]: FrameCard;
  }
}
