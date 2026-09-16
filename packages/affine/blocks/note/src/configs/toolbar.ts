import { EdgelessLegacySlotIdentifier } from '@labre/affine-block-surface';
import { NoteBlockModel, NoteDisplayMode } from '@labre/affine-model';
import {
  NotificationProvider,
  SidebarExtensionIdentifier,
  TOAST_NOTE_REMOVED_FROM_PAGE,
  type ToolbarAction,
  type ToolbarContext,
  type ToolbarModuleConfig,
  ToolbarModuleExtension,
  translateKey,
} from '@labre/affine-shared/services';
import { Bound } from '@labre/global/gfx';
import {
  AutoHeightIcon,
  CustomizedHeightIcon,
  InsertIntoPageIcon,
  ScissorsIcon,
} from '@blocksuite/icons/lit';
import { BlockFlavourIdentifier } from '@labre/std';
import type { ExtensionType } from '@labre/store';
import { computed } from '@preact/signals-core';
import { html } from 'lit';

import { changeNoteDisplayMode } from '../commands';
import { NoteConfigExtension } from '../config';
import {
  NOTE_TOAST_ADDED_TO_PAGE_BODY,
  NOTE_TOAST_DISPLAYED_IN_PAGE_MODE,
  NOTE_TOAST_REMOVED_FROM_PAGE_BODY,
  NOTE_TOAST_VIEW_IN_TOC,
  NOTE_TOOLBAR_AUTO_HEIGHT,
  NOTE_TOOLBAR_CUSTOMIZED_HEIGHT,
  NOTE_TOOLBAR_CUTTING_MODE,
  NOTE_TOOLBAR_DISPLAY_IN_PAGE,
  NOTE_TOOLBAR_DISPLAYED_IN_PAGE,
  NOTE_TOOLBAR_REMOVE_FROM_PAGE_TOOLTIP,
  NOTE_TOOLBAR_SIZE,
  NOTE_TOOLBAR_SLICER,
} from '../translations.js';

const trackBaseProps = {
  category: 'note',
};

