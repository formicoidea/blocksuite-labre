import { RefNodeSlotsProvider } from '@labre/affine-inline-reference';
import type { RootBlockModel } from '@labre/affine-model';
import { requestThrottledConnectedFrame } from '@labre/affine-shared/utils';
import { WidgetComponent } from '@labre/std';
import {
  GfxControllerIdentifier,
  type GfxModel,
  GfxPrimitiveElementModel,
} from '@labre/std/gfx';
import { OpenInNewIcon, RightSidebarIcon } from '@blocksuite/icons/lit';
import { css, html, nothing } from 'lit';
import { state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';

export const EDGELESS_ELEMENT_LINK_WIDGET = 'edgeless-element-link';

type ViewRect = { left: number; top: number; width: number; height: number };

/**
 * Shows a clickable arrow when hovering a drawing element that carries a link
 * ({@link GfxPrimitiveElementModel.linkedDocId} or `.externalLink`). Clicking it
 * opens the linked doc (host side-view via `docLinkClicked`) or the URL.
 *
 * ponytail: hover is resolved via `getElementByPoint`, which returns the topmost
 * leaf — a link set on a group only shows when a child is hovered. Good enough
 * for v1 (shapes/text/connectors are hit directly).
 */
export class EdgelessElementLinkWidget extends WidgetComponent<RootBlockModel> {
  static override styles = css`
    :host {
      position: absolute;
      top: 0;
      left: 0;
      z-index: 1;
      pointer-events: none;
    }

    .open-link-button {
      position: absolute;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 4px;
      background: var(--affine-background-overlay-panel-color, #fff);
      box-shadow: var(--affine-shadow-1);
      color: var(--affine-icon-color);
      cursor: pointer;
      pointer-events: auto;
      transform: translate(-50%, -50%);
    }

    .open-link-button:hover {
      background: var(--affine-hover-color);
    }

    .open-link-button svg {
      width: 16px;
      height: 16px;
    }
  `;

  private _hideTimer: ReturnType<typeof setTimeout> | null = null;

  @state()
  private accessor _target: GfxPrimitiveElementModel | null = null;

  @state()
  private accessor _rect: ViewRect | null = null;

  get gfx() {
    return this.std.get(GfxControllerIdentifier);
  }

  private readonly _updateRect = requestThrottledConnectedFrame(() => {
    const el = this._target;
    if (!el) {
      this._rect = null;
      return;
    }
    const bound = el.elementBound;
    const { viewport } = this.gfx;
    const [left, top] = viewport.toViewCoord(bound.x, bound.y);
    this._rect = {
      left,
      top,
      width: bound.w * viewport.zoom,
      height: bound.h * viewport.zoom,
    };
  }, this);

  private _hasLink(el: unknown): el is GfxPrimitiveElementModel {
    return (
      el instanceof GfxPrimitiveElementModel &&
      Boolean(el.linkedDocId || el.externalLink)
    );
  }

  private _setTarget(el: GfxPrimitiveElementModel | null) {
    if (el) {
      if (this._hideTimer) {
        clearTimeout(this._hideTimer);
        this._hideTimer = null;
      }
      this._target = el;
      this._updateRect();
      return;
    }
    // Delay hiding so the pointer can travel from the element to the button.
    if (this._target && !this._hideTimer) {
      this._hideTimer = setTimeout(() => {
        this._hideTimer = null;
        this._target = null;
        this._rect = null;
      }, 200);
    }
  }

  /** The hovered element if it carries a link, else its nearest linked group. */
  private _resolveLinked(
    hit: GfxModel | null
  ): GfxPrimitiveElementModel | null {
    if (this._hasLink(hit)) return hit;
    const groups = hit instanceof GfxPrimitiveElementModel ? hit.groups : [];
    for (const group of groups) {
      if (this._hasLink(group)) return group;
    }
    return null;
  }

  private readonly _open = (e: Event) => {
    e.stopPropagation();
    const el = this._target;
    if (!el) return;
    if (el.linkedDocId) {
      this.std.getOptional(RefNodeSlotsProvider)?.docLinkClicked.next({
        pageId: el.linkedDocId,
        host: this.std.host,
      });
    } else if (el.externalLink) {
      window.open(el.externalLink, '_blank', 'noopener,noreferrer');
    }
  };

  private readonly _onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this._open(e);
    }
  };

  override firstUpdated() {
    const { _disposables, gfx } = this;

    _disposables.add(
      this.std.host.event.add('pointerMove', ctx => {
        const evt = ctx.get('pointerState');
        const [x, y] = gfx.viewport.toModelCoord(evt.x, evt.y);
        this._setTarget(this._resolveLinked(gfx.getElementByPoint(x, y)));
      })
    );

    _disposables.add(
      gfx.viewport.viewportUpdated.subscribe(() => {
        if (this._target) this._updateRect();
      })
    );

    _disposables.add(() => {
      if (this._hideTimer) clearTimeout(this._hideTimer);
    });
  }

  override render() {
    const rect = this._rect;
    const target = this._target;
    if (!target || !rect) return nothing;

    const isDoc = Boolean(target.linkedDocId);
    const label = isDoc ? 'Open linked doc' : 'Open link';

    return html`<div
      class="open-link-button"
      role="button"
      tabindex="0"
      title=${label}
      aria-label=${label}
      style=${styleMap({
        left: `${rect.left + rect.width}px`,
        top: `${rect.top}px`,
      })}
      @click=${this._open}
      @keydown=${this._onKeydown}
      @pointerenter=${() => this._setTarget(target)}
      @pointerleave=${() => this._setTarget(null)}
    >
      ${isDoc ? RightSidebarIcon() : OpenInNewIcon()}
    </div>`;
  }
}
