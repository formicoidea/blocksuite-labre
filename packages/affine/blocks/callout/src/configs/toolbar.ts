import { toast } from '@labre/affine-components/toast';
import { EditorChevronDown } from '@labre/affine-components/toolbar';
import { CalloutBlockModel } from '@labre/affine-model';
import { textConversionConfigs } from '@labre/affine-rich-text';
import {
  copySelectedModelsCommand,
  deleteSelectedModelsCommand,
  draftSelectedModelsCommand,
  duplicateSelectedModelsCommand,
  getSelectedModelsCommand,
} from '@labre/affine-shared/commands';
import {
  ActionPlacement,
  blockCommentToolbarButton,
  TOAST_COPIED_TO_CLIPBOARD,
  type ToolbarAction,
  type ToolbarContext,
  type ToolbarModuleConfig,
  TOOLBAR_CONVERSIONS_ARIA,
  TOOLBAR_COPY,
  TOOLBAR_DELETE,
  TOOLBAR_DUPLICATE,
  TOOLBAR_TURN_INTO,
  translateKey,
} from '@labre/affine-shared/services';
import { matchModels } from '@labre/affine-shared/utils';
import {
  CopyIcon,
  DeleteIcon,
  DuplicateIcon,
  FontIcon,
} from '@blocksuite/icons/lit';
import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';

import {
  calloutUnwrapTargets,
  turnCalloutIntoCommand,
} from '../commands/turn-callout-into.js';

/** The block-selected callouts — the row only opens on a block selection. */
const selectedCallouts = ({ chain }: ToolbarContext) => {
  const [ok, { selectedModels = [] }] = chain
    .pipe(getSelectedModelsCommand, { types: ['block'], mode: 'highest' })
    .run();
  return ok
    ? selectedModels.filter(model => matchModels(model, [CalloutBlockModel]))
    : [];
};

/**
 * "Turn into" on a callout (#468): the text kinds of the note's own row, minus
 * the divider (which is not a conversion of a block's words), each offered
 * only when `calloutUnwrapTargets` says the whole conversion can complete —
 * a refusal is an absent entry, never a click that does nothing.
 *
 * Like the note row, which offers "Turn into" on a paragraph or a code block
 * only once it holds words (`isFormatSupported`), the entry waits for the
 * callout to hold some: an empty callout shows the "⋮" menu alone (PO
 * recette of #468, for one behaviour across blocks).
 */
const conversionsAction = {
  id: 'a.conversions',
  when: ctx => !ctx.readonly,
  content(ctx) {
    const { std, store } = ctx;
    const callouts = selectedCallouts(ctx);
    if (callouts.length === 0) return null;
    const holdsWords = callouts.some(callout =>
      callout.children.some(child => (child.text?.length ?? 0) > 0)
    );
    if (!holdsWords) return null;

    const conversions = textConversionConfigs.filter(
      ({ flavour }) =>
        flavour !== 'affine:divider' &&
        calloutUnwrapTargets(store, callouts, flavour).length > 0
    );
    if (conversions.length === 0) return null;

    return html`
      <editor-menu-button
        .contentPadding="${'8px'}"
        .button=${html`
          <editor-icon-button
            aria-label="${translateKey(std, ...TOOLBAR_CONVERSIONS_ARIA)}"
            .tooltip="${translateKey(std, ...TOOLBAR_TURN_INTO)}"
          >
            ${FontIcon()} ${EditorChevronDown}
          </editor-icon-button>
        `}
      >
        <div data-size="large" data-orientation="vertical">
          ${repeat(
            conversions,
            item => item.name,
            ({ flavour, type, name, nameWording, icon }) => {
              const label = nameWording
                ? translateKey(std, ...nameWording)
                : name;
              return html`
                <editor-menu-action
                  aria-label=${label}
                  @click=${() =>
                    std.command.exec(turnCalloutIntoCommand, {
                      models: callouts,
                      flavour,
                      ...(type && { props: { type } }),
                    })}
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

/**
 * The callout's block toolbar, opened by its drag handle (#468). Without a
 * module for `affine:callout` the toolbar widget shows no row for a selected
 * callout at all, so a callout could not be converted back. Copy, duplicate
 * and delete are the note row's, restricted to the block selection — except
 * that they take the selection in `flat` mode, descendants included, where
 * the note row's Duplicate takes `highest`: a callout is a hub, and drafted
 * without its children it would copy as an empty frame.
 *
 * Centred above the block (`top`) like the note row a paragraph or a code
 * block opens; without a placement of its own the widget sets a block's row
 * at `top-start`, which left the callout's row hanging off its left edge.
 */
export const calloutToolbarConfig = {
  placement: 'top',
  actions: [
    conversionsAction,
    {
      id: 'g.comment',
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
          run({ chain, host, std }) {
            // `flat`, not `highest`: the callout's words are its children,
            // and the draft keeps only the children that are selected too.
            const [ok] = chain
              .pipe(getSelectedModelsCommand, {
                types: ['block'],
                mode: 'flat',
              })
              .pipe(draftSelectedModelsCommand)
              .pipe(copySelectedModelsCommand)
              .run();
            if (!ok) return;
            toast(host, translateKey(std, ...TOAST_COPIED_TO_CLIPBOARD));
          },
        },
        {
          id: 'duplicate',
          labelWording: TOOLBAR_DUPLICATE,
          icon: DuplicateIcon(),
          run(ctx) {
            const { chain, store } = ctx;
            // The copy lands right after the (last) callout. Said explicitly:
            // the command's default anchors on the LAST selected model, which
            // in `flat` mode is one of the callout's descendants.
            const last = selectedCallouts(ctx).at(-1);
            const parentModel = last && store.getParent(last);
            if (!last || !parentModel) return;
            store.captureSync();
            // `flat`, not `highest`, for the same reason as Copy: a callout
            // drafted without its children duplicates as an empty frame.
            chain
              .pipe(getSelectedModelsCommand, {
                types: ['block'],
                mode: 'flat',
              })
              .pipe(duplicateSelectedModelsCommand, {
                parentModel,
                index: parentModel.children.indexOf(last) + 1,
              })
              .run();
          },
        },
      ],
      when: ctx => !ctx.flags.isNative(),
    },
    {
      placement: ActionPlacement.More,
      id: 'c.delete',
      actions: [
        {
          id: 'delete',
          labelWording: TOOLBAR_DELETE,
          icon: DeleteIcon(),
          variant: 'destructive',
          run({ chain }) {
            chain
              .pipe(getSelectedModelsCommand, { types: ['block'] })
              .pipe(deleteSelectedModelsCommand)
              .run();
          },
        },
      ],
      when: ctx => !ctx.flags.isNative(),
    },
  ],
} as const satisfies ToolbarModuleConfig;
