import {
  DefaultTool,
  EdgelessCRUDIdentifier,
} from '@labre/affine-block-surface';
import { EmptyTool } from '@labre/affine-gfx-pointer';
import { TextTool } from '@labre/affine-gfx-text';
import type {
  MindmapElementModel,
  MindmapStyle,
} from '@labre/affine-model';
import {
  EditPropsStore,
  ViewportElementProvider,
} from '@labre/affine-shared/services';
import {
  EdgelessDraggableElementController,
  EdgelessToolbarToolMixin,
} from '@labre/affine-widget-edgeless-toolbar';
import type { Bound } from '@labre/global/gfx';
import { SignalWatcher } from '@labre/global/lit';
import { computed } from '@preact/signals-core';
import { css, html, LitElement, nothing } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';

import { getMindMaps } from './assets.js';
import {
  type DraggableTool,
  getMindmapRender,
  mediaConfig,
  mediaRender,
  mindmapConfig,
  textConfig,
  textRender,
  toolConfig2StyleObj,
} from './basket-elements.js';
import { mindmapMenuMediaIcon, textIcon } from './icons.js';
import { importMindmap } from './utils/import-mindmap.js';

export class EdgelessMindmapToolButton extends EdgelessToolbarToolMixin(
  SignalWatcher(LitElement)
) {
  static override styles = css`
    :host {
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      /* Make this button the containing block of the popup's clip wrapper so
         the "Others" sub-menu anchors to THIS button (not the whole toolbar)
         and can be right-aligned to it — mirrors the framework senior buttons.
         Without this the menu drifts when senior buttons are hidden. */
      position: relative;
    }
    .partial-clip {
      flex-shrink: 0;
      box-sizing: border-box;
      width: calc(100% + 20px);
      pointer-events: none;
      padding: 0 10px;
      overflow: hidden;
    }
    /* Icons sit centered in the slot — no basket tray. */
    .basket-wrapper {
      pointer-events: auto;
      height: 64px;
      width: 96px;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 4px;
      position: relative;
    }
    .basket-tool-item {
      position: relative;
      cursor: grab;
      transition: transform 0.3s ease-in-out;
    }
    .basket-tool-item svg {
      display: block;
      max-width: 46px;
      max-height: 46px;
      width: auto;
      height: auto;
    }
    /* the drag clone flies in/out using its captured offsets */
    .basket-tool-item.next {
      position: absolute;
      transform: translate(var(--next-x, 0), var(--next-y, 0))
        rotate(var(--next-r, 0)) scale(var(--next-s, 1));
      z-index: var(--next-z, 0);
    }
    .basket-wrapper:hover .basket-tool-item.current,
    .basket-wrapper.active .basket-tool-item.current {
      transform: translateY(-6px) scale(1.06);
    }
  `;

  private readonly _style$ = computed(() => {
    const { style } =
      this.edgeless.std.get(EditPropsStore).lastProps$.value.mindmap;
    return style;
  });

  draggableController!: EdgelessDraggableElementController<DraggableTool>;

  override enableActiveBackground = true;

  override type = [EmptyTool, TextTool];

  get draggableTools(): DraggableTool[] {
    // The dedicated "Mind Map" button carries only the mindmap tool; the
    // "Others" button keeps free-text + add-file.
    if (this.variant === 'mindmap') {
      const style = this._style$.value;
      const mindmap =
        this.mindmaps.find(m => m.style === style) || this.mindmaps[0];
      return [
        {
          name: 'mindmap',
          icon: mindmap.icon,
          config: mindmapConfig,
          standardWidth: 350,
          render: getMindmapRender(style),
        },
      ];
    }
    return [
      {
        name: 'media',
        icon: mindmapMenuMediaIcon,
        config: mediaConfig,
        standardWidth: 100,
        render: mediaRender,
      },
      {
        name: 'text',
        icon: textIcon,
        config: textConfig,
        standardWidth: 100,
        render: textRender,
      },
    ];
  }

  get mindmaps() {
    return getMindMaps(this.theme);
  }

  get crud() {
    return this.edgeless.std.get(EdgelessCRUDIdentifier);
  }

  private _toggleMenu() {
    if (this.tryDisposePopper()) return;
    this.setEdgelessTool(DefaultTool);

    const menu = this.createPopper('edgeless-mindmap-menu', this);
    Object.assign(menu.element, {
      edgeless: this.edgeless,
      variant: this.variant,
      onActiveStyleChange: (style: MindmapStyle) => {
        this.edgeless.std.get(EditPropsStore).recordLastProps('mindmap', {
          style,
        });
      },
      onImportMindMap: (bound: Bound) => {
        return importMindmap(bound).then(mindmap => {
          const id = this.crud.addElement('mindmap', {
            children: mindmap,
            layoutType: mindmap?.layoutType === 'left' ? 1 : 0,
          });
          if (!id) return;
          const element = this.crud.getElementById(id) as MindmapElementModel;

          this.tryDisposePopper();
          this.setEdgelessTool(DefaultTool);
          this.gfx.selection.set({
            elements: [element.tree.id],
            editing: false,
          });
        });
      },
    });

    // Right-align the menu's right edge to this button's right edge, like the
    // framework senior buttons. Stays correct however many buttons are hidden.
    const el = menu.element as HTMLElement;
    const wrap = el.parentElement;
    if (wrap) {
      wrap.style.overflow = 'visible';
      wrap.style.justifyContent = 'flex-end';
    }
    Object.assign(el.style, {
      position: 'static',
      width: 'max-content',
      maxWidth: 'calc(100vw - 16px)',
      marginLeft: '0',
    });
  }

  initDragController() {
    if (!this.edgeless || !this.toolbarContainer) return;
    if (this.draggableController) return;
    this.draggableController = new EdgelessDraggableElementController(this, {
      edgeless: this.edgeless,
      scopeElement: this.toolbarContainer,
      standardWidth: 100,
      clickToDrag: false,
      onOverlayCreated: (overlay, { data }) => {
        const tool = this.draggableTools.find(t => t.name === data.name);
        if (!tool) return;

        // recover the rotation
        const rotate = tool.config?.hover?.r ?? tool.config?.default?.r ?? 0;
        overlay.element.style.setProperty('--rotate', rotate + 'deg');
        setTimeout(() => {
          overlay.transitionWrapper.style.setProperty(
            '--rotate',
            -rotate + 'deg'
          );
        }, 50);

        // set the scale (without transition)
        const scale = tool.config?.hover?.s ?? tool.config?.default?.s ?? 1;
        overlay.element.style.setProperty('--scale', `${scale}`);

        // a workaround to handle getBoundingClientRect() when the element is rotated
        const _left = parseInt(overlay.element.style.left);
        const _top = parseInt(overlay.element.style.top);
        if (data.name === 'mindmap') {
          overlay.element.style.left = _left + 3 + 'px';
          overlay.element.style.top = _top + 5 + 'px';
        } else if (data.name === 'text') {
          overlay.element.style.left = _left + 0 + 'px';
          overlay.element.style.top = _top + 3 + 'px';
        }
        this.readyToDrop = true;
      },
      onCanceled: overlay => {
        overlay.transitionWrapper.style.transformOrigin = 'unset';
        overlay.transitionWrapper.style.setProperty('--rotate', '0deg');
        this.readyToDrop = false;
      },
      onDrop: (el, bound) => {
        el.data
          .render(bound, this.edgeless)
          .then(id => {
            if (!id) return;
            this.readyToDrop = false;
            if (el.data.name === 'mindmap') {
              this.setEdgelessTool(DefaultTool);
              this.gfx.selection.set({
                elements: [id],
                editing: false,
              });
            } else if (el.data.name === 'text') {
              this.setEdgelessTool(DefaultTool);
            }
          })
          .catch(console.error);
      },
    });

    // The `m` shortcut belongs to the dedicated Mind Map button only.
    if (this.variant === 'mindmap') {
      this.edgeless.bindHotKey(
        {
          m: () => {
            const gfx = this.gfx;
            const locked = gfx.viewport.locked;
            if (locked) return;
            if (gfx.selection.editing) return;

            if (this.readyToDrop) {
            // change the style
            const activeIndex = this.mindmaps.findIndex(
              m => m.style === this._style$.value
            );
            const nextIndex = (activeIndex + 1) % this.mindmaps.length;
            const next = this.mindmaps[nextIndex];
            this.edgeless.std.get(EditPropsStore).recordLastProps('mindmap', {
              style: next.style,
            });
            const tool = this.draggableTools.find(t => t.name === 'mindmap');
            this.draggableController.updateElementInfo({
              data: tool,
              preview: next.icon,
            });
            return;
          }
          this.setEdgelessTool(EmptyTool);
          const icon = this.mindmapElement;
          const { x, y } = gfx.tool.lastMouseViewPos$.peek();
          const { viewport } = this.edgeless.std.get(ViewportElementProvider);
          const { left, top } = viewport;
          const clientPos = { x: x + left, y: y + top };
          this.draggableController.dragAndMoveTo(icon, clientPos);
        },
      },
      { global: true }
    );
    }

    // since there is not a tool called mindmap, we need to cancel the drag when the tool is changed
    this.disposables.add(
      this.gfx.tool.currentToolName$.subscribe(toolName => {
        // FIXME: remove the assertion after gfx tool refactor
        if ((toolName as string) !== 'empty' && this.readyToDrop) {
          this.draggableController.cancel();
        }
      })
    );
  }

  override render() {
    const { popper } = this;
    const { cancelled, dragOut, draggingElement } =
      this.draggableController?.states || {};

    const active = popper || draggingElement;

    return html`<edgeless-toolbar-button
      class="edgeless-mindmap-button"
      ?withHover=${true}
      .tooltip=${popper ? '' : this.variant === 'mindmap' ? 'Mind Map' : 'Others'}
      .tooltipOffset=${4}
      @click=${this._toggleMenu}
      style="width: 100%; height: 100%; display: inline-block"
    >
      <div class="partial-clip">
        <div class="basket-wrapper ${active ? 'active' : ''}">
          ${repeat(
            this.draggableTools,
            t => t.name,
            tool => {
              const isBeingDragged = draggingElement?.data.name === tool.name;
              const variables = toolConfig2StyleObj(tool.config);

              const nextStyle = styleMap({
                ...variables,
              });
              const currentStyle = styleMap({
                ...variables,
                opacity: isBeingDragged ? 0 : 1,
                pointerEvents: draggingElement ? 'none' : 'auto',
              });

              return html`${isBeingDragged
                  ? html`<div
                      class=${classMap({
                        'basket-tool-item': true,
                        next: true,
                        coming: !!dragOut && !cancelled,
                      })}
                      style=${nextStyle}
                    >
                      ${tool.icon}
                    </div>`
                  : nothing}

                <div
                  style=${currentStyle}
                  @mousedown=${(e: MouseEvent) =>
                    this.draggableController.onMouseDown(e, {
                      data: tool,
                      preview: tool.icon,
                      standardWidth: tool.standardWidth,
                    })}
                  @touchstart=${(e: TouchEvent) =>
                    this.draggableController.onTouchStart(e, {
                      data: tool,
                      preview: tool.icon,
                      standardWidth: tool.standardWidth,
                    })}
                  class="basket-tool-item current ${tool.name}"
                >
                  ${tool.icon}
                </div>`;
            }
          )}
        </div>
      </div>
    </edgeless-toolbar-button>`;
  }

  override updated(_changedProperties: Map<PropertyKey, unknown>) {
    const controllerRequiredProps = ['edgeless', 'toolbarContainer'] as const;
    if (
      controllerRequiredProps.some(p => _changedProperties.has(p)) &&
      !this.draggableController
    ) {
      this.initDragController();
    }
  }

  /** `'mindmap'` → the dedicated Mind Map button; `'other'` → free-text +
   * add-file ("Others"). Drives the tools, tooltip, `m` shortcut and menu. */
  @property({ attribute: false })
  accessor variant: 'mindmap' | 'other' = 'other';

  @query('.basket-tool-item.mindmap')
  accessor mindmapElement!: HTMLElement;

  @state()
  accessor readyToDrop = false;
}
