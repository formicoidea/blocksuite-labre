import { toast } from '@labre/affine-components/toast';
import {
  ActionPlacement,
  EmbedIframeService,
  EmbedOptionProvider,
  TOOLBAR_CARD_VIEW,
  TOOLBAR_DELETE,
  TOOLBAR_EMBED_VIEW,
  TOOLBAR_INLINE_VIEW,
  type ToolbarAction,
  type ToolbarActionGroup,
  toolbarActionLabel,
  type ToolbarContext,
  type ToolbarModuleConfig,
  translateKey,
} from '@labre/affine-shared/services';
import {
  CopyIcon,
  DeleteIcon,
  EditIcon,
  UnlinkIcon,
} from '@blocksuite/icons/lit';
import { BlockSelection } from '@labre/std';
import { signal } from '@preact/signals-core';
import { html } from 'lit-html';
import { keyed } from 'lit-html/directives/keyed.js';

import { AffineLink } from '../affine-link';
import { toggleLinkPopup } from '../link-popup/toggle-link-popup';
import {
  LINK_TOOLBAR_COPIED_TOAST,
  LINK_TOOLBAR_COPY_LINK,
  LINK_TOOLBAR_EDIT,
  LINK_TOOLBAR_REMOVE_LINK,
} from '../../translations.js';

const trackBaseProps = {
  segment: 'doc',
  page: 'doc editor',
  module: 'toolbar',
  category: 'link',
  type: 'inline view',
};

/**
 * Flavour the "Card view" conversion would create for `url`.
 */
function cardFlavour(ctx: ToolbarContext, url: string) {
  const options = ctx.std.get(EmbedOptionProvider).getEmbedBlockOptions(url);
  return options?.viewType === 'card' ? options.flavour : 'affine:bookmark';
}

/**
 * Flavour the "Embed view" conversion would create for `url`, or `null` when
 * nothing can embed it.
 */
function embedFlavour(ctx: ToolbarContext, url: string) {
  const options = ctx.std.get(EmbedOptionProvider).getEmbedBlockOptions(url);
  if (options?.viewType === 'embed') return options.flavour;
  if (ctx.std.get(EmbedIframeService).canEmbed(url)) {
    return 'affine:embed-iframe';
  }
  return null;
}

/**
 * A conversion is a creation tool: it may only be offered when the block it
 * creates can be rendered here. Block flags gate view extensions (ADR 0009),
 * so a flavour without a registered view is one the host switched off —
 * converting would replace the link with a block that paints as nothing.
 *
 * ponytail: runtime probe of the flag's EFFECT, not the flag. Holds while a
 * block's renderer and tooling share one view extension. The day bookmark or
 * embed gets the render/tooling split of ADR 0009, the view stays registered
 * with the flag off and this gate goes blind. Upgrade path: a link-conversion
 * contribution identifier that the gated bookmark/embed extensions register,
 * so the action disappears by absence like every other gated tool.
 */
function canConvertTo(ctx: ToolbarContext, flavour: string | null) {
  return !!flavour && !!ctx.std.getView(flavour);
}

function isOffered(ctx: ToolbarContext, action: ToolbarAction) {
  return typeof action.when === 'function'
    ? action.when(ctx)
    : (action.when ?? true);
}

