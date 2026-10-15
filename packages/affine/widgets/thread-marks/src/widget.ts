import { CommentIcon } from '@blocksuite/icons/lit';
import { isPainted } from '@labre/affine-block-surface';
import {
  type ThreadMark,
  ThreadMarksProvider,
  translateKey,
} from '@labre/affine-shared/services';
import {
  isInsideEdgelessEditor,
  requestThrottledConnectedFrame,
} from '@labre/affine-shared/utils';
import { WidgetComponent } from '@labre/std';
import {
  GfxBlockElementModel,
  GfxControllerIdentifier,
  GfxPrimitiveElementModel,
} from '@labre/std/gfx';
import { effect } from '@preact/signals-core';
import { cssVarV2 } from '@toeverything/theme/v2';
import { css, html, nothing, unsafeCSS } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';

import { openThreadOn } from './toolbar.js';
import { THREAD_DISCUSS } from './translations.js';

export const AFFINE_THREAD_MARKS_WIDGET = 'affine-thread-marks-widget';

/**
 * Where a mark sits, relative to the widget's own origin: beside a block of
 * the page (`side`, in the right gutter, at the block's top), or on the
 * top-right corner of a canvas model or of a block inside a canvas note
 * (`corner`, centred on it).
 */
export interface ThreadMarkPlace {
  x: number;
  y: number;
  anchor: 'side' | 'corner';
}

export interface PlacedThreadMark extends ThreadMarkPlace {
  mark: ThreadMark;
}

/**
 * The marks to draw, from what the host says and where the editor finds each
 * target. Pure, so the "ignore what is absent" rule is held by a test:
 *
 * - a target `locate` cannot find (deleted, of the other view, hidden for this
 *   viewer) is skipped, never an error: an orphan anchor has no mark;
 * - a mark at `count <= 0` is not drawn;
 * - two marks on one target are one mark: counts add up, unread wins.
 */
export function placeThreadMarks(
  marks: readonly ThreadMark[],
  locate: (mark: ThreadMark) => ThreadMarkPlace | null
): PlacedThreadMark[] {
  const merged = new Map<string, ThreadMark>();
  for (const mark of marks) {
    if (!(mark.count > 0)) continue;
    const key = `${mark.targetType}:${mark.targetId}`;
    const seen = merged.get(key);
    merged.set(
      key,
      seen
        ? {
            ...seen,
            count: seen.count + mark.count,
            unread: seen.unread || mark.unread,
          }
        : mark
    );
  }
  const placed: PlacedThreadMark[] = [];
  for (const mark of merged.values()) {
    const place = locate(mark);
    if (place) placed.push({ ...place, mark });
  }
  return placed;
}

/**
 * The "has a thread" marks (ADR 0038), one widget for both views, mounted on
 * the root like `remote-selection`: in the page view beside each marked block,
 * on the canvas on the corner of each marked element or block. A click asks
 * the host to open the discussion, exactly as "Discuss" does.
 *
 * It reads the seam and the layout, and writes nothing. Positions are
 * client rects taken relative to the widget's own box and recomputed, once a
 * frame at most, when the marks, the document, the canvas or the window
 * change. Without the seam it renders nothing.
 */
export class ThreadMarksWidget extends WidgetComponent {
  static override styles = css`
    :host {
      position: absolute;
      top: 0;
      left: 0;
      width: 0;
      height: 0;
      overflow: visible;
      pointer-events: none;
      z-index: 1;
    }

    .thread-mark {
      position: absolute;
      top: 0;
      left: 0;
      gap: 2px;
      padding: 0 6px 0 4px;
      border-radius: 12px;
      border: 1px solid ${unsafeCSS(cssVarV2('layer/insideBorder/border'))};
      background: ${unsafeCSS(cssVarV2('layer/background/overlayPanel'))};
      box-shadow: var(--affine-shadow-1);
      color: ${unsafeCSS(cssVarV2('text/secondary'))};
      pointer-events: auto;
    }

    .thread-mark[data-unread] {
      color: ${unsafeCSS(cssVarV2('text/emphasis'))};
    }

    @media (pointer: coarse) {
      .thread-mark::after {
        content: '';
        position: absolute;
        inset: -10px;
      }
    }
  `;

  private readonly _refresh = requestThrottledConnectedFrame(() => {
    this.requestUpdate();
  }, this);