const builtinSurfaceToolbarConfig = {
  actions: [
    {
      id: 'a.show-in',
      when(ctx) {
        return (
          ctx.getSurfaceModelsByType(NoteBlockModel).length === 1 &&
          ctx.features.getFlag('enable_advanced_block_visibility')
        );
      },
      content(ctx) {
        const models = ctx.getSurfaceModelsByType(NoteBlockModel);
        if (!models.length) return null;

        const firstModel = models[0];
        const { displayMode } = firstModel.props;
        const onSelect = (e: CustomEvent<NoteDisplayMode>) => {
          e.stopPropagation();

          const newMode = e.detail;
          setDisplayMode(ctx, firstModel, newMode);
        };

        return html`
          <edgeless-note-display-mode-dropdown-menu
            .std=${ctx.std}
            @select=${onSelect}
            .displayMode="${displayMode}"
          >
          </edgeless-note-display-mode-dropdown-menu>
        `;
      },
    },
    {
      id: 'b.display-in-page',
      when(ctx) {
        const elements = ctx.getSurfaceModelsByType(NoteBlockModel);
        return (
          elements.length === 1 &&
          !elements[0].isPageBlock() &&
          !ctx.features.getFlag('enable_advanced_block_visibility')
        );
      },
      generate(ctx) {
        const models = ctx.getSurfaceModelsByType(NoteBlockModel);
        if (!models.length) return null;

        const firstModel = models[0];
        const shouldShowTooltip$ = computed(
          () =>
            firstModel.props.displayMode$.value ===
            NoteDisplayMode.DocAndEdgeless
        );
        const label$ = computed(() =>
          translateKey(
            ctx.std,
            ...(firstModel.props.displayMode$.value ===
            NoteDisplayMode.EdgelessOnly
              ? NOTE_TOOLBAR_DISPLAY_IN_PAGE
              : NOTE_TOOLBAR_DISPLAYED_IN_PAGE)
          )
        );
        const onSelect = () => {
          const newMode =
            firstModel.props.displayMode === NoteDisplayMode.EdgelessOnly
              ? NoteDisplayMode.DocAndEdgeless
              : NoteDisplayMode.EdgelessOnly;
          setDisplayMode(ctx, firstModel, newMode);

          ctx.track('BlockCreated', {
            page: 'whiteboard editor',
            module: 'toolbar',
            segment: 'toolbar',
            blockType: 'affine:note',
            control: 'toolbar:general',
            other: `display in page: ${newMode === NoteDisplayMode.EdgelessOnly ? 'off' : 'on'}`,
          });
        };

        return {
          content: html`<editor-icon-button
            aria-label="${label$.value}"
            .showTooltip="${shouldShowTooltip$.value}"
            .tooltip="${translateKey(
              ctx.std,
              ...NOTE_TOOLBAR_REMOVE_FROM_PAGE_TOOLTIP
            )}"
            data-testid="display-in-page"
            @click=${() => onSelect()}
          >
            ${InsertIntoPageIcon()}
            <span class="label">${label$.value}</span>
          </editor-icon-button>`,
        };
      },
    },
    {
      id: 'd.style',
      when(ctx) {
        const elements = ctx.getSurfaceModelsByType(NoteBlockModel);
        return (
          elements.length > 0 &&
          elements[0].props.displayMode !== NoteDisplayMode.DocOnly
        );
      },
      actions: [
        {
          id: 'b.style',
          when: ctx => {
            const models = ctx.getSurfaceModels();
            return (
              models.length > 0 &&
              models.every(model => model instanceof NoteBlockModel)
            );
          },
          content(ctx) {
            const notes = ctx.getSurfaceModelsByType(NoteBlockModel);
            return html`<edgeless-note-style-panel
              .notes=${notes}
              .std=${ctx.std}
            ></edgeless-note-style-panel>`;
          },
        } satisfies ToolbarAction,
      ],
    },
    {
      id: 'e.slicer',
      icon: ScissorsIcon(),
      active: false,
      when(ctx) {
        return (
          ctx.getSurfaceModelsByType(NoteBlockModel).length === 1 &&
          ctx.features.getFlag('enable_advanced_block_visibility')
        );
      },
      generate(ctx) {
        return {
          label: translateKey(ctx.std, ...NOTE_TOOLBAR_SLICER),
          tooltip: html`<affine-tooltip-content-with-shortcut
            data-tip="${translateKey(ctx.std, ...NOTE_TOOLBAR_CUTTING_MODE)}"
            data-shortcut="${'-'}"
          ></affine-tooltip-content-with-shortcut>`,
          run(ctx) {
            ctx.std.get(EdgelessLegacySlotIdentifier).toggleNoteSlicer.next();
          },
        };
      },
    },
    {
      id: 'f.auto-height',
      when(ctx) {
        const elements = ctx.getSurfaceModelsByType(NoteBlockModel);
        return (
          elements.length > 0 &&
          (!elements[0].isPageBlock() ||
            !ctx.std.getOptional(NoteConfigExtension.identifier)
              ?.edgelessNoteHeader)
        );
      },
      generate(ctx) {
        const models = ctx.getSurfaceModelsByType(NoteBlockModel);
        if (!models.length) return null;

        const firstModel = models[0];
        const { collapse } = firstModel.props.edgeless$.value;
        const options: Pick<ToolbarAction, 'tooltip' | 'icon'> = collapse
          ? {
              tooltip: translateKey(ctx.std, ...NOTE_TOOLBAR_AUTO_HEIGHT),
              icon: AutoHeightIcon(),
            }
          : {
              tooltip: translateKey(ctx.std, ...NOTE_TOOLBAR_CUSTOMIZED_HEIGHT),
              icon: CustomizedHeightIcon(),
            };

        return {
          ...options,
          label: translateKey(ctx.std, ...NOTE_TOOLBAR_SIZE),
          run(ctx) {
            ctx.store.captureSync();

            for (const model of models) {
              const edgeless = model.props.edgeless;

              if (edgeless.collapse) {
                ctx.store.updateBlock(model, () => {
                  model.props.edgeless.collapse = false;
                });
                continue;
              }

              if (edgeless.collapsedHeight) {
                const bounds = Bound.deserialize(model.xywh);
                bounds.h = edgeless.collapsedHeight * (edgeless.scale ?? 1);
                const xywh = bounds.serialize();

                ctx.store.updateBlock(model, () => {
                  model.xywh = xywh;
                  model.props.edgeless.collapse = true;
                });
              }
            }
          },
        };
      },
    },
    {
      id: 'g.scale',
      content(ctx) {
        const models = ctx.getSurfaceModelsByType(NoteBlockModel);
        if (!models.length) return null;

        const firstModel = models[0];
        const scale$ = computed(() => {
          const scale = firstModel.props.edgeless$.value.scale ?? 1;
          return Math.round(100 * scale);
        });
        const onSelect = (e: CustomEvent<number>) => {
          e.stopPropagation();

          const scale = e.detail / 100;

          models.forEach(model => {
            const bounds = Bound.deserialize(model.xywh);
            const oldScale = model.props.edgeless.scale ?? 1;
            const ratio = scale / oldScale;
            bounds.w *= ratio;
            bounds.h *= ratio;
            const xywh = bounds.serialize();

            ctx.store.updateBlock(model, () => {
              model.xywh = xywh;
              model.props.edgeless.scale = scale;
            });
          });

          ctx.track('SelectedCardScale', {
            ...trackBaseProps,
            control: 'select card scale',
          });
        };
        const onToggle = (e: CustomEvent<boolean>) => {
          e.stopPropagation();

          const opened = e.detail;
          if (!opened) return;

          ctx.track('OpenedCardScaleSelector', {
            ...trackBaseProps,
            control: 'switch card scale',
          });
        };
        const format = (value: number) => `${value}%`;

        return html`<affine-size-dropdown-menu
          @select=${onSelect}
          @toggle=${onToggle}
          .format=${format}
          .size$=${scale$}
        ></affine-size-dropdown-menu>`;
      },
    },
  ],

  when: ctx => ctx.getSurfaceModelsByType(NoteBlockModel).length > 0,
} as const satisfies ToolbarModuleConfig;

