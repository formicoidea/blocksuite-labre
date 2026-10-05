import { focusBlockEnd } from '@labre/affine-shared/commands';
import { isInsideBlockByFlavour } from '@labre/affine-shared/utils';
import { type SlashMenuConfig } from '@labre/affine-widget-slash-menu';
import { FontIcon } from '@blocksuite/icons/lit';

import {
  CALLOUT_SLASH_CAPTION,
  CALLOUT_SLASH_DESCRIPTION,
  CALLOUT_SLASH_NAME,
} from '../translations';
import { calloutTooltip } from './tooltips';

// Gated by the `callout` block flag alone: `CalloutViewExtension` registers
// this config and is itself flag-gated (ADR 0009). The deprecated
// `enable_callout` feature flag is not read.
//
// No `disableWhen` here on purpose. The widget ORs every config's `disableWhen`
// together and then refuses to open at all, so the callout's own guard used to
// silence the WHOLE slash menu inside a callout — every block, every framework,
// not just this one entry.
export const calloutSlashMenuConfig: SlashMenuConfig = {
  items: [
    {
      name: 'Callout',
      nameWording: CALLOUT_SLASH_NAME,
      description: 'Let your words stand out.',
      descriptionWording: CALLOUT_SLASH_DESCRIPTION,
      icon: FontIcon(),
      tooltip: {
        figure: calloutTooltip,
        caption: 'Callout',
        captionWording: CALLOUT_SLASH_CAPTION,
      },
      searchAlias: ['callout'],
      group: '0_Basic@9',
      when: ({ model }) => {
        return (
          !isInsideBlockByFlavour(model.store, model, 'affine:edgeless-text') &&
          // The schema forbids a callout inside a callout, so offering the item
          // there would only produce a thrown insertion.
          !isInsideBlockByFlavour(model.store, model, 'affine:callout')
        );
      },
      action: ({ model, std }) => {
        const { store } = model;
        const parent = store.getParent(model);
        if (!parent) return;

        const index = parent.children.indexOf(model);
        if (index === -1) return;
        const calloutId = store.addBlock(
          'affine:callout',
          {},
          parent,
          index + 1
        );
        if (!calloutId) return;
        const paragraphId = store.addBlock('affine:paragraph', {}, calloutId);
        if (!paragraphId) return;
        std.host.updateComplete
          .then(() => {
            const paragraph = std.view.getBlock(paragraphId);
            if (!paragraph) return;
            std.command.exec(focusBlockEnd, {
              focusBlock: paragraph,
            });
          })
          .catch(console.error);
      },
    },
  ],
};