  private get _edgeless() {
    return isInsideEdgelessEditor(this.std.host);
  }

  override connectedCallback() {
    super.connectedCallback();
    const { _disposables, std } = this;
    // The seam is fixed for the editor's life: without it, follow nothing,
    // so a host that has no threads pays nothing on a pan or a keystroke.
    if (!std.getOptional(ThreadMarksProvider)) return;

    _disposables.add(std.store.slots.blockUpdated.subscribe(this._refresh));
    // A block mounts after the widget: a mark on it can only be placed then.
    _disposables.add(std.view.viewUpdated.subscribe(this._refresh));
    _disposables.addFromEvent(window, 'resize', this._refresh);
    // Capture: the page view scrolls in a container, not the window.
    _disposables.addFromEvent(window, 'scroll', this._refresh, true);

    const gfx = std.getOptional(GfxControllerIdentifier);
    if (gfx) {
      _disposables.add(gfx.viewport.viewportUpdated.subscribe(this._refresh));
      // The surface may load after the widget connects: follow it.
      _disposables.add(
        effect(() => {
          const surface = gfx.surface$.value;
          if (!surface) return;
          this._refresh();
          const subscriptions = [
            surface.elementAdded.subscribe(this._refresh),
            surface.elementRemoved.subscribe(this._refresh),
            surface.elementUpdated.subscribe(this._refresh),
          ];
          return () => subscriptions.forEach(s => s.unsubscribe());
        })
      );
    }
  }

  private _locate(mark: ThreadMark, origin: DOMRect): ThreadMarkPlace | null {
    const edgeless = this._edgeless;
    if (edgeless) {
      const gfx = this.std.get(GfxControllerIdentifier);
      const model = gfx.getElementById(mark.targetId);
      if (
        model instanceof GfxPrimitiveElementModel ||
        model instanceof GfxBlockElementModel
      ) {
        // What this viewer does not see carries no mark (ADR 0031): the
        // renderers' own predicate for an element, the local hide for a block.
        const painted =
          model instanceof GfxPrimitiveElementModel
            ? isPainted(model, gfx.localVisibility)
            : !gfx.localVisibility.isHidden(model);
        if (!painted) return null;
        const bound = model.elementBound;
        const [x, y] = gfx.viewport.toViewCoord(bound.maxX, bound.y);
        return {
          x: x + gfx.viewport.left - origin.left,
          y: y + gfx.viewport.top - origin.top,
          anchor: 'corner',
        };
      }
    }
    if (mark.targetType !== 'block') return null;

    const block = this.std.view.getBlock(mark.targetId);
    if (!block) return null;
    const rect = block.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return null;
    return {
      x: rect.right - origin.left,
      y: rect.top - origin.top,
      anchor: edgeless ? 'corner' : 'side',
    };
  }

  override render() {
    const service = this.std.getOptional(ThreadMarksProvider);
    if (!service) return nothing;
    const marks = service.marks$.value;
    if (marks.length === 0) return nothing;

    const origin = this.getBoundingClientRect();
    const placed = placeThreadMarks(marks, mark => this._locate(mark, origin));
    if (placed.length === 0) return nothing;

    const label = translateKey(this.std, ...THREAD_DISCUSS);
    return repeat(
      placed,
      ({ mark }) => `${mark.targetType}:${mark.targetId}`,
      ({ mark, x, y, anchor }) =>
        html`<icon-button
          class="thread-mark"
          data-testid="thread-mark"
          data-target-type=${mark.targetType}
          data-target-id=${mark.targetId}
          ?data-unread=${mark.unread}
          width="auto"
          height="24px"
          .active=${mark.unread}
          .text=${String(mark.count)}
          aria-label=${label}
          title=${label}
          style=${styleMap({
            transform:
              anchor === 'side'
                ? `translate(${x + 8}px, ${y}px)`
                : `translate(${x}px, ${y}px) translate(-50%, -50%)`,
          })}
          @pointerdown=${(event: PointerEvent) => event.stopPropagation()}
          @click=${(event: MouseEvent) => {
            event.stopPropagation();
            openThreadOn(this.std, {
              targetType: mark.targetType,
              targetId: mark.targetId,
            });
          }}
          >${CommentIcon({ width: '16px', height: '16px' })}</icon-button
        >`
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    [AFFINE_THREAD_MARKS_WIDGET]: ThreadMarksWidget;
  }
}
