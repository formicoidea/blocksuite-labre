import { createIdentifier } from '@labre/global/di';
import type { ExtensionType } from '@labre/store';

/**
 * Registered by `DatabaseViewExtension` only (`./view.ts`): its presence says
 * the `database` tooling is on, so a rendered database offers "+ view". The
 * block reads it when it builds its data source and, absent, sets data-view's
 * `ViewCreationOffKey` on it (ADR 0035 §5). Its own file so the block reads it
 * without importing the view extensions, which import the block.
 */
export const DatabaseViewCreationIdentifier = createIdentifier<true>(
  'AffineDatabaseViewCreation'
);

export const DatabaseViewCreationExtension: ExtensionType = {
  setup: di => {
    di.override(DatabaseViewCreationIdentifier, () => true);
  },
};