function setDisplayMode(
  ctx: ToolbarContext,
  model: NoteBlockModel,
  newMode: NoteDisplayMode
) {
  const displayMode = model.props.displayMode;

  ctx.command.exec(changeNoteDisplayMode, {
    noteId: model.id,
    mode: newMode,
    stopCapture: true,
  });

  // if change note to page only, should clear the selection
  if (newMode === NoteDisplayMode.DocOnly) {
    ctx.selection.clear();
  }

  const data =
    newMode === NoteDisplayMode.EdgelessOnly
      ? {
          title: translateKey(ctx.std, ...TOAST_NOTE_REMOVED_FROM_PAGE),
          message: translateKey(ctx.std, ...NOTE_TOAST_REMOVED_FROM_PAGE_BODY),
        }
      : {
          title: translateKey(ctx.std, ...NOTE_TOAST_DISPLAYED_IN_PAGE_MODE),
          message: translateKey(ctx.std, ...NOTE_TOAST_ADDED_TO_PAGE_BODY),
        };

  const notification = ctx.std.getOptional(NotificationProvider);
  notification?.notifyWithUndoAction({
    title: data.title,
    message: data.message,
    accent: 'success',
    duration: 5 * 1000,
    actions: [
      {
        key: 'view-in-toc',
        label: translateKey(ctx.std, ...NOTE_TOAST_VIEW_IN_TOC),
        onClick: () => {
          const sidebar = ctx.std.getOptional(SidebarExtensionIdentifier);
          sidebar?.open('outline');
        },
      },
    ],
  });

  ctx.track('NoteDisplayModeChanged', {
    ...trackBaseProps,
    control: 'display mode',
    other: `from ${displayMode} to ${newMode}`,
  });
}

export const createBuiltinToolbarConfigExtension = (
  flavour: string
): ExtensionType[] => {
  const name = flavour.split(':').pop();

  return [
    ToolbarModuleExtension({
      id: BlockFlavourIdentifier(`affine:surface:${name}`),
      config: builtinSurfaceToolbarConfig,
    }),
  ];
};
