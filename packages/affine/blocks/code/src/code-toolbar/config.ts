import {
  CancelWrapIcon,
  CaptionIcon,
  CopyIcon,
  DeleteIcon,
  DuplicateIcon,
  WrapIcon,
} from '@labre/affine-components/icons';
import type { MenuItemGroup } from '@labre/affine-components/toolbar';
import {
  CommentProviderIdentifier,
  DocModeProvider,
  TelemetryProvider,
  translateKey,
} from '@labre/affine-shared/services';
import { isInsidePageEditor } from '@labre/affine-shared/utils';
import { noop, sleep } from '@labre/global/utils';
import {
  CollapseIcon,
  CommentIcon,
  NumberedListIcon,
  ToggleRightIcon,
} from '@blocksuite/icons/lit';
import { BlockSelection } from '@labre/std';
import { html } from 'lit';

import { CodeBlockConfigExtension } from '../code-block-config.js';
import {
  CODE_TOOLBAR_CANCEL_LINE_NUMBER,
  CODE_TOOLBAR_CANCEL_WRAP,
  CODE_TOOLBAR_CAPTION,
  CODE_TOOLBAR_COLLAPSE,
  CODE_TOOLBAR_COMMENT,
  CODE_TOOLBAR_COPY_CODE,
  CODE_TOOLBAR_DELETE,
  CODE_TOOLBAR_DUPLICATE,
  CODE_TOOLBAR_EXPAND,
  CODE_TOOLBAR_LINE_NUMBER,
  CODE_TOOLBAR_WRAP,
} from '../translations.js';
import type { CodeBlockToolbarContext } from './context.js';
import { duplicateCodeBlock } from './utils.js';

// Upstream keeps these two in `@blocksuite/affine-components/icons`; we build
// them here so the code block owns its own toolbar glyphs.
const CollapseCodeIcon = CollapseIcon({ width: '20', height: '20' });
const ExpandCodeIcon = ToggleRightIcon({ width: '20', height: '20' });

