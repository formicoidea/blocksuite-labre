import { toast } from '@labre/affine-components/toast';
import { EditorChevronDown } from '@labre/affine-components/toolbar';
import {
  type EmbedCardStyle,
  EmbedLinkedDocModel,
  EmbedLinkedDocStyles,
} from '@labre/affine-model';
import {
  EMBED_CARD_HEIGHT,
  EMBED_CARD_WIDTH,
} from '@labre/affine-shared/consts';
import {
  ActionPlacement,
  blockCommentToolbarButton,
  CHROME_UNTITLED,
  DocDisplayMetaProvider,
  EditorSettingProvider,
  type LinkEventType,
  type OpenDocMode,
  TOAST_COPIED_TO_CLIPBOARD,
  TOOLBAR_CAPTION,
  TOOLBAR_CARD_VIEW,
  TOOLBAR_COPY,
  TOOLBAR_DELETE,
  TOOLBAR_DUPLICATE,
  TOOLBAR_EMBED_VIEW,
  TOOLBAR_INLINE_VIEW,
  TOOLBAR_LARGE_HORIZONTAL_STYLE,
  TOOLBAR_LARGE_VERTICAL_STYLE,
  TOOLBAR_OPEN_THIS_DOC,
  TOOLBAR_SMALL_HORIZONTAL_STYLE,
  TOOLBAR_SMALL_VERTICAL_STYLE,
  type ToolbarAction,
  type ToolbarActionGroup,
  toolbarActionLabel,
  type ToolbarContext,
  type ToolbarModuleConfig,
  ToolbarModuleExtension,
  translateKey,
} from '@labre/affine-shared/services';
import { getBlockProps, referenceToNode } from '@labre/affine-shared/utils';
import { Bound } from '@labre/global/gfx';
import {
  CaptionIcon,
  CopyIcon,
  DeleteIcon,
  DuplicateIcon,
  ExpandFullIcon,
  OpenInNewIcon,
} from '@blocksuite/icons/lit';
import { BlockFlavourIdentifier, isGfxBlockComponent } from '@labre/std';
import { type ExtensionType, Slice } from '@labre/store';
import { computed, signal } from '@preact/signals-core';
import { html } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { keyed } from 'lit/directives/keyed.js';
import { repeat } from 'lit/directives/repeat.js';

import { EmbedLinkedDocBlockComponent } from '../embed-linked-doc-block';
import { EMBED_DOC_OPEN_DOC } from '../../translations';

const trackBaseProps = {
  category: 'linked doc',
  type: 'card view',
};

const createOnToggleFn =
  (
    ctx: ToolbarContext,
    name: Extract<
      LinkEventType,
      | 'OpenedViewSelector'
      | 'OpenedCardStyleSelector'
      | 'OpenedCardScaleSelector'
    >,
    control: 'switch view' | 'switch card style' | 'switch card scale'
  ) =>
  (e: CustomEvent<boolean>) => {
    e.stopPropagation();
    const opened = e.detail;
    if (!opened) return;

    ctx.track(name, { ...trackBaseProps, control });
  };

const docTitleAction = {
  id: 'a.doc-title',
  content(ctx) {
    const block = ctx.getCurrentBlockByType(EmbedLinkedDocBlockComponent);
    if (!block) return null;

    const model = block.model;
    if (!model.props.title) return null;

    const originalTitle =
      ctx.std.get(DocDisplayMetaProvider).title(model.props.pageId).value ||
      translateKey(ctx.std, ...CHROME_UNTITLED);
    const open = (event: MouseEvent) => block.open({ event });

    return html`<affine-linked-doc-title
      .title=${originalTitle}
      .open=${open}
    ></affine-linked-doc-title>`;
  },
} as const satisfies ToolbarAction;

const captionAction = {
  id: 'd.caption',
  tooltip: 'Caption',
  tooltipWording: TOOLBAR_CAPTION,
  icon: CaptionIcon(),
  run(ctx) {
    const block = ctx.getCurrentBlockByType(EmbedLinkedDocBlockComponent);
    block?.captionEditor?.show();

    ctx.track('OpenedCaptionEditor', {
      ...trackBaseProps,
      control: 'add caption',
    });
  },
} as const satisfies ToolbarAction;

