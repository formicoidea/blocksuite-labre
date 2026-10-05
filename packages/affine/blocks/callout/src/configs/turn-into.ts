import type { TextConversionEntry } from '@labre/affine-rich-text';
import { FeatureFlagService } from '@labre/affine-shared/services';
import { FontIcon } from '@blocksuite/icons/lit';

import {
  calloutConversionTargets,
  turnIntoCalloutCommand,
} from '../commands/turn-into-callout.js';
import { CALLOUT_TURN_INTO_NAME } from '../translations.js';

/**
 * "Callout" in the "Turn into" menu, registered by `CalloutViewExtension` so
 * the `callout` flag removes it with the slash item (ADR 0009). It answers to
 * the same `enable_callout` feature flag as the slash item, so the two always
 * appear and disappear together.
 */
export const calloutTurnIntoEntry: TextConversionEntry = {
  flavour: 'affine:callout',
  name: 'Callout',
  nameWording: CALLOUT_TURN_INTO_NAME,
  icon: FontIcon(),
  when: (std, models) =>
    std.get(FeatureFlagService).getFlag('enable_callout') &&
    calloutConversionTargets(std.store, models).length > 0,
  run: (std, models) => {
    std.command.exec(turnIntoCalloutCommand, { models });
  },
};
