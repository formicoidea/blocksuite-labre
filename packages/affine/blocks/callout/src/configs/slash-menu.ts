import { focusBlockEnd } from '@labre/affine-shared/commands';
import { FeatureFlagService } from '@labre/affine-shared/services';
import { isInsideBlockByFlavour } from '@labre/affine-shared/utils';
import { type SlashMenuConfig } from '@labre/affine-widget-slash-menu';
import { FontIcon } from '@blocksuite/icons/lit';

import { calloutTooltip } from './tooltips';

// No `disableWhen` here on purpose. The widget ORs every config's `disableWhen`
// together and then refuses to open at all, so the callout's own guard used to
// silence the WHOLE slash menu inside a callout — every block, every framework,
// not just this one entry.
export const calloutSlashMenuConfig: SlashMenuConfig = {
  items: [
    {
      name: 'Callout',
      description: 'Let your words stand out.',
      icon: FontIcon(),
      tooltip: {
        figure: calloutTooltip,
        caption: 'Callout',
      },
      searchAlias: ['callout'],
      group: '0_Basic@9',
      when: ({ std, model }) => {
        return (
          std.get(FeatureFlagService).getFlag('enable_callout') &&
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
