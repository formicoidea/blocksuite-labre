import type { TextConversionEntry } from '@labre/affine-rich-text';
import { FontIcon } from '@blocksuite/icons/lit';

import {
  calloutConversionTargets,
  turnIntoCalloutCommand,
} from '../commands/turn-into-callout.js';
import { CALLOUT_TURN_INTO_NAME } from '../translations.js';

/**
 * "Callout" in the "Turn into" menu, registered by `CalloutViewExtension` so
 * the `callout` flag removes it with the slash item (ADR 0009). That flag is
 * the only switch: the deprecated `enable_callout` feature flag is not read,
 * so the two entries always appear and disappear together.
 */
export const calloutTurnIntoEntry: TextConversionEntry = {
  flavour: 'affine:callout',
  name: 'Callout',
  nameWording: CALLOUT_TURN_INTO_NAME,
  icon: FontIcon(),
  when: (std, models) => calloutConversionTargets(std.store, models).length > 0,
  run: (std, models) => {
    std.command.exec(turnIntoCalloutCommand, { models });
  },
};