const openDocActions = [
  {
    mode: 'open-in-active-view',
    id: 'a.open-in-active-view',
    label: 'Open this doc',
    labelWording: TOOLBAR_OPEN_THIS_DOC,
    icon: ExpandFullIcon(),
  },
] as const satisfies (Pick<
  ToolbarAction,
  'id' | 'label' | 'labelWording' | 'icon'
> & {
  mode: OpenDocMode;
})[];

const openDocActionGroup = {
  placement: ActionPlacement.Start,
  id: 'A.open-doc',
  content(ctx) {
    const block = ctx.getCurrentBlockByType(EmbedLinkedDocBlockComponent);
    if (!block) return null;

    const actions = openDocActions.map<ToolbarAction>(action => {
      const openMode = action.mode;
      const shouldOpenInActiveView = openMode === 'open-in-active-view';
      return {
        ...action,
        disabled: shouldOpenInActiveView
          ? block.model.props.pageId === ctx.store.id
          : false,
        when: true,
        run: (_ctx: ToolbarContext) => block.open({ openMode }),
      };
    });
    const openDocLabel = translateKey(ctx.std, ...EMBED_DOC_OPEN_DOC);

    return html`
      <editor-menu-button
        .contentPadding="${'8px'}"
        .button=${html`
          <editor-icon-button
            aria-label=${openDocLabel}
            .tooltip=${openDocLabel}
          >
            ${OpenInNewIcon()} ${EditorChevronDown}
          </editor-icon-button>
        `}
      >
        <div data-size="small" data-orientation="vertical">
          ${repeat(
            actions,
            action => action.id,
            action => {
              const label = toolbarActionLabel(ctx.std, action);
              const { icon, run, disabled } = action;
              return html`
                <editor-menu-action
                  aria-label=${ifDefined(label)}
                  ?disabled=${ifDefined(
                    typeof disabled === 'function' ? disabled(ctx) : disabled
                  )}
                  @click=${() => run?.(ctx)}
                >
                  ${icon}<span class="label">${label}</span>
                </editor-menu-action>
              `;
            }
          )}
        </div>
      </editor-menu-button>
    `;
  },
} as const satisfies ToolbarAction;

const conversionsActionGroup = {
  id: 'b.conversions',
  actions: [
    {
      id: 'inline',
      labelWording: TOOLBAR_INLINE_VIEW,
      run(ctx) {
        const block = ctx.getCurrentBlockByType(EmbedLinkedDocBlockComponent);
        block?.convertToInline();

        // Clears
        ctx.select('note');
        ctx.reset();

        ctx.track('SelectedView', {
          ...trackBaseProps,
          control: 'select view',
          type: 'inline view',
        });
      },
      when: ctx => !ctx.hasSelectedSurfaceModels,
    },
    {
      id: 'card',
      labelWording: TOOLBAR_CARD_VIEW,
      disabled: true,
    },
    {
      id: 'embed',
      labelWording: TOOLBAR_EMBED_VIEW,
      disabled(ctx) {
        const block = ctx.getCurrentBlockByType(EmbedLinkedDocBlockComponent);
        if (!block) return true;

        if (block.closest('affine-embed-synced-doc-block')) return true;

        const model = block.model;

        // same doc
        if (model.props.pageId === ctx.store.id) return true;

        // linking to block
        if (referenceToNode(model.props)) return true;

        return false;
      },
      run(ctx) {
        const block = ctx.getCurrentBlockByType(EmbedLinkedDocBlockComponent);

        if (isGfxBlockComponent(block)) {
          const editorSetting = ctx.std.getOptional(EditorSettingProvider);
          editorSetting?.set?.(
            'docCanvasPreferView',
            'affine:embed-synced-doc'
          );
        }

        block?.convertToEmbed();

        ctx.track('SelectedView', {
          ...trackBaseProps,
          control: 'select view',
          type: 'embed view',
        });
      },
    },
  ],
  content(ctx) {
    const model = ctx.getCurrentModelByType(EmbedLinkedDocModel);
    if (!model) return null;

    const actions = this.actions.map(action => ({ ...action }));
    const viewType$ = signal(translateKey(ctx.std, ...TOOLBAR_CARD_VIEW));
    const onToggle = createOnToggleFn(ctx, 'OpenedViewSelector', 'switch view');

    return html`${keyed(
      model,
      html`<affine-view-dropdown-menu
        @toggle=${onToggle}
        .actions=${actions}
        .context=${ctx}
        .viewType$=${viewType$}
      ></affine-view-dropdown-menu>`
    )}`;
  },
} as const satisfies ToolbarActionGroup<ToolbarAction>;