export const builtinInlineLinkToolbarConfig = {
  actions: [
    {
      id: 'a.preview',
      content(cx) {
        const target = cx.message$.peek()?.element;
        if (!(target instanceof AffineLink)) return null;

        const { link } = target;
        if (!link) return null;

        return html`<affine-link-preview .url=${link}></affine-link-preview>`;
      },
    },
    {
      id: 'b.copy-link-and-edit',
      actions: [
        {
          id: 'copy-link',
          tooltipWording: LINK_TOOLBAR_COPY_LINK,
          icon: CopyIcon(),
          run(ctx) {
            const target = ctx.message$.peek()?.element;
            if (!(target instanceof AffineLink)) return;

            const { link } = target;

            if (!link) return;

            // Clears
            ctx.reset();

            navigator.clipboard.writeText(link).catch(console.error);
            toast(
              ctx.host,
              translateKey(ctx.std, ...LINK_TOOLBAR_COPIED_TOAST)
            );

            ctx.track('CopiedLink', {
              ...trackBaseProps,
              control: 'copy link',
            });
          },
        },
        {
          id: 'edit',
          tooltipWording: LINK_TOOLBAR_EDIT,
          icon: EditIcon(),
          run(ctx) {
            const target = ctx.message$.peek()?.element;
            if (!(target instanceof AffineLink)) return;

            const { inlineEditor, selfInlineRange } = target;

            if (!inlineEditor || !selfInlineRange) return;

            const abortController = new AbortController();
            const popover = toggleLinkPopup(
              ctx.std,
              'edit',
              inlineEditor,
              selfInlineRange,
              abortController
            );
            abortController.signal.onabort = () => popover.remove();

            ctx.track('OpenedAliasPopup', {
              ...trackBaseProps,
              control: 'edit',
            });
          },
        },
      ],
    },
    {
      id: 'c.conversions',
      actions: [
        {
          id: 'inline',
          labelWording: TOOLBAR_INLINE_VIEW,
          disabled: true,
        },
        {
          id: 'card',
          labelWording: TOOLBAR_CARD_VIEW,
          when(ctx) {
            const target = ctx.message$.peek()?.element;
            if (!(target instanceof AffineLink)) return false;

            const url = target.link;
            if (!url) return false;

            return canConvertTo(ctx, cardFlavour(ctx, url));
          },
          run(ctx) {
            const target = ctx.message$.peek()?.element;
            if (!(target instanceof AffineLink)) return;
            if (!target.block) return;

            const url = target.link;
            if (!url) return;

            const {
              block: { model },
              inlineEditor,
              selfInlineRange,
            } = target;
            const { parent } = model;

            if (!inlineEditor || !selfInlineRange || !parent) return;

            // Clears
            ctx.reset();

            const title = inlineEditor.yTextString.slice(
              selfInlineRange.index,
              selfInlineRange.index + selfInlineRange.length
            );

            const flavour = cardFlavour(ctx, url);
            const index = parent.children.indexOf(model);
            const props = {
              url,
              title: title === url ? '' : title,
            };

            const blockId = ctx.store.addBlock(
              flavour,
              props,
              parent,
              index + 1
            );

            const totalTextLength = inlineEditor.yTextLength;
            const inlineTextLength = selfInlineRange.length;
            if (totalTextLength === inlineTextLength) {
              ctx.store.deleteBlock(model);
            } else {
              inlineEditor.formatText(selfInlineRange, { link: null });
            }

            ctx.select('note', [
              ctx.selection.create(BlockSelection, { blockId }),
            ]);

            ctx.track('SelectedView', {
              ...trackBaseProps,
              control: 'select view',
              type: 'card view',
            });
          },
        },
        {
          id: 'embed',
          labelWording: TOOLBAR_EMBED_VIEW,
          when(ctx) {
            const target = ctx.message$.peek()?.element;
            if (!(target instanceof AffineLink)) return false;
            if (!target.block) return false;

            const url = target.link;
            if (!url) return false;

            const {
              block: { model },
              inlineEditor,
              selfInlineRange,
            } = target;
            const { parent } = model;

            if (!inlineEditor || !selfInlineRange || !parent) return false;

            return canConvertTo(ctx, embedFlavour(ctx, url));
          },
          run(ctx) {
            const target = ctx.message$.peek()?.element;
            if (!(target instanceof AffineLink)) return;
            if (!target.block) return;

            const url = target.link;
            if (!url) return;

            const {
              block: { model },
              inlineEditor,
              selfInlineRange,
            } = target;
            const { parent } = model;

            if (!inlineEditor || !selfInlineRange || !parent) return;

            // Clears
            ctx.reset();

            const index = parent.children.indexOf(model);
            const props = { url };
            let blockId: string | undefined;

            const embedIframeService = ctx.std.get(EmbedIframeService);
            const embedOptions = ctx.std
              .get(EmbedOptionProvider)
              .getEmbedBlockOptions(url);

            if (embedOptions?.viewType === 'embed') {
              const flavour = embedOptions.flavour;
              blockId = ctx.store.addBlock(flavour, props, parent, index + 1);
            } else if (embedIframeService.canEmbed(url)) {
              blockId = embedIframeService.addEmbedIframeBlock(
                props,
                parent.id,
                index + 1
              );
            }

            if (!blockId) return;

            const totalTextLength = inlineEditor.yTextLength;
            const inlineTextLength = selfInlineRange.length;
            if (totalTextLength === inlineTextLength) {
              ctx.store.deleteBlock(model);
            } else {
              inlineEditor.formatText(selfInlineRange, { link: null });
            }

            ctx.select('note', [
              ctx.selection.create(BlockSelection, { blockId }),
            ]);

            ctx.track('SelectedView', {
              ...trackBaseProps,
              control: 'select view',
              type: 'embed view',
            });
          },
        },
      ],
      content(ctx) {
        const target = ctx.message$.peek()?.element;
        if (!(target instanceof AffineLink)) return null;

        const actions = this.actions.map(action => ({ ...action }));
        const viewType$ = signal(toolbarActionLabel(ctx.std, actions[0]));
        const onToggle = (e: CustomEvent<boolean>) => {
          const opened = e.detail;
          if (!opened) return;

          ctx.track('OpenedViewSelector', {
            ...trackBaseProps,
            control: 'switch view',
          });
        };

        return html`${keyed(
          target,
          html`<affine-view-dropdown-menu
            .actions=${actions}
            .context=${ctx}
            .onToggle=${onToggle}
            .viewType$=${viewType$}
          ></affine-view-dropdown-menu>`
        )}`;
      },
      when(ctx) {
        const target = ctx.message$.peek()?.element;
        if (!(target instanceof AffineLink)) return false;
        if (!target.block) return false;

        if (ctx.flags.isNative()) return false;
        if (
          target.block.closest('affine-database') ||
          target.block.closest('affine-table')
        )
          return false;

        if (!target.link.startsWith('http')) return false;

        const { model } = target.block;
        const parent = model.parent;
        if (!parent) return false;

        const schema = ctx.store.schema;
        const bookmarkSchema = schema.flavourSchemaMap.get('affine:bookmark');
        if (!bookmarkSchema) return false;

        const parentSchema = schema.flavourSchemaMap.get(parent.flavour);
        if (!parentSchema) return false;

        try {
          schema.validateSchema(bookmarkSchema, parentSchema);
        } catch {
          return false;
        }

        // "Inline view" is the current state; without another target the
        // dropdown would offer nothing.
        return this.actions.some(
          action => action.id !== 'inline' && isOffered(ctx, action)
        );
      },
    } satisfies ToolbarActionGroup<ToolbarAction>,
    {
      placement: ActionPlacement.More,
      id: 'b.remove-link',
      labelWording: LINK_TOOLBAR_REMOVE_LINK,
      icon: UnlinkIcon(),
      run(ctx) {
        const target = ctx.message$.peek()?.element;
        if (!(target instanceof AffineLink)) return;

        const { inlineEditor, selfInlineRange } = target;
        if (!inlineEditor || !selfInlineRange) return;

        if (!inlineEditor.isValidInlineRange(selfInlineRange)) return;

        inlineEditor.formatText(selfInlineRange, { link: null });
      },
    },
    {
      placement: ActionPlacement.More,
      id: 'c.delete',
      labelWording: TOOLBAR_DELETE,
      icon: DeleteIcon(),
      variant: 'destructive',
      run(ctx) {
        const target = ctx.message$.peek()?.element;
        if (!(target instanceof AffineLink)) return;

        const { inlineEditor, selfInlineRange } = target;
        if (!inlineEditor || !selfInlineRange) return;

        if (!inlineEditor.isValidInlineRange(selfInlineRange)) return;

        inlineEditor.deleteText(selfInlineRange);
      },
    },
  ],
} as const satisfies ToolbarModuleConfig;
