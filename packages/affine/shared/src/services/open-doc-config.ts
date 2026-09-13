import { createIdentifier } from '@labre/global/di';
import { CenterPeekIcon, ExpandFullIcon } from '@blocksuite/icons/lit';
import { type ExtensionType } from '@labre/store';
import type { TemplateResult } from 'lit';

export type OpenDocMode =
  | 'open-in-active-view'
  | 'open-in-new-view'
  | 'open-in-new-tab'
  | 'open-in-center-peek';

// todo: later this will be used to generate the menu items.
// for now we only use it as a hint for whether or not to show the open doc buttons.
//
// `label` was removed here (i18n L7-s2, 2026-09): nothing in the repo ever
// read it — `embed-linked-doc-block.ts`, the one consumer, calls only
// `isAllowed(mode)` — so keying two English literals nobody displays would
// have widened the manifest for no reader. Re-add it (with a key) the day
// this config actually drives a rendered menu.
export interface OpenDocConfigItem {
  type: OpenDocMode;
  icon: TemplateResult<1>;
}
export interface OpenDocConfig {
  items: OpenDocConfigItem[];
}

export interface OpenDocService {
  isAllowed: (mode: OpenDocMode) => boolean;
  items: OpenDocConfig['items'];
}

export const OpenDocExtensionIdentifier = createIdentifier<OpenDocService>(
  'AffineOpenDocExtension'
);

const defaultConfig: OpenDocConfig = {
  items: [
    {
      type: 'open-in-active-view',
      icon: ExpandFullIcon(),
    },
    {
      type: 'open-in-center-peek',
      icon: CenterPeekIcon(),
    },
  ],
};

export const OpenDocExtension = (config: OpenDocConfig): ExtensionType => ({
  setup: di => {
    di.override(OpenDocExtensionIdentifier, () => {
      const allowedOpenDocModes = new Set(config.items.map(item => item.type));
      return {
        isAllowed: (mode: OpenDocMode) => allowedOpenDocModes.has(mode),
        items: config.items,
      };
    });
  },
});

export const DefaultOpenDocExtension = OpenDocExtension(defaultConfig);