const builtinToolbarConfig = {
  actions: [
    docTitleAction,
    conversionsActionGroup,
    {
      id: 'c.style',
      actions: (
        [
          {
            id: 'horizontal',
            label: 'Large horizontal style',
            labelWording: TOOLBAR_LARGE_HORIZONTAL_STYLE,
          },
          {
            id: 'list',
            label: 'Small horizontal style',
            labelWording: TOOLBAR_SMALL_HORIZONTAL_STYLE,
          },
        ] as const
      ).filter(action => EmbedLinkedDocStyles.includes(action.id)),
      content(ctx) {
        const model = ctx.getCurrentModelByType(EmbedLinkedDocModel);
        if (!model) return null;

        const actions = this.actions.map(action => ({
          ...action,
          run: ({ store }) => {
            store.updateBlock(model, { style: action.id });

            ctx.track('SelectedCardStyle', {
              ...trackBaseProps,
              control: 'select card style',
              type: action.id,
            });
          },
        })) satisfies ToolbarAction[];
        const onToggle = createOnToggleFn(
          ctx,
          'OpenedCardStyleSelector',
          'switch card style'
        );

        return html`${keyed(
          model,
          html`<affine-card-style-dropdown-menu
            @toggle=${onToggle}
            .actions=${actions}
            .context=${ctx}
            .style$=${model.props.style$}
          ></affine-card-style-dropdown-menu>`
        )}`;
      },
    } satisfies ToolbarActionGroup<ToolbarAction>,
    captionAction,
    {
      id: 'e.comment',
      ...blockCommentToolbarButton,
    },
    {
      placement: ActionPlacement.More,
      id: 'a.clipboard',
      actions: [
        {
          id: 'copy',
          labelWording: TOOLBAR_COPY,
          icon: CopyIcon(),
          run(ctx) {
            const model = ctx.getCurrentModelByType(EmbedLinkedDocModel);
            if (!model) return;

            const slice = Slice.fromModels(ctx.store, [model]);
            ctx.clipboard
              .copySlice(slice)
              .then(() =>
                toast(
                  ctx.host,
                  translateKey(ctx.std, ...TOAST_COPIED_TO_CLIPBOARD)
                )
              )
              .catch(console.error);
          },
        },
        {
          id: 'duplicate',
          labelWording: TOOLBAR_DUPLICATE,
          icon: DuplicateIcon(),
          run(ctx) {
            const model = ctx.getCurrentModelByType(EmbedLinkedDocModel);
            if (!model) return;

            const { flavour, parent } = model;
            const props = getBlockProps(model);
            const index = parent?.children.indexOf(model);

            ctx.store.addBlock(flavour, props, parent, index);
          },
        },
      ],
    },
    {
      placement: ActionPlacement.More,
      id: 'c.delete',
      labelWording: TOOLBAR_DELETE,
      icon: DeleteIcon(),
      variant: 'destructive',
      run(ctx) {
        const model = ctx.getCurrentModelByType(EmbedLinkedDocModel);
        if (!model) return;

        ctx.store.deleteBlock(model);

        // Clears
        ctx.select('note');
        ctx.reset();
      },
    },
  ],
} as const satisfies ToolbarModuleConfig;