export const PRIMARY_GROUPS: MenuItemGroup<CodeBlockToolbarContext>[] = [
  {
    type: 'primary',
    items: [
      {
        type: 'change-lang',
        generate: ({ blockComponent, setActive }) => {
          const state = { active: false };
          return {
            action: noop,
            render: () =>
              html`<language-list-button
                .blockComponent=${blockComponent}
                .onActiveStatusChange=${async (active: boolean) => {
                  state.active = active;
                  if (!active) {
                    await sleep(1000);
                    if (state.active) return;
                  }
                  setActive(active);
                }}
              >
              </language-list-button>`,
          };
        },
      },
      {
        type: 'preview',
        generate: ({ blockComponent }) => {
          return {
            action: noop,
            render: () => html`
              <preview-button .blockComponent=${blockComponent}>
              </preview-button>
            `,
          };
        },
      },
      {
        type: 'copy-code',
        label: 'Copy code',
        icon: CopyIcon,
        generate: ({ blockComponent }) => {
          return {
            action: () => {
              blockComponent.copyCode();
            },
            render: item => {
              const label = translateKey(
                blockComponent.std,
                ...CODE_TOOLBAR_COPY_CODE
              );
              return html`
                <editor-icon-button
                  class="code-toolbar-button copy-code"
                  aria-label=${label}
                  .tooltip=${label}
                  .tooltipOffset=${4}
                  .iconSize=${'16px'}
                  .iconContainerPadding=${4}
                  @click=${(e: MouseEvent) => {
                    e.stopPropagation();
                    item.action();
                  }}
                >
                  ${item.icon}
                </editor-icon-button>
              `;
            },
          };
        },
      },
      {
        type: 'collapse',
        when: ({ doc }) => !doc.readonly,
        generate: ({ blockComponent }) => {
          return {
            action: () => {
              const collapsed = !blockComponent.collapsed$.value;
              blockComponent.setCollapsed(collapsed);

              const std = blockComponent.std;
              const mode =
                std.getOptional(DocModeProvider)?.getEditorMode() ?? 'page';
              std
                .getOptional(TelemetryProvider)
                ?.track('codeBlockToggleCollapse', {
                  page: mode,
                  segment: 'code block',
                  module: 'code toolbar container',
                  control: 'collapse button',
                  type: collapsed ? 'collapse' : 'expand',
                });
            },
            render: item => {
              const collapsed = blockComponent.collapsed$.value;
              const icon = collapsed ? ExpandCodeIcon : CollapseCodeIcon;
              const label = translateKey(
                blockComponent.std,
                ...(collapsed ? CODE_TOOLBAR_EXPAND : CODE_TOOLBAR_COLLAPSE)
              );
              return html`
                <editor-icon-button
                  class="code-toolbar-button collapse"
                  aria-label=${label}
                  .tooltip=${label}
                  .tooltipOffset=${4}
                  .iconSize=${'16px'}
                  .iconContainerPadding=${4}
                  @click=${(e: MouseEvent) => {
                    e.stopPropagation();
                    item.action();
                  }}
                >
                  ${icon}
                </editor-icon-button>
              `;
            },
          };
        },
      },
      {
        type: 'caption',
        label: 'Caption',
        icon: CaptionIcon,
        when: ({ doc }) => !doc.readonly,
        generate: ({ blockComponent }) => {
          return {
            action: () => {
              blockComponent.captionEditor?.show();
            },
            render: item => {
              const label = translateKey(
                blockComponent.std,
                ...CODE_TOOLBAR_CAPTION
              );
              return html`
                <editor-icon-button
                  class="code-toolbar-button caption"
                  aria-label=${label}
                  .tooltip=${label}
                  .tooltipOffset=${4}
                  .iconSize=${'16px'}
                  .iconContainerPadding=${4}
                  @click=${(e: MouseEvent) => {
                    e.stopPropagation();
                    item.action();
                  }}
                >
                  ${item.icon}
                </editor-icon-button>
              `;
            },
          };
        },
      },
      {
        type: 'comment',
        label: 'Comment',
        tooltip: 'Comment',
        icon: CommentIcon({
          width: '20',
          height: '20',
        }),
        when: ({ std }) => !!std.getOptional(CommentProviderIdentifier),
        generate: ({ blockComponent }) => {
          return {
            action: () => {
              const commentProvider = blockComponent.std.getOptional(
                CommentProviderIdentifier
              );
              if (!commentProvider) return;

              commentProvider.addComment([
                new BlockSelection({
                  blockId: blockComponent.model.id,
                }),
              ]);
            },
            render: item => {
              const label = translateKey(
                blockComponent.std,
                ...CODE_TOOLBAR_COMMENT
              );
              return html`<editor-icon-button
                class="code-toolbar-button comment"
                aria-label=${label}
                .tooltip=${label}
                .tooltipOffset=${4}
                .iconSize=${'16px'}
                .iconContainerPadding=${4}
                @click=${(e: MouseEvent) => {
                  e.stopPropagation();
                  item.action();
                }}
              >
                ${item.icon}
              </editor-icon-button>`;
            },
          };
        },
      },
    ],
  },
];