const builtinSurfaceToolbarConfig = {
  actions: [
    openDocActionGroup,
    docTitleAction,
    conversionsActionGroup,
    {
      id: 'c.style',
      actions: (
        [
          {
            id: 'horizontal',
            label: 'Large horizontal style',
            labelWording: TOOLBAR_LARGE_HORIZONTAL_STYLE,
          },
          {
            id: 'list',
            label: 'Small horizontal style',
            labelWording: TOOLBAR_SMALL_HORIZONTAL_STYLE,
          },
          {
            id: 'vertical',
            label: 'Large vertical style',
            labelWording: TOOLBAR_LARGE_VERTICAL_STYLE,
          },
          {
            id: 'cube',
            label: 'Small vertical style',
            labelWording: TOOLBAR_SMALL_VERTICAL_STYLE,
          },
        ] as const
      ).filter(action => EmbedLinkedDocStyles.includes(action.id)),
      content(ctx) {
        const model = ctx.getCurrentModelByType(EmbedLinkedDocModel);
        if (!model) return null;

        const actions = this.actions.map(action => ({
          ...action,
          run: ({ store }) => {
            const style = action.id as EmbedCardStyle;
            const bounds = Bound.deserialize(model.xywh);
            bounds.w = EMBED_CARD_WIDTH[style];
            bounds.h = EMBED_CARD_HEIGHT[style];
            const xywh = bounds.serialize();

            store.updateBlock(model, { style, xywh });

            ctx.track('SelectedCardStyle', {
              ...trackBaseProps,
              control: 'select card style',
              type: style,
            });
          },
        })) satisfies ToolbarAction[];
        const style$ = model.props.style$;
        const onToggle = createOnToggleFn(
          ctx,
          'OpenedCardStyleSelector',
          'switch card style'
        );

        return html`${keyed(
          model,
          html`<affine-card-style-dropdown-menu
            @toggle=${onToggle}
            .actions=${actions}
            .context=${ctx}
            .style$=${style$}
          ></affine-card-style-dropdown-menu>`
        )}`;
      },
    } satisfies ToolbarActionGroup<ToolbarAction>,
    captionAction,
    {
      id: 'e.scale',
      content(ctx) {
        const model = ctx.getCurrentBlockByType(
          EmbedLinkedDocBlockComponent
        )?.model;
        if (!model) return null;

        const scale$ = computed(() => {
          const {
            xywh$: { value: xywh },
          } = model;
          const {
            style$: { value: style },
          } = model.props;
          const bounds = Bound.deserialize(xywh);
          const height = EMBED_CARD_HEIGHT[style];
          return Math.round(100 * (bounds.h / height));
        });
        const onSelect = (e: CustomEvent<number>) => {
          e.stopPropagation();

          const scale = e.detail / 100;

          const bounds = Bound.deserialize(model.xywh);
          const style = model.props.style;
          bounds.h = EMBED_CARD_HEIGHT[style] * scale;
          bounds.w = EMBED_CARD_WIDTH[style] * scale;
          const xywh = bounds.serialize();

          ctx.store.updateBlock(model, { xywh });

          ctx.track('SelectedCardScale', {
            ...trackBaseProps,
            control: 'select card scale',
          });
        };
        const onToggle = createOnToggleFn(
          ctx,
          'OpenedCardScaleSelector',
          'switch card scale'
        );
        const format = (value: number) => `${value}%`;

        return html`${keyed(
          model,
          html`<affine-size-dropdown-menu
            @select=${onSelect}
            @toggle=${onToggle}
            .format=${format}
            .size$=${scale$}
          ></affine-size-dropdown-menu>`
        )}`;
      },
    },
  ],

  when: ctx => ctx.getSurfaceModelsByType(EmbedLinkedDocModel).length === 1,
} as const satisfies ToolbarModuleConfig;

export const createBuiltinToolbarConfigExtension = (
  flavour: string
): ExtensionType[] => {
  const name = flavour.split(':').pop();

  return [
    ToolbarModuleExtension({
      id: BlockFlavourIdentifier(flavour),
      config: builtinToolbarConfig,
    }),

    ToolbarModuleExtension({
      id: BlockFlavourIdentifier(`affine:surface:${name}`),
      config: builtinSurfaceToolbarConfig,
    }),
  ];
};