export const toggleGroup: MenuItemGroup<CodeBlockToolbarContext> = {
  type: 'toggle',
  items: [
    {
      type: 'wrap',
      generate: ({ blockComponent }) => {
        return {
          action: () => {},
          render: () => {
            const wrapped = blockComponent.model.props.wrap;
            const label = translateKey(
              blockComponent.std,
              ...(wrapped ? CODE_TOOLBAR_CANCEL_WRAP : CODE_TOOLBAR_WRAP)
            );
            const icon = wrapped ? CancelWrapIcon : WrapIcon;
            return html`
              <editor-menu-action
                @click=${() => {
                  const currentWrap = blockComponent.model.props.wrap;
                  blockComponent.setWrap(!currentWrap);
                }}
                aria-label=${label}
              >
                ${icon}
                <span class="label">${label}</span>
                <toggle-switch
                  style="margin-left: auto;"
                  .on="${wrapped}"
                ></toggle-switch>
              </editor-menu-action>
            `;
          },
        };
      },
    },
    {
      type: 'line-number',
      when: ({ std }) =>
        std.getOptional(CodeBlockConfigExtension.identifier)?.showLineNumbers ??
        true,
      generate: ({ blockComponent }) => {
        return {
          action: () => {},
          render: () => {
            const lineNumber = blockComponent.showLineNumbers;
            const label = translateKey(
              blockComponent.std,
              ...(lineNumber
                ? CODE_TOOLBAR_CANCEL_LINE_NUMBER
                : CODE_TOOLBAR_LINE_NUMBER)
            );
            return html`
              <editor-menu-action
                @click=${() => {
                  blockComponent.store.updateBlock(blockComponent.model, {
                    lineNumber: !blockComponent.showLineNumbers,
                  });
                }}
                aria-label=${label}
              >
                ${NumberedListIcon()}
                <span class="label">${label}</span>
                <toggle-switch
                  style="margin-left: auto;"
                  .on="${lineNumber}"
                ></toggle-switch>
              </editor-menu-action>
            `;
          },
        };
      },
    },
  ],
};

// Clipboard Group
export const clipboardGroup: MenuItemGroup<CodeBlockToolbarContext> = {
  type: 'clipboard',
  items: [
    {
      type: 'duplicate',
      // `MenuItemGroup`'s default renderer (`renderActions`,
      // `@labre/affine-components/toolbar`) draws a plain `action` item's
      // static `label` with no wording seam of its own — but `generate` DOES
      // reach `std` (via `blockComponent`, exactly like every other item in
      // this file), so the wording is resolved in a `render` override instead
      // of relying on the generic renderer.
      icon: DuplicateIcon,
      when: ({ doc }) => !doc.readonly,
      generate: ({ host, blockComponent, close }) => {
        return {
          action: () => {
            const codeId = duplicateCodeBlock(blockComponent.model);

            host.updateComplete
              .then(() => {
                host.selection.setGroup('note', [
                  host.selection.create(BlockSelection, {
                    blockId: codeId,
                  }),
                ]);

                if (isInsidePageEditor(host)) {
                  const duplicateElement = host.view.getBlock(codeId);
                  if (duplicateElement) {
                    duplicateElement.scrollIntoView({ block: 'nearest' });
                  }
                }
              })
              .catch(console.error);

            close();
          },
          render: item => {
            const label = translateKey(
              blockComponent.std,
              ...CODE_TOOLBAR_DUPLICATE
            );
            return html`
              <editor-menu-action
                class="code-toolbar-button duplicate"
                aria-label=${label}
                @click=${() => item.action()}
              >
                ${item.icon}
                <span class="label">${label}</span>
              </editor-menu-action>
            `;
          },
        };
      },
    },
  ],
};

// Delete Group
export const deleteGroup: MenuItemGroup<CodeBlockToolbarContext> = {
  type: 'delete',
  items: [
    {
      type: 'delete',
      // See the note on `duplicate` above.
      icon: DeleteIcon,
      when: ({ doc }) => !doc.readonly,
      generate: ({ doc, blockComponent, close }) => {
        return {
          action: () => {
            doc.deleteBlock(blockComponent.model);
            close();
          },
          render: item => {
            const label = translateKey(
              blockComponent.std,
              ...CODE_TOOLBAR_DELETE
            );
            return html`
              <editor-menu-action
                class="code-toolbar-button delete"
                aria-label=${label}
                @click=${() => item.action()}
              >
                ${item.icon}
                <span class="label">${label}</span>
              </editor-menu-action>
            `;
          },
        };
      },
    },
  ],
};

export const MORE_GROUPS: MenuItemGroup<CodeBlockToolbarContext>[] = [
  toggleGroup,
  clipboardGroup,
  deleteGroup,
];
